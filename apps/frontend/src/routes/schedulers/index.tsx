"use client";

import type { JobScheduler } from "@bullstudio/connect-types";
import dayjs from "@bullstudio/dayjs";
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
import { Input } from "@bullstudio/ui/components/input";
import { Label } from "@bullstudio/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@bullstudio/ui/components/sheet";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { Textarea } from "@bullstudio/ui/components/textarea";
import { EmptyState } from "@bullstudio/ui/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Layers, Plus, RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import Header from "@/components/Header";
import { useTRPC } from "@/integrations/trpc/react";
import { parseQueueKey, queueKey } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

type PrivateScheduler = JobScheduler & { queueKey?: string };

const ALL_QUEUES_VALUE = "__all__";
const SKELETON_KEYS = ["s-1", "s-2", "s-3", "s-4", "s-5"];

const searchSchema = z.object({
  queueKey: z.string().optional(),
});

export const Route = createFileRoute("/schedulers/")({
  component: SchedulersPage,
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
});

function describeSchedule(scheduler: JobScheduler): string {
  if (scheduler.strategy === "cron") {
    return scheduler.pattern ?? "—";
  }
  return scheduler.every ? `every ${humanizeMs(scheduler.every)}` : "—";
}

function humanizeMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${trimZero(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${trimZero(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${trimZero(hours)}h`;
  return `${trimZero(hours / 24)}d`;
}

function trimZero(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}

function SchedulersPage() {
  const trpc = useTRPC();
  const navigate = useNavigate({ from: Route.fullPath });
  const { queueKey: queueKeySearch } = Route.useSearch();

  const [selected, setSelected] = useState<PrivateScheduler | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;
  const mutationsEnabled = queueSource?.features.schedulers.enabled ?? false;
  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;

  const parsed = queueKeySearch ? parseQueueKey(queueKeySearch) : null;

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(),
  );

  const {
    data: schedulers,
    isLoading,
    isFetching,
    refetch,
  } = useQuery(
    trpc.schedulers.list.queryOptions({
      queueName: parsed?.name,
      prefix: parsed?.prefix,
      limit: 200,
    }),
  );

  const selectedQueue = queueKeySearch
    ? queues?.find(
        (queue) => queueKey(queue.prefix ?? "", queue.name) === queueKeySearch,
      )
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Header title="Schedulers" />
        <div className="flex items-center gap-2">
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
          <Button
            size="sm"
            disabled={!mutationsEnabled || !selectedQueue}
            title={
              !mutationsEnabled
                ? "Schedulers are read-only for this dashboard"
                : selectedQueue
                  ? undefined
                  : "Select a single queue to create a scheduler"
            }
            onClick={() => {
              setSelected(null);
              setCreating(true);
            }}
          >
            <Plus className="size-4 mr-2" />
            New scheduler
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={queueKeySearch || ALL_QUEUES_VALUE}
          onValueChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                queueKey: value === ALL_QUEUES_VALUE ? undefined : value,
              }),
            })
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
              >
                <span className="font-mono">
                  {hasMultiplePrefixes && (
                    <span className="text-muted-foreground mr-1">
                      {queue.prefix}/
                    </span>
                  )}
                  {queue.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-8 space-y-4">
            {SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : !schedulers || schedulers.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-12" />}
          title="No schedulers found"
          description="Job schedulers repeat work on a cron or fixed interval. Create one to enqueue jobs automatically."
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Scheduler</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Next run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulers.map((scheduler) => (
                <TableRow
                  key={`${scheduler.prefix ?? ""}-${scheduler.queueName}-${scheduler.key}`}
                  className="cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => {
                    setCreating(false);
                    setSelected(scheduler);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                        <CalendarClock className="size-4 text-violet-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {scheduler.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {scheduler.id ?? scheduler.key}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {hasMultiplePrefixes && scheduler.prefix && (
                        <span className="text-muted-foreground mr-1">
                          {scheduler.prefix}/
                        </span>
                      )}
                      {scheduler.queueName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        scheduler.strategy === "cron"
                          ? "border-sky-500/30 text-sky-400"
                          : "border-amber-500/30 text-amber-400"
                      }
                    >
                      {scheduler.strategy}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-foreground">
                      {describeSchedule(scheduler)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {scheduler.next ? (
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">
                          {dayjs(scheduler.next).fromNow()}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {dayjs(scheduler.next).format("MMM D, HH:mm:ss")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-3 border-t text-sm text-muted-foreground">
            Showing {schedulers.length} scheduler
            {schedulers.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <SchedulerSheet
        open={Boolean(selected) || creating}
        mode={creating ? "create" : "edit"}
        scheduler={selected}
        mutationsEnabled={mutationsEnabled}
        createQueue={
          selectedQueue
            ? {
                queueKey:
                  "key" in selectedQueue ? selectedQueue.key : undefined,
                queueName: selectedQueue.name,
                prefix: selectedQueue.prefix,
              }
            : null
        }
        onClose={() => {
          setSelected(null);
          setCreating(false);
        }}
        onSaved={() => refetch()}
      />
    </div>
  );
}

interface QueueTarget {
  queueKey?: string;
  queueName: string;
  prefix?: string;
}

interface SchedulerSheetProps {
  open: boolean;
  mode: "create" | "edit";
  scheduler: PrivateScheduler | null;
  mutationsEnabled: boolean;
  createQueue: QueueTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

function SchedulerSheet({
  open,
  mode,
  scheduler,
  mutationsEnabled,
  createQueue,
  onClose,
  onSaved,
}: SchedulerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {open && (
          <SchedulerSheetBody
            key={scheduler?.key ?? "new"}
            mode={mode}
            scheduler={scheduler}
            mutationsEnabled={mutationsEnabled}
            createQueue={createQueue}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SchedulerSheetBody({
  mode,
  scheduler,
  mutationsEnabled,
  createQueue,
  onClose,
  onSaved,
}: Omit<SchedulerSheetProps, "open">) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ids = useId();
  const fieldId = (field: string) => `${ids}-${field}`;

  const [schedulerId, setSchedulerId] = useState(
    scheduler?.id ?? scheduler?.name ?? "",
  );
  const [strategy, setStrategy] = useState<"cron" | "every">(
    scheduler?.strategy ?? "cron",
  );
  const [pattern, setPattern] = useState(scheduler?.pattern ?? "");
  const [every, setEvery] = useState(
    scheduler?.every ? String(scheduler.every) : "",
  );
  const [tz, setTz] = useState(scheduler?.tz ?? "");
  const [jobName, setJobName] = useState(scheduler?.name ?? "");
  const [data, setData] = useState(
    scheduler?.template?.data !== undefined
      ? JSON.stringify(scheduler.template.data, null, 2)
      : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const target: QueueTarget | null =
    mode === "edit" && scheduler
      ? {
          queueKey: scheduler.queueKey,
          queueName: scheduler.queueName,
          prefix: scheduler.prefix,
        }
      : createQueue;

  const upsert = useMutation(
    trpc.schedulers.upsert.mutationOptions({
      onSuccess: (response) => {
        toast.success(response.message);
        queryClient.invalidateQueries({ queryKey: [["schedulers"]] });
        onSaved();
        onClose();
      },
      onError: (error) => {
        toast.error("Failed to save scheduler", {
          description: error.message,
        });
      },
    }),
  );

  const remove = useMutation(
    trpc.schedulers.remove.mutationOptions({
      onSuccess: (response) => {
        toast.success(response.message);
        queryClient.invalidateQueries({ queryKey: [["schedulers"]] });
        onSaved();
        onClose();
      },
      onError: (error) => {
        toast.error("Failed to remove scheduler", {
          description: error.message,
        });
      },
    }),
  );

  const handleSave = () => {
    if (!target) {
      toast.error("Select a queue before saving the scheduler.");
      return;
    }
    if (!schedulerId.trim()) {
      toast.error("A scheduler id is required.");
      return;
    }

    let parsedData: unknown;
    if (data.trim()) {
      try {
        parsedData = JSON.parse(data);
      } catch {
        toast.error("Job data must be valid JSON.");
        return;
      }
    }

    if (strategy === "cron" && !pattern.trim()) {
      toast.error("A cron pattern is required.");
      return;
    }
    const everyMs = Number(every);
    if (strategy === "every" && (!everyMs || everyMs <= 0)) {
      toast.error("An interval greater than zero is required.");
      return;
    }

    upsert.mutate({
      queueKey: target.queueKey,
      queueName: target.queueName,
      prefix: target.prefix,
      schedulerId: schedulerId.trim(),
      previousKey: mode === "edit" ? scheduler?.key : undefined,
      repeat:
        strategy === "cron"
          ? { strategy, pattern: pattern.trim(), tz: tz.trim() || undefined }
          : { strategy, every: everyMs, tz: tz.trim() || undefined },
      template: {
        name: jobName.trim() || undefined,
        data: parsedData,
      },
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {mode === "create" ? "New scheduler" : scheduler?.name}
        </SheetTitle>
        <SheetDescription>
          {target
            ? `Queue: ${target.prefix ? `${target.prefix}/` : ""}${target.queueName}`
            : "Select a queue to create a scheduler."}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4">
        <div className="space-y-2">
          <Label htmlFor={fieldId("scheduler-id")}>Scheduler id</Label>
          <Input
            id={fieldId("scheduler-id")}
            value={schedulerId}
            disabled={mode === "edit"}
            placeholder="my-scheduler-id"
            onChange={(event) => setSchedulerId(event.target.value)}
          />
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">
              The id is fixed for an existing scheduler.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Repeat strategy</Label>
          <Select
            value={strategy}
            onValueChange={(value) => setStrategy(value as "cron" | "every")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cron">Cron expression</SelectItem>
              <SelectItem value="every">Fixed interval</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {strategy === "cron" ? (
          <div className="space-y-2">
            <Label htmlFor={fieldId("cron-pattern")}>Cron pattern</Label>
            <Input
              id={fieldId("cron-pattern")}
              value={pattern}
              placeholder="0 15 3 * * *"
              className="font-mono"
              onChange={(event) => setPattern(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Seconds (optional) minute hour day-of-month month day-of-week.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={fieldId("every-ms")}>Interval (milliseconds)</Label>
            <Input
              id={fieldId("every-ms")}
              type="number"
              min={1}
              value={every}
              placeholder="60000"
              onChange={(event) => setEvery(event.target.value)}
            />
            {Number(every) > 0 && (
              <p className="text-xs text-muted-foreground">
                Repeats every {humanizeMs(Number(every))}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={fieldId("tz")}>Timezone (optional)</Label>
          <Input
            id={fieldId("tz")}
            value={tz}
            placeholder="Europe/Berlin"
            onChange={(event) => setTz(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("job-name")}>Job name</Label>
          <Input
            id={fieldId("job-name")}
            value={jobName}
            placeholder="my-job-name"
            onChange={(event) => setJobName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("job-data")}>Job data (JSON)</Label>
          <Textarea
            id={fieldId("job-data")}
            value={data}
            placeholder={`{\n  "foo": "bar"\n}`}
            className="font-mono min-h-32"
            onChange={(event) => setData(event.target.value)}
          />
        </div>

        {scheduler && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="break-all">
              <span className="font-medium text-foreground">Key:</span>{" "}
              {scheduler.key}
            </div>
            {scheduler.next && (
              <div>
                <span className="font-medium text-foreground">Next run:</span>{" "}
                {dayjs(scheduler.next).format("MMM D, HH:mm:ss")}
              </div>
            )}
          </div>
        )}
      </div>

      <SheetFooter>
        {mode === "edit" && (
          <Button
            variant="destructive"
            disabled={!mutationsEnabled || remove.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
        <Button
          disabled={!mutationsEnabled || upsert.isPending}
          onClick={handleSave}
        >
          {upsert.isPending ? "Saving…" : "Save scheduler"}
        </Button>
      </SheetFooter>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scheduler?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops "{scheduler?.name}" from producing new jobs. Existing
              jobs are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!scheduler) return;
                remove.mutate({
                  queueKey: scheduler.queueKey,
                  queueName: scheduler.queueName,
                  prefix: scheduler.prefix,
                  schedulerKey: scheduler.key,
                  schedulerId: scheduler.id,
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
