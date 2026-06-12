import type {
  AddJobInput,
  AdapterCapabilities,
  FlowSummary,
  FlowTree,
  Job,
  JobCounts,
  JobQueryOptions,
  JobScheduler,
  JobSchedulerTarget,
  JobSummary,
  Queue,
  QueueAdapter,
  QueueAdapterProvider,
  QueueMetricSnapshot,
  QueueMetricType,
  UpsertJobSchedulerInput,
  Worker,
  WorkerCount,
} from "@bullstudio/connect-types";

export type DashboardMode = "embedded";

export type {
  AdapterCapabilities,
  QueueAdapter,
  QueueAdapterProvider,
  QueueMetricSnapshot,
  QueueMetricType,
} from "@bullstudio/connect-types";

export type DashboardProtection =
  | BasicAuthProtection
  | SessionDashboardProtection
  | DisabledDashboardProtection
  | CustomDashboardProtection;

export interface BasicAuthProtection {
  type: "basic";
  username: string;
  password: string;
  sessionSecret?: string;
  tokenTtlSeconds?: number;
  cookieName?: string;
}

export interface SessionDashboardProtection {
  type: "session" | "basic";
  username: string;
  password: string;
  sessionSecret?: string;
  tokenTtlSeconds?: number;
  cookieName?: string;
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

/**
 * Controls how aggressively the dashboard polls the backend (and therefore
 * Redis). Operators set this to protect their Redis instance — especially on
 * pay-per-command hosted Redis where every poll has a cost.
 */
export interface PollingConfig {
  /**
   * Master switch. When `false`, the dashboard never polls and end-users
   * cannot turn polling on. Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Default poll interval in milliseconds applied to every live view.
   * Defaults to 2000.
   */
  interval?: number;
  /**
   * Optional floor (ms) end-users cannot poll faster than. Lets operators cap
   * load without disabling user overrides entirely.
   */
  minInterval?: number;
  /**
   * Whether end-users may change the interval / turn polling off from the
   * dashboard UI. Defaults to `true`. When `false`, the operator's `interval`
   * is pinned and the in-dashboard control is hidden.
   */
  allowUserOverride?: boolean;
}

export interface ResolvedPollingConfig {
  enabled: boolean;
  interval: number;
  minInterval?: number;
  allowUserOverride: boolean;
}

export interface DashboardConfig {
  queues: QueueAdapter[];
  readOnly?: boolean;
  protection?: DashboardProtection;
  dashboardIdentity?: DashboardIdentity;
  documentIdentity?: DocumentIdentity;
  basePath?: string;
  polling?: PollingConfig;
}

export interface ResolvedDashboardConfig {
  queues: QueueAdapter[];
  readOnly: boolean;
  protection: DashboardProtection;
  dashboardIdentity: DashboardIdentity;
  documentIdentity: DocumentIdentity;
  basePath: string;
  polling: ResolvedPollingConfig;
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
  basePath?: string;
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
  drainQueue(queueKey: string): Promise<void>;
  addJob(queueKey: string, input: AddJobInput): Promise<void>;
  getJobs(queueKey: string, options?: JobQueryOptions): Promise<Job[]>;
  getJobsSummary(
    queueKey: string,
    options?: JobQueryOptions,
  ): Promise<JobSummary[]>;
  getQueueMetrics(
    queueKey: string,
    type: QueueMetricType,
  ): Promise<QueueMetricSnapshot | null>;
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
  listWorkers(queueKey: string): Promise<Worker[]>;
  listFlows(options?: {
    limit?: number;
    queueKey?: string;
  }): Promise<FlowSummary[]>;
  getFlow(queueKey: string, flowId: string): Promise<FlowTree | null>;
  getJobFlow(queueKey: string, jobId: string): Promise<FlowTree | null>;
  listQueueSchedulers(
    queueKey: string,
    options?: { limit?: number },
  ): Promise<JobScheduler[]>;
  getJobScheduler(
    queueKey: string,
    target: JobSchedulerTarget,
  ): Promise<JobScheduler | null>;
  upsertJobScheduler(
    queueKey: string,
    input: UpsertJobSchedulerInput,
  ): Promise<void>;
  removeJobScheduler(
    queueKey: string,
    target: JobSchedulerTarget,
  ): Promise<boolean>;
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}

export interface StandaloneDashboardInstance {
  mode: "standalone";
  config: ResolvedStandaloneDashboardConfig;
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}
