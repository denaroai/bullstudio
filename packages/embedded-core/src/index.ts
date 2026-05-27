import type {
  Job,
  JobCounts,
  JobQueryOptions,
  JobSummary,
  Queue,
  WorkerCount,
} from "@bullstudio/connect-types";

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

export interface QueueSourceStatus {
  source: "supplied";
  status: "healthy" | "degraded" | "unhealthy";
  queueCount: number;
  providers: QueueAdapterProvider[];
  capabilities: AdapterCapabilities;
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

  return {
    mode: "embedded",
    config: resolvedConfig,
    queues: resolvedConfig.queues,
    getQueueSourceStatus: () => getQueueSourceStatus(resolvedConfig.queues),
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
    pauseQueue: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).pauseQueue(),
    resumeQueue: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).resumeQueue(),
    getJobs: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobs(options),
    getJobsSummary: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobsSummary(options),
    getJob: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJob(jobId),
    getJobLogs: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobLogs(jobId),
    retryJob: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).retryJob(jobId),
    removeJob: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).removeJob(jobId),
    getWorkerCount: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getWorkerCount(),
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
