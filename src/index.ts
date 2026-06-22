/**
 * genieos — official Node / TypeScript SDK for GenieOS.
 *
 * Quickstart:
 *
 *   import { GenieOS } from 'genieos';
 *
 *   const mg = new GenieOS({ apiKey: process.env.MG_API_KEY! });
 *   await mg.templates.send('order.confirmation', {
 *     to: 'fan@example.com',
 *     variables: { firstName: 'Aki', orderId: 'A-1042' },
 *   });
 *
 * Webhook verification (lightweight, separate entry point):
 *
 *   import { verifyWebhook } from 'genieos/webhooks';
 *   const event = verifyWebhook(rawBody, headers, process.env.MG_WEBHOOK_SECRET!);
 */
export { GenieOS, type GenieOSOptions } from './client.js';
export { generateIdempotencyKey } from './transport.js';
export {
  GenieOSError,
  GenieOSAuthError,
  GenieOSRateLimitError,
  GenieOSValidationError,
  GenieOSIdempotencyConflictError,
  GenieOSNetworkError,
  type GenieOSErrorBody,
  type GenieOSErrorType,
} from './errors.js';
export type * from './types.js';
