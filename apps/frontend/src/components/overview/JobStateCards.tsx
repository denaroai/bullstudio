import type { JobCounts } from "@bullstudio/connect-types";
import { Card } from "@bullstudio/ui/components/card";
import { formatNumber } from "@bullstudio/ui/shared";
import {
  ArrowUp,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader,
  type LucideIcon,
  XCircle,
} from "lucide-react";

type JobStateCardsProps = {
  counts: JobCounts;
};

const JOB_STATES = [
  { key: "waiting", label: "Waiting", icon: Hourglass },
  { key: "active", label: "Active", icon: Loader },
  { key: "delayed", label: "Delayed", icon: Clock },
  { key: "prioritized", label: "Prioritized", icon: ArrowUp },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "failed", label: "Failed", icon: XCircle },
] as const satisfies ReadonlyArray<{
  key: keyof JobCounts;
  label: string;
  icon: LucideIcon;
}>;

export function JobStateCards({ counts }: JobStateCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {JOB_STATES.map((state) => (
        <Card key={state.key} className="bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <state.icon className="size-4" />
            {state.label}
          </div>
          <div className="mt-2 text-2xl font-bold text-card-foreground">
            {formatNumber(counts[state.key])}
          </div>
        </Card>
      ))}
    </div>
  );
}
