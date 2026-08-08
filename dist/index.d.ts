import { W as Workspace, T as TemplateSummary, a as TemplateDetail, R as RenderTemplateRequest, b as RenderTemplateResponse, S as SendTemplateRequest, c as SendTemplateResponse, d as TemplateSchemaContract, e as SequenceRun, f as SequenceRunActionRequest, g as Sequence, h as SequenceDetail, i as SequenceMutationRequest, j as SequenceSimulationInput, k as SequenceSimulationResult, E as EnrollSequenceRequest, l as EnrollSequenceResponse, m as EmitEventRequest, n as EmitEventResponse, o as WebhookSubscription, C as CreateWebhookRequest, U as UpdateWebhookRequest, A as ApiKeySummary, p as AuditEvent, B as BrandSummary, q as BrandDetail, P as PageSummary, r as PageDetail, s as SmsTemplateView, t as SmsCatalogEntry, u as PreviewSmsRequest, v as PreviewSmsResponse, w as SendSmsRequest, x as SendSmsResponse, y as SmsDelivery, z as PreviewSocialEventRequest, D as TriggerSocialEventRequest, F as TriggerSocialEventResponse, G as SocialNetwork, H as SocialPostStatus, I as SocialChannelId, J as SocialPost, K as CreateSocialPostRequest, L as CreateSocialPostResponse, M as UpdateSocialPostRequest, N as ScheduleSocialPostRequest, O as PublishSocialPostRequest, Q as ShortLinkSummary, V as ListUtmSuggestionsResponse, X as CreateShortLinkRequest, Y as CreateShortLinkResponse, Z as ShortLinkDetail, _ as UpdateShortLinkRequest, $ as UpdateShortLinkResponse, a0 as ReadLinkAnalyticsRequest, a1 as ReadLinkAnalyticsResponse, a2 as CreateQrDesignRequest, a3 as CreateQrDesignResponse, a4 as UpdateQrDesignRequest, a5 as UpdateQrDesignResponse, a6 as RenderQrDesignRequest, a7 as RenderQrDesignResponse } from './types-C-2xdZiV.js';
export { a8 as ApiKeyKind, a9 as ApiKeyScope, aa as LinkAnalyticsCardKey, ab as ObservedTemplateVariable, ac as QrBodyShape, ad as QrEncodes, ae as QrErrorCorrection, af as QrExportFormat, ag as QrEyeShape, ah as QrFrame, ai as QrStyle, aj as QrStyleOverride, ak as SequenceStatus, al as SequenceTriggerType, am as ShortLinkRouteRule, an as ShortLinkRouteRuleMatch, ao as ShortLinkUtm, ap as SocialPostMediaItem, aq as TemplateVariable, ar as TemplateVariableType, as as UtmFieldKey, at as UtmSuggestionCounts, au as UtmSuggestions, av as WebhookDeliveryEnvelope, aw as WebhookEventName } from './types-C-2xdZiV.js';

interface TransportOptions {
    /**
     * API key — either `gos_live_*` (production), `gos_test_*` (sandbox), or
     * the legacy `mfk_live_*` shape. Treated opaquely.
     */
    apiKey: string;
    /** Defaults to `https://api.genieos.pro`. */
    baseUrl?: string;
    /** Per-request timeout, default 30s. */
    timeoutMs?: number;
    /** Max retry attempts for retryable failures, default 3. */
    maxRetries?: number;
    /** Initial backoff, default 200ms. Doubles per retry. */
    initialBackoffMs?: number;
    /** Optional fetch override — handy for tests + Cloudflare Workers. */
    fetch?: typeof fetch;
    /** Extra static headers (e.g. tracing). */
    defaultHeaders?: Record<string, string>;
    /** Free-form integration label appended to the User-Agent. */
    appName?: string;
    /** Free-form integration version appended to the User-Agent. */
    appVersion?: string;
}
interface RequestOptions {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
    query?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
    /** Caller-supplied idempotency key. Beats the auto-generated default. */
    idempotencyKey?: string;
    /** Forwarded as-is. */
    headers?: Record<string, string>;
    /** Per-request timeout override. */
    timeoutMs?: number;
    /** Per-request retry override. */
    maxRetries?: number;
    /** AbortSignal for caller-driven cancellation (chained with timeout). */
    signal?: AbortSignal;
}
declare class Transport {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly initialBackoffMs;
    private readonly fetchImpl;
    private readonly defaultHeaders;
    private readonly userAgent;
    constructor(opts: TransportOptions);
    request<T>(opts: RequestOptions): Promise<T>;
    private buildUrl;
    private buildHeaders;
    private backoffFor;
}
declare function generateIdempotencyKey(): string;

