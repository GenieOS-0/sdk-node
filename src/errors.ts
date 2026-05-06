/**
 * Typed errors for `genieos`.
 *
 * Mirrors the error envelope returned by the REST API (Plans/Developers/
 * Developers-PRD.md §13.2):
 *
 *   { error: { type, code, message, context? } }
 *
 * The transport throws a `MailGeniusError` (or one of its subclasses)
 * for any non-2xx response. Network failures and timeouts surface as
 * `MailGeniusNetworkError` so callers can distinguish "the server told
 * me no" from "I never reached the server".
 */

export type MailGeniusErrorType =
  | 'authentication_error'
  | 'permission_denied'
  | 'invalid_request_error'
  | 'rate_limit_error'
  | 'connector_error'
  | 'idempotency_conflict'
  | 'api_error'
  | 'network_error';

export interface MailGeniusErrorBody {
  type: string;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export class MailGeniusError extends Error {
  readonly type: MailGeniusErrorType | string;
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly context?: Record<string, unknown>;

  constructor(opts: {
    type: string;
    code: string;
    message: string;
    status: number;
    requestId?: string;
    context?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = 'MailGeniusError';
    this.type = opts.type;
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.context = opts.context;
  }
}

export class MailGeniusAuthError extends MailGeniusError {
  constructor(opts: ConstructorParameters<typeof MailGeniusError>[0]) {
    super(opts);
    this.name = 'MailGeniusAuthError';
  }
}

export class MailGeniusRateLimitError extends MailGeniusError {
  readonly retryAfterSec?: number;
  constructor(opts: ConstructorParameters<typeof MailGeniusError>[0] & { retryAfterSec?: number }) {
    super(opts);
    this.name = 'MailGeniusRateLimitError';
    this.retryAfterSec = opts.retryAfterSec;
  }
}

export class MailGeniusValidationError extends MailGeniusError {
  constructor(opts: ConstructorParameters<typeof MailGeniusError>[0]) {
    super(opts);
    this.name = 'MailGeniusValidationError';
  }
}

export class MailGeniusIdempotencyConflictError extends MailGeniusError {
  constructor(opts: ConstructorParameters<typeof MailGeniusError>[0]) {
    super(opts);
    this.name = 'MailGeniusIdempotencyConflictError';
  }
}

export class MailGeniusNetworkError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MailGeniusNetworkError';
    this.cause = cause;
  }
}
