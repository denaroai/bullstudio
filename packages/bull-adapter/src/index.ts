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
  JobScheduler,
  JobSchedulerRepeat,
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
      schedulers: true,
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
    listJobSchedulers: async (options) => {
      const limit = options?.limit ?? 50;
      const jobs = await queue.getRepeatableJobs(0, limit - 1, true);
      return jobs.map((job) =>
        mapScheduler(job, queue.name, getQueuePrefix(queue)),
      );
    },
    getJobScheduler: async (target) => {
      const jobs = await queue.getRepeatableJobs(0, -1, true);
      const match = jobs.find(
        (job) =>
          job.key === target.key ||
          (target.id !== undefined && job.id === target.id),
      );
      return match
        ? mapScheduler(match, queue.name, getQueuePrefix(queue))
        : null;
    },
    upsertJobScheduler: async (input) => {
      // Bull has no native upsert: drop the previous repeatable (its key
      // encodes the repeat options) before adding the updated one.
      if (input.previousKey) {
        await queue.removeRepeatableByKey(input.previousKey);
      }
      await queue.add(
        input.template?.name ?? input.schedulerId,
        input.template?.data ?? {},
        {
          repeat: toRepeatOptions(input.repeat),
          jobId: input.schedulerId,
        },
      );
    },
    removeJobScheduler: async (target) => {
      await queue.removeRepeatableByKey(target.key);
      return true;
    },
  };
}

function mapScheduler(
  job: Bull.JobInformation,
  queueName: string,
  prefix: string,
): JobScheduler {
  // Bull leaves the unused field `null` at runtime, so the static `cron`/
  // `every` types are wider than what's actually returned.
  const raw = job as Bull.JobInformation & {
    cron?: string | null;
    every?: number | string | null;
  };
  const pattern = raw.cron ?? undefined;
  const every =
    raw.every === undefined || raw.every === null
      ? undefined
      : Number(raw.every);

  return {
    key: job.key,
    id: job.id,
    name: job.name,
    queueName,
    prefix,
    strategy: pattern ? "cron" : "every",
    pattern,
    every: pattern || every === undefined || Number.isNaN(every)
      ? undefined
      : every,
    tz: job.tz,
    next: job.next,
    endDate: job.endDate,
  };
}

function toRepeatOptions(
  repeat: JobSchedulerRepeat,
): Bull.CronRepeatOptions | Bull.EveryRepeatOptions {
  const base = {
    tz: repeat.tz,
    endDate: repeat.endDate,
    limit: repeat.limit,
  };

  if (repeat.strategy === "every") {
    return { ...base, every: repeat.every ?? 0 };
  }

  return { ...base, cron: repeat.pattern ?? "" };
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
