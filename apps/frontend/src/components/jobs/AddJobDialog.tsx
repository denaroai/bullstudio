import Editor from "@monaco-editor/react";
import { Button } from "@bullstudio/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bullstudio/ui/components/dialog";
import { Input } from "@bullstudio/ui/components/input";
import { Label } from "@bullstudio/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/ThemeProvider";
import { useTRPC } from "@/integrations/trpc/react";

interface QueueTarget {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
}

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueName: string;
  queueTarget: QueueTarget;
  mutationsEnabled: boolean;
}

const DEFAULT_PAYLOAD = "{\n  \n}";

export function AddJobDialog({
  open,
  onOpenChange,
  queueName,
  queueTarget,
  mutationsEnabled,
}: AddJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <AddJobDialogBody
            queueName={queueName}
            queueTarget={queueTarget}
            mutationsEnabled={mutationsEnabled}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddJobDialogBody({
  queueName,
  queueTarget,
  mutationsEnabled,
  onClose,
}: Omit<AddJobDialogProps, "open" | "onOpenChange"> & {
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ids = useId();
  const fieldId = (field: string) => `${ids}-${field}`;
  const monacoTheme = useMonacoTheme();

  const [jobName, setJobName] = useState("");
  const [delay, setDelay] = useState("");
  const [attempts, setAttempts] = useState("");
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);

  const addJob = useMutation(
    trpc.jobs.add.mutationOptions({
      onSuccess: (response) => {
        toast.success(response.message);
        queryClient.invalidateQueries({ queryKey: [["jobs"]] });
        queryClient.invalidateQueries({ queryKey: [["queues"]] });
        onClose();
      },
      onError: (error) => {
        toast.error("Failed to add job", { description: error.message });
      },
    }),
  );

  const handleSubmit = () => {
    if (!jobName.trim()) {
      toast.error("A job name is required.");
      return;
    }

    let data: unknown;
    if (payload.trim()) {
      try {
        data = JSON.parse(payload);
      } catch {
        toast.error("Payload must be valid JSON.");
        return;
      }
    }

    const delayMs = delay.trim() ? Number(delay) : undefined;
    if (delayMs !== undefined && (!Number.isFinite(delayMs) || delayMs < 0)) {
      toast.error("Delay must be zero or a positive number of milliseconds.");
      return;
    }

    const attemptsCount = attempts.trim() ? Number(attempts) : undefined;
    if (
      attemptsCount !== undefined &&
      (!Number.isInteger(attemptsCount) || attemptsCount < 1)
    ) {
      toast.error("Attempts must be a whole number greater than zero.");
      return;
    }

    addJob.mutate({
      queueKey: queueTarget.queueKey,
      queueName: queueTarget.queueName,
      prefix: queueTarget.prefix,
      jobName: jobName.trim(),
      data,
      delay: delayMs,
      attempts: attemptsCount,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add job</DialogTitle>
        <DialogDescription>
          Enqueue a new job onto "{queueName}".
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={fieldId("job-name")}>Name</Label>
          <Input
            id={fieldId("job-name")}
            value={jobName}
            placeholder="my-job-name"
            onChange={(event) => setJobName(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={fieldId("delay")}>Delay (ms)</Label>
            <Input
              id={fieldId("delay")}
              type="number"
              min={0}
              value={delay}
              placeholder="0"
              onChange={(event) => setDelay(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("attempts")}>Attempts</Label>
            <Input
              id={fieldId("attempts")}
              type="number"
              min={1}
              value={attempts}
              placeholder="1"
              onChange={(event) => setAttempts(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={fieldId("payload")}>Payload (JSON)</Label>
          <div className="overflow-hidden rounded-md border">
            <Editor
              height="220px"
              defaultLanguage="json"
              value={payload}
              theme={monacoTheme}
              onChange={(value) => setPayload(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "off",
                scrollBeyondLastLine: false,
                tabSize: 2,
                automaticLayout: true,
                folding: false,
                wordWrap: "on",
              }}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!mutationsEnabled || addJob.isPending}
          onClick={handleSubmit}
        >
          {addJob.isPending ? "Adding..." : "Add job"}
        </Button>
      </DialogFooter>
    </>
  );
}

function useMonacoTheme(): "vs-dark" | "light" {
  const { theme } = useTheme();
  const prefersDark =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark";
  return prefersDark ? "vs-dark" : "light";
}
