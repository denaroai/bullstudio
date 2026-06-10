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
import { Badge } from "@bullstudio/ui/components/badge";
import { Button } from "@bullstudio/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@bullstudio/ui/components/sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BriefcaseBusiness, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { DashboardQueue } from "@bullstudio/private-router";
import { useTRPC } from "@/integrations/trpc/react";
import { FilterableStatus } from "@/lib/jobs";
import type { PrivateWorker, QueueActionState } from "./types";

interface WorkerSheetProps {
  open: boolean;
  worker: PrivateWorker | null;
  queue?: DashboardQueue;
  queueActions: QueueActionState;
  onClose: () => void;
  onChanged: () => void;
}

export function WorkerSheet({
  open,
  worker,
  queue,
  queueActions,
  onClose,
  onChanged,
}: WorkerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {worker && (
          <WorkerSheetBody
            key={worker.id}
            worker={worker}
            queue={queue}
            queueActions={queueActions}
            onChanged={onChanged}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function WorkerSheetBody({
  worker,
  queue,
  queueActions,
  onChanged,
}: {
  worker: PrivateWorker;
  queue?: DashboardQueue;
  queueActions: QueueActionState;
  onChanged: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [confirmDrain, setConfirmDrain] = useState(false);
  const target = {
    queueKey: worker.queueKey,
    queueName: worker.queueName,
    prefix: worker.prefix,
  };

  const pause = useMutation(
    trpc.queues.pause.mutationOptions({
      onSuccess: () => {
        toast.success(`Queue "${worker.queueName}" paused`);
        invalidateQueueQueries(queryClient);
        onChanged();
      },
      onError: (error) => {
        toast.error("Failed to pause queue", { description: error.message });
      },
    }),
  );
  const resume = useMutation(
    trpc.queues.resume.mutationOptions({
      onSuccess: () => {
        toast.success(`Queue "${worker.queueName}" resumed`);
        invalidateQueueQueries(queryClient);
        onChanged();
      },
      onError: (error) => {
        toast.error("Failed to resume queue", { description: error.message });
      },
    }),
  );
  const drain = useMutation(
    trpc.queues.drain.mutationOptions({
      onSuccess: () => {
        toast.success(`Queue "${worker.queueName}" drained`);
        invalidateQueueQueries(queryClient);
        onChanged();
      },
      onError: (error) => {
        toast.error("Failed to drain queue", { description: error.message });
      },
    }),
  );

  const canPause =
    queueActions.pause && (queue?.capabilities?.queuePause ?? true);
  const canResume =
    queueActions.resume && (queue?.capabilities?.queueResume ?? true);
  const canDrain =
    queueActions.drain && (queue?.capabilities?.queueDrain ?? true);
  const metadataEntries = Object.entries(worker.metadata).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <>
      <SheetHeader>
        <SheetTitle>{worker.name}</SheetTitle>
        <SheetDescription>
          {worker.prefix ? `${worker.prefix}/` : ""}
          {worker.queueName}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4">
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {worker.provider && (
              <Badge variant="outline">{worker.provider}</Badge>
            )}
            {queue?.isPaused && <Badge variant="secondary">paused queue</Badge>}
            {worker.address && (
              <Badge variant="outline">{worker.address}</Badge>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <DetailItem label="Worker id" value={worker.id} mono />
            <DetailItem label="Queue key" value={worker.queueKey ?? "-"} mono />
            <DetailItem label="Queue" value={worker.queueName} mono />
            <DetailItem label="Prefix" value={worker.prefix ?? "-"} mono />
            <DetailItem label="Age" value={`${worker.age}s`} />
            <DetailItem label="Idle" value={`${worker.idle}s`} />
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Queue actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link
                to="/queues/$queueName/jobs"
                params={{ queueName: worker.queueName }}
                search={{
                  statusFilter: FilterableStatus.All,
                  page: 1,
                  pageSize: 50,
                  sortField: "timestamp",
                  sortOrder: "desc",
                }}
              >
                <BriefcaseBusiness className="size-4" />
                View jobs
              </Link>
            </Button>
            {queue?.isPaused ? (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={!canResume || resume.isPending}
                onClick={() => resume.mutate(target)}
              >
                <Play className="size-4" />
                Resume queue
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                disabled={!canPause || pause.isPending}
                onClick={() => pause.mutate(target)}
              >
                <Pause className="size-4" />
                Pause queue
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="justify-start text-destructive hover:text-destructive"
              disabled={!canDrain || drain.isPending}
              onClick={() => setConfirmDrain(true)}
            >
              <Trash2 className="size-4" />
              Drain queue
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            Client metadata
          </h3>
          {metadataEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Redis client metadata was reported for this worker.
            </p>
          ) : (
            <div className="rounded-md border">
              {metadataEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-[130px_1fr] gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="font-mono text-muted-foreground">{key}</span>
                  <span className="min-w-0 break-all font-mono text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={confirmDrain} onOpenChange={setConfirmDrain}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drain queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes waiting and delayed jobs from "{worker.queueName}".
              Active jobs are not cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => drain.mutate(target)}
              disabled={drain.isPending}
            >
              Drain queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "mt-1 break-all font-mono text-foreground"
            : "mt-1 text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function invalidateQueueQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  queryClient.invalidateQueries({ queryKey: [["queues"]] });
  queryClient.invalidateQueries({ queryKey: [["workers"]] });
}
