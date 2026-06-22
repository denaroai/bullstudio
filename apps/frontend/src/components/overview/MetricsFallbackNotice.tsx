import type { OverviewMetricsResponse } from "@bullstudio/private-router";
import { cn } from "@bullstudio/ui/lib/utils";
import { AlertTriangle } from "lucide-react";

const METRICS_DOCS_URL =
  "https://bullstudio.dev/docs/operating-dashboard#throughput-metrics";

type MetricsFallbackNoticeProps = {
  nativeMetrics: OverviewMetricsResponse["nativeMetrics"];
  className?: string;
};

/**
 * Shown below throughput-related charts when one or more queues in view are not
 * recording native Bull/BullMQ metrics, so their figures were estimated from
 * the jobs still in Redis and may be inaccurate. Renders nothing otherwise.
 */
export function MetricsFallbackNotice({
  nativeMetrics,
  className,
}: MetricsFallbackNoticeProps) {
  const { totalQueues, recordingQueues } = nativeMetrics;

  if (totalQueues === 0 || recordingQueues >= totalQueues) {
    return null;
  }

  const scope =
    totalQueues === 1
      ? "this queue"
      : `${totalQueues - recordingQueues} of ${totalQueues} queues`;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-500" />
      <span>
        Built-in metrics aren't enabled for {scope}. Throughput and failure rate
        are estimated from jobs still in Redis and may be inaccurate.{" "}
        <a
          href={METRICS_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Learn more about throughput and failure rate metrics"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Learn more
        </a>
      </span>
    </p>
  );
}
