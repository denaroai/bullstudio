"use client"

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/integrations/trpc/react"
import { useQuery } from "@tanstack/react-query"
import Header from "@/components/Header"
import { getFlowDetailSearch } from "@/lib/flow-detail-navigation"
import { Button } from "@bullstudio/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table"
import { Skeleton } from "@bullstudio/ui/components/skeleton"
import {
  JobStatusBadge,
  type JobStatus,
  EmptyState,
} from "@bullstudio/ui/shared"
import { Workflow, RefreshCw, Inbox, CheckCircle, XCircle } from "lucide-react"
import dayjs from "@bullstudio/dayjs"
import type { FlowSummary } from "@bullstudio/connect-types"

type PrivateFlowSummary = FlowSummary & { queueKey?: string }

const flowSkeletonRows = [
  "flow-skeleton-1",
  "flow-skeleton-2",
  "flow-skeleton-3",
  "flow-skeleton-4",
  "flow-skeleton-5",
]

export const Route = createFileRoute("/flows/")({
  component: FlowsPage,
})

function FlowsPage() {
  const trpc = useTRPC()
  const navigate = useNavigate()

  const {
    data: flows,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(
    trpc.flows.list.queryOptions(undefined, {
      refetchInterval(query) {
        const flowsData = query.state.data
        if (!flowsData || flowsData.length === 0) return false
        const hasActiveFlows = flowsData.some(
          (f) => !["completed", "failed"].includes(f.status),
        )
        return hasActiveFlows ? 2000 : false
      },
    }),
  )

  const navigateToFlow = (flow: PrivateFlowSummary) => {
    navigate({
      to: "/flows/$flowId",
      params: { flowId: flow.id },
      search: getFlowDetailSearch(flow),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Header title="Flows" />
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

      {isLoading ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-8 space-y-4">
            {flowSkeletonRows.map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : !flows || flows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-12" />}
          title="No flows found"
          description="Flows will appear here when parent jobs with children are created using BullMQ's FlowProducer"
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Flow</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((flow) => (
                <TableRow
                  key={`${flow.prefix}-${flow.queueName}-${flow.id}`}
                  className="cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => navigateToFlow(flow)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <Workflow className="size-4 text-cyan-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {flow.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {flow.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {flow.queueName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge
                      status={flow.status as JobStatus}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-foreground">
                        {flow.totalJobs} total
                      </span>
                      <div className="flex items-center gap-3 text-xs">
                        {flow.completedJobs > 0 && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle className="size-3" />
                            {flow.completedJobs}
                          </span>
                        )}
                        {flow.failedJobs > 0 && (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircle className="size-3" />
                            {flow.failedJobs}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">
                        {dayjs(flow.timestamp).fromNow()}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {dayjs(flow.timestamp).format("MMM D, HH:mm:ss")}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t text-sm text-muted-foreground">
            Showing {flows.length} flow{flows.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  )
}
