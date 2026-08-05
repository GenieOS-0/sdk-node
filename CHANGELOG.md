# @genie-os/sdk

## 0.1.4

- `links.list()` and `links.utmSuggestions()` — read prior short links and
  frequency-ranked UTM values before create.

## 0.1.3

- Typed `links.create` body (`CreateShortLinkRequest`) including optional
  `utm` (`source` / `medium` / `campaign` / `content` / `term`), `tags`,
  and `domain`. UTMs are stamped onto the redirect at click time.

## 0.1.2

- Template create + compose (`templates.create`, `templates.compose`).
- Broader resource surface (pages, social, messaging, marketing, lists, …).
- Docs / examples use `GENIEOS_API_KEY` and `gos_live_*` / `gos_test_*` keys.
- Auto idempotency keys now prefixed `gos_` (was `mgi_`).

## 0.1.1

- Scoped package rename and GenieOS branding pass.

## 0.1.0

Initial release.

- Sync HTTP client with automatic retry on network failure / 429 / 5xx and `Retry-After` honour.
- Auto-generated `Idempotency-Key` for every mutating request (24h dedup window per workspace per key).
- Resources: `workspace`, `templates`, `events`, `webhooks`, `audit`, `keys`.
- Webhook signature verification helpers exported from `@genie-os/sdk/webhooks`.
- Typed errors: `GenieOSAuthError`, `GenieOSValidationError`, `GenieOSRateLimitError`,
  `GenieOSConflictError`, `GenieOSNotFoundError`, `GenieOSServerError`, `GenieOSNetworkError`.
