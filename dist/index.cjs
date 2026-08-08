"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  GenieOS: () => GenieOS,
  GenieOSAuthError: () => GenieOSAuthError,
  GenieOSError: () => GenieOSError,
  GenieOSIdempotencyConflictError: () => GenieOSIdempotencyConflictError,
  GenieOSNetworkError: () => GenieOSNetworkError,
  GenieOSRateLimitError: () => GenieOSRateLimitError,
  GenieOSValidationError: () => GenieOSValidationError,
  generateIdempotencyKey: () => generateIdempotencyKey
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var GenieOSError = class extends Error {
  type;
  code;
  status;
  requestId;
  context;
  constructor(opts) {
    super(opts.message);
    this.name = "GenieOSError";
    this.type = opts.type;
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.context = opts.context;
  }
};
var GenieOSAuthError = class extends GenieOSError {
  constructor(opts) {
    super(opts);
    this.name = "GenieOSAuthError";
  }
};
var GenieOSRateLimitError = class extends GenieOSError {
  retryAfterSec;
  constructor(opts) {
    super(opts);
    this.name = "GenieOSRateLimitError";
    this.retryAfterSec = opts.retryAfterSec;
  }
};
var GenieOSValidationError = class extends GenieOSError {
  constructor(opts) {
    super(opts);
    this.name = "GenieOSValidationError";
  }
};
var GenieOSIdempotencyConflictError = class extends GenieOSError {
  constructor(opts) {
    super(opts);
    this.name = "GenieOSIdempotencyConflictError";
  }
};
var GenieOSNetworkError = class extends Error {
  cause;
  constructor(message, cause) {
    super(message);
    this.name = "GenieOSNetworkError";
    this.cause = cause;
  }
};

