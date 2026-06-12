import type {
  JobSummary,
  QueueMetricSnapshot,
} from "@bullstudio/connect-types";
import type { OverviewMetricsResponse, QueueMetricsSummary } from "./types";

export const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// Choose a time-series bucket size that keeps the chart readable (~5–24 points)
// for the selected range. Metric snapshots are per-minute, so 1 min is the floor.
function getBucketMs(timeRangeHours: number): number {
  const rangeMs = timeRangeHours * HOUR_MS;
  if (rangeMs <= 15 * MINUTE_MS) return MINUTE_MS; // ≤15m → 1-min
  if (rangeMs <= 30 * MINUTE_MS) return 2 * MINUTE_MS; // ≤30m → 2-min
  if (rangeMs <= HOUR_MS) return 5 * MINUTE_MS; // ≤1h  → 5-min
  if (rangeMs <= 6 * HOUR_MS) return 30 * MINUTE_MS; // ≤6h  → 30-min
  return HOUR_MS; // >6h  → 1-hour
}

export type OverviewJobSummary = JobSummary & { queueKey?: string };

export function aggregateOverviewMetrics(
  jobs: OverviewJobSummary[],
  timeRangeHours: number,
  queuesCount: number,
  queueMetrics: QueueMetricsSummary[] = [],
  now: number = Date.now(),
): OverviewMetricsResponse {
  const cutoff = now - timeRangeHours * HOUR_MS;
  // A queue is "metric-backed" only when it is actively recording metrics.
  // Otherwise its throughput falls back to counting raw job summaries.
  const metricBackedQueues = queueMetrics.filter(hasRecordedMetrics);

  const fallbackJobs = jobs.filter(
    (job) => !isMetricBacked(job, metricBackedQueues),
  );
  const totalCompleted =
    fallbackJobs.filter((job) => job.status === "completed").length +
    sumMetricsInRange(metricBackedQueues, "completed", cutoff, now);
  const totalFailed =
    fallbackJobs.filter((job) => job.status === "failed").length +
    sumMetricsInRange(metricBackedQueues, "failed", cutoff, now);
  const totalJobs = totalCompleted + totalFailed;

  // Timing, slowest jobs, and failing types are never available from metrics,
  // so they always derive from the full set of raw job summaries.
  const jobsWithProcessingTime = jobs.filter(
    (job) => job.processedOn && job.finishedOn,
  );
  const jobsWithDelay = jobs.filter((job) => job.processedOn && job.timestamp);
  const failedJobs = jobs.filter((job) => job.status === "failed");

  const processingTimeRange = minMax(
    jobsWithProcessingTime.map(processingTimeOf),
  );
  const delayRange = minMax(
    jobsWithDelay.map((job) => Math.max(0, delayOf(job))),
  );

  return {
    summary: {
      totalCompleted,
      totalFailed,
      avgThroughputPerHour: totalJobs / timeRangeHours,
      failureRate: totalJobs > 0 ? (totalFailed / totalJobs) * 100 : 0,
      avgProcessingTimeMs: averageProcessingTime(jobsWithProcessingTime),
      minProcessingTimeMs: processingTimeRange.min,
      maxProcessingTimeMs: processingTimeRange.max,
      avgDelayMs: Math.max(0, averageDelay(jobsWithDelay)),
      minDelayMs: delayRange.min,
      maxDelayMs: delayRange.max,
    },
    timeSeries: buildOverviewTimeSeries(
      jobs,
      timeRangeHours,
      metricBackedQueues,
      now,
    ),
    slowestJobs: buildOverviewSlowestJobs(jobsWithProcessingTime),
    failingJobTypes: buildOverviewFailingJobTypes(failedJobs),
    queuesCount,
    nativeMetrics: {
      totalQueues: queueMetrics.length,
      recordingQueues: metricBackedQueues.length,
    },
    lastUpdated: now,
  };
}

function hasRecordedMetrics(metric: QueueMetricsSummary): boolean {
  return (
    (metric.completed?.meta.count ?? 0) > 0 ||
    (metric.failed?.meta.count ?? 0) > 0
  );
}

function isMetricBacked(
  job: OverviewJobSummary,
  metricBackedQueues: QueueMetricsSummary[],
): boolean {
  return metricBackedQueues.some((metric) => metricMatchesJob(metric, job));
}

function metricMatchesJob(
  metric: QueueMetricsSummary,
  job: OverviewJobSummary,
): boolean {
  if (metric.queueKey && job.queueKey) {
    return metric.queueKey === job.queueKey;
  }
  return (
    metric.queueName === job.queueName &&
    (!metric.prefix || metric.prefix === job.prefix)
  );
}

/**
 * Walk a metric snapshot's per-minute data points, newest first, invoking
 * `visit` for each non-zero point that falls inside `[cutoff, now]`.
 */
function forEachMetricPointInRange(
  snapshot: QueueMetricSnapshot | null,
  cutoff: number,
  now: number,
  visit: (value: number, minute: number) => void,
): void {
  if (!snapshot || snapshot.meta.count === 0) {
    return;
  }

  const newestMinute = Math.floor(snapshot.meta.prevTS / MINUTE_MS) * MINUTE_MS;
  for (let index = 0; index < snapshot.data.length; index++) {
    const value = snapshot.data[index];
    if (!value) {
      continue;
    }
    const minute = newestMinute - index * MINUTE_MS;
    if (minute < cutoff || minute > now) {
      continue;
    }
    visit(value, minute);
  }
}

