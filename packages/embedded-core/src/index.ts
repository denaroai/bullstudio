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

export interface QueueSourceStatus {
  source: "supplied";
  status: "healthy" | "degraded" | "unhealthy";
  queueCount: number;
  providers: QueueAdapterProvider[];
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

  return {
    mode: "embedded",
    config: resolvedConfig,
    queues: resolvedConfig.queues,
    getQueueSourceStatus: () => getQueueSourceStatus(resolvedConfig.queues),
    handle: async () => ({
      status: 501,
      body: "Dashboard assets are not mounted in this implementation slice.",
    }),
    mountPrivateDashboardApi: () => ({
      handle: async () => ({
        status: 501,
        body: "Private dashboard API is not mounted in this implementation slice.",
      }),
    }),
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

function getQueueSourceStatus(queues: QueueAdapter[]): QueueSourceStatus {
  return {
    source: "supplied",
    status: "healthy",
    queueCount: queues.length,
    providers: getProviders(queues),
    capabilities: aggregateCapabilities(queues),
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