// src/transport.ts
var SDK_VERSION = "0.1.4";
var DEFAULT_BASE = "https://api.genieos.pro";
var RETRYABLE_STATUSES = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var Transport = class {
  apiKey;
  baseUrl;
  timeoutMs;
  maxRetries;
  initialBackoffMs;
  fetchImpl;
  defaultHeaders;
  userAgent;
  constructor(opts) {
    if (!opts.apiKey) throw new Error("GenieOS SDK: apiKey is required.");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 3e4;
    this.maxRetries = opts.maxRetries ?? 3;
    this.initialBackoffMs = opts.initialBackoffMs ?? 200;
    this.fetchImpl = opts.fetch ?? fetch;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    const tag = opts.appName ? `${opts.appName}${opts.appVersion ? `/${opts.appVersion}` : ""}` : "";
    this.userAgent = `genieos-node/${SDK_VERSION}${tag ? " " + tag : ""}`;
  }
  async request(opts) {
    const url = this.buildUrl(opts.path, opts.query);
    const headers = this.buildHeaders(opts);
    const bodyString = opts.body !== void 0 && opts.method !== "GET" && opts.method !== "DELETE" ? JSON.stringify(opts.body) : void 0;
    const maxRetries = opts.maxRetries ?? this.maxRetries;
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const signal = opts.signal ? mergeSignals(controller.signal, opts.signal) : controller.signal;
      try {
        const res = await this.fetchImpl(url, {
          method: opts.method,
          headers,
          body: bodyString,
          signal
        });
        clearTimeout(timer);
        if (res.status >= 200 && res.status < 300) {
          if (res.status === 204) return void 0;
          return await safeJson(res);
        }
        const requestId = res.headers.get("x-request-id") ?? void 0;
        const errBody = await parseErrorBody(res);
        const err = buildError(res.status, errBody, requestId, res.headers);
        if (RETRYABLE_STATUSES.has(res.status) && attempt < maxRetries) {
          lastError = err;
          await sleep(this.backoffFor(attempt, res.headers.get("retry-after")));
          continue;
        }
        throw err;
      } catch (e) {
        clearTimeout(timer);
        if (e instanceof GenieOSError) throw e;
        const isAbort = e.name === "AbortError";
        const wrapped = new GenieOSNetworkError(
          isAbort ? `Request timed out after ${timeoutMs}ms` : `Network error: ${e.message}`,
          e
        );
        if (attempt < maxRetries) {
          lastError = wrapped;
          await sleep(this.backoffFor(attempt));
          continue;
        }
        throw wrapped;
      }
    }
    throw lastError ?? new Error("GenieOS SDK: exhausted retries with no captured error");
  }
  buildUrl(path, query) {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === void 0 || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
  buildHeaders(opts) {
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "User-Agent": this.userAgent,
      ...this.defaultHeaders,
      ...opts.headers
    };
    if (opts.body !== void 0 && opts.method !== "GET" && opts.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
    }
    if (isMutatingMethod(opts.method)) {
      headers["Idempotency-Key"] = opts.idempotencyKey ?? generateIdempotencyKey();
    }
    return headers;
  }
  backoffFor(attempt, retryAfter) {
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed * 1e3;
    }
    const base = this.initialBackoffMs * Math.pow(2, attempt);
    const jitter = Math.random() * base * 0.25;
    return base + jitter;
  }
};
function isMutatingMethod(method) {
  return method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
}
function generateIdempotencyKey() {
  const t = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `gos_${t}_${rand}`;
}
function buildError(status, body, requestId, headers) {
  const ctx = { status, code: body.code, message: body.message, type: body.type, requestId, context: body.context };
  if (status === 401 || status === 403) return new GenieOSAuthError(ctx);
  if (status === 409 && body.code === "idempotency_conflict") {
    return new GenieOSIdempotencyConflictError(ctx);
  }
  if (status === 422 || status === 400) return new GenieOSValidationError(ctx);
  if (status === 429) {
    const ra = headers.get("retry-after");
    return new GenieOSRateLimitError({
      ...ctx,
      retryAfterSec: ra ? Number(ra) : void 0
    });
  }
  return new GenieOSError(ctx);
}
async function parseErrorBody(res) {
  try {
    const json = await res.json();
    if (json.error) return json.error;
  } catch {
  }
  return {
    type: "api_error",
    code: `http_${res.status}`,
    message: `HTTP ${res.status} ${res.statusText}`.trim()
  };
}
async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function mergeSignals(a, b) {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const fwd = (signal) => () => ctrl.abort(signal.reason);
  a.addEventListener("abort", fwd(a), { once: true });
  b.addEventListener("abort", fwd(b), { once: true });
  return ctrl.signal;
}

