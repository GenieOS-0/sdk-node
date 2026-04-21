/**
 * Wire types for the MailGenius public API. These are hand-curated to
 * mirror the shapes returned by `https://api.mailgenius.app/v1/*` and
 * intentionally do NOT pull from `@shared/types/*` so this package can
 * be published independently of the monorepo.
 *
 * When the API adds a field, update both the OpenAPI document
 * (`functions/src/http/api.ts` /v1/openapi.json) and this file.
 */

export type ApiKeyKind = 'live' | 'test';

export type ApiKeyScope =
  | 'templates:read'
  | 'templates:render'
  | 'templates:send'
  | 'templates:write'
  | 'flows:enroll'
  | 'sequences:read'
  | 'sequences:trigger'
  | 'subjects:write'
  | 'events:write'
  | 'stats:read'
  | 'brand:read'
  | 'connectors:read'
  | 'webhooks:manage'
  | 'audit:read'
  | 'workspace:read';

/* ---------- Workspace ---------- */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'grove' | 'forest' | 'enterprise';
  keyKind: ApiKeyKind;
  scopes: ApiKeyScope[];
}

/* ---------- Templates + schema contract ---------- */
export type TemplateVariableType = 'string' | 'number' | 'url' | 'email';

export interface TemplateVariable {
  key: string;
  type: TemplateVariableType;
  label?: string;
  sample?: string;
  description?: string;
  required?: boolean;
}

export interface ObservedTemplateVariable {
  key: string;
  type: TemplateVariableType;
  firstSeenAt: string;
  lastSeenAt: string;
  hits: number;
  sample?: string;
}

export type ChangeRequestEffect = 'add' | 'remove' | 'rename' | 'retype' | 'flip-required';
export type ChangeRequestStatus = 'open' | 'accepted' | 'rejected' | 'expired';
export type ChangeRequestProposer = 'developer' | 'marketer' | 'genius';
export type ChangeRequestDecision = 'accept' | 'accept-as-optional' | 'reject';

export interface TemplateChangeProposal {
  id: string;
  effect: ChangeRequestEffect;
  proposer: ChangeRequestProposer;
  proposerUid?: string;
  proposerDisplayName?: string;
  variable: TemplateVariable;
  fromVariable?: TemplateVariable;
  notes?: string;
  proposedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedDecision?: ChangeRequestDecision;
  expiresAt: string;
  status: ChangeRequestStatus;
}

export interface TemplateSchemaContract {
  declared: TemplateVariable[];
  observed: ObservedTemplateVariable[];
  pending: TemplateChangeProposal[];
  policy?: { mode: 'strict' | 'lenient'; failOnUndeclared: boolean };
  ratifiedAt: string;
  ratifiedVersion: number;
}

export interface TemplateSummary {
  id: string;
  key: string;
  name: string;
  subject: string;
  version: number;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  declaredVariables: TemplateVariable[];
  schemaContract?: TemplateSchemaContract;
}

export interface RenderTemplateRequest {
  variables?: Record<string, string | number>;
  preview?: boolean;
}

export interface RenderTemplateResponse {
  html: string;
  subject: string;
  warnings?: { code: string; message: string }[];
}

export interface SendTemplateRequest {
  to: string;
  from?: { email: string; name?: string };
  replyTo?: { email: string; name?: string };
  variables?: Record<string, string | number>;
  tags?: string[];
}

export interface SendTemplateResponse {
  id: string;
  status: 'queued' | 'sent' | 'delivered';
  provider: string;
  providerMessageId?: string | null;
}

/* ---------- Sequences (a.k.a. flows) ---------- */
export type SequenceStatus = 'draft' | 'published' | 'paused' | 'archived';
export type SequenceTriggerType =
  | 'api.enroll'
  | 'event.matches'
  | 'subject.property_changed'
  | 'manual'
  | 'schedule'
  | 'segment.entered';

export interface Sequence {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: SequenceStatus;
  trigger: { type: SequenceTriggerType; config: Record<string, unknown> };
  enrolledCount: number;
  publishedVersion?: number;
  updatedAt: string;
}

export interface SequenceDetail extends Sequence {
  graph: { nodeCount: number; edgeCount: number };
}

export interface EnrollSequenceRequest {
  contact: {
    email?: string;
    userId?: string;
    traits?: Record<string, unknown>;
  };
  variables?: Record<string, unknown>;
  startAtStep?: string;
}

export interface EnrollSequenceResponse {
  runId: string;
  sequenceKey: string;
  subjectId: string;
  enrolledAt: string;
}

export interface SequenceRun {
  id: string;
  flowId: string;
  subjectId: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled' | 'errored';
  enrolledAt: string;
  cancelledAt?: string;
  enrollVariables?: Record<string, unknown>;
  triggeredBy?: { kind: string; apiKeyId?: string };
}

/* ---------- Events ---------- */
export interface EmitEventRequest {
  name: string;
  userId?: string;
  email?: string;
  traits?: Record<string, string | number | boolean | null>;
  occurredAt?: string;
}

export interface EmitEventResponse {
  eventId: string;
  enrollments: { sequenceKey: string; runId: string; scheduledFirstStepAt: string | null }[];
  creditsCharged: number;
}

/* ---------- Webhooks ---------- */
export type WebhookEventName =
  | 'send.queued'
  | 'send.delivered'
  | 'send.opened'
  | 'send.clicked'
  | 'send.bounced'
  | 'send.complained'
  | 'send.failed'
  | 'sequence_run.enrolled'
  | 'sequence_run.advanced'
  | 'sequence_run.completed'
  | 'sequence_run.cancelled'
  | 'template.schema_proposed'
  | 'template.schema_ratified'
  | 'template.published';

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventName[];
  description?: string;
  /** Masked on read (e.g. "ab12•••cd34"). The full secret is only
   *  returned by `webhooks.create()` once. */
  secret: string;
  createdAt: string;
  disabledAt?: string | null;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: 'success' | 'failure';
  consecutiveFailures: number;
}

export interface CreateWebhookRequest {
  url: string;
  events?: WebhookEventName[];
  description?: string;
  /** Optional. If omitted, the server mints a 32-byte hex secret. */
  secret?: string;
}

export interface UpdateWebhookRequest {
  events?: WebhookEventName[];
  description?: string;
  disabled?: boolean;
}

export interface WebhookDeliveryEnvelope<TData = unknown> {
  id: string;
  event: WebhookEventName;
  workspaceId: string;
  occurredAt: number;
  data: TData;
}

/* ---------- API keys (read-only over REST) ---------- */
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  kind: ApiKeyKind;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/* ---------- Audit ---------- */
export interface AuditEvent {
  id: string;
  type: string;
  actor: { uid: string; displayName: string };
  resource?: { kind: string; id: string };
  data?: Record<string, unknown>;
  createdAt: string;
}

/* ---------- Brand ---------- */
export interface BrandSummary {
  id: string;
  name: string;
  isDefault: boolean;
  version: number;
  origin?: string;
  domain: string | null;
  updatedAt: string;
}

export interface BrandDetail extends BrandSummary {
  identity: Record<string, unknown>;
  palette: Record<string, unknown>;
  typography: Record<string, unknown>;
  logos: Record<string, unknown>;
  voice: Record<string, unknown>;
  imagery: Record<string, unknown>;
  emailDefaults: Record<string, unknown>;
  tokens: Record<string, unknown>;
}
