import dayjs from "@bullstudio/dayjs";
import { Badge } from "@bullstudio/ui/components/badge";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { EmptyState } from "@bullstudio/ui/shared";
import { CalendarClock } from "lucide-react";
import { describeSchedule } from "./schedule-format";
import type { PrivateScheduler } from "./types";

const SKELETON_KEYS = ["s-1", "s-2", "s-3", "s-4", "s-5"];

interface SchedulersTableProps {
  hasMultiplePrefixes: boolean;
  isLoading: boolean;
  schedulers?: PrivateScheduler[];
  onSelectScheduler: (scheduler: PrivateScheduler) => void;
}

export function SchedulersTable({
  hasMultiplePrefixes,
  isLoading,
  schedulers,
  onSelectScheduler,
}: SchedulersTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-8 space-y-4">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!schedulers || schedulers.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-12" />}
        title="No schedulers found"
        description="Job schedulers repeat work on a cron or fixed interval. Create one to enqueue jobs automatically."
      />
    );
  }

  return (
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
              onClick={() => onSelectScheduler(scheduler)}
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
                  <span className="text-muted-foreground">-</span>
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
  );
}
