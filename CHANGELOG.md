# mailgenius

## 0.1.0

Initial release.

- Sync HTTP client with automatic retry on network failure / 429 / 5xx and `Retry-After` honour.
- Auto-generated `Idempotency-Key` for every mutating request (24h dedup window per workspace per key).
- Resources: `workspace`, `templates`, `events`, `webhooks`, `audit`, `keys`.
- Webhook signature verification helpers exported from `mailgenius/webhooks`.
- Typed errors: `MailGeniusAuthError`, `MailGeniusValidationError`, `MailGeniusRateLimitError`,
  `MailGeniusConflictError`, `MailGeniusNotFoundError`, `MailGeniusServerError`, `MailGeniusNetworkError`.
