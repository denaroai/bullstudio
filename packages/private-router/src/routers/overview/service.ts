import type { PrivateDashboardQueueSource } from "../../source";
import { resolveQueueTarget } from "../../shared/queue-target";
import { aggregateOverviewMetrics, HOUR_MS } from "./metrics";
import type {
  OverviewMetricsInput,
  OverviewMetricsResponse,
  QueueMetricsListInput,
} from "./types";

export async function getOverviewMetrics(
  source: PrivateDashboardQueueSource,
  input: OverviewMetricsInput,
): Promise<OverviewMetricsResponse> {
  const target =
    input.queueKey || input.queueName
      ? await resolveQueueTarget(source, input)
      : undefined;
  const queuesCount = target ? 1 : (await source.listQueues()).length;
  const now = Date.now();
  const cutoffTimestamp = now - input.timeRangeHours * HOUR_MS;
  const sourceInput = {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
    limit: 1000,
    offset: 0,
  };
  const metricsInput: QueueMetricsListInput = {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
  };
  // Native throughput metrics give accurate completed/failed counts even when
  // jobs are removed; raw job summaries still feed timing, slowest jobs, and
  // failing-type breakdowns, which metrics cannot provide.
  const [completed, failed, queueMetrics] = await Promise.all([
    source.listJobSummaries({ ...sourceInput, status: "completed" }),
    source.listJobSummaries({ ...sourceInput, status: "failed" }),
    source.listQueueMetrics(metricsInput),
  ]);
  const jobs = [...completed, ...failed].filter(
    (job) => job.finishedOn && job.finishedOn >= cutoffTimestamp,
  );

  return aggregateOverviewMetrics(
    jobs,
    input.timeRangeHours,
    queuesCount,
    queueMetrics,
    now,
  );
}
