"use client";

import { Button } from "@bullstudio/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import Header from "@/components/Header";
import { QueueFilter } from "@/components/QueueFilter";
import { WorkerSheet } from "@/components/workers/WorkerSheet";
import { WorkersTable } from "@/components/workers/WorkersTable";
import type { PrivateWorker } from "@/components/workers/types";
import { useTRPC } from "@/integrations/trpc/react";
import { parseQueueKey } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

const searchSchema = z.object({
  queueKey: z.string().optional(),
});

export const Route = createFileRoute("/workers/")({
  component: WorkersPage,
  validateSearch: (search: Record<string, unknown>) =>
    searchSchema.parse(search),
});

function WorkersPage() {
  const trpc = useTRPC();
  const navigate = useNavigate({ from: Route.fullPath });
  const { queueKey: queueKeySearch } = Route.useSearch();
  const [selected, setSelected] = useState<PrivateWorker | null>(null);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;
  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;
  const parsed = queueKeySearch ? parseQueueKey(queueKeySearch) : null;

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(),
  );
  const {
    data: workers,
    isLoading,
    isFetching,
    refetch,
  } = useQuery(
    trpc.workers.list.queryOptions({
      queueName: parsed?.name,
      prefix: parsed?.prefix,
      limit: 500,
    }),
  );
  const selectedQueue = selected
    ? queues?.find(
        (queue) =>
          (selected.queueKey &&
            "key" in queue &&
            queue.key === selected.queueKey) ||
          (queue.name === selected.queueName &&
            (selected.prefix === undefined ||
              queue.prefix === selected.prefix)),
      )
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Header title="Workers" />
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
      </div>

      <QueueFilter
        hasMultiplePrefixes={hasMultiplePrefixes}
        isLoading={loadingQueues}
        queues={queues}
        selectedQueueKey={queueKeySearch}
        onQueueKeyChange={(nextQueueKey) =>
          navigate({
            search: (prev) => ({
              ...prev,
              queueKey: nextQueueKey,
            }),
          })
        }
      />

      <WorkersTable
        hasMultiplePrefixes={hasMultiplePrefixes}
        isLoading={isLoading}
        workers={workers}
        onSelectWorker={setSelected}
      />

      <WorkerSheet
        open={Boolean(selected)}
        worker={selected}
        queue={selectedQueue}
        queueActions={{
          pause: queueSource?.features.queuePause.enabled ?? false,
          resume: queueSource?.features.queueResume.enabled ?? false,
          drain: queueSource?.features.queueDrain.enabled ?? false,
        }}
        onClose={() => setSelected(null)}
        onChanged={() => refetch()}
      />
    </div>
  );
}
