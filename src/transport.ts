/**
 * Low-level HTTP transport for the MailGenius SDK.
 *
 * Responsibilities:
 *
 *   - Bearer auth header injection.
 *   - Idempotency-Key auto-generation for mutating verbs (POST/PATCH/PUT/DELETE)
 *     unless the caller passes one explicitly. Generated keys are
 *     `mgi_<base36-millis><base36-random>` so they're easy to grep
 *     in customer logs.
 *   - Exponential-backoff retries for network failures and 5xx /
 *     429 responses, honouring `Retry-After` when present.
 *   - Typed error parsing — any non-2xx response is thrown as a
 *     subclass of `MailGeniusError`.
 *   - User-Agent stamping (helps server-side support triage).
 *   - Request fingerprinting via `requestId` echoed in errors.
 *
 * Designed for native `fetch` (Node ≥ 18). No runtime deps.
 */
import {
  MailGeniusAuthError,
  MailGeniusError,
  MailGeniusIdempotencyConflictError,
  MailGeniusNetworkError,
  MailGeniusRateLimitError,
  MailGeniusValidationError,
  type MailGeniusErrorBody,
} from './errors.js';

export interface TransportOptions {
  /**
   * API key — either `mg_live_*` (production), `mg_test_*` (sandbox), or
   * the legacy `mfk_live_*` shape. Treated opaquely.
   */
  apiKey: string;
  /** Defaults to `https://api.mailgenius.app`. */
  baseUrl?: string;
  /** Per-request timeout, default 30s. */
  timeoutMs?: number;
  /** Max retry attempts for retryable failures, default 3. */
  maxRetries?: number;
  /** Initial backoff, default 200ms. Doubles per retry. */
  initialBackoffMs?: number;
  /** Optional fetch override — handy for tests + Cloudflare Workers. */
  fetch?: typeof fetch;
  /** Extra static headers (e.g. tracing). */
  defaultHeaders?: Record<string, string>;
  /** Free-form integration label appended to the User-Agent. */
  appName?: string;
  /** Free-form integration version appended to the User-Agent. */
  appVersion?: string;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Caller-supplied idempotency key. Beats the auto-generated default. */
  idempotencyKey?: string;
  /** Forwarded as-is. */
  headers?: Record<string, string>;
  /** Per-request timeout override. */
  timeoutMs?: number;
  /** Per-request retry override. */
  maxRetries?: number;
  /** AbortSignal for caller-driven cancellation (chained with timeout). */
  signal?: AbortSignal;
}

const SDK_VERSION = '0.1.0';
const DEFAULT_BASE = 'https://api.mailgenius.app';
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export class Transport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly userAgent: string;

  constructor(opts: TransportOptions) {
    if (!opts.apiKey) throw new Error('MailGenius SDK: apiKey is required.');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.initialBackoffMs = opts.initialBackoffMs ?? 200;
    this.fetchImpl = opts.fetch ?? fetch;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    const tag = opts.appName
      ? `${opts.appName}${opts.appVersion ? `/${opts.appVersion}` : ''}`
      : '';
    this.userAgent = `mailgenius-node/${SDK_VERSION}${tag ? ' ' + tag : ''}`;
  }

  async request<T>(opts: RequestOptions): Promise<T> {
    const url = this.buildUrl(opts.path, opts.query);
    const headers = this.buildHeaders(opts);
    const bodyString =
      opts.body !== undefined && opts.method !== 'GET' && opts.method !== 'DELETE'
        ? JSON.stringify(opts.body)
        : undefined;

    const maxRetries = opts.maxRetries ?? this.maxRetries;
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const signal = opts.signal
        ? mergeSignals(controller.signal, opts.signal)
        : controller.signal;

      try {
        const res = await this.fetchImpl(url, {
          method: opts.method,
          headers,
          body: bodyString,
          signal,
        });
        clearTimeout(timer);

        if (res.status >= 200 && res.status < 300) {
          if (res.status === 204) return undefined as T;
          return (await safeJson(res)) as T;
        }

        // Non-2xx — parse error envelope.
        const requestId = res.headers.get('x-request-id') ?? undefined;
        const errBody = await parseErrorBody(res);
        const err = buildError(res.status, errBody, requestId, res.headers);

        // Retryable?
        if (RETRYABLE_STATUSES.has(res.status) && attempt < maxRetries) {
          lastError = err;
          await sleep(this.backoffFor(attempt, res.headers.get('retry-after')));
          continue;
        }
        throw err;
      } catch (e) {
        clearTimeout(timer);
        // Already a typed error → either re-throw or retry handled above.
        if (e instanceof MailGeniusError) throw e;
        // Network / abort.
        const isAbort = (e as { name?: string }).name === 'AbortError';
        const wrapped = new MailGeniusNetworkError(
          isAbort ? `Request timed out after ${timeoutMs}ms` : `Network error: ${(e as Error).message}`,
          e,
        );
        if (attempt < maxRetries) {
          lastError = wrapped;
          await sleep(this.backoffFor(attempt));
          continue;
        }
        throw wrapped;
      }
    }
    // Defensive — shouldn't be reachable.
    throw lastError ?? new Error('MailGenius SDK: exhausted retries with no captured error');
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private buildHeaders(opts: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': this.userAgent,
      ...this.defaultHeaders,
      ...opts.headers,
    };
    if (opts.body !== undefined && opts.method !== 'GET' && opts.method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
    }
    if (isMutatingMethod(opts.method)) {
      headers['Idempotency-Key'] = opts.idempotencyKey ?? generateIdempotencyKey();
    }
    return headers;
  }

  private backoffFor(attempt: number, retryAfter?: string | null): number {
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed * 1000;
    }
    const base = this.initialBackoffMs * Math.pow(2, attempt);
    const jitter = Math.random() * base * 0.25;
    return base + jitter;
  }
}

function isMutatingMethod(method: string): boolean {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

export function generateIdempotencyKey(): string {
  const t = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mgi_${t}_${rand}`;
}

function buildError(
  status: number,
  body: MailGeniusErrorBody,
  requestId: string | undefined,
  headers: Headers,
): MailGeniusError {
  const ctx = { status, code: body.code, message: body.message, type: body.type, requestId, context: body.context };
  if (status === 401 || status === 403) return new MailGeniusAuthError(ctx);
  if (status === 409 && body.code === 'idempotency_conflict') {
    return new MailGeniusIdempotencyConflictError(ctx);
  }
  if (status === 422 || status === 400) return new MailGeniusValidationError(ctx);
  if (status === 429) {
    const ra = headers.get('retry-after');
    return new MailGeniusRateLimitError({
      ...ctx,
      retryAfterSec: ra ? Number(ra) : undefined,
    });
  }
  return new MailGeniusError(ctx);
}

async function parseErrorBody(res: Response): Promise<MailGeniusErrorBody> {
  try {
    const json = (await res.json()) as { error?: MailGeniusErrorBody };
    if (json.error) return json.error;
  } catch {
    // fall through
  }
  return {
    type: 'api_error',
    code: `http_${res.status}`,
    message: `HTTP ${res.status} ${res.statusText}`.trim(),
  };
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const fwd = (signal: AbortSignal) => () => ctrl.abort(signal.reason);
  a.addEventListener('abort', fwd(a), { once: true });
  b.addEventListener('abort', fwd(b), { once: true });
  return ctrl.signal;
}
