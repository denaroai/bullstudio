"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import Header from "@/components/Header";
import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { Badge } from "@bullstudio/ui/components/badge";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Workflow,
  GitBranch,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import { FlowGraph } from "@/components/flows/FlowGraph";
import type { FlowNode } from "@bullstudio/connect-types";

const searchSchema = z.object({
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
  const { queueName, prefix } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const {
    data: flowTree,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(
    trpc.flows.get.queryOptions(
      { queueName, flowId, prefix },
      {
        refetchInterval(query) {
          const data = query.state.data;
          if (!data) return false;
          return checkHasActiveJobs(data.root) ? 2000 : false;
        },
      }
    )
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
    [navigate, prefix]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title="Flow Details" />
        <Skeleton className="h-[600px] w-full bg-zinc-800/50" />
      </div>
    );
  }

  if (!flowTree) {
    return (
      <div className="space-y-6">
        <Header title="Flow Not Found" />
        <div className="text-center py-12">
          <AlertTriangle className="size-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">Flow not found</h3>
          <p className="text-sm text-zinc-500 mt-1">
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Workflow className="size-5 text-cyan-400" />
          </div>
          <Header title="Flow Details" />
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {flowId}
        </Badge>
      </div>

      {/* Flow Metadata */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Queue:</span>
          <Badge variant="secondary" className="font-mono">
            {queueName}
          </Badge>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        <div className="flex items-center gap-2 text-sm">
          <GitBranch className="size-4 text-zinc-500" />
          <span className="text-zinc-300">{flowTree.totalNodes} jobs</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="size-4 text-emerald-400" />
          <span className="text-emerald-400">{flowTree.completedNodes} completed</span>
        </div>

        {flowTree.failedNodes > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="size-4 text-red-400" />
            <span className="text-red-400">{flowTree.failedNodes} failed</span>
          </div>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-zinc-800 hover:bg-zinc-800"
        >
          <RefreshCw
            className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Flow Graph */}
      <FlowGraph root={flowTree.root} onNodeClick={handleNodeClick} />
    </div>
  );
}
