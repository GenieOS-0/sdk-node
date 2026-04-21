import test from 'node:test';
import assert from 'node:assert/strict';
import { signWebhook, verifyWebhook, WebhookVerificationError } from '../src/webhooks.js';

const SECRET = 'whsec_unit_test';

test('verifyWebhook accepts a freshly-signed envelope', () => {
  const body = JSON.stringify({
    id: 'whd_x',
    event: 'send.delivered',
    workspaceId: 'ws_1',
    occurredAt: Date.now(),
    data: { sendId: 'snd_1' },
  });
  const sig = signWebhook(SECRET, body);
  const event = verifyWebhook(body, { 'x-mailgenius-signature': sig }, SECRET);
  assert.equal(event.event, 'send.delivered');
});

test('verifyWebhook rejects a tampered body', () => {
  const body = JSON.stringify({ event: 'send.delivered' });
  const sig = signWebhook(SECRET, body);
  assert.throws(
    () => verifyWebhook(body + 'x', { 'x-mailgenius-signature': sig }, SECRET),
    (e: unknown) => e instanceof WebhookVerificationError && e.code === 'bad_signature',
  );
});

test('verifyWebhook rejects an out-of-window timestamp', () => {
  const body = JSON.stringify({ event: 'send.delivered' });
  const sig = signWebhook(SECRET, body, Math.floor(Date.now() / 1000) - 99999);
  assert.throws(
    () => verifyWebhook(body, { 'x-mailgenius-signature': sig }, SECRET),
    (e: unknown) => e instanceof WebhookVerificationError && e.code === 'replay_window',
  );
});

test('verifyWebhook handles Headers instances and array-valued headers', () => {
  const body = JSON.stringify({ event: 'send.opened' });
  const sig = signWebhook(SECRET, body);
  const headers = new Headers({ 'x-mailgenius-signature': sig });
  assert.doesNotThrow(() => verifyWebhook(body, headers, SECRET));
  assert.doesNotThrow(() => verifyWebhook(body, { 'X-MailGenius-Signature': [sig] }, SECRET));
});
