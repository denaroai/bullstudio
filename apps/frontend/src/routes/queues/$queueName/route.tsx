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
import { ScrollArea, ScrollBar } from "@bullstudio/ui/components/scroll-area";
import { Separator } from "@bullstudio/ui/components/separator";
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddJobDialog } from "@/components/jobs/AddJobDialog";
import { QueueTabs } from "@/components/QueueTabs";
import { useTRPC } from "@/integrations/trpc/react";
import { queueNameFromParam, resolveQueueFromParam } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

export const Route = createFileRoute("/queues/$queueName")({
  component: QueueLayout,
});

function QueueLayout() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { queueName: queueParam } = Route.useParams();
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);
  const [addJobDialogOpen, setAddJobDialogOpen] = useState(false);

  const isFetching = useIsFetching() > 0;
  const refreshAll = () => queryClient.invalidateQueries();

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  const queue = resolveQueueFromParam(queueParam, queues);
  // Display + backend identity use the bare queue name; the route param itself
  // is a prefix-qualified composite key (see queueRouteParam).
  const queueName = queue?.name ?? queueNameFromParam(queueParam);
  const prefix = queue?.prefix;

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  // Only surface the prefix in the title when names can collide across them.
  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;
  const tabFeatures = {
    flows: queueSource?.features.flows.visible ?? false,
    schedulers: queueSource?.features.schedulers.visible ?? false,
    workers: queueSource?.features.workers.visible ?? false,
  };

  const isPaused = queue?.isPaused ?? false;
  const canPause = queueSource?.features.queuePause.enabled ?? false;
  const canResume = queueSource?.features.queueResume.enabled ?? false;
  const canDrain = queueSource?.features.queueDrain.enabled ?? false;
  const canAddJob = queueSource?.features.queueAddJob.enabled ?? false;
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

  const handleDrain = () => {
    drainMutation.mutate(queueTarget);
    setDrainDialogOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          {hasMultiplePrefixes && prefix && (
            <span className="truncate font-mono text-sm text-muted-foreground">
              {prefix} /
            </span>
          )}
          <h1 className="truncate text-lg font-semibold text-foreground">
            {queueName}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-3 h-5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddJobDialogOpen(true)}
            disabled={!canAddJob}
            className="bg-card"
          >
            <Plus className="size-4 mr-2" />
            Add job
          </Button>
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
      </header>

      <QueueTabs queueParam={queueParam} features={tabFeatures} />

      <AddJobDialog
        open={addJobDialogOpen}
        onOpenChange={setAddJobDialogOpen}
        queueName={queueName}
        queueTarget={queueTarget}
        mutationsEnabled={canAddJob}
      />

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

      <ScrollArea className="min-h-0 flex-1">
        <div className="pt-6">
          <Outlet />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
