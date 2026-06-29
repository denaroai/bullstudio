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
import { Textarea } from "@bullstudio/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/trpc/react";
import { humanizeMs } from "./schedule-format";
import type { PrivateScheduler, QueueTarget } from "./types";

interface SchedulerSheetProps {
  open: boolean;
  mode: "create" | "edit";
  scheduler: PrivateScheduler | null;
  mutationsEnabled: boolean;
  createQueue: QueueTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SchedulerSheet({
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
          {upsert.isPending ? "Saving..." : "Save scheduler"}
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