/**
 * High-level GenieOS client.
 *
 * Surface organised by resource:
 *
 *   gos.workspace.get()
 *   gos.templates.{list, get, create, compose, render, send, schema}
 *   gos.sequences.{list, get, runs, enroll}
 *   gos.sequences.runs.{get, cancel}
 *   gos.events.emit()
 *   gos.webhooks.{list, get, create, update, delete}
 *   gos.keys.{list, get}
 *   gos.audit.list()
 *   gos.brand.{list, get}
 *   gos.pages.{list, get}
 *   gos.connectors.{catalog, list}
 *   gos.messaging.{kit, catalog, preview, send, listDeliveries}
 *   gos.social.transactional.{catalog, listTemplates, preview, trigger, listEvents}
 *   gos.social.{listNetworks, refreshNetworks, list, get, create, update, schedule, publish, delete, analytics}
 *   gos.marketing.{strategy, patchStrategy, listIcps, getIcp, creationDefaults, setCreationDefaults}
 *   gos.creations.{list, get, spawn, approveStrategy}
 *   gos.lists.{list, get, create, update, delete, addMembers, removeMembers}
 *   gos.approvals.{listPolicies, listPending, managePolicy, decide}
 *   gos.links.{list, utmSuggestions, create, get, update, analytics}
 *   gos.qr.{create, update, render}
 *   gos.pages.{list, get, compose, publish, unpublish}
 *
 * The client itself is a thin façade over `Transport`. All retries,
 * idempotency-key generation, error shaping, and timeouts live in
 * the transport — keeps this file legible and the resource modules
 * trivial to add to.
 */

