"use client";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SchedulerQueueFilter } from "@/components/schedulers/SchedulerQueueFilter";
import { SchedulerSheet } from "@/components/schedulers/SchedulerSheet";
import { SchedulersHeader } from "@/components/schedulers/SchedulersHeader";
import { SchedulersTable } from "@/components/schedulers/SchedulersTable";
import type { PrivateScheduler } from "@/components/schedulers/types";
import { useTRPC } from "@/integrations/trpc/react";
import { parseQueueKey, queueKey } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

const searchSchema = z.object({
  queueKey: z.string().optional(),
});

export const Route = createFileRoute("/schedulers/")({
  component: SchedulersPage,
  validateSearch: (search: Record<string, unknown>) =>
    searchSchema.parse(search),
});

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
      <SchedulersHeader
        canCreate={mutationsEnabled && Boolean(selectedQueue)}
        isFetching={isFetching}
        mutationsEnabled={mutationsEnabled}
        onRefresh={() => refetch()}
        onCreate={() => {
          setSelected(null);
          setCreating(true);
        }}
      />

      <SchedulerQueueFilter
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

      <SchedulersTable
        hasMultiplePrefixes={hasMultiplePrefixes}
        isLoading={isLoading}
        schedulers={schedulers}
        onSelectScheduler={(scheduler) => {
          setCreating(false);
          setSelected(scheduler);
        }}
      />

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
