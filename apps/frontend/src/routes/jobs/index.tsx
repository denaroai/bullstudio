import type { JobSummary } from "@bullstudio/connect-types";
import dayjs from "@bullstudio/dayjs";
import { Button } from "@bullstudio/ui/components/button";
import { Input } from "@bullstudio/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@bullstudio/ui/components/tabs";
import {
  EmptyState,
  type JobStatus,
  JobStatusBadge,
} from "@bullstudio/ui/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Inbox,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { useTRPC } from "@/integrations/trpc/react";
import {
  getJobDetailSearch,
  type JobDetailNavigationSource,
} from "@/lib/job-detail-navigation";
import { parseQueueKey, queueKey } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";
import { z } from "zod";

export enum FilterableStatus {
  All = "all",
  Waiting = "waiting",
  Active = "active",
  Completed = "completed",
  Failed = "failed",
  Delayed = "delayed",
  Paused = "paused",
  WaitingChildren = "waiting-children",
}

type SortField = "name" | "queueName" | "status" | "timestamp" | "duration";
type SortOrder = "asc" | "desc";

const jobSearchSchema = z.object({
  queueKey: z.string().optional(),
  statusFilter: z.enum(FilterableStatus).default(FilterableStatus.All),
});
type JobSearch = z.infer<typeof jobSearchSchema>;

export const Route = createFileRoute("/jobs/")({
  component: JobsPage,
  validateSearch: (search: Record<string, unknown>): JobSearch =>
    jobSearchSchema.parse(search),
});

const BASE_STATUS_TABS: { value: FilterableStatus | "all"; label: string }[] = [
  { value: FilterableStatus.All, label: "All" },
  { value: FilterableStatus.Waiting, label: "Waiting" },
  { value: FilterableStatus.Active, label: "Active" },
  { value: FilterableStatus.Completed, label: "Completed" },
  { value: FilterableStatus.Failed, label: "Failed" },
  { value: FilterableStatus.Delayed, label: "Delayed" },
];

