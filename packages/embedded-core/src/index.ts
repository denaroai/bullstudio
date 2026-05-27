import type {
  Job,
  JobCounts,
  JobQueryOptions,
  JobSummary,
  Queue,
  WorkerCount,
} from "@bullstudio/connect-types";
import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export type DashboardMode = "embedded";

export type QueueAdapterProvider = "bullmq" | "bull";

export interface AdapterCapabilities {
  flows: boolean;
  jobLogs: boolean;
  jobRemoval: boolean;
  jobRetry: boolean;
  queuePause: boolean;
  queueResume: boolean;
  workers: boolean;
}

export interface QueueAdapter {
  key: string;
  label: string;
  provider: QueueAdapterProvider;
  capabilities: AdapterCapabilities;
  getQueue(): Promise<Queue>;
  getJobCounts(): Promise<JobCounts>;
  pauseQueue(): Promise<void>;
  resumeQueue(): Promise<void>;
  getJobs(options?: JobQueryOptions): Promise<Job[]>;
  getJobsSummary(options?: JobQueryOptions): Promise<JobSummary[]>;
  getJob(jobId: string): Promise<Job | null>;
  getJobLogs(jobId: string): Promise<{ logs: string[]; count: number }>;
  retryJob(jobId: string): Promise<void>;
  removeJob(jobId: string): Promise<void>;
  getWorkerCount(): Promise<WorkerCount>;
}

export type DashboardProtection =
  | BasicAuthProtection
  | DisabledDashboardProtection
  | CustomDashboardProtection;

export interface BasicAuthProtection {
  type: "basic";
  username: string;
  password: string;
}

export interface DisabledDashboardProtection {
  type: "disabled";
}

export interface CustomDashboardProtection {
  type: "custom";
}

export interface DashboardIdentity {
  title: string;
  logo?: DashboardLogo;
}

export interface DashboardLogo {
  src: string;
  alt: string;
}

export interface DocumentIdentity {
  title: string;
  favicon?: string;
}

export interface DashboardConfig {
  queues: QueueAdapter[];
  readOnly?: boolean;
  protection?: DashboardProtection;
  dashboardIdentity?: DashboardIdentity;
  documentIdentity?: DocumentIdentity;
}

export interface ResolvedDashboardConfig {
  queues: QueueAdapter[];
  readOnly: boolean;
  protection: DashboardProtection;
  dashboardIdentity: DashboardIdentity;
  documentIdentity: DocumentIdentity;
}

