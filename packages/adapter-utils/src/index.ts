import type {
  Job,
  JobCounts,
  JobSort,
  JobSummary,
  WorkerCount,
} from "@bullstudio/connect-types";

export type SortableJob = Pick<
  Job,
  "finishedOn" | "processedOn" | "progress" | "timestamp"
>;

export function filterJobsByName<T extends { name: string }>(
  jobs: T[],
  name: string | undefined,
): T[] {
  return name ? jobs.filter((job) => job.name === name) : jobs;
}

export function sortJobs<T extends SortableJob>(
  jobs: T[],
  field: JobSort["field"],
  order: JobSort["order"],
): T[] {
  return [...jobs].sort((a, b) => {
    const aValue = getSortableJobValue(a, field);
    const bValue = getSortableJobValue(b, field);

    return order === "asc" ? aValue - bValue : bValue - aValue;
  });
}

export function toJobSummary({
  attemptsLimit: _attemptsLimit,
  data: _data,
  returnValue: _returnValue,
  stacktrace: _stacktrace,
  ...summary
}: Job): JobSummary {
  return summary;
}

export function createJobNotFoundError(
  queueName: string,
  jobId: string,
): Error {
  return new Error(`Job "${jobId}" was not found in queue "${queueName}".`);
}

export function createWorkerCount(
  queueName: string,
  workers: unknown[],
): WorkerCount {
  return {
    queueName,
    count: workers.length,
  };
}

export function normalizeJobCounts(
  counts: Partial<Record<keyof JobCounts | "waiting-children", number>>,
): JobCounts {
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
    paused: counts.paused ?? 0,
    prioritized: counts.prioritized ?? 0,
    waitingChildren: counts.waitingChildren ?? counts["waiting-children"] ?? 0,
  };
}

function getSortableJobValue(
  job: SortableJob,
  field: JobSort["field"],
): number {
  if (field === "progress") {
    return typeof job.progress === "number" ? job.progress : 0;
  }

  return job[field] ?? 0;
}
