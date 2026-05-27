import {
  createJobNotFoundError,
  createWorkerCount,
  filterJobsByName,
  normalizeJobCounts,
  sortJobs,
  toJobSummary,
} from "@bullstudio/adapter-utils";
import type {
  FlowNode,
  FlowSummary,
  FlowTree,
  Job,
  JobQueryOptions,
  JobStatus,
} from "@bullstudio/connect-types";
import type { QueueAdapter } from "@bullstudio/embedded-core";
import {
  type Job as BullMqJob,
  FlowProducer,
  type JobNode,
  type JobType,
  type Queue,
} from "bullmq";

export interface BullMqQueueAdapterOptions {
  key?: string;
  label?: string;
}

export function createBullMqQueueAdapter(
  queue: Queue,
  options: BullMqQueueAdapterOptions = {},
): QueueAdapter {
  const flowProducer = new FlowProducer({
    connection: queue.opts?.connection,
    prefix: getQueuePrefix(queue),
  });

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
      const summaries = await Promise.all(
        jobs
          .filter((job): job is BullMqJob => job !== undefined)
          .map((job) => mapJob(job, queue.name)),
      );
      let filteredSummaries = filterJobsByName(
        summaries,
        options?.filter?.name,
      );

      if (options?.sort) {
        filteredSummaries = sortJobs(
          filteredSummaries,
          options.sort.field,
          options.sort.order,
        );
      }

      return filteredSummaries.map(toJobSummary);
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
    listFlows: async (options) => listFlows(queue, flowProducer, options),
    getFlow: async (flowId) => getFlow(queue, flowProducer, flowId),
  };
}

async function listFlows(
  queue: Queue,
  flowProducer: FlowProducer,
  options?: { limit?: number },
): Promise<FlowSummary[]> {
  const limit = options?.limit ?? 50;
  const prefix = getQueuePrefix(queue);
  const flows: FlowSummary[] = [];
  const seenJobIds = new Set<string>();

  const jobs = await getPotentialFlowRoots(queue, limit);

  for (const job of jobs) {
    if (flows.length >= limit) {
      break;
    }
    if (job.parentId) {
      continue;
    }

    const jobKey = `${prefix}:${job.queueName}:${job.id}`;
    if (seenJobIds.has(jobKey)) {
      continue;
    }
    seenJobIds.add(jobKey);

    const flowTree = await getBullMqFlow(flowProducer, {
      id: job.id,
      queueName: job.queueName,
      prefix,
    });

    if (!flowTree?.children || flowTree.children.length === 0) {
      continue;
    }

    const stats = await countFlowStats(flowTree);
    const state = await flowTree.job.getState();

    flows.push({
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      prefix,
      status: state as JobStatus,
      totalJobs: stats.total,
      completedJobs: stats.completed,
      failedJobs: stats.failed,
      timestamp: job.timestamp,
    });
  }

  return flows.sort((a, b) => b.timestamp - a.timestamp);
}

async function getPotentialFlowRoots(
  queue: Queue,
  limit: number,
): Promise<FlowSummaryCandidate[]> {
  const [recentJobs, waitingChildrenJobs] = await Promise.all([
    queue.getJobs(resolveStatuses(undefined), 0, 499),
    queue.getJobs(["waiting-children"], 0, Math.max(limit * 2, 99)),
  ]);

  const jobs = await Promise.all(
    [...recentJobs, ...waitingChildrenJobs]
      .filter((job): job is BullMqJob => job !== undefined)
      .map((job) => mapJob(job, queue.name)),
  );

  return jobs.sort((a, b) => b.timestamp - a.timestamp);
}

async function getFlow(
  queue: Queue,
  flowProducer: FlowProducer,
  flowId: string,
): Promise<FlowTree | null> {
  const flowTree = await getBullMqFlow(flowProducer, {
    id: flowId,
    queueName: queue.name,
    prefix: getQueuePrefix(queue),
  });

  if (!flowTree) {
    return null;
  }

  const root = await convertFlowTree(flowTree);
  const stats = await countFlowStats(flowTree);

  return {
    id: flowId,
    root,
    queueName: queue.name,
    totalNodes: stats.total,
    completedNodes: stats.completed,
    failedNodes: stats.failed,
  };
}

async function getBullMqFlow(
  flowProducer: FlowProducer,
  options: {
    id: string;
    queueName: string;
    prefix: string;
  },
): Promise<JobNode | null> {
  try {
    return await flowProducer.getFlow(options);
  } catch {
    return null;
  }
}

async function countFlowStats(tree: JobNode): Promise<{
  total: number;
  completed: number;
  failed: number;
}> {
  let total = 1;
  let completed = 0;
  let failed = 0;

  const state = await tree.job.getState();
  if (state === "completed") {
    completed = 1;
  } else if (state === "failed") {
    failed = 1;
  }

  if (tree.children) {
    for (const child of tree.children) {
      const childStats = await countFlowStats(child);
      total += childStats.total;
      completed += childStats.completed;
      failed += childStats.failed;
    }
  }

  return { total, completed, failed };
}

async function convertFlowTree(tree: JobNode): Promise<FlowNode> {
  const job = tree.job;
  const state = await job.getState();
  const children = tree.children
    ? await Promise.all(tree.children.map((child) => convertFlowTree(child)))
    : [];

  return {
    id: job.id ?? "",
    name: job.name,
    queueName: job.queueName,
    status: state as JobStatus,
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    children,
  };
}

type FlowSummaryCandidate = Pick<
  FlowSummary,
  "id" | "name" | "queueName" | "timestamp"
> & {
  parentId?: string;
};

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

async function getJobCounts(queue: Queue) {
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

  return normalizeJobCounts(counts);
}

function getQueuePrefix(queue: Queue): string {
  return queue.opts?.prefix ?? "bull";
}
