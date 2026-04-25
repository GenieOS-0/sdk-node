/**
 * mailgenius — official Node / TypeScript SDK for MailGenius.
 *
 * Quickstart:
 *
 *   import { MailGenius } from 'mailgenius';
 *
 *   const mg = new MailGenius({ apiKey: process.env.MG_API_KEY! });
 *   await mg.templates.send('order.confirmation', {
 *     to: 'fan@example.com',
 *     variables: { firstName: 'Aki', orderId: 'A-1042' },
 *   });
 *
 * Webhook verification (lightweight, separate entry point):
 *
 *   import { verifyWebhook } from 'mailgenius/webhooks';
 *   const event = verifyWebhook(rawBody, headers, process.env.MG_WEBHOOK_SECRET!);
 */
export { MailGenius, type MailGeniusOptions } from './client.js';
export { generateIdempotencyKey } from './transport.js';
export {
  MailGeniusError,
  MailGeniusAuthError,
  MailGeniusRateLimitError,
  MailGeniusValidationError,
  MailGeniusIdempotencyConflictError,
  MailGeniusNetworkError,
  type MailGeniusErrorBody,
  type MailGeniusErrorType,
} from './errors.js';
export type * from './types.js';
