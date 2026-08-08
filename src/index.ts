/**
 * @genie-os/sdk — official Node / TypeScript SDK for GenieOS.
 *
 * Quickstart:
 *
 *   import { GenieOS } from '@genie-os/sdk';
 *
 *   // Keys: gos_live_* (production) or gos_test_* (sandbox)
 *   const gos = new GenieOS({ apiKey: process.env.GENIEOS_API_KEY! });
 *   await gos.templates.send('order.confirmation', {
 *     to: 'fan@example.com',
 *     variables: { firstName: 'Aki', orderId: 'A-1042' },
 *   });
 *
 * Webhook verification (lightweight, separate entry point):
 *
 *   import { verifyWebhook } from '@genie-os/sdk/webhooks';
 *   const event = verifyWebhook(rawBody, headers, process.env.GENIEOS_WEBHOOK_SECRET!);
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
