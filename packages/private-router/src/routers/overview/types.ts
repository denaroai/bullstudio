import type { QueueMetricSnapshot } from "@bullstudio/connect-types";

export type OverviewMetricsInput = {
  timeRangeHours: number;
  queueKey?: string;
  queueName?: string;
  prefix?: string;
};

export type QueueMetricsListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
};

/**
 * Native throughput metrics for a single queue. `completed`/`failed` are
 * `null` when the queue's backend exposes no metrics API; both are present
 * (but may be empty) when it does. Whether metrics are actually being
 * recorded is signalled by `meta.count > 0`.
 */
export type QueueMetricsSummary = {
  queueKey?: string;
  queueName: string;
  prefix?: string;
  completed: QueueMetricSnapshot | null;
  failed: QueueMetricSnapshot | null;
};

export type OverviewMetricsResponse = {
  summary: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughputPerHour: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    minProcessingTimeMs: number;
    maxProcessingTimeMs: number;
    avgDelayMs: number;
    minDelayMs: number;
    maxDelayMs: number;
  };
  timeSeries: Array<{
    timestamp: number;
    completed: number;
    failed: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  }>;
  slowestJobs: Array<{
    id: string;
    name: string;
    queueName: string;
    processingTimeMs: number;
    timestamp: number;
    status: string;
  }>;
  failingJobTypes: Array<{
    name: string;
    queueName: string;
    failureCount: number;
    lastFailedAt: number;
    lastFailedReason?: string;
  }>;
  queuesCount: number;
  /**
   * Coverage of native Bull/BullMQ throughput metrics for the queues in scope.
   * When `recordingQueues < totalQueues`, some throughput/failure figures were
   * estimated from raw jobs in Redis instead of `getMetrics()`, and may be
   * inaccurate (e.g. when finished jobs are removed).
   */
  nativeMetrics: {
    totalQueues: number;
    recordingQueues: number;
  };
  lastUpdated: number;
};
