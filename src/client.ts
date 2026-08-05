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
 *   gos.links.{list, utmSuggestions, create}()
 *   gos.pages.{list, get, compose, publish, unpublish}
 *
 * The client itself is a thin façade over `Transport`. All retries,
 * idempotency-key generation, error shaping, and timeouts live in
 * the transport — keeps this file legible and the resource modules
 * trivial to add to.
 */
import { Transport, type RequestOptions, type TransportOptions } from './transport.js';
import type {
  ApiKeySummary,
  AuditEvent,
  BrandDetail,
  BrandSummary,
  CreateShortLinkRequest,
  CreateShortLinkResponse,
  ListUtmSuggestionsResponse,
  ShortLinkSummary,
  CreateSocialPostRequest,
  CreateSocialPostResponse,
  CreateWebhookRequest,
  EmitEventRequest,
  EmitEventResponse,
  EnrollSequenceRequest,
  EnrollSequenceResponse,
  PageDetail,
  PageSummary,
  PreviewSmsRequest,
  PreviewSmsResponse,
  PreviewSocialEventRequest,
  PublishSocialPostRequest,
  RenderTemplateRequest,
  RenderTemplateResponse,
  ScheduleSocialPostRequest,
  SendSmsRequest,
  SendSmsResponse,
  SendTemplateRequest,
  SendTemplateResponse,
  Sequence,
  SequenceDetail,
  SequenceRun,
  SmsCatalogEntry,
  SmsDelivery,
  SmsTemplateView,
  SocialChannelId,
  SocialNetwork,
  SocialPost,
  SocialPostStatus,
  TemplateDetail,
  TemplateSchemaContract,
  TemplateSummary,
  TriggerSocialEventRequest,
  TriggerSocialEventResponse,
  UpdateSocialPostRequest,
  UpdateWebhookRequest,
  WebhookSubscription,
  Workspace,
} from './types.js';

export type GenieOSOptions = TransportOptions;

interface ListEnvelope<T> {
  data: T[];
  /** Reserved for cursor-paginated endpoints. */
  hasMore?: boolean;
  cursor?: string | null;
}

export class GenieOS {
  private readonly transport: Transport;
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
  /** Alias of `sequences` for callers raised on the legacy "flows" name. */
  readonly flows: SequencesResource;

  constructor(opts: GenieOSOptions) {
    this.transport = new Transport(opts);
    this.workspace = new WorkspaceResource(this.transport);
    this.templates = new TemplatesResource(this.transport);
    this.sequences = new SequencesResource(this.transport);
    this.flows = this.sequences;
    this.events = new EventsResource(this.transport);
    this.webhooks = new WebhooksResource(this.transport);
    this.keys = new KeysResource(this.transport);
    this.audit = new AuditResource(this.transport);
    this.brand = new BrandResource(this.transport);
    this.pages = new PagesResource(this.transport);
    this.connectors = new ConnectorsResource(this.transport);
    this.messaging = new MessagingResource(this.transport);
    this.sms = this.messaging;
    this.social = new SocialResource(this.transport);
    this.marketing = new MarketingResource(this.transport);
    this.creations = new CreationsResource(this.transport);
    this.lists = new ListsResource(this.transport);
    this.approvals = new ApprovalsResource(this.transport);
    this.links = new LinksResource(this.transport);
  }

  /**
   * Escape hatch — issue a raw request against the API. Useful for
   * preview features that haven't been promoted to a typed resource.
   */
  request<T>(opts: RequestOptions): Promise<T> {
    return this.transport.request<T>(opts);
  }
}

/* ===========================================================================
 *  Resources
 * =========================================================================== */

class WorkspaceResource {
  constructor(private readonly t: Transport) {}
  /** GET /v1/workspace — resolves the bearer token's home workspace. */
  get(): Promise<Workspace> {
    return this.t.request<Workspace>({ method: 'GET', path: '/v1/workspace' });
  }
}

class PagesResource {
  constructor(private readonly t: Transport) {}

