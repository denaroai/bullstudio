import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@bullstudio/ui/components/alert-dialog";
import { Button } from "@bullstudio/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Separator } from "@bullstudio/ui/components/separator";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { EmptyState } from "@bullstudio/ui/shared";
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock,
  Database,
  ListTodo,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { queueKey } from "src/lib/queue-key";
import Header from "@/components/Header";
import { FailingJobTypesTable } from "@/components/overview/FailingJobTypesTable";
import { JobStateCards } from "@/components/overview/JobStateCards";
import { MetricCardsGrid } from "@/components/overview/MetricCardsGrid";
import { ProcessingTimeChart } from "@/components/overview/ProcessingTimeChart";
import { SlowestJobsTable } from "@/components/overview/SlowestJobsTable";
import { ThroughputChart } from "@/components/overview/ThroughputChart";
import { useTRPC } from "@/integrations/trpc/react";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";
import { FilterableStatus } from "../jobs";

export const Route = createFileRoute("/queues/$queueName")({
  component: QueuePage,
});

const TIME_RANGES = [
  { value: "1", label: "Last 1h" },
  { value: "6", label: "Last 6h" },
  { value: "24", label: "Last 24h" },
  { value: "72", label: "Last 3d" },
  { value: "168", label: "Last 7d" },
];

const OVERVIEW_SKELETON_KEYS = [
  "summary-1",
  "summary-2",
  "summary-3",
  "summary-4",
];

const JOB_STATE_SKELETON_KEYS = [
  "state-1",
  "state-2",
  "state-3",
  "state-4",
  "state-5",
  "state-6",
];

function QueuePage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<number>(24);
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);

  const navigate = useNavigate({ from: Route.fullPath });

  const { queueName } = Route.useParams();

  const isFetching = useIsFetching() > 0;
  const refreshAll = () => queryClient.invalidateQueries();

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(),
  );

  const queue = queues?.find((item) => item.name === queueName);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const { data: metrics, isLoading: loadingMetrics } = useQuery(
    trpc.overview.metrics.queryOptions({
      timeRangeHours: timeRange,
      queueName,
      //prefix: parsed?.prefix,
    }),
  );

  const isPaused = queue?.isPaused ?? false;
  const canPause = queueSource?.features.queuePause.enabled ?? false;
  const canResume = queueSource?.features.queueResume.enabled ?? false;
  const canDrain = queueSource?.features.queueDrain.enabled ?? false;
  const queueTarget = {
    queueKey: queue?.key,
    queueName,
    prefix: queue?.prefix,
  };

  const invalidateQueues = () =>
    queryClient.invalidateQueries({ queryKey: [["queues"]] });

  const pauseMutation = useMutation(
    trpc.queues.pause.mutationOptions({
      onSuccess: () => {
        toast.success(`Queue "${queueName}" paused`);
        invalidateQueues();
      },
      onError: (error) => {
        toast.error("Failed to pause queue", { description: error.message });
      },
    }),
  );

  const resumeMutation = useMutation(
    trpc.queues.resume.mutationOptions({
      onSuccess: () => {
        toast.success(`Queue "${queueName}" resumed`);
        invalidateQueues();
      },
      onError: (error) => {
        toast.error("Failed to resume queue", { description: error.message });
      },
    }),
  );

  const drainMutation = useMutation(
    trpc.queues.drain.mutationOptions({
      onSuccess: () => {
        toast.success(`Queue "${queueName}" drained`);
        invalidateQueues();
      },
      onError: (error) => {
        toast.error("Failed to drain queue", { description: error.message });
      },
    }),
  );

  const togglePending = pauseMutation.isPending || resumeMutation.isPending;
  const toggleDisabled = isPaused ? !canResume : !canPause;

  const handleToggle = () => {
    if (isPaused) {
      resumeMutation.mutate(queueTarget);
    } else {
      pauseMutation.mutate(queueTarget);
    }
  };

  const handleGotoJobs = () => {
    const key = queueKey(queue?.prefix ?? "", queueName);
    navigate({
      to: "/jobs",
      search: () => ({
        queueKey: key,
        statusFilter: FilterableStatus.All,
        page: 1,
        pageSize: 50,
        sortField: "timestamp" as const,
        sortOrder: "desc" as const,
      }),
    });
  };

  const handleGotoSchedulers = () => {
    const key = queueKey(queue?.prefix ?? "", queueName);
    navigate({
      to: "/schedulers",
      search: () => ({
        queueKey: key,
      }),
    });
  };

  const handleDrain = () => {
    drainMutation.mutate(queueTarget);
    setDrainDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <Header title={`${queueName}`}>
        <div className="flex items-center gap-3 h-5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGotoJobs}
            className="bg-card"
          >
            <ListTodo className="size-4 mr-2" />
            View jobs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGotoSchedulers}
            className="bg-card"
          >
            <Clock className="size-4 mr-2" />
            View schedulers
          </Button>
          <Separator orientation="vertical" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            disabled={toggleDisabled || togglePending}
            className="bg-card"
          >
            {isPaused ? (
              <Play className="size-4 mr-2" />
            ) : (
              <Pause className="size-4 mr-2" />
            )}
            {isPaused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrainDialogOpen(true)}
            disabled={!canDrain || drainMutation.isPending}
            className="bg-card"
          >
            <Trash2 className="size-4 mr-2" />
            Drain
          </Button>
          <Separator orientation="vertical" />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isFetching}
            className="bg-card"
          >
            <RefreshCw
              className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh page
          </Button>
        </div>
      </Header>

      <AlertDialog open={drainDialogOpen} onOpenChange={setDrainDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drain queue "{queueName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all waiting and delayed jobs from the
              queue. Active jobs are not affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDrain}>Drain</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Live job-state snapshot (independent of the time range below) */}
      {(queue?.jobCounts || loadingQueues) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Jobs distribution
          </h2>
          {queue?.jobCounts ? (
            <JobStateCards
              counts={queue.jobCounts}
              queueKey={queueKey(queue.prefix ?? "", queueName)}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {JOB_STATE_SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-20 w-full bg-zinc-800/50" />
              ))}
            </div>
          )}
        </section>
      )}

      <Separator />

      {/* Header Controls */}
      <div className="flex items-center w-full justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Performance
        </h2>
        <Select
          value={String(timeRange)}
          onValueChange={(value) => setTimeRange(Number(value))}
        >
          <SelectTrigger className="w-[150px] bg-card">
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
          <section className="space-y-3">
            <MetricCardsGrid
              summary={metrics.summary}
              timeSeries={metrics.timeSeries}
              timeRange={timeRange}
              nativeMetrics={metrics.nativeMetrics}
            />
          </section>

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
