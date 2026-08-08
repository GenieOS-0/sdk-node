// src/webhooks.ts
import { createHmac, timingSafeEqual } from "crypto";
var WebhookVerificationError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "WebhookVerificationError";
    this.code = code;
  }
};
function verifyWebhook(rawBody, headers, secret, opts = {}) {
  if (!secret) {
    throw new WebhookVerificationError("bad_signature", "Verifier secret not provided.");
  }
  const sigHeader = pickHeader(headers, "x-genieos-signature");
  if (!sigHeader) {
    throw new WebhookVerificationError("missing_signature", "X-GenieOS-Signature header is missing.");
  }
  const parts = parseSigHeader(sigHeader);
  if (!parts) {
    throw new WebhookVerificationError(
      "malformed_signature",
      'X-GenieOS-Signature is malformed; expected "t=<seconds>,v1=<hex>".'
    );
  }
  const tolerance = opts.toleranceSec ?? 300;
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1e3);
  if (Math.abs(nowSec - parts.t) > tolerance) {
    throw new WebhookVerificationError(
      "replay_window",
      `Signature timestamp outside ${tolerance}s tolerance window.`
    );
  }
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest();
  const provided = Buffer.from(parts.v1, "hex");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new WebhookVerificationError("bad_signature", "Signature mismatch.");
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new WebhookVerificationError("malformed_body", "Webhook body is not valid JSON.");
  }
}
function signWebhook(secret, body, t = Math.floor(Date.now() / 1e3)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}
function pickHeader(headers, name) {
  if (headers instanceof Headers) {
    return headers.get(name) ?? void 0;
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== lower) continue;
    if (Array.isArray(v)) return v[0];
    return v;
  }
  return void 0;
}
function parseSigHeader(header) {
  const map = {};
  for (const part of header.split(",")) {
    const [k, ...v] = part.trim().split("=");
    if (!k || v.length === 0) continue;
    map[k] = v.join("=");
  }
  const t = Number(map.t);
  const v1 = map.v1;
  if (!Number.isFinite(t) || !v1) return null;
  return { t, v1 };
}
export {
  WebhookVerificationError,
  signWebhook,
  verifyWebhook
};
