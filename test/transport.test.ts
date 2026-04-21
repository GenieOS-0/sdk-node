import test from 'node:test';
import assert from 'node:assert/strict';
import { MailGenius, MailGeniusAuthError, MailGeniusRateLimitError } from '../src/index.js';

function fakeFetch(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as URL, init);
    return handler(req);
  };
}

test('templates.send injects bearer auth + idempotency-key + body', async () => {
  let observed: { authorization: string | null; idempotency: string | null; body: string } | null = null;
  const mg = new MailGenius({
    apiKey: 'mg_live_unit_test',
    fetch: fakeFetch(async (req) => {
      observed = {
        authorization: req.headers.get('authorization'),
        idempotency: req.headers.get('idempotency-key'),
        body: await req.text(),
      };
      return new Response(JSON.stringify({ id: 'snd_1', status: 'sent', provider: 'sandbox' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }),
  });

  const res = await mg.templates.send('hello.world', {
    to: 'fan@example.com',
    variables: { firstName: 'Aki' },
  });
  assert.equal(res.id, 'snd_1');
  assert.ok(observed);
  assert.equal(observed!.authorization, 'Bearer mg_live_unit_test');
  assert.match(observed!.idempotency!, /^mgi_/);
  assert.match(observed!.body, /firstName/);
});

test('429 with retry-after backs off then succeeds', async () => {
  let calls = 0;
  const mg = new MailGenius({
    apiKey: 'mg_live_unit',
    initialBackoffMs: 5,
    fetch: fakeFetch(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({ error: { type: 'rate_limit_error', code: 'rate_limited', message: 'slow down' } }),
          { status: 429, headers: { 'retry-after': '0' } },
        );
      }
      return new Response(
        JSON.stringify({ eventId: 'evt_1', enrollments: [], creditsCharged: 0.05 }),
        { status: 202 },
      );
    }),
  });
  const res = await mg.events.emit({ name: 'unit.test' });
  assert.equal(res.eventId, 'evt_1');
  assert.equal(calls, 2);
});

test('401 throws MailGeniusAuthError', async () => {
  const mg = new MailGenius({
    apiKey: 'mg_live_invalid',
    maxRetries: 0,
    fetch: fakeFetch(
      async () =>
        new Response(
          JSON.stringify({ error: { type: 'authentication_error', code: 'invalid_auth', message: 'nope' } }),
          { status: 401 },
        ),
    ),
  });
  await assert.rejects(mg.workspace.get(), (e: unknown) => e instanceof MailGeniusAuthError);
});

test('429 with exhausted retries throws MailGeniusRateLimitError', async () => {
  const mg = new MailGenius({
    apiKey: 'mg_live_x',
    maxRetries: 1,
    initialBackoffMs: 1,
    fetch: fakeFetch(
      async () =>
        new Response(
          JSON.stringify({ error: { type: 'rate_limit_error', code: 'rate_limited', message: 'slow down' } }),
          { status: 429, headers: { 'retry-after': '0' } },
        ),
    ),
  });
  await assert.rejects(mg.events.emit({ name: 'x' }), (e: unknown) => e instanceof MailGeniusRateLimitError);
});
