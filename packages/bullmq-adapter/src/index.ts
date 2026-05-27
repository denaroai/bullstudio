import type {
  Job,
  JobCounts,
  JobQueryOptions,
  JobStatus,
} from "@bullstudio/connect-types";
import type { QueueAdapter } from "@bullstudio/embedded-core";
import type { Job as BullMqJob, JobType, Queue } from "bullmq";

export interface BullMqQueueAdapterOptions {
  key?: string;
  label?: string;
}

export function createBullMqQueueAdapter(
  queue: Queue,
  options: BullMqQueueAdapterOptions = {},
): QueueAdapter {
  return {
    key: options.key ?? queue.name,
    label: options.label ?? queue.name,
    provider: "bullmq",
    capabilities: {
      flows: true,
      jobLogs: true,
      jobRemoval: true,
      jobRetry: true,
      queuePause: true,
      queueResume: true,
      workers: true,
    },
    getQueue: async () => {
      const [isPaused, jobCounts] = await Promise.all([
        queue.isPaused(),
        getJobCounts(queue),
      ]);

      return {
        name: queue.name,
        prefix: getQueuePrefix(queue),
        isPaused,
        jobCounts,
      };
    },
    getJobCounts: () => getJobCounts(queue),
    pauseQueue: async () => {
      await queue.pause();
    },
    resumeQueue: async () => {
      await queue.resume();
    },
    getJobs: async (options) => {
      const { filter, sort, limit = 100, offset = 0 } = options ?? {};
      const jobs = await queue.getJobs(
        resolveStatuses(filter?.status),
        offset,
        offset + limit - 1,
      );
      let mappedJobs = await Promise.all(
        jobs
          .filter((job): job is BullMqJob => job !== undefined)
          .map((job) => mapJob(job, queue.name)),
      );

      if (filter?.name) {
        mappedJobs = mappedJobs.filter((job) => job.name === filter.name);
      }

      if (sort) {
        mappedJobs = sortJobs(mappedJobs, sort.field, sort.order);
      }

      return mappedJobs;
    },
    getJobsSummary: async (options) => {
      const jobs = await queue.getJobs(
        resolveStatuses(options?.filter?.status),
        options?.offset ?? 0,
        (options?.offset ?? 0) + (options?.limit ?? 100) - 1,
      );
      const summaries = await Promise.all(
        jobs
          .filter((job): job is BullMqJob => job !== undefined)
          .map((job) => mapJob(job, queue.name)),
      );

      return summaries.map(
        ({ data, returnValue, stacktrace, ...summary }) => summary,
      );
    },
    getJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      return job ? mapJob(job, queue.name) : null;
    },
    getJobLogs: (jobId) => queue.getJobLogs(jobId),
    retryJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(
          `Job "${jobId}" was not found in queue "${queue.name}".`,
        );
      }
      await job.retry();
    },
    removeJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(
          `Job "${jobId}" was not found in queue "${queue.name}".`,
        );
      }
      await job.remove();
    },
    getWorkerCount: async () => {
      const workers = await queue.getWorkers();
      return {
        queueName: queue.name,
        count: workers.length,
      };
    },
  };
}

function resolveStatuses(
  status?: JobQueryOptions["filter"] extends infer Filter
    ? Filter extends { status?: infer Status }
      ? Status
      : never
    : never,
): JobType[] {
  if (!status) {
    return [
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
      "prioritized",
      "waiting-children",
    ];
  }

  return (Array.isArray(status) ? status : [status]) as JobType[];
}

async function mapJob(job: BullMqJob, queueName: string): Promise<Job> {
  return {
    id: job.id ?? "",
    name: job.name,
    queueName,
    data: job.data,
    status: (await job.getState()) as JobStatus,
    progress: normalizeProgress(job.progress),
    attemptsMade: job.attemptsMade,
    attemptsLimit: job.opts?.attempts ?? 1,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    returnValue: job.returnvalue,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    delay: job.opts?.delay,
    priority: job.opts?.priority,
    parentId: job.parentKey?.split(":").pop(),
    repeatJobKey: job.repeatJobKey,
  };
}

function normalizeProgress(progress: number | string | object | boolean) {
  if (typeof progress === "boolean") {
    return progress ? 100 : 0;
  }
  if (typeof progress === "string") {
    const parsed = Number.parseFloat(progress);
    return Number.isNaN(parsed) ? { value: progress } : parsed;
  }
  return progress;
}

function sortJobs(
  jobs: Job[],
  field: "timestamp" | "processedOn" | "finishedOn" | "progress",
  order: "asc" | "desc",
): Job[] {
  return [...jobs].sort((a, b) => {
    const aValue =
      field === "progress"
        ? typeof a.progress === "number"
          ? a.progress
          : 0
        : (a[field] ?? 0);
    const bValue =
      field === "progress"
        ? typeof b.progress === "number"
          ? b.progress
          : 0
        : (b[field] ?? 0);

    return order === "asc" ? aValue - bValue : bValue - aValue;
  });
}

async function getJobCounts(queue: Queue): Promise<JobCounts> {
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
    "prioritized",
    "waiting-children",
  );

  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
    paused: counts.paused ?? 0,
    prioritized: counts.prioritized ?? 0,
    waitingChildren: counts["waiting-children"] ?? 0,
  };
}

function getQueuePrefix(queue: Queue): string {
  return queue.opts.prefix ?? "bull";
}
