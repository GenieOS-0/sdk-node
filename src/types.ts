/**
 * Wire types for the GenieOS public API. These are hand-curated to
 * mirror the shapes returned by `https://api.genieos.pro/v1/*` and
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
  | 'sequences:write'
  | 'sequences:trigger'
  | 'subjects:write'
  | 'events:write'
  | 'stats:read'
  | 'brand:read'
  | 'connectors:read'
  | 'pages:read'
  | 'pages:write'
  | 'pages:publish'
  | 'messaging.transactional.read'
  | 'messaging.transactional.send'
  | 'social:transactional:read'
  | 'social:transactional:trigger'
  | 'social:transactional:publish'
  | 'social:posts:read'
  | 'social:posts:write'
  | 'social:posts:publish'
  | 'marketing:read'
  | 'marketing:write'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'lists:read'
  | 'lists:write'
  | 'approvals:read'
  | 'approvals:write'
  | 'links:read'
  | 'links:write'
  | 'webhooks:manage'
  | 'audit:read'
  | 'workspace:read';

/** Social channel ids accepted by transactional + organic social APIs. */
export type SocialChannelId =
  | 'linkedin'
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'bluesky'
  | 'pinterest'
  | string;

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

export interface TemplateSchemaContract {
  declared: TemplateVariable[];
  observed: ObservedTemplateVariable[];
  /** Reserved for future use. Treat as opaque. */
  pending?: unknown[];
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
  graph: {
    nodes: Array<Record<string, unknown> & { id: string; kind: string }>;
    edges: Array<Record<string, unknown> & { id: string; source: string; target: string }>;
  };
  graphSummary: { nodeCount: number; edgeCount: number };
  lifecyclePolicy?: Record<string, unknown> | null;
  activationPolicy?: Record<string, unknown> | null;
}

export interface SequenceMutationRequest {
  baseRevision: string;
  mutation: {
    version: 1;
    prompt: string;
    by?: 'human' | 'genius';
    summary?: string;
    ops: Array<Record<string, unknown> & { op: string }>;
  };
}

export interface SequenceSimulationInput {
  runId?: string;
  subjectId: string;
  subject: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
  entryEvent?: Record<string, unknown>;
  journey?: Record<string, string>;
  startedAt?: string;
  signals?: Array<{
    id: string;
    kind: 'event' | 'engagement';
    at: string;
    event?: Record<string, unknown>;
    engagement?: {
      stepRef: string;
      metric: string;
      linkId?: string;
      machineActivity?: boolean;
      sentAt?: string;
    };
  }>;
}

export interface SequenceSimulationResult {
  flowId: string;
  flowVersion: number;
  completed: boolean;
  outcome: string;
  trace: Array<Record<string, unknown>>;
  journey: Record<string, string>;
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
  status:
    | 'active'
    | 'waiting'
    | 'blocked'
    | 'completed'
    | 'exited'
    | 'paused'
    | 'cancelled'
    | 'failed';
  flowVersion: number;
  currentStepId?: string;
  enrolledAt: string;
  completedAt?: string;
  cancelledAt?: string;
  enrollVariables?: Record<string, unknown>;
  triggeredBy?: { kind: string; apiKeyId?: string };
  waitUntil?: Record<string, unknown>;
  lastDecision?: Record<string, unknown>;
  timeline?: Array<Record<string, unknown>>;
}

export interface SequenceRunActionRequest {
  action: 'pause' | 'resume' | 'retry' | 'skip' | 'force_timeout';
  reason: string;
  pathLabel?: string;
}

/* ---------- Events ---------- */
export interface EmitEventRequest {
  eventId?: string;
  name: string;
  source?: string;
  schemaVersion?: number;
  userId?: string;
  anonymousId?: string;
  email?: string;
  phone?: string;
  externalIds?: Record<string, string>;
  object?: { type: string; id: string };
  correlationId?: string;
  causationId?: string;
  traits?: Record<string, string | number | boolean | null>;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  occurredAt?: string;
}

