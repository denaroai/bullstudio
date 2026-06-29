import type {
  Job,
  JobCounts,
  JobSort,
  JobSummary,
  Worker,
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

export function mapRedisClientWorker(
  client: unknown,
  queueName: string,
  options: {
    prefix?: string;
    provider?: string;
  } = {},
): Worker {
  const metadata = toMetadata(client);
  const name =
    getStringField(client, "name") ??
    getStringField(client, "id") ??
    getStringField(client, "addr") ??
    "worker";
  const address = getStringField(client, "addr");
  const id = [
    options.prefix,
    queueName,
    name,
    address,
    getStringField(client, "fd"),
  ]
    .filter(Boolean)
    .join(":");

  return {
    id,
    name,
    queueName,
    prefix: options.prefix,
    provider: options.provider,
    address,
    age: getNumberField(client, "age") ?? 0,
    idle: getNumberField(client, "idle") ?? 0,
    metadata,
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

function getStringField(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function getNumberField(input: unknown, key: string): number | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toMetadata(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter((entry): entry is [string, string | number | boolean] => {
        const value = entry[1];
        return (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        );
      })
      .map(([key, value]) => [key, String(value)]),
  );
}
