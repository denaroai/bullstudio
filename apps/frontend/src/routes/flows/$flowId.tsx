"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  GitBranch,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import { FlowGraph } from "@/components/flows/FlowGraph";
import type { FlowNode } from "@bullstudio/connect-types";

const searchSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string(),
  prefix: z.string().optional(),
});

export const Route = createFileRoute("/flows/$flowId")({
  component: FlowDetailPage,
  validateSearch: searchSchema,
});

function checkHasActiveJobs(node: FlowNode): boolean {
  const activeStates = ["active", "waiting", "delayed", "waiting-children"];
  if (activeStates.includes(node.status)) return true;
  if (!node.children) return false;
  return node.children.some(checkHasActiveJobs);
}

function FlowDetailPage() {
  const { flowId } = Route.useParams();
  const { queueName, prefix, queueKey } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const {
    data: flowTree,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(
    trpc.flows.get.queryOptions(
      { queueKey, queueName, flowId, prefix },
      {
        refetchInterval(query) {
          const data = query.state.data;
          if (!data) return false;
          return checkHasActiveJobs(data.root) ? 2000 : false;
        },
      },
    ),
  );

  const goBack = useCallback(() => {
    navigate({ to: "/flows" });
  }, [navigate]);

  const handleNodeClick = useCallback(
    (jobId: string, jobQueueName: string) => {
      navigate({
        to: "/jobs/$jobId",
        params: { jobId },
        search: {
          queueName: jobQueueName,
          prefix,
        },
      });
    },
    [navigate, prefix],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full bg-zinc-800/50" />
        <Skeleton className="h-16 w-full bg-zinc-800/50" />
        <Skeleton className="h-[560px] w-full bg-zinc-800/50" />
      </div>
    );
  }

  if (!flowTree) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="size-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">Flow not found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The flow may have been removed or the ID is incorrect.
          </p>
          <Button variant="outline" className="mt-4" onClick={goBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Flows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            aria-label="Back to flows"
            className="mt-0.5"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold leading-tight text-foreground">
                {flowTree.root.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-medium uppercase text-cyan-400">
                Flow
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">#{flowId}</span>
              <span className="font-mono">{queueName}</span>
              {prefix && <span className="font-mono">{prefix}</span>}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-card"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <div className="grid overflow-hidden rounded-lg border bg-card/80 sm:grid-cols-2 lg:grid-cols-4">
        <FlowMetric
          icon={<GitBranch className="size-4 text-muted-foreground" />}
          label="Jobs"
          value={String(flowTree.totalNodes)}
        />
        <FlowMetric
          icon={<CheckCircle className="size-4 text-emerald-400" />}
          label="Completed"
          value={String(flowTree.completedNodes)}
          valueClassName="text-emerald-400"
        />
        <FlowMetric
          icon={<XCircle className="size-4 text-red-400" />}
          label="Failed"
          value={String(flowTree.failedNodes)}
          valueClassName={flowTree.failedNodes > 0 ? "text-red-400" : undefined}
        />
        <FlowMetric label="Queue" value={queueName} mono />
      </div>

      <FlowGraph root={flowTree.root} onNodeClick={handleNodeClick} />
    </div>
  );
}

function FlowMetric({
  icon,
  label,
  value,
  valueClassName,
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b p-4 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      {icon}
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-0.5 truncate text-sm font-medium text-foreground ${mono ? "font-mono" : ""} ${valueClassName ?? ""}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
