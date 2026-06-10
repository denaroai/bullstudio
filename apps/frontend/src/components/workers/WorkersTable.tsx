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
import { Cpu } from "lucide-react";
import type { PrivateWorker } from "./types";

const SKELETON_KEYS = ["w-1", "w-2", "w-3", "w-4", "w-5"];

interface WorkersTableProps {
  hasMultiplePrefixes: boolean;
  isLoading: boolean;
  workers?: PrivateWorker[];
  onSelectWorker: (worker: PrivateWorker) => void;
}

export function WorkersTable({
  hasMultiplePrefixes,
  isLoading,
  workers,
  onSelectWorker,
}: WorkersTableProps) {
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

  if (!workers || workers.length === 0) {
    return (
      <EmptyState
        icon={<Cpu className="size-12" />}
        title="No workers found"
        description="Workers will appear here when Bull or BullMQ reports active worker clients for a queue."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Worker</TableHead>
            <TableHead>Queue</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Idle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((worker) => (
            <TableRow
              key={worker.id}
              className="cursor-pointer hover:bg-muted/60 transition-colors"
              onClick={() => onSelectWorker(worker)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Cpu className="size-4 text-emerald-400" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-foreground truncate">
                      {worker.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {worker.id}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm text-muted-foreground">
                  {hasMultiplePrefixes && worker.prefix && (
                    <span className="text-muted-foreground mr-1">
                      {worker.prefix}/
                    </span>
                  )}
                  {worker.queueName}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm text-foreground">
                  {worker.address ?? "-"}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatSeconds(worker.age)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatSeconds(worker.idle)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-4 py-3 border-t text-sm text-muted-foreground">
        Showing {workers.length} worker{workers.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function formatSeconds(value: number): string {
  if (value < 60) {
    return `${value}s`;
  }
  if (value < 3600) {
    return `${Math.round(value / 60)}m`;
  }
  if (value < 86400) {
    return `${Math.round(value / 3600)}h`;
  }
  return `${Math.round(value / 86400)}d`;
}