type GenieOSOptions = TransportOptions;
declare class GenieOS {
    private readonly transport;
    readonly workspace: WorkspaceResource;
    readonly templates: TemplatesResource;
    readonly sequences: SequencesResource;
    readonly events: EventsResource;
    readonly webhooks: WebhooksResource;
    readonly keys: KeysResource;
    readonly audit: AuditResource;
    readonly brand: BrandResource;
    readonly pages: PagesResource;
    readonly connectors: ConnectorsResource;
    /** Transactional SMS — `/v1/messaging/transactional/*`. */
    readonly messaging: MessagingResource;
    /** Alias of `messaging` for callers who think in SMS. */
    readonly sms: MessagingResource;
    /** Organic + transactional social. */
    readonly social: SocialResource;
    readonly marketing: MarketingResource;
    readonly creations: CreationsResource;
    readonly lists: ListsResource;
    readonly approvals: ApprovalsResource;
    readonly links: LinksResource;
    readonly qr: QrResource;
    /** Alias of `sequences` for callers raised on the legacy "flows" name. */
    readonly flows: SequencesResource;
    constructor(opts: GenieOSOptions);
    /**
     * Escape hatch — issue a raw request against the API. Useful for
     * preview features that haven't been promoted to a typed resource.
     */
    request<T>(opts: RequestOptions): Promise<T>;
}
declare class WorkspaceResource {
    private readonly t;
    constructor(t: Transport);
    /** GET /v1/workspace — resolves the bearer token's home workspace. */
    get(): Promise<Workspace>;
}
declare class PagesResource {
    private readonly t;
    constructor(t: Transport);
    /** GET /v1/pages — list landing pages (read-only; blueprints excluded). */
    list(): Promise<PageSummary[]>;
    /** Async iterator over every page in the workspace. */
    iter(): AsyncIterableIterator<PageSummary>;
    /** GET /v1/pages/:idOrSlug — one page's metadata + section summary. */
    get(idOrSlug: string): Promise<PageDetail>;
    compose(idOrSlug: string, body: {
        intake: Record<string, unknown>;
        persist?: boolean;
        themeId?: string;
    }): Promise<unknown>;
    publish(idOrSlug: string, body?: {
        slug?: string;
    }): Promise<unknown>;
    unpublish(idOrSlug: string): Promise<unknown>;
}
declare class TemplatesResource {
    private readonly t;
    constructor(t: Transport);
    list(): Promise<TemplateSummary[]>;
    /**
     * Async iterator over every template in the workspace. The REST
     * endpoint does not paginate today (workspaces have O(100) templates),
     * but we expose the iterator now so SDK users don't have to migrate
     * when cursors land.
     */
    iter(): AsyncIterableIterator<TemplateSummary>;
    get(key: string): Promise<TemplateDetail>;
    /** Create a blank draft email template. */
    create(body?: {
        key?: string;
        name?: string;
        category?: 'marketing' | 'transactional' | 'system';
        mode?: 'mjml' | 'html';
        subject?: string;
        previewText?: string;
        themeId?: string;
    }): Promise<unknown>;
    /** Compose from a brief and persist. Charges compose-template credits. */
    compose(body: {
        prompt: string;
        key?: string;
        name?: string;
        category?: 'marketing' | 'transactional' | 'system';
        mode?: 'mjml' | 'html';
        themeId?: string;
        starterShellId?: string;
        includeHeroImage?: boolean;
        model?: string;
    }): Promise<unknown>;
    render(key: string, body?: RenderTemplateRequest): Promise<RenderTemplateResponse>;
    send(key: string, body: SendTemplateRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<SendTemplateResponse>;
    schema(key: string): Promise<TemplateSchemaContract & {
        templateKey: string;
    }>;
}
declare class SequencesResource {
    private readonly t;
    readonly runs: SequenceRunsResource;
    constructor(t: Transport);
    list(): Promise<Sequence[]>;
    get(keyOrId: string): Promise<SequenceDetail>;
    patchGraph(keyOrId: string, body: SequenceMutationRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<{
        flow: SequenceDetail;
        appliedOps: Array<{
            summary: string;
        }>;
    }>;
    simulate(keyOrId: string, body: SequenceSimulationInput): Promise<SequenceSimulationResult>;
    listRuns(keyOrId: string, opts?: {
        limit?: number;
    }): Promise<SequenceRun[]>;
    enroll(keyOrId: string, body: EnrollSequenceRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<EnrollSequenceResponse>;
}
declare class SequenceRunsResource {
    private readonly t;
    constructor(t: Transport);
    get(runId: string): Promise<SequenceRun>;
    cancel(runId: string): Promise<SequenceRun>;
    act(runId: string, body: SequenceRunActionRequest): Promise<SequenceRun>;
}
declare class EventsResource {
    private readonly t;
    constructor(t: Transport);
    emit(body: EmitEventRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<EmitEventResponse>;
}
declare class WebhooksResource {
    private readonly t;
    constructor(t: Transport);
    list(): Promise<WebhookSubscription[]>;
    get(id: string): Promise<WebhookSubscription>;
    create(body: CreateWebhookRequest): Promise<{
        webhook: WebhookSubscription;
    }>;
    update(id: string, body: UpdateWebhookRequest): Promise<{
        id: string;
        ok: true;
    }>;
    delete(id: string): Promise<{
        id: string;
        deleted: true;
    }>;
}
declare class KeysResource {
    private readonly t;
    constructor(t: Transport);
    list(): Promise<ApiKeySummary[]>;
    get(id: string): Promise<ApiKeySummary>;
}
declare class AuditResource {
    private readonly t;
    constructor(t: Transport);
    list(opts?: {
        limit?: number;
    }): Promise<AuditEvent[]>;
}
declare class BrandResource {
    private readonly t;
    constructor(t: Transport);
    list(): Promise<BrandSummary[]>;
    get(idOrDefault?: string): Promise<BrandDetail>;
}
declare class ConnectorsResource {
    private readonly t;
    constructor(t: Transport);
    /** Public catalog — no auth required, but the SDK call still
     *  attaches the bearer token (the API ignores it for this route). */
    catalog(): Promise<{
        providers: unknown[];
    }>;
    list(): Promise<{
        connectors: unknown[];
    }>;
}
declare class MessagingResource {
    private readonly t;
    constructor(t: Transport);
    /** GET /v1/messaging/transactional/kit — workspace SMS template views. */
    kit(): Promise<SmsTemplateView[]>;
    /** GET /v1/messaging/transactional/catalog — platform SMS definitions. */
    catalog(): Promise<SmsCatalogEntry[]>;
    preview(body: PreviewSmsRequest): Promise<PreviewSmsResponse>;
    send(body: SendSmsRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<SendSmsResponse>;
    listDeliveries(opts?: {
        templateKey?: string;
        limit?: number;
    }): Promise<SmsDelivery[]>;
}
declare class SocialResource {
    private readonly t;
    readonly transactional: TransactionalSocialResource;
    constructor(t: Transport);
    /** Company-only connected networks (`{ profileStatus, networks }`). */
    listNetworks(): Promise<{
        profileStatus: string;
        networks: SocialNetwork[];
    }>;
    refreshNetworks(): Promise<unknown>;
    list(opts?: {
        status?: SocialPostStatus;
        channelId?: SocialChannelId;
        groupId?: string;
        from?: string;
        to?: string;
        limit?: number;
    }): Promise<SocialPost[]>;
    get(postId: string): Promise<SocialPost>;
    create(body: CreateSocialPostRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<CreateSocialPostResponse>;
    update(postId: string, body: UpdateSocialPostRequest): Promise<SocialPost>;
    schedule(postId: string, body: ScheduleSocialPostRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<unknown>;
    publish(postId: string, body?: PublishSocialPostRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<unknown>;
    delete(postId: string, opts?: {
        fromProvider?: boolean;
    }): Promise<unknown>;
    analytics(postId: string, opts?: {
        refresh?: boolean;
    }): Promise<unknown>;
}
declare class MarketingResource {
    private readonly t;
    constructor(t: Transport);
    strategy(opts?: {
        detail?: 'summary' | 'full';
    }): Promise<unknown>;
    listIcps(opts?: {
        detail?: 'summary' | 'full';
    }): Promise<unknown[]>;
    getIcp(icpId: string): Promise<unknown>;
    creationDefaults(): Promise<unknown>;
    patchStrategy(patch: Record<string, unknown>): Promise<unknown>;
    setCreationDefaults(body: Record<string, unknown>): Promise<unknown>;
    createIcp(body: Record<string, unknown>): Promise<unknown>;
    updateIcp(icpId: string, body: Record<string, unknown>): Promise<unknown>;
}
declare class CreationsResource {
    private readonly t;
    constructor(t: Transport);
    list(opts?: {
        status?: string;
        limit?: number;
    }): Promise<unknown[]>;
    get(creationId: string, opts?: {
        detail?: 'summary' | 'full';
    }): Promise<unknown>;
    spawn(body: Record<string, unknown>, opts?: {
        idempotencyKey?: string;
    }): Promise<unknown>;
    approveStrategy(creationId: string): Promise<unknown>;
}
declare class ListsResource {
    private readonly t;
    constructor(t: Transport);
    list(): Promise<unknown[]>;
    get(listId: string): Promise<unknown>;
    create(body: {
        name: string;
        description?: string;
        colorToken?: string;
    }): Promise<unknown>;
    update(listId: string, body: Record<string, unknown>): Promise<unknown>;
    delete(listId: string): Promise<unknown>;
    addMembers(listId: string, contactIds: string[]): Promise<unknown>;
    removeMembers(listId: string, contactIds: string[]): Promise<unknown>;
}
declare class ApprovalsResource {
    private readonly t;
    constructor(t: Transport);
    listPolicies(): Promise<unknown[]>;
    listPending(opts?: {
        limit?: number;
    }): Promise<unknown[]>;
    managePolicy(surfaceKind: string, body: Record<string, unknown>): Promise<unknown>;
    decide(requestId: string, body: {
        decision: 'approve' | 'changes_requested' | 'reject';
        actingAsMemberUid: string;
        comment?: string;
    }): Promise<unknown>;
}
declare class LinksResource {
    private readonly t;
    constructor(t: Transport);
    list(opts?: {
        includeArchived?: boolean;
        limit?: number;
    }): Promise<ShortLinkSummary[]>;
    utmSuggestions(opts?: {
        field?: 'source' | 'medium' | 'campaign' | 'content' | 'term';
        includeCounts?: boolean;
    }): Promise<ListUtmSuggestionsResponse>;
    create(body: CreateShortLinkRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<CreateShortLinkResponse>;
    /** Read one short link by id — full detail including routeRules,
     *  whether a password is set, and the schedule window (`list()`
     *  omits these for brevity). */
    get(linkId: string): Promise<ShortLinkDetail>;
    /** Free edits to an existing short link — destination, label, tags,
     *  utm, routeRules, schedule, and password. */
    update(linkId: string, body: UpdateShortLinkRequest): Promise<UpdateShortLinkResponse>;
    /** Short-link click analytics — cache-first (5-minute TTL); cache
     *  hits are free, misses charge credits per event scanned. Requires
     *  Glow tier or above. */
    analytics(opts: ReadLinkAnalyticsRequest): Promise<ReadLinkAnalyticsResponse>;
}
declare class QrResource {
    private readonly t;
    constructor(t: Transport);
    /** Create a brand-styled QR design (1 credit). Does not render
     *  bytes — call `render()` afterwards for SVG/PNG/WebP/PDF. */
    create(body: CreateQrDesignRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<CreateQrDesignResponse>;
    /** Free edits to an existing QR design — style, frame, label, tags.
     *  Does not re-render bytes; call `render()` afterwards for a fresh
     *  preview/download. */
    update(qrId: string, body: UpdateQrDesignRequest): Promise<UpdateQrDesignResponse>;
    /** Render a QR design to bytes. svg/png/webp are free; png-print
     *  costs 2 credits, pdf costs 5. Pass `saveToAssets: true` to also
     *  write the render into the workspace Asset Manager. */
    render(qrId: string, body?: RenderQrDesignRequest): Promise<RenderQrDesignResponse>;
}
declare class TransactionalSocialResource {
    private readonly t;
    constructor(t: Transport);
    catalog(): Promise<unknown[]>;
    listTemplates(): Promise<unknown[]>;
    preview(body: PreviewSocialEventRequest): Promise<unknown>;
    trigger(body: TriggerSocialEventRequest, opts?: {
        idempotencyKey?: string;
    }): Promise<TriggerSocialEventResponse>;
    listEvents(opts?: {
        eventKey?: string;
        limit?: number;
    }): Promise<unknown[]>;
}

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
type GenieOSErrorType = 'authentication_error' | 'permission_denied' | 'invalid_request_error' | 'rate_limit_error' | 'connector_error' | 'idempotency_conflict' | 'api_error' | 'network_error';
interface GenieOSErrorBody {
    type: string;
    code: string;
    message: string;
    context?: Record<string, unknown>;
}
declare class GenieOSError extends Error {
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
    });
}
declare class GenieOSAuthError extends GenieOSError {
    constructor(opts: ConstructorParameters<typeof GenieOSError>[0]);
}
declare class GenieOSRateLimitError extends GenieOSError {
    readonly retryAfterSec?: number;
    constructor(opts: ConstructorParameters<typeof GenieOSError>[0] & {
        retryAfterSec?: number;
    });
}
declare class GenieOSValidationError extends GenieOSError {
    constructor(opts: ConstructorParameters<typeof GenieOSError>[0]);
}
declare class GenieOSIdempotencyConflictError extends GenieOSError {
    constructor(opts: ConstructorParameters<typeof GenieOSError>[0]);
}
declare class GenieOSNetworkError extends Error {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}

export { ApiKeySummary, AuditEvent, BrandDetail, BrandSummary, CreateQrDesignRequest, CreateQrDesignResponse, CreateShortLinkRequest, CreateShortLinkResponse, CreateSocialPostRequest, CreateSocialPostResponse, CreateWebhookRequest, EmitEventRequest, EmitEventResponse, EnrollSequenceRequest, EnrollSequenceResponse, GenieOS, GenieOSAuthError, GenieOSError, type GenieOSErrorBody, type GenieOSErrorType, GenieOSIdempotencyConflictError, GenieOSNetworkError, type GenieOSOptions, GenieOSRateLimitError, GenieOSValidationError, ListUtmSuggestionsResponse, PageDetail, PageSummary, PreviewSmsRequest, PreviewSmsResponse, PreviewSocialEventRequest, PublishSocialPostRequest, ReadLinkAnalyticsRequest, ReadLinkAnalyticsResponse, RenderQrDesignRequest, RenderQrDesignResponse, RenderTemplateRequest, RenderTemplateResponse, ScheduleSocialPostRequest, SendSmsRequest, SendSmsResponse, SendTemplateRequest, SendTemplateResponse, Sequence, SequenceDetail, SequenceMutationRequest, SequenceRun, SequenceRunActionRequest, SequenceSimulationInput, SequenceSimulationResult, ShortLinkDetail, ShortLinkSummary, SmsCatalogEntry, SmsDelivery, SmsTemplateView, SocialChannelId, SocialNetwork, SocialPost, SocialPostStatus, TemplateDetail, TemplateSchemaContract, TemplateSummary, TriggerSocialEventRequest, TriggerSocialEventResponse, UpdateQrDesignRequest, UpdateQrDesignResponse, UpdateShortLinkRequest, UpdateShortLinkResponse, UpdateSocialPostRequest, UpdateWebhookRequest, WebhookSubscription, Workspace, generateIdempotencyKey };
