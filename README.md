# @mailgenius/sdk

Official TypeScript / Node.js SDK for the [MailGenius](https://mailgenius.pro) API.

```bash
npm add @mailgenius/sdk
# or: pnpm add @mailgenius/sdk · yarn add @mailgenius/sdk
```

## Quickstart

```ts
import { MailGenius } from '@mailgenius/sdk';

const mg = new MailGenius({ apiKey: process.env.MG_API_KEY! });

await mg.templates.send('order.confirmation', {
  to: 'fan@example.com',
  variables: { firstName: 'Aki', orderId: 'A-1042' },
});

await mg.events.emit({
  name: 'subscription.cancelled',
  userId: 'usr_4',
  email: 'fan@example.com',
  traits: { plan: 'pro' },
});
```

The client auto-retries network failures, 429s, and 5xx responses with
exponential backoff and honours `Retry-After`. It also generates an
`Idempotency-Key` header for every mutating request so the dedup
window on the server (24h, per workspace per key) works out-of-the-box.

## Verifying webhooks

```ts
import express from 'express';
import { verifyWebhook } from '@mailgenius/sdk/webhooks';

const app = express();

app.post('/mg-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = verifyWebhook(req.body.toString('utf8'), req.headers, process.env.MG_WEBHOOK_SECRET!);
    switch (event.event) {
      case 'send.delivered':
        // ...
        break;
      case 'sequence_run.advanced':
        // ...
        break;
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(401).json({ error: (e as Error).message });
  }
});
```

## Error handling

```ts
import { MailGeniusRateLimitError, MailGeniusValidationError } from '@mailgenius/sdk';

try {
  await mg.templates.send('order.confirmation', { to: 'invalid' });
} catch (e) {
  if (e instanceof MailGeniusValidationError) console.error('bad input', e.message);
  else if (e instanceof MailGeniusRateLimitError) console.warn('try again in', e.retryAfterSec, 's');
  else throw e;
}
```

## Schema contract

Every template carries a typed schema contract. The SDK's send and
render paths surface schema validation errors as
`MailGeniusValidationError` with field-level codes:

```ts
try {
  await mg.templates.send('order.confirmation', { to, variables });
} catch (err) {
  if (err instanceof MailGeniusValidationError) {
    for (const f of err.fields ?? []) console.warn(f.path, f.code);
  }
}
```

Codegen that turns a published contract into typed `variables` inputs
is tracked on the roadmap — see the [docs](https://docs.mailgenius.pro/schema-contract).
