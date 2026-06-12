import type { FlowSummary, FlowTree } from "./flow";
import type { AddJobInput, Job, JobQueryOptions, JobSummary } from "./job";
import type { JobCounts, Queue } from "./queue";
import type {
  JobScheduler,
  JobSchedulerTarget,
  UpsertJobSchedulerInput,
} from "./scheduler";
import type { Worker, WorkerCount } from "./worker";

export type QueueAdapterProvider = "bullmq" | "bull";

export type QueueMetricType = "completed" | "failed";

/**
 * Lightweight, per-minute throughput counters maintained natively by
 * Bull/BullMQ (the `metrics` worker option). Unlike raw jobs, these survive
 * job removal, so they give accurate throughput even when `removeOnComplete`
 * is enabled.
 */
export interface QueueMetricSnapshot {
  meta: {
    /** Cumulative count of finished jobs of this type, all-time. */
    count: number;
    /** Timestamp (ms) of the most recently recorded data point. */
    prevTS: number;
    prevCount: number;
  };
  /** Per-minute job counts, newest first (index 0 === the `prevTS` minute). */
  data: number[];
  /** Number of data points returned. */
  count: number;
}

export interface AdapterCapabilities {
  flows: boolean;
  jobLogs: boolean;
  jobRemoval: boolean;
  jobRetry: boolean;
  queuePause: boolean;
  queueResume: boolean;
  queueDrain: boolean;
  queueAddJob: boolean;
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
  addJob?(input: AddJobInput): Promise<void>;
  getJobs(options?: JobQueryOptions): Promise<Job[]>;
  getJobsSummary(options?: JobQueryOptions): Promise<JobSummary[]>;
  /**
   * Native throughput metrics, when the underlying queue records them.
   * Optional: omitted by adapters whose backend has no metrics API.
   */
  getMetrics?(type: QueueMetricType): Promise<QueueMetricSnapshot>;
  getJob(jobId: string): Promise<Job | null>;
  getJobLogs(jobId: string): Promise<{ logs: string[]; count: number }>;
  retryJob(jobId: string): Promise<void>;
  /** Re-enqueue all failed jobs. Returns the number of jobs retried. */
  retryFailedJobs(): Promise<number>;
  removeJob(jobId: string): Promise<void>;
  getWorkerCount(): Promise<WorkerCount>;
  listWorkers?(): Promise<Worker[]>;
  listFlows?(options?: { limit?: number }): Promise<FlowSummary[]>;
  getFlow?(flowId: string): Promise<FlowTree | null>;
  /**
   * Resolve the full flow a job belongs to. Walks up from the given job to the
   * flow's root (across queues) and returns the entire tree, or `null` when the
   * job is not part of a flow.
   */
  getJobFlow?(jobId: string): Promise<FlowTree | null>;
  listJobSchedulers?(options?: { limit?: number }): Promise<JobScheduler[]>;
  getJobScheduler?(target: JobSchedulerTarget): Promise<JobScheduler | null>;
  upsertJobScheduler?(input: UpsertJobSchedulerInput): Promise<void>;
  removeJobScheduler?(target: JobSchedulerTarget): Promise<boolean>;
}
