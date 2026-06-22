# @genie-os/sdk

Official TypeScript / Node.js SDK for the [GenieOS](https://genieos.pro) API.

```bash
npm add @genie-os/sdk
# or: pnpm add @genie-os/sdk · yarn add @genie-os/sdk
```

> The unscoped `genieos` package is kept as a deprecation alias that
> re-exports `@genie-os/sdk`. New code should depend on `@genie-os/sdk`.

## Quickstart

```ts
import { GenieOS } from '@genie-os/sdk';

const mg = new GenieOS({ apiKey: process.env.MG_API_KEY! });

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
import { verifyWebhook } from '@genie-os/sdk/webhooks';

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
import { GenieOSRateLimitError, GenieOSValidationError } from '@genie-os/sdk';

try {
  await mg.templates.send('order.confirmation', { to: 'invalid' });
} catch (e) {
  if (e instanceof GenieOSValidationError) console.error('bad input', e.message);
  else if (e instanceof GenieOSRateLimitError) console.warn('try again in', e.retryAfterSec, 's');
  else throw e;
}
```

## Schema contract

Every template carries a typed schema contract. The SDK's send and
render paths surface schema validation errors as
`GenieOSValidationError` with field-level codes:

```ts
try {
  await mg.templates.send('order.confirmation', { to, variables });
} catch (err) {
  if (err instanceof GenieOSValidationError) {
    for (const f of err.fields ?? []) console.warn(f.path, f.code);
  }
}
```

Codegen that turns a published contract into typed `variables` inputs
is tracked on the roadmap — see the [docs](https://docs.genieos.pro/schema-contract).
