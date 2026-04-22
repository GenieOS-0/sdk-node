/**
 * High-level MailGenius client.
 *
 * Surface organised by resource:
 *
 *   mg.workspace.get()
 *   mg.templates.{list, get, render, send, schema}
 *   mg.sequences.{list, get, runs, enroll}
 *   mg.sequences.runs.{get, cancel}
 *   mg.events.emit()
 *   mg.webhooks.{list, get, create, update, delete}
 *   mg.keys.{list, get}
 *   mg.audit.list()
 *   mg.brand.{list, get}
 *   mg.connectors.{catalog, list}
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
  CreateWebhookRequest,
  EmitEventRequest,
  EmitEventResponse,
  EnrollSequenceRequest,
  EnrollSequenceResponse,
  RenderTemplateRequest,
  RenderTemplateResponse,
  SendTemplateRequest,
  SendTemplateResponse,
  Sequence,
  SequenceDetail,
  SequenceRun,
  TemplateDetail,
  TemplateSchemaContract,
  TemplateSummary,
  UpdateWebhookRequest,
  WebhookSubscription,
  Workspace,
} from './types.js';

export type MailGeniusOptions = TransportOptions;

interface ListEnvelope<T> {
  data: T[];
  /** Reserved for cursor-paginated endpoints. */
  hasMore?: boolean;
  cursor?: string | null;
}

export class MailGenius {
  private readonly transport: Transport;
  readonly workspace: WorkspaceResource;
  readonly templates: TemplatesResource;
  readonly sequences: SequencesResource;
  readonly events: EventsResource;
  readonly webhooks: WebhooksResource;
  readonly keys: KeysResource;
  readonly audit: AuditResource;
  readonly brand: BrandResource;
  readonly connectors: ConnectorsResource;
  /** Alias of `sequences` for callers raised on the legacy "flows" name. */
  readonly flows: SequencesResource;

  constructor(opts: MailGeniusOptions) {
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
    this.connectors = new ConnectorsResource(this.transport);
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
