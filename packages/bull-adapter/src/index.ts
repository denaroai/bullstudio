import {
  createJobNotFoundError,
  createWorkerCount,
  filterJobsByName,
  normalizeJobCounts,
  sortJobs,
  toJobSummary,
} from "@bullstudio/adapter-utils";
import type {
  Job,
  JobCounts,
  JobStatus,
  QueueAdapter,
} from "@bullstudio/connect-types";
import type Bull from "bull";

export interface BullQueueAdapterOptions {
  key?: string;
  label?: string;
}

type BullJobStatus = "waiting" | "active" | "completed" | "failed" | "delayed";

export function createBullQueueAdapter(
  queue: Bull.Queue,
  options: BullQueueAdapterOptions = {},
): QueueAdapter {
  return {
    key: options.key ?? queue.name,
    label: options.label ?? queue.name,
    provider: "bull",
    capabilities: {
      flows: false,
      jobLogs: true,
      jobRemoval: true,
      jobRetry: true,
      queuePause: true,
      queueResume: true,
      queueDrain: true,
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
    drainQueue: async () => {
      await queue.empty();
    },
    getJobs: async (options) => {
      const { filter, sort, limit = 100, offset = 0 } = options ?? {};
      const jobs = await queue.getJobs(
        resolveStatuses(filter?.status),
        offset,
        offset + limit - 1,
      );
      let mappedJobs = jobs
        .filter((job): job is Bull.Job => job !== undefined && job !== null)
        .map((job) => mapJob(job, queue.name));

      mappedJobs = filterJobsByName(mappedJobs, filter?.name);

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

      let summaries = jobs
        .filter((job): job is Bull.Job => job !== undefined && job !== null)
        .map((job) => mapJob(job, queue.name));

      summaries = filterJobsByName(summaries, options?.filter?.name);

      if (options?.sort) {
        summaries = sortJobs(summaries, options.sort.field, options.sort.order);
      }

      return summaries.map(toJobSummary);
    },
    getJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      return job ? mapJob(job, queue.name) : null;
    },
    getJobLogs: (jobId) => queue.getJobLogs(jobId),
    retryJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw createJobNotFoundError(queue.name, jobId);
      }
      await job.retry();
    },
    removeJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw createJobNotFoundError(queue.name, jobId);
      }
      await job.remove();
    },
    getWorkerCount: async () => {
      const workers = await queue.getWorkers();
      return createWorkerCount(queue.name, workers);
    },
  };
}

function resolveStatuses(status?: JobStatus | JobStatus[]): BullJobStatus[] {
  if (!status) {
    return ["waiting", "active", "completed", "failed", "delayed"];
  }

  const statuses = Array.isArray(status) ? status : [status];
  return statuses.filter((value): value is BullJobStatus =>
    ["waiting", "active", "completed", "failed", "delayed"].includes(value),
  );
}

function mapJob(job: Bull.Job, queueName: string): Job {
  return {
    id: String(job.id),
    name: job.name,
    queueName,
    data: job.data,
    status: getJobState(job),
    progress: normalizeProgress(job.progress()),
    attemptsMade: job.attemptsMade,
    attemptsLimit: job.opts.attempts ?? 1,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    returnValue: job.returnvalue,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    delay: job.opts.delay,
    priority: job.opts.priority,
    parentId: undefined,
    repeatJobKey: job.opts.repeat ? job.id?.toString() : undefined,
  };
}

function getJobState(job: Bull.Job): JobStatus {
  if (job.finishedOn) {
    return job.failedReason ? "failed" : "completed";
  }

  if (job.processedOn) {
    return "active";
  }

  if (job.opts.delay && job.timestamp + job.opts.delay > Date.now()) {
    return "delayed";
  }

  return "waiting";
}

function normalizeProgress(progress: number | object): number | object {
  if (typeof progress === "number") {
    return progress;
  }

  if (typeof progress === "object" && progress !== null) {
    return progress;
  }

  return 0;
}

async function getJobCounts(queue: Bull.Queue): Promise<JobCounts> {
  const counts = await queue.getJobCounts();

  return normalizeJobCounts(counts);
}

function getQueuePrefix(queue: Bull.Queue): string {
  const queueWithPrefix = queue as Bull.Queue & {
    keyPrefix?: string;
    opts?: {
      prefix?: string;
    };
  };

  return queueWithPrefix.keyPrefix ?? queueWithPrefix.opts?.prefix ?? "bull";
}
