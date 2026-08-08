import { av as WebhookDeliveryEnvelope } from './types-C-2xdZiV.cjs';
export { aw as WebhookEventName } from './types-C-2xdZiV.cjs';

declare class WebhookVerificationError extends Error {
    readonly code: 'missing_signature' | 'malformed_signature' | 'replay_window' | 'bad_signature' | 'malformed_body';
    constructor(code: WebhookVerificationError['code'], message: string);
}
interface VerifyOptions {
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
declare function verifyWebhook<TData = unknown>(rawBody: string, headers: HeaderBag, secret: string, opts?: VerifyOptions): WebhookDeliveryEnvelope<TData>;
/**
 * Compute the signature header for a given body + secret. Useful for
 * tests, replays, and for tools that want to forge known-good
 * payloads against a development webhook handler.
 */
declare function signWebhook(secret: string, body: string, t?: number): string;
type HeaderBag = Record<string, string | string[] | undefined> | Headers;

export { type VerifyOptions, WebhookDeliveryEnvelope, WebhookVerificationError, signWebhook, verifyWebhook };