const ALL_QUEUES_VALUE = "__all__";
const SEARCH_DEBOUNCE_MS = 300;
const JOBS_SKELETON_KEYS = ["job-1", "job-2", "job-3", "job-4", "job-5"];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function JobsPage() {
  const trpc = useTRPC();
  const navigate = useNavigate({ from: Route.fullPath });

  const { queueKey: queueKeySearch, statusFilter } = Route.useSearch();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const hasMultiplePrefixes = (queueSource?.prefixes.length ?? 0) > 1;

  const parsed = queueKeySearch ? parseQueueKey(queueKeySearch) : null;

  // Build status tabs based on provider capabilities
  const statusTabs = useMemo(() => {
    // If provider supports flows (BullMQ), add waiting-children tab
    if (queueSource?.features.flows.visible) {
      return [
        ...BASE_STATUS_TABS,
        {
          value: "waiting-children" as FilterableStatus,
          label: "Waiting Children",
        },
      ];
    }
    return BASE_STATUS_TABS;
  }, [queueSource?.features.flows.visible]);

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(),
  );

  const {
    data: jobs,
    isLoading: loadingJobs,
    refetch: refetchJobs,
  } = useQuery(
    trpc.jobs.listSummary.queryOptions({
      queueName: parsed?.name,
      prefix: parsed?.prefix,
      status: statusFilter !== "all" ? statusFilter : undefined,
      limit: 500,
    }),
  );

  // Client-side filtering and sorting
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs ?? [];

    // Search filter (searches only summary fields - no payload data)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((job) => {
        const searchableFields = [job.name, job.id, job.queueName];
        return searchableFields.some(
          (field) => field && String(field).toLowerCase().includes(query),
        );
      });
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "queueName":
          aVal = a.queueName.toLowerCase();
          bVal = b.queueName.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "timestamp":
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case "duration":
          aVal = a.finishedOn
            ? a.finishedOn - a.timestamp
            : a.processedOn
              ? Date.now() - a.processedOn
              : 0;
          bVal = b.finishedOn
            ? b.finishedOn - b.timestamp
            : b.processedOn
              ? Date.now() - b.processedOn
              : 0;
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [jobs, debouncedSearchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 text-zinc-600" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="size-3.5 text-zinc-300" />
    ) : (
      <ArrowDown className="size-3.5 text-zinc-300" />
    );
  };

  const formatDuration = (job: JobSummary) => {
    if (job.finishedOn) {
      const ms = job.finishedOn - (job.processedOn ?? job.timestamp);
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      return `${(ms / 60000).toFixed(1)}m`;
    }
    if (job.processedOn || job.status === "active") {
      return (
        <span className="text-blue-400 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
          In progress
        </span>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  };

  const navigateToJob = (jobId: string, job: JobDetailNavigationSource) => {
    navigate({
      to: "/jobs/$jobId",
      params: { jobId },
      search: getJobDetailSearch(job),
    });
  };

  return (
    <div className="space-y-6">
      <Header title="Jobs" />

      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={queueKeySearch || ALL_QUEUES_VALUE}
            onValueChange={(value) =>
              //setSelectedQueue(value === ALL_QUEUES_VALUE ? "" : value)
              navigate({
                search: (prev) => ({
                  ...prev,
                  queueKey: value === ALL_QUEUES_VALUE ? undefined : value,
                }),
              })
            }
            disabled={loadingQueues}
          >
            <SelectTrigger className="w-[250px] bg-card">
              <Layers className="size-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_QUEUES_VALUE}>All queues</SelectItem>
              {loadingQueues ? (
                <div className="p-2">
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : queues?.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No queues found
                </div>
              ) : (
                queues?.map((queue) => (
                  <SelectItem
                    key={queueKey(queue.prefix ?? "", queue.name)}
                    value={queueKey(queue.prefix ?? "", queue.name)}
                  >
                    <span className="font-mono">
                      {hasMultiplePrefixes && (
                        <span className="text-muted-foreground mr-1">
                          {queue.prefix}/
                        </span>
                      )}
                      {queue.name}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchJobs()}
            className="bg-card"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) =>
          navigate({
            search: (prev) => ({
              ...prev,
              statusFilter: v as FilterableStatus,
            }),
          })
        }
      >
        <TabsList className="border border-border">
          {statusTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-background"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Jobs Table */}
      {loadingJobs ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-8 space-y-4">
            {JOBS_SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : filteredAndSortedJobs.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-12" />}
          title="No jobs found"
          description={
            searchQuery
              ? "Try adjusting your search query"
              : "No jobs matching your filters"
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    Job
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("queueName")}
                >
                  <div className="flex items-center gap-2">
                    Queue
                    <SortIcon field="queueName" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("timestamp")}
                >
                  <div className="flex items-center gap-2">
                    Queued At
                    <SortIcon field="timestamp" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors text-right"
                  onClick={() => handleSort("duration")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Duration
                    <SortIcon field="duration" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedJobs.map((job) => (
                <TableRow
                  key={`${job.prefix ?? ""}-${job.queueName}-${job.id}`}
                  className="cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => navigateToJob(job.id, job)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {job.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {job.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {hasMultiplePrefixes && job.prefix && (
                        <span className="text-muted-foreground mr-1">
                          {job.prefix}/
                        </span>
                      )}
                      {job.queueName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge
                      status={job.status as JobStatus}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">
                        {dayjs(job.timestamp).fromNow()}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {dayjs(job.timestamp).format("MMM D, HH:mm:ss")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatDuration(job)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Results Count */}
          <div className="px-4 py-3 border-t text-sm text-muted-foreground">
            Showing {filteredAndSortedJobs.length} of {jobs?.length ?? 0} jobs
          </div>
        </div>
      )}
    </div>
  );
}