// src/client.ts
var GenieOS = class {
  transport;
  workspace;
  templates;
  sequences;
  events;
  webhooks;
  keys;
  audit;
  brand;
  pages;
  connectors;
  /** Transactional SMS — `/v1/messaging/transactional/*`. */
  messaging;
  /** Alias of `messaging` for callers who think in SMS. */
  sms;
  /** Organic + transactional social. */
  social;
  marketing;
  creations;
  lists;
  approvals;
  links;
  qr;
  /** Alias of `sequences` for callers raised on the legacy "flows" name. */
  flows;
  constructor(opts) {
    this.transport = new Transport(opts);
    this.workspace = new WorkspaceResource(this.transport);
    this.templates = new TemplatesResource(this.transport);
    this.sequences = new SequencesResource(this.transport);
    this.flows = this.sequences;
    this.events = new EventsResource(this.transport);
    this.webhooks = new WebhooksResource(this.transport);
    this.keys = new KeysResource(this.transport);
    this.audit = new AuditResource(this.transport);
    this.brand = new BrandResource(this.transport);
    this.pages = new PagesResource(this.transport);
    this.connectors = new ConnectorsResource(this.transport);
    this.messaging = new MessagingResource(this.transport);
    this.sms = this.messaging;
    this.social = new SocialResource(this.transport);
    this.marketing = new MarketingResource(this.transport);
    this.creations = new CreationsResource(this.transport);
    this.lists = new ListsResource(this.transport);
    this.approvals = new ApprovalsResource(this.transport);
    this.links = new LinksResource(this.transport);
    this.qr = new QrResource(this.transport);
  }
  /**
   * Escape hatch — issue a raw request against the API. Useful for
   * preview features that haven't been promoted to a typed resource.
   */
  request(opts) {
    return this.transport.request(opts);
  }
};
var WorkspaceResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  /** GET /v1/workspace — resolves the bearer token's home workspace. */
  get() {
    return this.t.request({ method: "GET", path: "/v1/workspace" });
  }
};
var PagesResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  /** GET /v1/pages — list landing pages (read-only; blueprints excluded). */
  list() {
    return this.t.request({ method: "GET", path: "/v1/pages" }).then((r) => r.data);
  }
  /** Async iterator over every page in the workspace. */
  async *iter() {
    const items = await this.list();
    for (const item of items) yield item;
  }
  /** GET /v1/pages/:idOrSlug — one page's metadata + section summary. */
  get(idOrSlug) {
    return this.t.request({
      method: "GET",
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}`
    });
  }
  compose(idOrSlug, body) {
    return this.t.request({
      method: "POST",
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}/compose`,
      body
    });
  }
  publish(idOrSlug, body = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}/publish`,
      body
    }).then((r) => r.data);
  }
  unpublish(idOrSlug) {
    return this.t.request({
      method: "POST",
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}/unpublish`,
      body: {}
    });
  }
};
var TemplatesResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list() {
    return this.t.request({ method: "GET", path: "/v1/templates" }).then((r) => r.data);
  }
  /**
   * Async iterator over every template in the workspace. The REST
   * endpoint does not paginate today (workspaces have O(100) templates),
   * but we expose the iterator now so SDK users don't have to migrate
   * when cursors land.
   */
  async *iter() {
    const items = await this.list();
    for (const item of items) yield item;
  }
  get(key) {
    return this.t.request({
      method: "GET",
      path: `/v1/templates/${encodeURIComponent(key)}`
    });
  }
  /** Create a blank draft email template. */
  create(body = {}) {
    return this.t.request({ method: "POST", path: "/v1/templates", body }).then((r) => r.data);
  }
  /** Compose from a brief and persist. Charges compose-template credits. */
  compose(body) {
    return this.t.request({ method: "POST", path: "/v1/templates/compose", body }).then((r) => r.data);
  }
  render(key, body = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/templates/${encodeURIComponent(key)}/render`,
      body
    });
  }
  send(key, body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/templates/${encodeURIComponent(key)}/send`,
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
  schema(key) {
    return this.t.request({
      method: "GET",
      path: `/v1/templates/${encodeURIComponent(key)}/schema`
    });
  }
};
var SequencesResource = class {
  constructor(t) {
    this.t = t;
    this.runs = new SequenceRunsResource(t);
  }
  t;
  runs;
  list() {
    return this.t.request({ method: "GET", path: "/v1/sequences" }).then((r) => r.data);
  }
  get(keyOrId) {
    return this.t.request({
      method: "GET",
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}`
    });
  }
  patchGraph(keyOrId, body, opts = {}) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}/graph`,
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
  simulate(keyOrId, body) {
    return this.t.request({
      method: "POST",
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}/simulate`,
      body
    }).then((response) => response.data);
  }
  listRuns(keyOrId, opts = {}) {
    return this.t.request({
      method: "GET",
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}/runs`,
      query: { limit: opts.limit }
    }).then((r) => r.data);
  }
  enroll(keyOrId, body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}/enroll`,
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
};
var SequenceRunsResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  get(runId) {
    return this.t.request({
      method: "GET",
      path: `/v1/sequence-runs/${encodeURIComponent(runId)}`
    });
  }
  cancel(runId) {
    return this.t.request({
      method: "POST",
      path: `/v1/sequence-runs/${encodeURIComponent(runId)}/cancel`
    });
  }
  act(runId, body) {
    return this.t.request({
      method: "POST",
      path: `/v1/sequence-runs/${encodeURIComponent(runId)}/actions`,
      body
    });
  }
};
var EventsResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  emit(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/events",
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
};
var WebhooksResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list() {
    return this.t.request({ method: "GET", path: "/v1/webhooks" }).then((r) => r.data);
  }
  get(id) {
    return this.t.request({
      method: "GET",
      path: `/v1/webhooks/${encodeURIComponent(id)}`
    });
  }
  create(body) {
    return this.t.request({
      method: "POST",
      path: "/v1/webhooks",
      body
    });
  }
  update(id, body) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/webhooks/${encodeURIComponent(id)}`,
      body
    });
  }
  delete(id) {
    return this.t.request({
      method: "DELETE",
      path: `/v1/webhooks/${encodeURIComponent(id)}`
    });
  }
};
var KeysResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list() {
    return this.t.request({ method: "GET", path: "/v1/keys" }).then((r) => r.data);
  }
  get(id) {
    return this.t.request({ method: "GET", path: `/v1/keys/${encodeURIComponent(id)}` });
  }
};
var AuditResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/audit",
      query: { limit: opts.limit }
    }).then((r) => r.data);
  }
};
var BrandResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list() {
    return this.t.request({ method: "GET", path: "/v1/brand" }).then((r) => r.data);
  }
  get(idOrDefault = "default") {
    return this.t.request({ method: "GET", path: `/v1/brand/${encodeURIComponent(idOrDefault)}` });
  }
};
var ConnectorsResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  /** Public catalog — no auth required, but the SDK call still
   *  attaches the bearer token (the API ignores it for this route). */
  catalog() {
    return this.t.request({ method: "GET", path: "/v1/connectors/catalog" });
  }
  list() {
    return this.t.request({ method: "GET", path: "/v1/connectors" });
  }
};
var MessagingResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  /** GET /v1/messaging/transactional/kit — workspace SMS template views. */
  kit() {
    return this.t.request({
      method: "GET",
      path: "/v1/messaging/transactional/kit"
    }).then((r) => r.data);
  }
  /** GET /v1/messaging/transactional/catalog — platform SMS definitions. */
  catalog() {
    return this.t.request({
      method: "GET",
      path: "/v1/messaging/transactional/catalog"
    }).then((r) => r.data);
  }
  preview(body) {
    return this.t.request({
      method: "POST",
      path: "/v1/messaging/transactional/preview",
      body
    });
  }
  send(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/messaging/transactional",
      body,
      idempotencyKey: opts.idempotencyKey ?? body.idempotencyKey
    });
  }
  listDeliveries(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/messaging/transactional/deliveries",
      query: { templateKey: opts.templateKey, limit: opts.limit }
    }).then((r) => Array.isArray(r) ? r : r.data ?? []);
  }
};
var SocialResource = class {
  constructor(t) {
    this.t = t;
    this.transactional = new TransactionalSocialResource(t);
  }
  t;
  transactional;
  /** Company-only connected networks (`{ profileStatus, networks }`). */
  listNetworks() {
    return this.t.request({
      method: "GET",
      path: "/v1/social/networks"
    });
  }
  refreshNetworks() {
    return this.t.request({ method: "POST", path: "/v1/social/networks/refresh" });
  }
  list(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/social/posts",
      query: {
        status: opts.status,
        channelId: opts.channelId,
        groupId: opts.groupId,
        from: opts.from,
        to: opts.to,
        limit: opts.limit
      }
    }).then((r) => Array.isArray(r) ? r : r.data ?? []);
  }
  get(postId) {
    return this.t.request({
      method: "GET",
      path: `/v1/social/posts/${encodeURIComponent(postId)}`
    }).then((r) => r.data);
  }
  create(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/social/posts",
      body,
      idempotencyKey: opts.idempotencyKey ?? body.idempotencyKey
    });
  }
  update(postId, body) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/social/posts/${encodeURIComponent(postId)}`,
      body
    }).then((r) => r.data);
  }
  schedule(postId, body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/social/posts/${encodeURIComponent(postId)}/schedule`,
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
  publish(postId, body = {}, opts = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/social/posts/${encodeURIComponent(postId)}/publish`,
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
  delete(postId, opts = {}) {
    return this.t.request({
      method: "DELETE",
      path: `/v1/social/posts/${encodeURIComponent(postId)}`,
      query: opts.fromProvider ? { fromProvider: "true" } : void 0
    });
  }
  analytics(postId, opts = {}) {
    return this.t.request({
      method: "GET",
      path: `/v1/social/posts/${encodeURIComponent(postId)}/analytics`,
      query: opts.refresh ? { refresh: "true" } : void 0
    });
  }
};
var MarketingResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  strategy(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/marketing/strategy",
      query: opts.detail === "full" ? { detail: "full" } : void 0
    });
  }
  listIcps(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/marketing/icps",
      query: opts.detail === "full" ? { detail: "full" } : void 0
    }).then((r) => r.data);
  }
  getIcp(icpId) {
    return this.t.request({
      method: "GET",
      path: `/v1/marketing/icps/${encodeURIComponent(icpId)}`
    }).then((r) => r.data);
  }
  creationDefaults() {
    return this.t.request({
      method: "GET",
      path: "/v1/marketing/creation-defaults"
    }).then((r) => r.data);
  }
  patchStrategy(patch) {
    return this.t.request({
      method: "PATCH",
      path: "/v1/marketing/strategy",
      body: { patch }
    });
  }
  setCreationDefaults(body) {
    return this.t.request({
      method: "PATCH",
      path: "/v1/marketing/creation-defaults",
      body
    });
  }
  createIcp(body) {
    return this.t.request({ method: "POST", path: "/v1/marketing/icps", body });
  }
  updateIcp(icpId, body) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/marketing/icps/${encodeURIComponent(icpId)}`,
      body
    });
  }
};
var CreationsResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/creations",
      query: { status: opts.status, limit: opts.limit }
    }).then((r) => r.data);
  }
  get(creationId, opts = {}) {
    return this.t.request({
      method: "GET",
      path: `/v1/creations/${encodeURIComponent(creationId)}`,
      query: opts.detail === "full" ? { detail: "full" } : void 0
    }).then((r) => r.data);
  }
  spawn(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/creations",
      body,
      idempotencyKey: opts.idempotencyKey
    });
  }
  approveStrategy(creationId) {
    return this.t.request({
      method: "POST",
      path: `/v1/creations/${encodeURIComponent(creationId)}/approve-strategy`,
      body: {}
    });
  }
};
var ListsResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list() {
    return this.t.request({ method: "GET", path: "/v1/lists" }).then((r) => r.data);
  }
  get(listId) {
    return this.t.request({
      method: "GET",
      path: `/v1/lists/${encodeURIComponent(listId)}`
    }).then((r) => r.data);
  }
  create(body) {
    return this.t.request({ method: "POST", path: "/v1/lists", body }).then((r) => r.data);
  }
  update(listId, body) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/lists/${encodeURIComponent(listId)}`,
      body
    }).then((r) => r.data);
  }
  delete(listId) {
    return this.t.request({
      method: "DELETE",
      path: `/v1/lists/${encodeURIComponent(listId)}`
    });
  }
  addMembers(listId, contactIds) {
    return this.t.request({
      method: "POST",
      path: `/v1/lists/${encodeURIComponent(listId)}/members`,
      body: { contactIds }
    }).then((r) => r.data);
  }
  removeMembers(listId, contactIds) {
    return this.t.request({
      method: "POST",
      path: `/v1/lists/${encodeURIComponent(listId)}/members/remove`,
      body: { contactIds }
    }).then((r) => r.data);
  }
};
var ApprovalsResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  listPolicies() {
    return this.t.request({ method: "GET", path: "/v1/approvals/policies" }).then((r) => r.data);
  }
  listPending(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/approvals/pending",
      query: { limit: opts.limit }
    }).then((r) => r.data);
  }
  managePolicy(surfaceKind, body) {
    return this.t.request({
      method: "PUT",
      path: `/v1/approvals/policies/${encodeURIComponent(surfaceKind)}`,
      body
    });
  }
  decide(requestId, body) {
    return this.t.request({
      method: "POST",
      path: `/v1/approvals/pending/${encodeURIComponent(requestId)}/decide`,
      body
    });
  }
};
var LinksResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  list(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/links",
      query: {
        includeArchived: opts.includeArchived ? "true" : void 0,
        limit: opts.limit
      }
    }).then((r) => r.data);
  }
  utmSuggestions(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/links/utm-suggestions",
      query: {
        field: opts.field,
        includeCounts: opts.includeCounts === false ? "false" : void 0
      }
    }).then((r) => r.data);
  }
  create(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/links",
      body,
      idempotencyKey: opts.idempotencyKey
    }).then((r) => r.data);
  }
  /** Read one short link by id — full detail including routeRules,
   *  whether a password is set, and the schedule window (`list()`
   *  omits these for brevity). */
  get(linkId) {
    return this.t.request({
      method: "GET",
      path: `/v1/links/${encodeURIComponent(linkId)}`
    }).then((r) => r.data);
  }
  /** Free edits to an existing short link — destination, label, tags,
   *  utm, routeRules, schedule, and password. */
  update(linkId, body) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/links/${encodeURIComponent(linkId)}`,
      body
    }).then((r) => r.data);
  }
  /** Short-link click analytics — cache-first (5-minute TTL); cache
   *  hits are free, misses charge credits per event scanned. Requires
   *  Glow tier or above. */
  analytics(opts) {
    return this.t.request({
      method: "GET",
      path: "/v1/links/analytics",
      query: {
        cardKey: opts.cardKey,
        linkId: opts.linkId,
        days: opts.days,
        forceRefresh: opts.forceRefresh ? "true" : void 0
      }
    }).then((r) => r.data);
  }
};
var QrResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  /** Create a brand-styled QR design (1 credit). Does not render
   *  bytes — call `render()` afterwards for SVG/PNG/WebP/PDF. */
  create(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/qr",
      body,
      idempotencyKey: opts.idempotencyKey
    }).then((r) => r.data);
  }
  /** Free edits to an existing QR design — style, frame, label, tags.
   *  Does not re-render bytes; call `render()` afterwards for a fresh
   *  preview/download. */
  update(qrId, body) {
    return this.t.request({
      method: "PATCH",
      path: `/v1/qr/${encodeURIComponent(qrId)}`,
      body
    }).then((r) => r.data);
  }
  /** Render a QR design to bytes. svg/png/webp are free; png-print
   *  costs 2 credits, pdf costs 5. Pass `saveToAssets: true` to also
   *  write the render into the workspace Asset Manager. */
  render(qrId, body = {}) {
    return this.t.request({
      method: "POST",
      path: `/v1/qr/${encodeURIComponent(qrId)}/render`,
      body
    }).then((r) => r.data);
  }
};
var TransactionalSocialResource = class {
  constructor(t) {
    this.t = t;
  }
  t;
  catalog() {
    return this.t.request({
      method: "GET",
      path: "/v1/social/transactional/catalog"
    }).then((r) => r.data);
  }
  listTemplates() {
    return this.t.request({
      method: "GET",
      path: "/v1/social/transactional/templates"
    }).then((r) => r.data);
  }
  preview(body) {
    return this.t.request({
      method: "POST",
      path: "/v1/social/transactional/preview",
      body
    });
  }
  trigger(body, opts = {}) {
    return this.t.request({
      method: "POST",
      path: "/v1/social/transactional/events",
      body,
      idempotencyKey: opts.idempotencyKey ?? body.idempotencyKey
    });
  }
  listEvents(opts = {}) {
    return this.t.request({
      method: "GET",
      path: "/v1/social/transactional/events",
      query: { eventKey: opts.eventKey, limit: opts.limit }
    }).then((r) => r.data);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GenieOS,
  GenieOSAuthError,
  GenieOSError,
  GenieOSIdempotencyConflictError,
  GenieOSNetworkError,
  GenieOSRateLimitError,
  GenieOSValidationError,
  generateIdempotencyKey
});