export interface StandaloneDashboardConfig {
  protection?: DashboardProtection;
  handleDashboardAsset(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}

export interface ResolvedStandaloneDashboardConfig {
  protection: DashboardProtection;
}

export interface QueueSourceStatus {
  mode: DashboardMode;
  source: "supplied";
  status: "healthy" | "degraded" | "unhealthy";
  queueCount: number;
  providers: QueueAdapterProvider[];
  capabilities: AdapterCapabilities;
  readOnly: boolean;
  mutationsAllowed: boolean;
}

export interface DashboardQueue extends Queue {
  key: string;
  label: string;
  provider: QueueAdapterProvider;
  capabilities: AdapterCapabilities;
}

export interface FrameworkRequest {
  method: string;
  url: string;
  headers?: Headers | Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface FrameworkResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface PrivateDashboardApiMount {
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
}

export interface EmbeddedDashboardInstance {
  mode: DashboardMode;
  config: ResolvedDashboardConfig;
  queues: QueueAdapter[];
  getQueueSourceStatus(): QueueSourceStatus;
  listQueues(): Promise<DashboardQueue[]>;
  getQueue(queueKey: string): Promise<DashboardQueue | null>;
  getJobCounts(queueKey: string): Promise<JobCounts>;
  pauseQueue(queueKey: string): Promise<void>;
  resumeQueue(queueKey: string): Promise<void>;
  getJobs(queueKey: string, options?: JobQueryOptions): Promise<Job[]>;
  getJobsSummary(
    queueKey: string,
    options?: JobQueryOptions,
  ): Promise<JobSummary[]>;
  getJob(queueKey: string, jobId: string): Promise<Job | null>;
  getJobLogs(
    queueKey: string,
    jobId: string,
  ): Promise<{
    logs: string[];
    count: number;
  }>;
  retryJob(queueKey: string, jobId: string): Promise<void>;
  removeJob(queueKey: string, jobId: string): Promise<void>;
  getWorkerCount(queueKey: string): Promise<WorkerCount>;
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}

export interface StandaloneDashboardInstance {
  mode: "standalone";
  config: ResolvedStandaloneDashboardConfig;
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}

const defaultCapabilities: AdapterCapabilities = {
  flows: false,
  jobLogs: false,
  jobRemoval: false,
  jobRetry: false,
  queuePause: false,
  queueResume: false,
  workers: false,
};

const defaultProtection: DashboardProtection = {
  type: "basic",
  username: "admin",
  password: "bullstudio",
};

const defaultDashboardIdentity: DashboardIdentity = {
  title: "Bullstudio",
};

const defaultDocumentIdentity: DocumentIdentity = {
  title: "Bullstudio",
};

export function createEmbeddedDashboard(
  config: DashboardConfig,
): EmbeddedDashboardInstance {
  const resolvedConfig = resolveDashboardConfig(config);
  const queueAdaptersByKey = indexQueueAdaptersByKey(resolvedConfig.queues);
  const dashboard: EmbeddedDashboardInstance = {
    mode: "embedded",
    config: resolvedConfig,
    queues: resolvedConfig.queues,
    getQueueSourceStatus: () => getQueueSourceStatus(resolvedConfig),
    listQueues: async () =>
      Promise.all(
        resolvedConfig.queues.map((queue) => getDashboardQueue(queue)),
      ),
    getQueue: async (queueKey) => {
      const queue = queueAdaptersByKey.get(queueKey);
      return queue ? getDashboardQueue(queue) : null;
    },
    getJobCounts: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobCounts(),
    pauseQueue: async (queueKey) => {
      assertCanMutate(resolvedConfig);
      await getQueueAdapter(queueAdaptersByKey, queueKey).pauseQueue();
    },
    resumeQueue: (queueKey) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).resumeQueue(),
      ),
    getJobs: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobs(options),
    getJobsSummary: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobsSummary(options),
    getJob: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJob(jobId),
    getJobLogs: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobLogs(jobId),
    retryJob: (queueKey, jobId) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).retryJob(jobId),
      ),
    removeJob: (queueKey, jobId) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).removeJob(jobId),
      ),
    getWorkerCount: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getWorkerCount(),
    handle: (request) =>
      withDashboardProtection(resolvedConfig.protection, request, () =>
        handleDashboardAsset(request, resolvedConfig),
      ),
    mountPrivateDashboardApi: () => ({
      handle: (request) =>
        withDashboardProtection(resolvedConfig.protection, request, () =>
          handlePrivateDashboardApi(dashboard, request),
        ),
    }),
  };

  return dashboard;
}

export function createStandaloneDashboard(
  config: StandaloneDashboardConfig,
): StandaloneDashboardInstance {
  const resolvedConfig: ResolvedStandaloneDashboardConfig = {
    protection: config.protection ?? defaultProtection,
  };
  const privateDashboardApi = config.mountPrivateDashboardApi();

  return {
    mode: "standalone",
    config: resolvedConfig,
    handle: (request) =>
      withDashboardProtection(resolvedConfig.protection, request, () =>
        config.handleDashboardAsset(request),
      ),
    mountPrivateDashboardApi: () => ({
      handle: (request) =>
        withDashboardProtection(resolvedConfig.protection, request, () =>
          privateDashboardApi.handle(request),
        ),
    }),
  };
}

export class ReadOnlyDashboardError extends Error {
  constructor() {
    super("Read-only dashboards cannot mutate queues or jobs.");
    this.name = "ReadOnlyDashboardError";
  }
}

async function withMutationAccess<T>(
  config: ResolvedDashboardConfig,
  operation: () => Promise<T>,
): Promise<T> {
  assertCanMutate(config);
  return operation();
}

function assertCanMutate(config: ResolvedDashboardConfig): void {
  if (config.readOnly) {
    throw new ReadOnlyDashboardError();
  }
}

async function withDashboardProtection(
  protection: DashboardProtection,
  request: FrameworkRequest,
  next: () => Promise<FrameworkResponse>,
): Promise<FrameworkResponse> {
  if (protection.type !== "basic") {
    return next();
  }

  if (hasValidBasicAuth(request, protection)) {
    return next();
  }

  return {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="bullstudio"',
    },
    body: "Authentication required",
  };
}