  /** GET /v1/pages — list landing pages (read-only; blueprints excluded). */
  list(): Promise<PageSummary[]> {
    return this.t
      .request<ListEnvelope<PageSummary>>({ method: 'GET', path: '/v1/pages' })
      .then((r) => r.data);
  }

  /** Async iterator over every page in the workspace. */
  async *iter(): AsyncIterableIterator<PageSummary> {
    const items = await this.list();
    for (const item of items) yield item;
  }

  /** GET /v1/pages/:idOrSlug — one page's metadata + section summary. */
  get(idOrSlug: string): Promise<PageDetail> {
    return this.t.request<PageDetail>({
      method: 'GET',
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}`,
    });
  }

  compose(
    idOrSlug: string,
    body: { intake: Record<string, unknown>; persist?: boolean; themeId?: string },
  ): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}/compose`,
      body,
    });
  }

  publish(idOrSlug: string, body: { slug?: string } = {}): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'POST',
        path: `/v1/pages/${encodeURIComponent(idOrSlug)}/publish`,
        body,
      })
      .then((r) => r.data);
  }

  unpublish(idOrSlug: string): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: `/v1/pages/${encodeURIComponent(idOrSlug)}/unpublish`,
      body: {},
    });
  }
}

class TemplatesResource {
  constructor(private readonly t: Transport) {}

  list(): Promise<TemplateSummary[]> {
    return this.t
      .request<ListEnvelope<TemplateSummary>>({ method: 'GET', path: '/v1/templates' })
      .then((r) => r.data);
  }

  /**
   * Async iterator over every template in the workspace. The REST
   * endpoint does not paginate today (workspaces have O(100) templates),
   * but we expose the iterator now so SDK users don't have to migrate
   * when cursors land.
   */
  async *iter(): AsyncIterableIterator<TemplateSummary> {
    const items = await this.list();
    for (const item of items) yield item;
  }

  get(key: string): Promise<TemplateDetail> {
    return this.t.request<TemplateDetail>({
      method: 'GET',
      path: `/v1/templates/${encodeURIComponent(key)}`,
    });
  }

