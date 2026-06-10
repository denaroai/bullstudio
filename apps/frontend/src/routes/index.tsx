import dayjs from "@bullstudio/dayjs";
import { Button } from "@bullstudio/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { EmptyState } from "@bullstudio/ui/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Layers, RefreshCw } from "lucide-react";
import { useState } from "react";
import Header from "@/components/Header";
import { FailingJobTypesTable } from "@/components/overview/FailingJobTypesTable";
import { MetricCardsGrid } from "@/components/overview/MetricCardsGrid";
import { ProcessingTimeChart } from "@/components/overview/ProcessingTimeChart";
import { SlowestJobsTable } from "@/components/overview/SlowestJobsTable";
import { ThroughputChart } from "@/components/overview/ThroughputChart";
import { useTRPC } from "@/integrations/trpc/react";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

export const Route = createFileRoute("/")({ component: OverviewPage });

import { parseQueueKey, queueKey } from "@/lib/queue-key";
import { TIME_RANGES } from "@/lib/time-ranges";

const ALL_QUEUES_VALUE = "__all__";
const OVERVIEW_SKELETON_KEYS = [
  "summary-1",
  "summary-2",
  "summary-3",
  "summary-4",
];

function OverviewPage() {
  const trpc = useTRPC();
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [timeRange, setTimeRange] = useState<number>(5 / 60);

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(),
  );

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;

  const parsed = selectedQueue ? parseQueueKey(selectedQueue) : null;

  const {
    data: metrics,
    isLoading: loadingMetrics,
    refetch,
    isFetching,
  } = useQuery(
    trpc.overview.metrics.queryOptions({
      timeRangeHours: timeRange,
      queueName: parsed?.name,
      prefix: parsed?.prefix,
    }),
  );

  return (
    <div className="space-y-6">
      <Header title="Overview" />

      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedQueue || ALL_QUEUES_VALUE}
            onValueChange={(value) =>
              setSelectedQueue(value === ALL_QUEUES_VALUE ? "" : value)
            }
            disabled={loadingQueues}
          >
            <SelectTrigger className="w-[250px] bg-card">
              <Layers className="size-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_QUEUES_VALUE}>All queues</SelectItem>
              {queues?.map((queue) => (
                <SelectItem
                  key={queueKey(queue.prefix ?? "", queue.name)}
                  value={queueKey(queue.prefix ?? "", queue.name)}
                  className="font-mono"
                >
                  {hasMultiplePrefixes && (
                    <span className="text-muted-foreground mr-1">
                      {queue.prefix}/
                    </span>
                  )}
                  {queue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(timeRange)}
            onValueChange={(value) => setTimeRange(Number(value))}
          >
            <SelectTrigger className="w-[130px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          {metrics?.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {dayjs(metrics.lastUpdated).fromNow()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-card"
          >
            <RefreshCw
              className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {loadingMetrics ? (
        <OverviewSkeleton />
      ) : queues && queues.length === 0 ? (
        <EmptyState
          icon={<Database className="size-12" />}
          title="No queues found"
          description={
            queueSource?.mode === "embedded"
              ? "No supplied queues are available in this dashboard."
              : "No BullMQ queues were found in the connected Redis instance. Make sure you have queues set up."
          }
        />
      ) : metrics ? (
        <>
          <MetricCardsGrid
            summary={metrics.summary}
            timeSeries={metrics.timeSeries}
            timeRange={timeRange}
            nativeMetrics={metrics.nativeMetrics}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <ThroughputChart
              data={metrics.timeSeries}
              timeRange={timeRange}
              nativeMetrics={metrics.nativeMetrics}
            />
            <ProcessingTimeChart
              data={metrics.timeSeries}
              timeRange={timeRange}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SlowestJobsTable jobs={metrics.slowestJobs} />
            <FailingJobTypesTable jobTypes={metrics.failingJobTypes} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OVERVIEW_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-32 w-full bg-zinc-800/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 w-full bg-zinc-800/50" />
        <Skeleton className="h-96 w-full bg-zinc-800/50" />
      </div>
    </div>
  );
}
