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
import { Separator } from "@bullstudio/ui/components/separator";
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Header from "@/components/Header";
import { useTRPC } from "@/integrations/trpc/react";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

export const Route = createFileRoute("/queues/$queueName")({
  component: QueueLayout,
});

function QueueLayout() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { queueName } = Route.useParams();
  const [drainDialogOpen, setDrainDialogOpen] = useState(false);

  const isFetching = useIsFetching() > 0;
  const refreshAll = () => queryClient.invalidateQueries();

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  const queue = queues?.find((item) => item.name === queueName);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

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

  const handleDrain = () => {
    drainMutation.mutate(queueTarget);
    setDrainDialogOpen(false);
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <Header title={`${queueName}`}>
        <div className="flex items-center gap-3 h-5">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