function hasValidBasicAuth(
  request: FrameworkRequest,
  protection: BasicAuthProtection,
): boolean {
  const authorization = getHeader(request.headers, "authorization");

  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const credentials = decodeBasicAuthCredentials(authorization.slice(6));
  const separator = credentials.indexOf(":");
  const username =
    separator === -1 ? credentials : credentials.slice(0, separator);
  const password = separator === -1 ? "" : credentials.slice(separator + 1);

  return username === protection.username && password === protection.password;
}

function decodeBasicAuthCredentials(encodedCredentials: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encodedCredentials, "base64").toString("utf8");
  }

  return atob(encodedCredentials);
}

function getHeader(
  headers: FrameworkRequest["headers"],
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const normalizedName = name.toLowerCase();

  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== normalizedName) {
      continue;
    }

    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}

async function handleDashboardAsset(
  request: FrameworkRequest,
  config: ResolvedDashboardConfig,
): Promise<FrameworkResponse> {
  const pathname = getPathname(request.url);

  if (request.method === "GET" || request.method === "HEAD") {
    if (pathname.endsWith("/assets/app.js")) {
      return {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": "application/javascript; charset=utf-8",
        },
        body:
          request.method === "HEAD"
            ? undefined
            : `window.__BULLSTUDIO__=${JSON.stringify({
                mode: "embedded",
                dashboardIdentity: config.dashboardIdentity,
                documentIdentity: config.documentIdentity,
              })};`,
      };
    }

    return {
      status: 200,
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
      },
      body:
        request.method === "HEAD"
          ? undefined
          : `<!doctype html><html><head><title>${escapeHtml(
              config.documentIdentity.title,
            )}</title>${renderFavicon(
              config.documentIdentity,
            )}<script type="module" src="./assets/app.js"></script></head><body><div id="root">${renderDashboardIdentity(
              config.dashboardIdentity,
            )}</div></body></html>`,
    };
  }

  return {
    status: 405,
    headers: {
      Allow: "GET, HEAD",
    },
    body: "Method Not Allowed",
  };
}

function renderFavicon(identity: DocumentIdentity): string {
  if (!identity.favicon) {
    return "";
  }

  return `<link rel="icon" href="${escapeHtml(identity.favicon)}">`;
}

function renderDashboardIdentity(identity: DashboardIdentity): string {
  return `${renderDashboardLogo(identity.logo)}<span>${escapeHtml(
    identity.title,
  )}</span>`;
}

function renderDashboardLogo(logo: DashboardLogo | undefined): string {
  if (!logo) {
    return "";
  }

  return `<img src="${escapeHtml(logo.src)}" alt="${escapeHtml(logo.alt)}">`;
}

async function handlePrivateDashboardApi(
  dashboard: EmbeddedDashboardInstance,
  request: FrameworkRequest,
): Promise<FrameworkResponse> {
  const response = await fetchRequestHandler({
    endpoint: getPrivateDashboardApiEndpoint(request.url),
    req: toFetchRequest(request),
    router: createPrivateDashboardApiRouter(dashboard),
    createContext: () => ({}),
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
}

function createPrivateDashboardApiRouter(dashboard: EmbeddedDashboardInstance) {
  const t = initTRPC.create();

  return t.router({
    queueSource: t.router({
      status: t.procedure.query(() => dashboard.getQueueSourceStatus()),
    }),
    queues: t.router({
      list: t.procedure.query(() => dashboard.listQueues()),
      pause: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          dashboard.pauseQueue(getQueueKeyInput(input).queueKey),
        ),
      ),
      resume: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          dashboard.resumeQueue(getQueueKeyInput(input).queueKey),
        ),
      ),
    }),
    jobs: t.router({
      retry: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () => {
          const { jobId, queueKey } = getJobMutationInput(input);
          return dashboard.retryJob(queueKey, jobId);
        }),
      ),
      remove: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () => {
          const { jobId, queueKey } = getJobMutationInput(input);
          return dashboard.removeJob(queueKey, jobId);
        }),
      ),
    }),
  });
}

async function runPrivateDashboardMutation(
  dashboard: EmbeddedDashboardInstance,
  operation: () => Promise<void>,
): Promise<{ success: true }> {
  try {
    assertCanMutate(dashboard.config);
    await operation();
    return { success: true };
  } catch (error) {
    if (error instanceof ReadOnlyDashboardError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: error.message,
      });
    }

    throw error;
  }
}

function getQueueKeyInput(input: unknown): { queueKey: string } {
  const value = unwrapJsonInput(input);

  if (
    value &&
    typeof value === "object" &&
    "queueKey" in value &&
    typeof value.queueKey === "string"
  ) {
    return {
      queueKey: value.queueKey,
    };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A queueKey string is required.",
  });
}

