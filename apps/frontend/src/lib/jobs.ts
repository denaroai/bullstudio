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

export type JobSortField =
  | "name"
  | "queueName"
  | "status"
  | "timestamp"
  | "duration";

/**
 * Search params for the per-queue jobs view. The queue itself is fixed by the
 * route param, so (unlike the old global jobs page) there is no `queueKey` here.
 */
export const jobsSearchSchema = z.object({
  statusFilter: z.enum(FilterableStatus).default(FilterableStatus.All),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(1000).catch(50),
  sortField: z
    .enum(["name", "queueName", "status", "timestamp", "duration"])
    .catch("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
});

export type JobsSearch = z.infer<typeof jobsSearchSchema>;

export const DEFAULT_JOBS_SEARCH: JobsSearch = {
  statusFilter: FilterableStatus.All,
  page: 1,
  pageSize: 50,
  sortField: "timestamp",
  sortOrder: "desc",
};
