import type { JobSummary } from "@bullstudio/connect-types";
import dayjs from "@bullstudio/dayjs";
import { Button } from "@bullstudio/ui/components/button";
import { Input } from "@bullstudio/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@bullstudio/ui/components/pagination";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const jobSearchSchema = z.object({
  queueKey: z.string().optional(),
  statusFilter: z.enum(FilterableStatus).default(FilterableStatus.All),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(1000).catch(50),
  sortField: z
    .enum(["name", "queueName", "status", "timestamp", "duration"])
    .catch("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
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
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

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
  const pendingPaginationScrollY = useRef<number | null>(null);

  const {
    queueKey: queueKeySearch,
    statusFilter,
    q,
    page,
    pageSize,
    sortField,
    sortOrder,
  } = Route.useSearch();

  const [searchQuery, setSearchQuery] = useState(q ?? "");
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

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

  const selectedQueue = useMemo(() => {
    if (!parsed || !queues) {
      return null;
    }

    return (
      queues.find(
        (queue) =>
          queue.name === parsed.name && (queue.prefix ?? "") === parsed.prefix,
      ) ?? null
    );
  }, [parsed, queues]);

  const statusCounts = useMemo(() => {
    const queuesForCounts = selectedQueue
      ? [selectedQueue]
      : (queues ?? []);

    return queuesForCounts.reduce(
      (counts, queue) => {
        const jobCounts = queue.jobCounts;
        counts.waiting += jobCounts?.waiting ?? 0;
        counts.active += jobCounts?.active ?? 0;
        counts.completed += jobCounts?.completed ?? 0;
        counts.failed += jobCounts?.failed ?? 0;
        counts.delayed += jobCounts?.delayed ?? 0;
        counts.paused += jobCounts?.paused ?? 0;
        counts.waitingChildren += jobCounts?.waitingChildren ?? 0;
        counts.prioritized += jobCounts?.prioritized ?? 0;
        return counts;
      },
      {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
        waitingChildren: 0,
        prioritized: 0,
      },
    );
  }, [queues, selectedQueue]);

  const getStatusCount = (status: FilterableStatus | "all") => {
    if (!queues) {
      return null;
    }

    switch (status) {
      case FilterableStatus.All:
        return (
          statusCounts.waiting +
          statusCounts.active +
          statusCounts.completed +
          statusCounts.failed +
          statusCounts.delayed +
          statusCounts.paused +
          statusCounts.waitingChildren +
          statusCounts.prioritized
        );
      case FilterableStatus.Waiting:
        return statusCounts.waiting;
      case FilterableStatus.Active:
        return statusCounts.active;
      case FilterableStatus.Completed:
        return statusCounts.completed;
      case FilterableStatus.Failed:
        return statusCounts.failed;
      case FilterableStatus.Delayed:
        return statusCounts.delayed;
      case FilterableStatus.Paused:
        return statusCounts.paused;
      case FilterableStatus.WaitingChildren:
        return statusCounts.waitingChildren;
    }
  };

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

  const {
    data: jobsResponse,
    isLoading: loadingJobs,
    isFetching: fetchingJobs,
    refetch: refetchJobs,
  } = useQuery(
    trpc.jobs.listSummary.queryOptions({
      queueName: parsed?.name,
      prefix: parsed?.prefix,
      status: statusFilter !== "all" ? statusFilter : undefined,
      search: q,
      sortField,
      sortOrder,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
  );

  const hasJobsResponse = jobsResponse !== undefined;
  const jobs = jobsResponse?.items ?? [];
  const totalJobs = jobsResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize));
  const firstVisibleJob = totalJobs === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisibleJob = Math.min(page * pageSize, totalJobs);

  useEffect(() => {
    setSearchQuery(q ?? "");
  }, [q]);

  useEffect(() => {
    const nextQuery = debouncedSearchQuery.trim() || undefined;
    if (nextQuery === q) {
      return;
    }

    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery,
        page: 1,
      }),
      replace: true,
    });
  }, [debouncedSearchQuery, navigate, q]);

  useEffect(() => {
    if (hasJobsResponse && page > totalPages) {
      navigate({
        search: (prev) => ({
          ...prev,
          page: totalPages,
        }),
        replace: true,
      });
    }
  }, [hasJobsResponse, navigate, page, totalPages]);

  useEffect(() => {
    if (
      fetchingJobs ||
      !hasJobsResponse ||
      pendingPaginationScrollY.current === null
    ) {
      return;
    }

    const scrollY = pendingPaginationScrollY.current;
    pendingPaginationScrollY.current = null;
    requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  }, [fetchingJobs, hasJobsResponse]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      navigate({
        search: (prev) => ({
          ...prev,
          sortOrder: sortOrder === "asc" ? "desc" : "asc",
          page: 1,
        }),
      });
    } else {
      navigate({
        search: (prev) => ({
          ...prev,
          sortField: field,
          sortOrder: "desc",
          page: 1,
        }),
      });
    }
  };

  const navigateToPage = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    pendingPaginationScrollY.current = window.scrollY;
    navigate({
      search: (prev) => ({
        ...prev,
        page: boundedPage,
      }),
    });
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
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
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
                  page: 1,
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
            disabled={fetchingJobs}
            className="bg-card"
          >
            <RefreshCw
              className={`size-4 ${fetchingJobs ? "animate-spin" : ""}`}
            />
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
              page: 1,
            }),
          })
        }
      >
        <TabsList className="border border-border">
          {statusTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="group data-[state=active]:bg-background"
            >
              <span>{tab.label}</span>
              {getStatusCount(tab.value) !== null && (
                <span className="ml-1.5 rounded-sm border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground tabular-nums group-data-[state=active]:border-border group-data-[state=active]:bg-background group-data-[state=active]:text-foreground">
                  {getStatusCount(tab.value)?.toLocaleString()}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Jobs Table */}
      {loadingJobs ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
          <div className="p-8 space-y-4">
            {JOBS_SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="min-h-0 flex-1">
          <EmptyState
            icon={<Inbox className="size-12" />}
            title="No jobs found"
            description={
              searchQuery
                ? "Try adjusting your search query"
                : "No jobs matching your filters"
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-2">
                      Job
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("queueName")}
                  >
                    <div className="flex items-center gap-2">
                      Queue
                      <SortIcon field="queueName" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("timestamp")}
                  >
                    <div className="flex items-center gap-2">
                      Queued At
                      <SortIcon field="timestamp" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors text-right"
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
                {jobs.map((job) => (
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
          </div>

          {/* Pagination */}
          <div className="shrink-0 flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div>
              Showing {firstVisibleJob.toLocaleString()}-
              {lastVisibleJob.toLocaleString()} of {totalJobs.toLocaleString()}{" "}
              jobs
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span>Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        pageSize: Number(value),
                        page: 1,
                      }),
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[82px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Pagination className="mx-0 w-auto justify-start">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Go to first page"
                      disabled={page === 1}
                      onClick={() => navigateToPage(1)}
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 px-2.5 sm:pl-2.5"
                      disabled={page === 1}
                      onClick={() => navigateToPage(page - 1)}
                    >
                      <ChevronLeft className="size-4" />
                      <span className="hidden sm:block">Previous</span>
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-24 cursor-default"
                      aria-current="page"
                    >
                      {page.toLocaleString()} / {totalPages.toLocaleString()}
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 px-2.5 sm:pr-2.5"
                      disabled={page >= totalPages}
                      onClick={() => navigateToPage(page + 1)}
                    >
                      <span className="hidden sm:block">Next</span>
                      <ChevronRight className="size-4" />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Go to last page"
                      disabled={page >= totalPages}
                      onClick={() => navigateToPage(totalPages)}
                    >
                      <ChevronsRight className="size-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
