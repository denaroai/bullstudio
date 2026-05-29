import type { FlowSummary, FlowTree } from "./flow";
import type { Job, JobQueryOptions, JobSummary } from "./job";
import type { JobCounts, Queue } from "./queue";
import type { WorkerCount } from "./worker";

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