export interface EmitEventResponse {
  eventId: string;
  duplicate: boolean;
  status: 'accepted' | 'quarantined' | 'invalid';
  resolvedSubjectId: string | null;
  waitsResumed: Array<{ waitId: string; flowId: string; runId: string; pathLabel: string }>;
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
  | 'template.published'
  | 'social.post.created'
  | 'social.post.scheduled'
  | 'social.post.published'
  | 'social.post.failed'
  | 'social.post.deleted'
  // Short-link lifecycle + clicks. `link.clicked` is Glow+; lifecycle
  // events follow the same gate.
  | 'link.clicked'
  | 'link.created'
  | 'link.updated'
  | 'link.archived'
  | 'link.abuse_flagged'
  | 'link.disabled_for_abuse'
  | 'link.reinstated';

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

/* ---------- Pages (read-only) ---------- */
export interface PageSummary {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  title: string;
  description: string;
  publishedAt?: string;
  updatedAt?: string;
}

export interface PageDetail extends PageSummary {
  brandId: string;
  themeId: string | null;
  /** Number of top-level sections in the page tree. */
  sectionCount: number;
  /** Section ids, top-to-bottom. The full block tree is intentionally not
   *  returned over the API (too large); read it in the SPA editor. */
  sectionIds: string[];
}

/* ---------- Transactional SMS (`/v1/messaging/transactional`) ---------- */
export interface SmsTemplateView {
  key: string;
  name?: string;
  bodyTemplate?: string;
  [key: string]: unknown;
}

export interface SmsCatalogEntry {
  key: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PreviewSmsRequest {
  templateKey: string;
  bodyTemplate?: string;
  variables?: Record<string, string | number | boolean>;
}

export interface PreviewSmsResponse {
  body: string;
  segmentCount?: number;
  [key: string]: unknown;
}

export interface SendSmsRequest {
  templateKey: string;
  /** E.164 phone, e.g. `+447700900123`. */
  to?: string;
  recipientId?: string;
  variables?: Record<string, string | number | boolean>;
  idempotencyKey?: string;
  consentProofId?: string;
  allowExtraSegments?: boolean;
}

export interface SendSmsResponse {
  deliveryId: string;
  templateKey: string;
  status: string;
  [key: string]: unknown;
}

export interface SmsDelivery {
  id?: string;
  deliveryId?: string;
  templateKey?: string;
  status?: string;
  to?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/* ---------- Transactional Socials ---------- */
export interface TriggerSocialEventRequest {
  eventKey: string;
  mode?: 'preview' | 'draft' | 'publish';
  variables?: Record<string, unknown>;
  channels?: SocialChannelId[];
  idempotencyKey?: string;
}

export interface TriggerSocialEventResponse {
  event: {
    id?: string;
    status: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PreviewSocialEventRequest {
  eventKey: string;
  variables?: Record<string, unknown>;
  channels?: SocialChannelId[];
}

/* ---------- Organic social (`/v1/social/posts`, `/v1/social/networks`) ---------- */
export type SocialPostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'deleted'
  | string;

export interface SocialNetwork {
  channelId: SocialChannelId;
  accountRef?: string;
  displayName?: string;
  handle?: string;
  [key: string]: unknown;
}

export interface SocialPostMediaItem {
  kind?: 'image' | 'video';
  assetId?: string;
  url?: string;
  alt?: string;
  thumbnailUrl?: string;
}

export interface SocialPost {
  id: string;
  status: SocialPostStatus;
  channelId?: SocialChannelId;
  caption?: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  groupId?: string;
  [key: string]: unknown;
}

export interface CreateSocialPostRequest {
  /** Default `copy`. Use `compose` + `brief` for Genie-written captions. */
  mode?: 'copy' | 'compose';
  name?: string;
  brief?: string;
  channels: SocialChannelId[];
  caption?: string;
  channelCaptions?: Partial<Record<SocialChannelId, string>>;
  hashtags?: string[];
  mentions?: string[];
  media?: SocialPostMediaItem[];
  linkUrl?: string;
  firstComment?: string;
  scheduleAt?: string;
  publish?: boolean;
  targetAccountRefs?: Partial<Record<SocialChannelId, string>>;
  composer?: 'sonnet' | 'opus';
  brandId?: string;
  idempotencyKey?: string;
}

export interface CreateSocialPostResponse {
  posts?: SocialPost[];
  groupId?: string;
  receipts?: { channelId?: string; ok: boolean; postId?: string; error?: string }[];
  [key: string]: unknown;
}

export interface UpdateSocialPostRequest {
  caption?: string;
  hashtags?: string[];
  media?: SocialPostMediaItem[];
  linkUrl?: string | null;
  firstComment?: string | null;
}

export interface ScheduleSocialPostRequest {
  scheduledAt: string;
  targetAccountRef?: string;
}

export interface PublishSocialPostRequest {
  targetAccountRef?: string;
}

/* ---------- Short links ---------- */
/** UTM tagging stamped onto the redirect destination at click time. */
export interface ShortLinkUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

/** Geo / platform / device dynamic routing — first matching rule wins;
 *  `destinationUrl` on the link is the fallback. */
export type ShortLinkRouteRuleMatch =
  | { kind: 'country'; codes: string[] }
  | { kind: 'city'; cities: string[] }
  | { kind: 'platform'; platforms: Array<'ios' | 'android' | 'desktop' | 'other'> }
  | { kind: 'device'; devices: Array<'mobile' | 'tablet' | 'desktop' | 'other'> };

export interface ShortLinkRouteRule {
  id: string;
  match: ShortLinkRouteRuleMatch;
  destinationUrl: string;
}

export interface CreateShortLinkRequest {
  destinationUrl: string;
  slug?: string;
  label?: string;
  tags?: string[];
  folderId?: string;
  utm?: ShortLinkUtm;
  campaignId?: string;
  /** Short-link host override. Defaults to gogen.ie; Spark+ custom
   *  hosts also accepted when active. */
  domain?: string;
  /** Optional password gate (plaintext; hashed server-side). Available
   *  on every tier. */
  password?: string;
  /** ISO-8601 — after this instant the link returns 410 Gone.
   *  Available on every tier. */
  expiresAt?: string;
  /** ISO-8601 — before this instant the link returns 425 Too Early.
   *  Available on every tier. */
  scheduledGoLiveAt?: string;
  /** Geo / platform / device dynamic routing. Available on every tier. */
  routeRules?: ShortLinkRouteRule[];
}

export interface UpdateShortLinkRequest {
  destinationUrl?: string;
  label?: string;
  /** Removes `label` entirely. */
  clearLabel?: boolean;
  tags?: string[];
  utm?: ShortLinkUtm;
  /** Removes `utm` entirely. */
  clearUtm?: boolean;
  /** Replace routing rules entirely. Pass `[]` to clear. */
  routeRules?: ShortLinkRouteRule[];
  /** Removes `routeRules` entirely. */
  clearRouteRules?: boolean;
  /** ISO-8601 expiry. */
  expiresAt?: string;
  clearExpiresAt?: boolean;
  /** ISO-8601 go-live. */
  scheduledGoLiveAt?: string;
  clearScheduledGoLiveAt?: boolean;
  /** Set / replace the password gate (plaintext; hashed server-side). */
  password?: string;
  /** Removes the password gate. */
  clearPassword?: boolean;
}

export interface UpdateShortLinkResponse {
  linkId: string;
  workspaceId: string;
  domain: string;
  slug: string;
  redirectUrl: string;
  destinationUrl: string;
  label?: string;
  tags: string[];
  utm?: ShortLinkUtm;
  hasPassword: boolean;
  expiresAt: string | null;
  scheduledGoLiveAt: string | null;
}

export interface CreateShortLinkResponse {
  linkId: string;
  workspaceId: string;
  domain: string;
  slug: string;
  redirectUrl: string;
  destinationUrl: string;
  totalClicks: number;
  uniqueClicks: number;
  remainingCredits: number;
}

export interface ShortLinkSummary {
  linkId: string;
  domain: string;
  slug: string;
  redirectUrl: string;
  destinationUrl: string;
  label?: string;
  tags: string[];
  utm?: ShortLinkUtm;
  campaignId?: string;
  totalClicks: number;
  uniqueClicks: number;
  archived: boolean;
  createdAt: string | null;
}

/** `ShortLinkSummary` plus the fields `list()` omits for brevity —
 *  routing rules, password-gate presence, and the schedule window.
 *  Returned by `links.get()`. */
export interface ShortLinkDetail extends ShortLinkSummary {
  routeRules?: ShortLinkRouteRule[];
  hasPassword: boolean;
  expiresAt: string | null;
  scheduledGoLiveAt: string | null;
}

export type UtmFieldKey = keyof ShortLinkUtm;

export interface UtmSuggestions {
  source: string[];
  medium: string[];
  campaign: string[];
  content: string[];
  term: string[];
}

export type UtmSuggestionCounts = Record<
  UtmFieldKey,
  Array<{ value: string; count: number }>
>;

export interface ListUtmSuggestionsResponse {
  suggestions: UtmSuggestions;
  counts?: UtmSuggestionCounts;
  scannedLinks: number;
}

/* ---------- Link analytics ---------- */
export type LinkAnalyticsCardKey =
  | 'headline'
  | 'timeseries'
  | 'geo'
  | 'geo_city'
  | 'devices'
  | 'referrers'
  | 'utm_campaign'
  | 'utm_source'
  | 'utm_medium';

export interface ReadLinkAnalyticsRequest {
  cardKey: LinkAnalyticsCardKey;
  /** Omit for workspace-wide; provide to scope to one short link. */
  linkId?: string;
  /** Lookback window in days (1–365, default 30). */
  days?: number;
  /** Bypass the cache and re-run the query. */
  forceRefresh?: boolean;
}

export interface ReadLinkAnalyticsResponse {
  cardKey: LinkAnalyticsCardKey;
  data: unknown;
  fetchedAt: string;
  staleness: 'fresh' | 'stale';
  creditsDebited: number;
}

/* ---------- QR designs ---------- */
export type QrEncodes =
  | { kind: 'shortLink'; linkId: string }
  | { kind: 'static'; payload: string }
  | { kind: 'wifi'; ssid: string; password: string; encryption: 'WPA' | 'WEP' | 'nopass' }
  | { kind: 'vcard'; vcardSource: string };

export type QrBodyShape = 'square' | 'rounded' | 'dots' | 'classy' | 'extra-rounded';
export type QrEyeShape = 'square' | 'rounded' | 'leaf' | 'dot' | 'frame';
export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrStyleOverride {
  foregroundColor?: string;
  backgroundColor?: string;
  bodyShape?: QrBodyShape;
  eyeShape?: QrEyeShape;
  cornerRadius?: number;
  logoAssetId?: string;
  /** Removes the logo from the design. */
  clearLogo?: boolean;
  logoSizeRatio?: number;
  margin?: number;
  errorCorrection?: QrErrorCorrection;
}

export interface QrStyle {
  foregroundColor: string;
  backgroundColor: string;
  bodyShape: QrBodyShape;
  eyeShape: QrEyeShape;
  cornerRadius: number;
  logoAssetId?: string;
  logoSizeRatio: number;
  margin: number;
  errorCorrection: QrErrorCorrection;
}

export type QrFrame =
  | { kind: 'plain' }
  | { kind: 'cta-band'; text: string; textColor: string; bandColor: string };

export interface CreateQrDesignRequest {
  encodes: QrEncodes;
  label?: string;
  tags?: string[];
  /** Defaults from the workspace brand kit when omitted. */
  style?: QrStyleOverride;
  frame?: QrFrame;
  brandId?: string;
}

export interface CreateQrDesignResponse {
  qrId: string;
  workspaceId: string;
  style: QrStyle;
  remainingCredits: number;
}

export interface UpdateQrDesignRequest {
  label?: string;
  clearLabel?: boolean;
  tags?: string[];
  style?: QrStyleOverride;
  frame?: QrFrame;
  clearFrame?: boolean;
}

export interface UpdateQrDesignResponse {
  qrId: string;
  style: QrStyle;
  frame: QrFrame | null;
  label: string | null;
  tags: string[];
}

export type QrExportFormat = 'svg' | 'png' | 'png-print' | 'webp' | 'pdf';

export interface RenderQrDesignRequest {
  /** Default `'png'`. */
  format?: QrExportFormat;
  /** Pixel width for web rasters / SVG (128–2048, default 1024).
   *  Ignored for print/PDF. */
  size?: number;
  /** Write the render into the workspace Asset Manager. Default
   *  false (preview only). */
  saveToAssets?: boolean;
}

export interface RenderQrDesignResponse {
  qrId: string;
  format: QrExportFormat;
  contentType: string;
  filename: string;
  /** Raw file bytes as base64 (no `data:` prefix). */
  fileBase64: string;
  /** @deprecated Prefer `fileBase64`. Kept for PNG callers. */
  pngBase64?: string;
  byteLength: number;
  remainingCredits?: number;
  /** Present when `saveToAssets` wrote a DAM row. */
  assetId?: string;
  downloadUrl?: string;
}
