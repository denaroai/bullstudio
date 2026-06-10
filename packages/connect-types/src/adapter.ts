import type { FlowSummary, FlowTree } from "./flow";
import type { Job, JobQueryOptions, JobSummary } from "./job";
import type { JobCounts, Queue } from "./queue";
import type {
  JobScheduler,
  JobSchedulerTarget,
  UpsertJobSchedulerInput,
} from "./scheduler";
import type { Worker, WorkerCount } from "./worker";

export type QueueAdapterProvider = "bullmq" | "bull";

export interface AdapterCapabilities {
  flows: boolean;
  jobLogs: boolean;
  jobRemoval: boolean;
  jobRetry: boolean;
  queuePause: boolean;
  queueResume: boolean;
  queueDrain: boolean;
  schedulers: boolean;
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
  drainQueue(): Promise<void>;
  getJobs(options?: JobQueryOptions): Promise<Job[]>;
  getJobsSummary(options?: JobQueryOptions): Promise<JobSummary[]>;
  getJob(jobId: string): Promise<Job | null>;
  getJobLogs(jobId: string): Promise<{ logs: string[]; count: number }>;
  retryJob(jobId: string): Promise<void>;
  removeJob(jobId: string): Promise<void>;
  getWorkerCount(): Promise<WorkerCount>;
  listWorkers?(): Promise<Worker[]>;
  listFlows?(options?: { limit?: number }): Promise<FlowSummary[]>;
  getFlow?(flowId: string): Promise<FlowTree | null>;
  listJobSchedulers?(options?: { limit?: number }): Promise<JobScheduler[]>;
  getJobScheduler?(target: JobSchedulerTarget): Promise<JobScheduler | null>;
  upsertJobScheduler?(input: UpsertJobSchedulerInput): Promise<void>;
  removeJobScheduler?(target: JobSchedulerTarget): Promise<boolean>;
}
