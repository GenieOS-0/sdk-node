/**
 * Webhook verification helpers.
 *
 * Mirrors the signing scheme implemented server-side in
 * `functions/src/lib/webhookDelivery.ts`:
 *
 *   X-GenieOS-Signature: t=<unix-seconds>,v1=<hex(hmac-sha256(secret, t.body))>
 *
 * Usage (Express):
 *
 *   import express from 'express';
 *   import { verifyWebhook } from '@genie-os/sdk/webhooks';
 *
 *   app.post('/genieos/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *     try {
 *       const event = verifyWebhook(
 *         req.body.toString('utf8'),
 *         req.headers,
 *         process.env.GENIEOS_WEBHOOK_SECRET!,
 *       );
 *       // event is the parsed envelope: { id, event, workspaceId, occurredAt, data }
 *       // ... your handler
 *       res.json({ ok: true });
 *     } catch (e) {
 *       res.status(401).json({ error: (e as Error).message });
 *     }
 *   });
 *
 * Constant-time comparison and a configurable replay-tolerance window
 * (default 5 minutes) ship by default — both essential for signed-webhook
 * security.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookDeliveryEnvelope, WebhookEventName } from './types.js';

export class WebhookVerificationError extends Error {
  readonly code:
    | 'missing_signature'
    | 'malformed_signature'
    | 'replay_window'
    | 'bad_signature'
    | 'malformed_body';
  constructor(code: WebhookVerificationError['code'], message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
    this.code = code;
  }
}

export interface VerifyOptions {
  /** Replay tolerance in seconds. Default 300 (5 minutes). */
  toleranceSec?: number;
  /** Override the wall-clock for tests. */
  now?: () => number;
}

/**
 * Verify an inbound GenieOS webhook delivery and return the parsed
 * envelope. Throws `WebhookVerificationError` on any failure mode.
 *
 * `headers` may be the raw header bag from any framework (Express,
 * Hono, Fastify, Next.js Edge, …) — both string and string[] values
 * are accepted.
 */
export function verifyWebhook<TData = unknown>(
  rawBody: string,
  headers: HeaderBag,
  secret: string,
  opts: VerifyOptions = {},
): WebhookDeliveryEnvelope<TData> {
  if (!secret) {
    throw new WebhookVerificationError('bad_signature', 'Verifier secret not provided.');
  }
  const sigHeader = pickHeader(headers, 'x-genieos-signature');
  if (!sigHeader) {
    throw new WebhookVerificationError('missing_signature', 'X-GenieOS-Signature header is missing.');
  }
  const parts = parseSigHeader(sigHeader);
  if (!parts) {
    throw new WebhookVerificationError(
      'malformed_signature',
      'X-GenieOS-Signature is malformed; expected "t=<seconds>,v1=<hex>".',
    );
  }
  const tolerance = opts.toleranceSec ?? 300;
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  if (Math.abs(nowSec - parts.t) > tolerance) {
    throw new WebhookVerificationError(
      'replay_window',
      `Signature timestamp outside ${tolerance}s tolerance window.`,
    );
  }
  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest();
  const provided = Buffer.from(parts.v1, 'hex');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new WebhookVerificationError('bad_signature', 'Signature mismatch.');
  }
  try {
    return JSON.parse(rawBody) as WebhookDeliveryEnvelope<TData>;
  } catch {
    throw new WebhookVerificationError('malformed_body', 'Webhook body is not valid JSON.');
  }
}

/**
 * Compute the signature header for a given body + secret. Useful for
 * tests, replays, and for tools that want to forge known-good
 * payloads against a development webhook handler.
 */
export function signWebhook(secret: string, body: string, t: number = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

/* ---------- internals ---------- */

type HeaderBag = Record<string, string | string[] | undefined> | Headers;

function pickHeader(headers: HeaderBag, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  // Frameworks lowercase headers; do a case-insensitive lookup.
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== lower) continue;
    if (Array.isArray(v)) return v[0];
    return v;
  }
  return undefined;
}

function parseSigHeader(header: string): { t: number; v1: string } | null {
  const map: Record<string, string> = {};
  for (const part of header.split(',')) {
    const [k, ...v] = part.trim().split('=');
    if (!k || v.length === 0) continue;
    map[k] = v.join('=');
  }
  const t = Number(map.t);
  const v1 = map.v1;
  if (!Number.isFinite(t) || !v1) return null;
  return { t, v1 };
}

/** Re-export the event-name union so handlers can switch exhaustively. */
export type { WebhookDeliveryEnvelope, WebhookEventName };
