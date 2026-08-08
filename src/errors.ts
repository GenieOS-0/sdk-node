/**
 * Typed errors for `genieos`.
 *
 * Mirrors the error envelope returned by the REST API (Plans/Developers/
 * Developers-PRD.md §13.2):
 *
 *   { error: { type, code, message, context? } }
 *
 * The transport throws a `GenieOSError` (or one of its subclasses)
 * for any non-2xx response. Network failures and timeouts surface as
 * `GenieOSNetworkError` so callers can distinguish "the server told
 * me no" from "I never reached the server".
 */

export type GenieOSErrorType =
  | 'authentication_error'
  | 'permission_denied'
  | 'invalid_request_error'
  | 'rate_limit_error'
  | 'connector_error'
  | 'idempotency_conflict'
  | 'api_error'
  | 'network_error';

export interface GenieOSErrorBody {
  type: string;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export class GenieOSError extends Error {
  readonly type: GenieOSErrorType | string;
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
    this.name = 'GenieOSError';
    this.type = opts.type;
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.context = opts.context;
  }
}

export class GenieOSAuthError extends GenieOSError {
  constructor(opts: ConstructorParameters<typeof GenieOSError>[0]) {
    super(opts);
    this.name = 'GenieOSAuthError';
  }
}

export class GenieOSRateLimitError extends GenieOSError {
  readonly retryAfterSec?: number;
  constructor(opts: ConstructorParameters<typeof GenieOSError>[0] & { retryAfterSec?: number }) {
    super(opts);
    this.name = 'GenieOSRateLimitError';
    this.retryAfterSec = opts.retryAfterSec;
  }
}

export class GenieOSValidationError extends GenieOSError {
  constructor(opts: ConstructorParameters<typeof GenieOSError>[0]) {
    super(opts);
    this.name = 'GenieOSValidationError';
  }
}

export class GenieOSIdempotencyConflictError extends GenieOSError {
  constructor(opts: ConstructorParameters<typeof GenieOSError>[0]) {
    super(opts);
    this.name = 'GenieOSIdempotencyConflictError';
  }
}

export class GenieOSNetworkError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'GenieOSNetworkError';
    this.cause = cause;
  }
}
