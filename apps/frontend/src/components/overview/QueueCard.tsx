import type { JobCounts } from "@bullstudio/connect-types";
import { Badge } from "@bullstudio/ui/components/badge";
import { Card } from "@bullstudio/ui/components/card";
import { Link } from "@tanstack/react-router";
import { QueueStatusBar } from "./QueueStatusBar";

type QueueCardProps = {
  name: string;
  /** Prefix-qualified route param (see queueRouteParam). */
  queueParam: string;
  counts?: JobCounts;
  isPaused?: boolean;
};

/**
 * Compact card for a single queue on the overview grid: shows the queue name,
 * a paused badge, and a status bar of its job distribution. Links to the
 * queue's detail view.
 *
 * @param name - Queue name shown on the card.
 * @param queueParam - Prefix-qualified route param used to link to the queue's detail view.
 * @param counts - Per-status job counts; omitted while still loading.
 * @param isPaused - Whether the queue is currently paused (renders a badge).
 */
export function QueueCard({
  name,
  queueParam,
  counts,
  isPaused,
}: QueueCardProps) {
  return (
    <Link
      to="/queues/$queueName"
      params={{ queueName: queueParam }}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-3 p-4 transition-colors hover:border-ring/40 hover:bg-accent/40">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {name}
          </span>
          {isPaused && (
            <Badge variant="secondary" className="ml-auto">
              Paused
            </Badge>
          )}
        </div>

        {counts ? (
          <QueueStatusBar counts={counts} />
        ) : (
          <span className="text-xs text-muted-foreground">No data</span>
        )}
      </Card>
    </Link>
  );
}
