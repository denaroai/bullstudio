import type {
  FlowSummary,
  FlowTree,
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
  listFlows?(options?: { limit?: number }): Promise<FlowSummary[]>;
  getFlow?(flowId: string): Promise<FlowTree | null>;
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
  basePath?: string;
}

export interface ResolvedDashboardConfig {
  queues: QueueAdapter[];
  readOnly: boolean;
  protection: DashboardProtection;
  dashboardIdentity: DashboardIdentity;
  documentIdentity: DocumentIdentity;
  basePath: string;
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
  listFlows(options?: { limit?: number }): Promise<FlowSummary[]>;
  getFlow(queueKey: string, flowId: string): Promise<FlowTree | null>;
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}

export interface StandaloneDashboardInstance {
  mode: "standalone";
  config: ResolvedStandaloneDashboardConfig;
  handle(request: FrameworkRequest): Promise<FrameworkResponse>;
  mountPrivateDashboardApi(): PrivateDashboardApiMount;
}