function getJobMutationInput(input: unknown): {
  jobId: string;
  queueKey: string;
} {
  const value = unwrapJsonInput(input);
  const { queueKey } = getQueueKeyInput(value);

  if (
    value &&
    typeof value === "object" &&
    "jobId" in value &&
    typeof value.jobId === "string"
  ) {
    return {
      jobId: value.jobId,
      queueKey,
    };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A jobId string is required.",
  });
}

function unwrapJsonInput(input: unknown): unknown {
  if (input && typeof input === "object" && "json" in input) {
    return input.json;
  }

  return input;
}

function toFetchRequest(request: FrameworkRequest): Request {
  return new Request(toAbsoluteUrl(request.url), {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : (request.body as BodyInit | null | undefined),
  });
}

function toFetchHeaders(
  headers: FrameworkRequest["headers"],
): HeadersInit | undefined {
  if (!headers || headers instanceof Headers) {
    return headers;
  }

  const fetchHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        fetchHeaders.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      fetchHeaders.set(name, value);
    }
  }

  return fetchHeaders;
}

function getPrivateDashboardApiEndpoint(url: string): string {
  const pathname = getPathname(url);
  const apiPathIndex = pathname.indexOf("/api/trpc");

  if (apiPathIndex === -1) {
    return "/api/trpc";
  }

  return pathname.slice(0, apiPathIndex + "/api/trpc".length);
}

function getPathname(url: string): string {
  return new URL(toAbsoluteUrl(url)).pathname;
}

function toAbsoluteUrl(url: string): string {
  return URL.canParse(url) ? url : `http://bullstudio.local${url}`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function indexQueueAdaptersByKey(
  queues: QueueAdapter[],
): Map<string, QueueAdapter> {
  const queuesByKey = new Map<string, QueueAdapter>();

  for (const queue of queues) {
    if (queuesByKey.has(queue.key)) {
      throw new Error(
        `Duplicate supplied queue key "${queue.key}". Queue keys must be unique.`,
      );
    }
    queuesByKey.set(queue.key, queue);
  }

  return queuesByKey;
}

function getQueueAdapter(
  queueAdaptersByKey: Map<string, QueueAdapter>,
  queueKey: string,
): QueueAdapter {
  const queue = queueAdaptersByKey.get(queueKey);

  if (!queue) {
    throw new Error(`Supplied queue "${queueKey}" was not found.`);
  }

  return queue;
}

async function getDashboardQueue(queue: QueueAdapter): Promise<DashboardQueue> {
  return {
    key: queue.key,
    label: queue.label,
    provider: queue.provider,
    capabilities: queue.capabilities,
    ...(await queue.getQueue()),
  };
}

function resolveDashboardConfig(
  config: DashboardConfig,
): ResolvedDashboardConfig {
  return {
    queues: config.queues,
    readOnly: config.readOnly ?? false,
    protection: config.protection ?? defaultProtection,
    dashboardIdentity: config.dashboardIdentity ?? defaultDashboardIdentity,
    documentIdentity: config.documentIdentity ?? defaultDocumentIdentity,
  };
}

function getQueueSourceStatus(
  config: ResolvedDashboardConfig,
): QueueSourceStatus {
  return {
    mode: "embedded",
    source: "supplied",
    status: "healthy",
    queueCount: config.queues.length,
    providers: getProviders(config.queues),
    capabilities: aggregateCapabilities(config.queues),
    readOnly: config.readOnly,
    mutationsAllowed: !config.readOnly,
  };
}

function getProviders(queues: QueueAdapter[]): QueueAdapterProvider[] {
  return [...new Set(queues.map((queue) => queue.provider))].sort();
}

function aggregateCapabilities(queues: QueueAdapter[]): AdapterCapabilities {
  return queues.reduce<AdapterCapabilities>(
    (result, queue) => ({
      flows: result.flows || queue.capabilities.flows,
      jobLogs: result.jobLogs || queue.capabilities.jobLogs,
      jobRemoval: result.jobRemoval || queue.capabilities.jobRemoval,
      jobRetry: result.jobRetry || queue.capabilities.jobRetry,
      queuePause: result.queuePause || queue.capabilities.queuePause,
      queueResume: result.queueResume || queue.capabilities.queueResume,
      workers: result.workers || queue.capabilities.workers,
    }),
    defaultCapabilities,
  );
}