  /** Create a blank draft email template. */
  create(body: {
    key?: string;
    name?: string;
    category?: 'marketing' | 'transactional' | 'system';
    mode?: 'mjml' | 'html';
    subject?: string;
    previewText?: string;
    themeId?: string;
  } = {}): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({ method: 'POST', path: '/v1/templates', body })
      .then((r) => r.data);
  }

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
  }): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({ method: 'POST', path: '/v1/templates/compose', body })
      .then((r) => r.data);
  }

  render(key: string, body: RenderTemplateRequest = {}): Promise<RenderTemplateResponse> {
    return this.t.request<RenderTemplateResponse>({
      method: 'POST',
      path: `/v1/templates/${encodeURIComponent(key)}/render`,
      body,
    });
  }

  send(
    key: string,
    body: SendTemplateRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<SendTemplateResponse> {
    return this.t.request<SendTemplateResponse>({
      method: 'POST',
      path: `/v1/templates/${encodeURIComponent(key)}/send`,
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }

  schema(key: string): Promise<TemplateSchemaContract & { templateKey: string }> {
    return this.t.request({
      method: 'GET',
      path: `/v1/templates/${encodeURIComponent(key)}/schema`,
    });
  }
}

class SequencesResource {
  readonly runs: SequenceRunsResource;
  constructor(private readonly t: Transport) {
    this.runs = new SequenceRunsResource(t);
  }

  list(): Promise<Sequence[]> {
    return this.t
      .request<ListEnvelope<Sequence>>({ method: 'GET', path: '/v1/sequences' })
      .then((r) => r.data);
  }

  get(keyOrId: string): Promise<SequenceDetail> {
    return this.t.request({
      method: 'GET',
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}`,
    });
  }

  listRuns(keyOrId: string, opts: { limit?: number } = {}): Promise<SequenceRun[]> {
    return this.t
      .request<{ data: SequenceRun[] }>({
        method: 'GET',
        path: `/v1/sequences/${encodeURIComponent(keyOrId)}/runs`,
        query: { limit: opts.limit },
      })
      .then((r) => r.data);
  }

  enroll(
    keyOrId: string,
    body: EnrollSequenceRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<EnrollSequenceResponse> {
    return this.t.request({
      method: 'POST',
      path: `/v1/sequences/${encodeURIComponent(keyOrId)}/enroll`,
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }
}

class SequenceRunsResource {
  constructor(private readonly t: Transport) {}

  get(runId: string): Promise<SequenceRun> {
    return this.t.request({
      method: 'GET',
      path: `/v1/sequence-runs/${encodeURIComponent(runId)}`,
    });
  }

  cancel(runId: string): Promise<{ runId: string; status: 'cancelled' }> {
    return this.t.request({
      method: 'POST',
      path: `/v1/sequence-runs/${encodeURIComponent(runId)}/cancel`,
    });
  }
}

class EventsResource {
  constructor(private readonly t: Transport) {}

  emit(
    body: EmitEventRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<EmitEventResponse> {
    return this.t.request({
      method: 'POST',
      path: '/v1/events',
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }
}

class WebhooksResource {
  constructor(private readonly t: Transport) {}

  list(): Promise<WebhookSubscription[]> {
    return this.t
      .request<ListEnvelope<WebhookSubscription>>({ method: 'GET', path: '/v1/webhooks' })
      .then((r) => r.data);
  }

  get(id: string): Promise<WebhookSubscription> {
    return this.t.request({
      method: 'GET',
      path: `/v1/webhooks/${encodeURIComponent(id)}`,
    });
  }

  create(
    body: CreateWebhookRequest,
  ): Promise<{ webhook: WebhookSubscription }> {
    return this.t.request({
      method: 'POST',
      path: '/v1/webhooks',
      body,
    });
  }

  update(id: string, body: UpdateWebhookRequest): Promise<{ id: string; ok: true }> {
    return this.t.request({
      method: 'PATCH',
      path: `/v1/webhooks/${encodeURIComponent(id)}`,
      body,
    });
  }

  delete(id: string): Promise<{ id: string; deleted: true }> {
    return this.t.request({
      method: 'DELETE',
      path: `/v1/webhooks/${encodeURIComponent(id)}`,
    });
  }
}

class KeysResource {
  constructor(private readonly t: Transport) {}

  list(): Promise<ApiKeySummary[]> {
    return this.t
      .request<ListEnvelope<ApiKeySummary>>({ method: 'GET', path: '/v1/keys' })
      .then((r) => r.data);
  }

  get(id: string): Promise<ApiKeySummary> {
    return this.t.request({ method: 'GET', path: `/v1/keys/${encodeURIComponent(id)}` });
  }
}

class AuditResource {
  constructor(private readonly t: Transport) {}

  list(opts: { limit?: number } = {}): Promise<AuditEvent[]> {
    return this.t
      .request<ListEnvelope<AuditEvent>>({
        method: 'GET',
        path: '/v1/audit',
        query: { limit: opts.limit },
      })
      .then((r) => r.data);
  }
}

class BrandResource {
  constructor(private readonly t: Transport) {}

  list(): Promise<BrandSummary[]> {
    return this.t
      .request<ListEnvelope<BrandSummary>>({ method: 'GET', path: '/v1/brand' })
      .then((r) => r.data);
  }

  get(idOrDefault: string = 'default'): Promise<BrandDetail> {
    return this.t.request({ method: 'GET', path: `/v1/brand/${encodeURIComponent(idOrDefault)}` });
  }
}

class ConnectorsResource {
  constructor(private readonly t: Transport) {}

  /** Public catalog — no auth required, but the SDK call still
   *  attaches the bearer token (the API ignores it for this route). */
  catalog(): Promise<{ providers: unknown[] }> {
    return this.t.request({ method: 'GET', path: '/v1/connectors/catalog' });
  }

  list(): Promise<{ connectors: unknown[] }> {
    return this.t.request({ method: 'GET', path: '/v1/connectors' });
  }
}

class MessagingResource {
  constructor(private readonly t: Transport) {}

  /** GET /v1/messaging/transactional/kit — workspace SMS template views. */
  kit(): Promise<SmsTemplateView[]> {
    return this.t
      .request<ListEnvelope<SmsTemplateView>>({
        method: 'GET',
        path: '/v1/messaging/transactional/kit',
      })
      .then((r) => r.data);
  }

  /** GET /v1/messaging/transactional/catalog — platform SMS definitions. */
  catalog(): Promise<SmsCatalogEntry[]> {
    return this.t
      .request<ListEnvelope<SmsCatalogEntry>>({
        method: 'GET',
        path: '/v1/messaging/transactional/catalog',
      })
      .then((r) => r.data);
  }

  preview(body: PreviewSmsRequest): Promise<PreviewSmsResponse> {
    return this.t.request({
      method: 'POST',
      path: '/v1/messaging/transactional/preview',
      body,
    });
  }

  send(
    body: SendSmsRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<SendSmsResponse> {
    return this.t.request({
      method: 'POST',
      path: '/v1/messaging/transactional',
      body,
      idempotencyKey: opts.idempotencyKey ?? body.idempotencyKey,
    });
  }

  listDeliveries(opts: { templateKey?: string; limit?: number } = {}): Promise<SmsDelivery[]> {
    return this.t
      .request<{ data?: SmsDelivery[] } | SmsDelivery[]>({
        method: 'GET',
        path: '/v1/messaging/transactional/deliveries',
        query: { templateKey: opts.templateKey, limit: opts.limit },
      })
      .then((r) => (Array.isArray(r) ? r : (r.data ?? [])));
  }
}

class SocialResource {
  readonly transactional: TransactionalSocialResource;
  constructor(private readonly t: Transport) {
    this.transactional = new TransactionalSocialResource(t);
  }

  /** Company-only connected networks (`{ profileStatus, networks }`). */
  listNetworks(): Promise<{ profileStatus: string; networks: SocialNetwork[] }> {
    return this.t.request({
      method: 'GET',
      path: '/v1/social/networks',
    });
  }

  refreshNetworks(): Promise<unknown> {
    return this.t.request({ method: 'POST', path: '/v1/social/networks/refresh' });
  }

  list(opts: {
    status?: SocialPostStatus;
    channelId?: SocialChannelId;
    groupId?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}): Promise<SocialPost[]> {
    return this.t
      .request<{ data?: SocialPost[] } | SocialPost[]>({
        method: 'GET',
        path: '/v1/social/posts',
        query: {
          status: opts.status,
          channelId: opts.channelId,
          groupId: opts.groupId,
          from: opts.from,
          to: opts.to,
          limit: opts.limit,
        },
      })
      .then((r) => (Array.isArray(r) ? r : (r.data ?? [])));
  }

  get(postId: string): Promise<SocialPost> {
    return this.t
      .request<{ data: SocialPost }>({
        method: 'GET',
        path: `/v1/social/posts/${encodeURIComponent(postId)}`,
      })
      .then((r) => r.data);
  }

  create(
    body: CreateSocialPostRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<CreateSocialPostResponse> {
    return this.t.request({
      method: 'POST',
      path: '/v1/social/posts',
      body,
      idempotencyKey: opts.idempotencyKey ?? body.idempotencyKey,
    });
  }

  update(postId: string, body: UpdateSocialPostRequest): Promise<SocialPost> {
    return this.t
      .request<{ data: SocialPost }>({
        method: 'PATCH',
        path: `/v1/social/posts/${encodeURIComponent(postId)}`,
        body,
      })
      .then((r) => r.data);
  }

  schedule(
    postId: string,
    body: ScheduleSocialPostRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: `/v1/social/posts/${encodeURIComponent(postId)}/schedule`,
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }

  publish(
    postId: string,
    body: PublishSocialPostRequest = {},
    opts: { idempotencyKey?: string } = {},
  ): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: `/v1/social/posts/${encodeURIComponent(postId)}/publish`,
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }

  delete(postId: string, opts: { fromProvider?: boolean } = {}): Promise<unknown> {
    return this.t.request({
      method: 'DELETE',
      path: `/v1/social/posts/${encodeURIComponent(postId)}`,
      query: opts.fromProvider ? { fromProvider: 'true' } : undefined,
    });
  }

  analytics(postId: string, opts: { refresh?: boolean } = {}): Promise<unknown> {
    return this.t.request({
      method: 'GET',
      path: `/v1/social/posts/${encodeURIComponent(postId)}/analytics`,
      query: opts.refresh ? { refresh: 'true' } : undefined,
    });
  }
}

class MarketingResource {
  constructor(private readonly t: Transport) {}

  strategy(opts: { detail?: 'summary' | 'full' } = {}): Promise<unknown> {
    return this.t.request({
      method: 'GET',
      path: '/v1/marketing/strategy',
      query: opts.detail === 'full' ? { detail: 'full' } : undefined,
    });
  }

  listIcps(opts: { detail?: 'summary' | 'full' } = {}): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({
        method: 'GET',
        path: '/v1/marketing/icps',
        query: opts.detail === 'full' ? { detail: 'full' } : undefined,
      })
      .then((r) => r.data);
  }

  getIcp(icpId: string): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'GET',
        path: `/v1/marketing/icps/${encodeURIComponent(icpId)}`,
      })
      .then((r) => r.data);
  }

  creationDefaults(): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'GET',
        path: '/v1/marketing/creation-defaults',
      })
      .then((r) => r.data);
  }

  patchStrategy(patch: Record<string, unknown>): Promise<unknown> {
    return this.t.request({
      method: 'PATCH',
      path: '/v1/marketing/strategy',
      body: { patch },
    });
  }

  setCreationDefaults(body: Record<string, unknown>): Promise<unknown> {
    return this.t.request({
      method: 'PATCH',
      path: '/v1/marketing/creation-defaults',
      body,
    });
  }

  createIcp(body: Record<string, unknown>): Promise<unknown> {
    return this.t.request({ method: 'POST', path: '/v1/marketing/icps', body });
  }

  updateIcp(icpId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.t.request({
      method: 'PATCH',
      path: `/v1/marketing/icps/${encodeURIComponent(icpId)}`,
      body,
    });
  }
}

class CreationsResource {
  constructor(private readonly t: Transport) {}

  list(opts: { status?: string; limit?: number } = {}): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({
        method: 'GET',
        path: '/v1/creations',
        query: { status: opts.status, limit: opts.limit },
      })
      .then((r) => r.data);
  }

  get(creationId: string, opts: { detail?: 'summary' | 'full' } = {}): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'GET',
        path: `/v1/creations/${encodeURIComponent(creationId)}`,
        query: opts.detail === 'full' ? { detail: 'full' } : undefined,
      })
      .then((r) => r.data);
  }

  spawn(body: Record<string, unknown>, opts: { idempotencyKey?: string } = {}): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: '/v1/creations',
      body,
      idempotencyKey: opts.idempotencyKey,
    });
  }

  approveStrategy(creationId: string): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: `/v1/creations/${encodeURIComponent(creationId)}/approve-strategy`,
      body: {},
    });
  }
}

class ListsResource {
  constructor(private readonly t: Transport) {}

  list(): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({ method: 'GET', path: '/v1/lists' })
      .then((r) => r.data);
  }

  get(listId: string): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'GET',
        path: `/v1/lists/${encodeURIComponent(listId)}`,
      })
      .then((r) => r.data);
  }

  create(body: { name: string; description?: string; colorToken?: string }): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({ method: 'POST', path: '/v1/lists', body })
      .then((r) => r.data);
  }

  update(listId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'PATCH',
        path: `/v1/lists/${encodeURIComponent(listId)}`,
        body,
      })
      .then((r) => r.data);
  }

  delete(listId: string): Promise<unknown> {
    return this.t.request({
      method: 'DELETE',
      path: `/v1/lists/${encodeURIComponent(listId)}`,
    });
  }

  addMembers(listId: string, contactIds: string[]): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'POST',
        path: `/v1/lists/${encodeURIComponent(listId)}/members`,
        body: { contactIds },
      })
      .then((r) => r.data);
  }

  removeMembers(listId: string, contactIds: string[]): Promise<unknown> {
    return this.t
      .request<{ data: unknown }>({
        method: 'POST',
        path: `/v1/lists/${encodeURIComponent(listId)}/members/remove`,
        body: { contactIds },
      })
      .then((r) => r.data);
  }
}

class ApprovalsResource {
  constructor(private readonly t: Transport) {}

  listPolicies(): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({ method: 'GET', path: '/v1/approvals/policies' })
      .then((r) => r.data);
  }

  listPending(opts: { limit?: number } = {}): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({
        method: 'GET',
        path: '/v1/approvals/pending',
        query: { limit: opts.limit },
      })
      .then((r) => r.data);
  }

  managePolicy(surfaceKind: string, body: Record<string, unknown>): Promise<unknown> {
    return this.t.request({
      method: 'PUT',
      path: `/v1/approvals/policies/${encodeURIComponent(surfaceKind)}`,
      body,
    });
  }

  decide(
    requestId: string,
    body: {
      decision: 'approve' | 'changes_requested' | 'reject';
      actingAsMemberUid: string;
      comment?: string;
    },
  ): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: `/v1/approvals/pending/${encodeURIComponent(requestId)}/decide`,
      body,
    });
  }
}

class LinksResource {
  constructor(private readonly t: Transport) {}

  list(
    opts: { includeArchived?: boolean; limit?: number } = {},
  ): Promise<ShortLinkSummary[]> {
    return this.t
      .request<{ data: ShortLinkSummary[] }>({
        method: 'GET',
        path: '/v1/links',
        query: {
          includeArchived: opts.includeArchived ? 'true' : undefined,
          limit: opts.limit,
        },
      })
      .then((r) => r.data);
  }

  utmSuggestions(
    opts: {
      field?: 'source' | 'medium' | 'campaign' | 'content' | 'term';
      includeCounts?: boolean;
    } = {},
  ): Promise<ListUtmSuggestionsResponse> {
    return this.t
      .request<{ data: ListUtmSuggestionsResponse }>({
        method: 'GET',
        path: '/v1/links/utm-suggestions',
        query: {
          field: opts.field,
          includeCounts: opts.includeCounts === false ? 'false' : undefined,
        },
      })
      .then((r) => r.data);
  }

  create(
    body: CreateShortLinkRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<CreateShortLinkResponse> {
    return this.t
      .request<{ data: CreateShortLinkResponse }>({
        method: 'POST',
        path: '/v1/links',
        body,
        idempotencyKey: opts.idempotencyKey,
      })
      .then((r) => r.data);
  }
}

class TransactionalSocialResource {
  constructor(private readonly t: Transport) {}

  catalog(): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({
        method: 'GET',
        path: '/v1/social/transactional/catalog',
      })
      .then((r) => r.data);
  }

  listTemplates(): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({
        method: 'GET',
        path: '/v1/social/transactional/templates',
      })
      .then((r) => r.data);
  }

  preview(body: PreviewSocialEventRequest): Promise<unknown> {
    return this.t.request({
      method: 'POST',
      path: '/v1/social/transactional/preview',
      body,
    });
  }

  trigger(
    body: TriggerSocialEventRequest,
    opts: { idempotencyKey?: string } = {},
  ): Promise<TriggerSocialEventResponse> {
    return this.t.request({
      method: 'POST',
      path: '/v1/social/transactional/events',
      body,
      idempotencyKey: opts.idempotencyKey ?? body.idempotencyKey,
    });
  }

  listEvents(opts: { eventKey?: string; limit?: number } = {}): Promise<unknown[]> {
    return this.t
      .request<ListEnvelope<unknown>>({
        method: 'GET',
        path: '/v1/social/transactional/events',
        query: { eventKey: opts.eventKey, limit: opts.limit },
      })
      .then((r) => r.data);
  }
}
