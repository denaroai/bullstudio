import type { JobCounts } from "@bullstudio/connect-types";
import { Card } from "@bullstudio/ui/components/card";
import { formatNumber } from "@bullstudio/ui/shared";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import { FilterableStatus } from "@/lib/jobs";

type JobStateCardsProps = {
  counts: JobCounts;
  /**
   * Prefix-qualified queue route param (see queueRouteParam). When provided,
   * each card links to this queue's jobs view filtered to the card's state.
   */
  queueParam?: string;
};

const JOB_STATES = [
  {
    key: "waiting",
    label: "Waiting",
    icon: Hourglass,
    color: "text-amber-500",
    filter: FilterableStatus.Waiting,
  },
  {
    key: "active",
    label: "Active",
    icon: Loader,
    color: "text-blue-400",
    filter: FilterableStatus.Active,
  },
  {
    key: "delayed",
    label: "Delayed",
    icon: Clock,
    color: "text-sky-400",
    filter: FilterableStatus.Delayed,
  },
  {
    key: "prioritized",
    label: "Prioritized",
    icon: ArrowUp,
    color: "text-violet-400",
    // No dedicated prioritized filter — fall back to the full queue listing.
    filter: FilterableStatus.All,
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    color: "text-emerald-500",
    filter: FilterableStatus.Completed,
  },
  {
    key: "failed",
    label: "Failed",
    icon: XCircle,
    color: "text-red-400",
    filter: FilterableStatus.Failed,
  },
] as const satisfies ReadonlyArray<{
  key: keyof JobCounts;
  label: string;
  icon: LucideIcon;
  color: string;
  filter: FilterableStatus;
}>;

export function JobStateCards({ counts, queueParam }: JobStateCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {JOB_STATES.map((state) => {
        const card = (
          <Card
            className={`bg-card p-4${
              queueParam
                ? " h-full transition-colors hover:border-ring/40 hover:bg-accent/40"
                : ""
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <state.icon className={`size-4 ${state.color}`} />
              {state.label}
            </div>
            <div className={`mt-2 text-2xl font-bold ${state.color}`}>
              {formatNumber(counts[state.key])}
            </div>
          </Card>
        );

        if (!queueParam) {
          return <div key={state.key}>{card}</div>;
        }

        return (
          <Link
            key={state.key}
            to="/queues/$queueName/jobs"
            params={{ queueName: queueParam }}
            search={{
              statusFilter: state.filter,
              page: 1,
              pageSize: 50,
              sortField: "timestamp",
              sortOrder: "desc",
            }}
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {card}
          </Link>
        );
      })}
    </div>
  );
}
