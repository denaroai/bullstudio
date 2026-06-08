import type {
  Job,
  JobCounts,
  JobQueryOptions,
  JobSummary,
  Queue,
  WorkerCount,
} from "@bullstudio/connect-types";
import type { QueueProviderCapabilities } from "./provider-capabilities.types";

/**
 * Provider type identifier for extensibility.
 */
export type QueueProviderType = "bullmq" | "bull" | "agenda" | "bee";

/**
 * Callbacks for connection events from the queue service.
 */
export interface QueueServiceEventCallbacks {
  onDisconnect?: (reason?: string) => void;
  onError?: (error: Error) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
}

/**
 * Configuration for initializing a queue service provider.
 */
export interface QueueServiceConfig {
  redisUrl: string;
  /** Single prefix (backward compat). Ignored when prefixes is set. */
  prefix?: string;
  /** Explicit list of prefixes. Use `["*"]` for auto-discovery. */
  prefixes?: string[];
  eventCallbacks?: QueueServiceEventCallbacks;
}

/**
 * Abstract interface for queue service providers.
 * Implement this interface to add support for different queue systems.
 */
export interface QueueService {
  /** Provider type identifier */
  readonly providerType: QueueProviderType;

  /** Establish connection to the queue backend */
  connect(): Promise<void>;

  /** Gracefully disconnect from the queue backend */
  disconnect(): Promise<void>;

  /** Check if currently connected */
  isConnected(): boolean;

  /** Return all discovered prefixes. */
  getPrefixes(): Promise<string[]>;

  // Queue operations
  getQueues(): Promise<Queue[]>;
  getQueue(name: string, prefix?: string): Promise<Queue | null>;
  pauseQueue(queueName: string, prefix?: string): Promise<void>;
  resumeQueue(queueName: string, prefix?: string): Promise<void>;
  getJobCounts(queueName: string, prefix?: string): Promise<JobCounts>;

  // Job operations
  getJobs(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<Job[]>;
  getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<JobSummary[]>;
  getJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<Job | null>;
  getJobLogs(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<{ logs: string[]; count: number }>;
  retryJob(queueName: string, jobId: string, prefix?: string): Promise<void>;
  removeJob(queueName: string, jobId: string, prefix?: string): Promise<void>;

  // Worker operations
  getWorkerCount(queueName: string, prefix?: string): Promise<WorkerCount>;

  // Provider capabilities
  getCapabilities(): QueueProviderCapabilities;
}