function sumMetricsInRange(
  metricBackedQueues: QueueMetricsSummary[],
  type: "completed" | "failed",
  cutoff: number,
  now: number,
): number {
  let total = 0;
  for (const metric of metricBackedQueues) {
    forEachMetricPointInRange(metric[type], cutoff, now, (value) => {
      total += value;
    });
  }
  return total;
}

type TimeSeriesBucket = {
  // All raw jobs in the bucket, used for timing regardless of metric backing.
  timingJobs: OverviewJobSummary[];
  completed: number;
  failed: number;
};

function buildOverviewTimeSeries(
  jobs: OverviewJobSummary[],
  timeRangeHours: number,
  metricBackedQueues: QueueMetricsSummary[],
  now: number,
): OverviewMetricsResponse["timeSeries"] {
  const bucketMs = getBucketMs(timeRangeHours);
  const rangeMs = timeRangeHours * HOUR_MS;
  const cutoff = now - rangeMs;
  const buckets = new Map<number, TimeSeriesBucket>();

  const bucketCount = Math.ceil(rangeMs / bucketMs);
  for (let index = 0; index < bucketCount; index++) {
    const bucketStart =
      Math.floor((now - index * bucketMs) / bucketMs) * bucketMs;
    buckets.set(bucketStart, { timingJobs: [], completed: 0, failed: 0 });
  }

  for (const job of jobs) {
    if (!job.finishedOn) {
      continue;
    }

    const bucketStart = Math.floor(job.finishedOn / bucketMs) * bucketMs;
    const bucket = buckets.get(bucketStart);
    if (!bucket) {
      continue;
    }

    bucket.timingJobs.push(job);
    // Only count jobs from queues without metrics; metric-backed queues
    // contribute their counts from the snapshot below.
    if (!isMetricBacked(job, metricBackedQueues)) {
      if (job.status === "completed") {
        bucket.completed++;
      } else if (job.status === "failed") {
        bucket.failed++;
      }
    }
  }

  for (const metric of metricBackedQueues) {
    addMetricToBuckets(
      buckets,
      metric.completed,
      "completed",
      cutoff,
      now,
      bucketMs,
    );
    addMetricToBuckets(buckets, metric.failed, "failed", cutoff, now, bucketMs);
  }

  return Array.from(buckets.entries())
    .map(([timestamp, bucket]) => ({
      timestamp,
      completed: bucket.completed,
      failed: bucket.failed,
      avgProcessingTimeMs: averageProcessingTime(
        bucket.timingJobs.filter((job) => job.processedOn && job.finishedOn),
      ),
      avgDelayMs: Math.max(
        0,
        averageDelay(bucket.timingJobs.filter((job) => job.processedOn)),
      ),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function addMetricToBuckets(
  buckets: Map<number, TimeSeriesBucket>,
  snapshot: QueueMetricSnapshot | null,
  type: "completed" | "failed",
  cutoff: number,
  now: number,
  bucketMs: number,
): void {
  forEachMetricPointInRange(snapshot, cutoff, now, (value, minute) => {
    const bucketStart = Math.floor(minute / bucketMs) * bucketMs;
    const bucket = buckets.get(bucketStart);
    if (bucket) {
      bucket[type] += value;
    }
  });
}

function buildOverviewSlowestJobs(
  jobs: JobSummary[],
): OverviewMetricsResponse["slowestJobs"] {
  return jobs
    .map((job) => ({
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      processingTimeMs:
        (job.finishedOn ?? job.processedOn ?? 0) - (job.processedOn ?? 0),
      timestamp: job.timestamp,
      status: job.status,
    }))
    .sort((a, b) => b.processingTimeMs - a.processingTimeMs)
    .slice(0, 10);
}

function buildOverviewFailingJobTypes(
  failedJobs: JobSummary[],
): OverviewMetricsResponse["failingJobTypes"] {
  const grouped = new Map<string, JobSummary[]>();

  for (const job of failedJobs) {
    const key = `${job.queueName}:${job.name}`;
    const jobs = grouped.get(key) ?? [];
    jobs.push(job);
    grouped.set(key, jobs);
  }

  return Array.from(grouped.entries())
    .map(([key, jobs]) => {
      const parts = key.split(":");
      const queueName = parts[0] ?? "";
      const name = parts.slice(1).join(":");
      const sorted = [...jobs].sort(
        (a, b) => (b.finishedOn || 0) - (a.finishedOn || 0),
      );
      const latest = sorted[0];

      return {
        name,
        queueName,
        failureCount: jobs.length,
        lastFailedAt: latest?.finishedOn || latest?.timestamp || 0,
        lastFailedReason: latest?.failedReason,
      };
    })
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10);
}

function processingTimeOf(job: JobSummary): number {
  return (job.finishedOn ?? job.processedOn ?? 0) - (job.processedOn ?? 0);
}

function delayOf(job: JobSummary): number {
  return (job.processedOn ?? job.timestamp) - job.timestamp - (job.delay || 0);
}

function averageProcessingTime(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return (
    jobs.reduce((sum, job) => sum + processingTimeOf(job), 0) / jobs.length
  );
}

function averageDelay(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return jobs.reduce((sum, job) => sum + delayOf(job), 0) / jobs.length;
}

function minMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}
