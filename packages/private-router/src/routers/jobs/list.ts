import type { JobStatus } from "@bullstudio/connect-types";
import type { DashboardQueue } from "../../shared/queue";
import type {
  JobListInput,
  JobListResponse,
  JobListSortField,
  JobListSortOrder,
} from "./types";

export type NormalizedJobListInput = Required<
  Pick<JobListInput, "limit" | "offset" | "sortField" | "sortOrder" | "search">
> &
  Omit<JobListInput, "limit" | "offset" | "sortField" | "sortOrder" | "search">;

export function mergeSortAndPageJobs<T extends { timestamp: number }>(
  jobs: T[],
  input: Pick<JobListInput, "limit" | "offset"> = {},
): T[] {
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;

  return [...jobs]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(offset, offset + limit);
}

export function filterSortAndPageJobs<
  T extends {
    id: string;
    name: string;
    queueName: string;
    status: JobStatus;
    timestamp: number;
    prefix?: string;
    processedOn?: number;
    finishedOn?: number;
  },
>(
  jobs: T[],
  input: NormalizedJobListInput,
  totalCandidates = jobs.length,
): JobListResponse<T> {
  const searched = input.search
    ? jobs.filter((job) => jobMatchesSearch(job, input.search))
    : jobs;
  const sorted = sortJobList(searched, input.sortField, input.sortOrder);
  const total = input.search ? searched.length : totalCandidates;

  return {
    items: sorted.slice(input.offset, input.offset + input.limit),
    total,
    limit: input.limit,
    offset: input.offset,
  };
}

export function normalizeJobListInput(
  input: JobListInput | undefined,
): NormalizedJobListInput {
  return {
    queueKey: input?.queueKey,
    queueName: input?.queueName,
    prefix: input?.prefix,
    status: input?.status,
    limit: input?.limit ?? 100,
    offset: input?.offset ?? 0,
    search: input?.search?.trim() ?? "",
    sortField: input?.sortField ?? "timestamp",
    sortOrder: input?.sortOrder ?? "desc",
  };
}

export function getSourceJobListInput(
  input: NormalizedJobListInput,
  totalCandidates: number,
): JobListInput {
  const needsFullCandidateSet =
    input.search ||
    input.sortField !== "timestamp" ||
    input.sortOrder !== "desc";

  return {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
    status: input.status,
    limit: needsFullCandidateSet ? totalCandidates : input.limit + input.offset,
    offset: 0,
  };
}

export function countQueueJobs(
  queue: DashboardQueue,
  status?: JobStatus,
): number {
  if (!queue.jobCounts) {
    return 0;
  }

  if (!status) {
    const bullMqOnlyCount =
      queue.provider !== "bull"
        ? queue.jobCounts.paused +
          queue.jobCounts.prioritized +
          queue.jobCounts.waitingChildren
        : 0;

    return (
      queue.jobCounts.waiting +
      queue.jobCounts.active +
      queue.jobCounts.completed +
      queue.jobCounts.failed +
      queue.jobCounts.delayed +
      bullMqOnlyCount
    );
  }

  if (
    queue.provider === "bull" &&
    (status === "paused" || status === "waiting-children")
  ) {
    return 0;
  }

  if (status === "waiting-children") {
    return queue.jobCounts.waitingChildren;
  }

  return queue.jobCounts[status];
}

function jobMatchesSearch(
  job: { id: string; name: string; queueName: string; prefix?: string },
  search: string,
): boolean {
  const query = search.toLowerCase();
  return [job.id, job.name, job.queueName, job.prefix].some((field) =>
    field?.toLowerCase().includes(query),
  );
}

function sortJobList<
  T extends {
    name: string;
    queueName: string;
    status: JobStatus;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
  },
>(jobs: T[], field: JobListSortField, order: JobListSortOrder): T[] {
  return [...jobs].sort((a, b) => {
    const direction = order === "asc" ? 1 : -1;
    const comparison = compareJobListValues(a, b, field);
    if (comparison !== 0) {
      return comparison * direction;
    }
    return b.timestamp - a.timestamp || a.name.localeCompare(b.name);
  });
}

function compareJobListValues<
  T extends {
    name: string;
    queueName: string;
    status: JobStatus;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
  },
>(a: T, b: T, field: JobListSortField): number {
  switch (field) {
    case "name":
      return a.name.localeCompare(b.name);
    case "queueName":
      return a.queueName.localeCompare(b.queueName);
    case "status":
      return a.status.localeCompare(b.status);
    case "duration":
      return getJobDuration(a) - getJobDuration(b);
    case "timestamp":
      return a.timestamp - b.timestamp;
  }
}

function getJobDuration(job: {
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}): number {
  if (job.finishedOn) {
    return job.finishedOn - (job.processedOn ?? job.timestamp);
  }

  if (job.processedOn) {
    return Date.now() - job.processedOn;
  }

  return 0;
}
