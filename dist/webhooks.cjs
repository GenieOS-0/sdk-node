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

// src/webhooks.ts
var webhooks_exports = {};
__export(webhooks_exports, {
  WebhookVerificationError: () => WebhookVerificationError,
  signWebhook: () => signWebhook,
  verifyWebhook: () => verifyWebhook
});
module.exports = __toCommonJS(webhooks_exports);
var import_node_crypto = require("crypto");
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
  const expected = (0, import_node_crypto.createHmac)("sha256", secret).update(`${parts.t}.${rawBody}`).digest();
  const provided = Buffer.from(parts.v1, "hex");
  if (expected.length !== provided.length || !(0, import_node_crypto.timingSafeEqual)(expected, provided)) {
    throw new WebhookVerificationError("bad_signature", "Signature mismatch.");
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new WebhookVerificationError("malformed_body", "Webhook body is not valid JSON.");
  }
}
function signWebhook(secret, body, t = Math.floor(Date.now() / 1e3)) {
  const v1 = (0, import_node_crypto.createHmac)("sha256", secret).update(`${t}.${body}`).digest("hex");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WebhookVerificationError,
  signWebhook,
  verifyWebhook
});
