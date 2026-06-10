import type {
  Job,
  JobQueryOptions,
  JobScheduler,
  JobSummary,
  Worker,
} from "@bullstudio/connect-types";
import {
  createPrivateDashboardRouter,
  type FlowListInput,
  type JobListInput,
  type JobTargetInput,
  type PrivateDashboardContext,
  type PrivateDashboardQueueSource,
  type QueueSourceStatus as PrivateQueueSourceStatus,
  type QueueMetricsListInput,
  type QueueMetricsSummary,
  type QueueTargetInput,
  type SchedulerListInput,
  type SchedulerTargetInput,
  type SchedulerUpsertInput,
  type WorkerListInput,
} from "@bullstudio/private-router";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getAuthenticatedSession } from "./session";
import type {
  DashboardProtection,
  DashboardQueue,
  EmbeddedDashboardInstance,
  FrameworkRequest,
  FrameworkResponse,
  PrivateDashboardApiMount,
  QueueSourceStatus,
} from "./types";
import { getPathname, toAbsoluteUrl } from "./url";

export function createPrivateDashboardApi(
  dashboard: EmbeddedDashboardInstance,
): PrivateDashboardApiMount {
  const source = createEmbeddedQueueSource(dashboard);
  const router = createPrivateDashboardRouter(source);

  return {
    handle: (request) =>
      handlePrivateDashboardApi(router, dashboard.config.protection, request),
  };
}

export function createEmbeddedQueueSource(
  dashboard: EmbeddedDashboardInstance,
): PrivateDashboardQueueSource {
  return {
    mode: "embedded",
    readOnly: dashboard.config.readOnly,
    getStatus: async () =>
      toPrivateQueueSourceStatus(dashboard.getQueueSourceStatus()),
    listQueues: () => dashboard.listQueues(),
    listPrefixes: () => getSuppliedQueuePrefixes(dashboard),
    resolveQueue: (input) =>
      getSuppliedQueueByPrivateApiInput(dashboard, input),
    listJobs: async (input) => {
      const queues = await getQueuesForJobList(dashboard, input);
      const jobs: Array<Job & { queueKey?: string }> = [];

      for (const queue of queues) {
        const queueJobs = await dashboard.getJobs(
          queue.key,
          getQueueJobQueryOptions(input),
        );
        jobs.push(
          ...queueJobs.map((job) => ({
            ...job,
            prefix: job.prefix ?? queue.prefix,
            queueKey: queue.key,
          })),
        );
      }

      return jobs;
    },
    listJobSummaries: async (input) => {
      const queues = await getQueuesForJobList(dashboard, input);
      const jobs: Array<JobSummary & { queueKey?: string }> = [];

      for (const queue of queues) {
        const queueJobs = await dashboard.getJobsSummary(
          queue.key,
          getQueueJobQueryOptions(input),
        );
        jobs.push(
          ...queueJobs.map((job) => ({
            ...job,
            prefix: job.prefix ?? queue.prefix,
            queueKey: queue.key,
          })),
        );
      }

      return jobs;
    },
    listQueueMetrics: (input) => listQueueMetrics(dashboard, input),
    getJob: async (input) => {
      const queue = await getQueueForTarget(dashboard, input);
      return dashboard.getJob(queue.key, input.jobId);
    },
    getJobLogs: async (input) => {
      const queue = await getQueueForTarget(dashboard, input);
      return dashboard.getJobLogs(queue.key, input.jobId);
    },
    retryJob: (input) => retryJob(dashboard, input),
    removeJob: (input) => removeJob(dashboard, input),
    pauseQueue: async (input) => {
      const queue = await getSuppliedQueueByPrivateApiInput(dashboard, input);
      await dashboard.pauseQueue(queue.key);
      return { success: true };
    },
    resumeQueue: async (input) => {
      const queue = await getSuppliedQueueByPrivateApiInput(dashboard, input);
      await dashboard.resumeQueue(queue.key);
      return { success: true };
    },
    drainQueue: async (input) => {
      const queue = await getSuppliedQueueByPrivateApiInput(dashboard, input);
      await dashboard.drainQueue(queue.key);
      return { success: true };
    },
    listFlows: (input) => dashboard.listFlows(getFlowListInput(input)),
    getFlow: async (input) => {
      const queue = await getQueueForTarget(dashboard, input);
      return dashboard.getFlow(queue.key, input.flowId);
    },
    listWorkers: async (input) => {
      const queues = await getQueuesForWorkerList(dashboard, input);
      const workers: Array<Worker & { queueKey?: string }> = [];

      for (const queue of queues) {
        if (!queue.capabilities.workers) {
          if (input.queueKey || input.queueName) {
            assertWorkerCapability(queue);
          }
          continue;
        }
        const queueWorkers = await dashboard.listWorkers(queue.key);
        workers.push(
          ...queueWorkers.map((worker) => ({
            ...worker,
            prefix: worker.prefix ?? queue.prefix,
            queueKey: queue.key,
            provider: worker.provider ?? queue.provider,
          })),
        );
      }

      return workers.slice(0, input.limit ?? 200);
    },
    getWorker: async (input) => {
      const queue = await getQueueForTarget(dashboard, input);
      assertWorkerCapability(queue);
      const workers = await dashboard.listWorkers(queue.key);
      return (
        workers
          .map((worker) => ({
            ...worker,
            prefix: worker.prefix ?? queue.prefix,
            queueKey: queue.key,
            provider: worker.provider ?? queue.provider,
          }))
          .find((worker) => worker.id === input.workerId) ?? null
      );
    },
    listJobSchedulers: async (input) => {
      const queues = await getQueuesForSchedulerList(dashboard, input);
      const schedulers: Array<JobScheduler & { queueKey?: string }> = [];

      for (const queue of queues) {
        if (!queue.capabilities.schedulers) {
          continue;
        }
        const queueSchedulers = await dashboard.listQueueSchedulers(queue.key, {
          limit: input.limit,
        });
        schedulers.push(
          ...queueSchedulers.map((scheduler) => ({
            ...scheduler,
            prefix: scheduler.prefix ?? queue.prefix,
            queueKey: queue.key,
          })),
        );
      }

      return schedulers
        .sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity))
        .slice(0, input.limit ?? 100);
    },
    getJobScheduler: async (input) => {
      const queue = await getQueueForTarget(dashboard, input);
      return dashboard.getJobScheduler(queue.key, {
        key: input.schedulerKey,
        id: input.schedulerId,
      });
    },
    upsertJobScheduler: (input) => upsertJobScheduler(dashboard, input),
    removeJobScheduler: (input) => removeJobScheduler(dashboard, input),
  };
}

async function handlePrivateDashboardApi(
  router: ReturnType<typeof createPrivateDashboardRouter>,
  protection: DashboardProtection,
  request: FrameworkRequest,
): Promise<FrameworkResponse> {
  const response = await fetchRequestHandler({
    endpoint: getPrivateDashboardApiEndpoint(request.url),
    req: toFetchRequest(request),
    router,
    createContext: (): PrivateDashboardContext =>
      getAuthenticatedSession(protection, request),
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
}

function toPrivateQueueSourceStatus(
  status: QueueSourceStatus,
): PrivateQueueSourceStatus {
  return {
    ...status,
    status: status.status === "unhealthy" ? "unavailable" : status.status,
    capabilities: {
      ...status.capabilities,
      mutationsAllowed: status.mutationsAllowed,
    },
  };
}

async function getSuppliedQueuePrefixes(
  dashboard: EmbeddedDashboardInstance,
): Promise<string[]> {
  const queues = await dashboard.listQueues();
  return [...new Set(queues.map((queue) => queue.prefix))].sort();
}

async function getQueuesForJobList(
  dashboard: EmbeddedDashboardInstance,
  input: JobListInput,
): Promise<DashboardQueue[]> {
  if (input.queueKey || input.queueName) {
    return [await getSuppliedQueueByPrivateApiInput(dashboard, input)];
  }

  return dashboard.listQueues();
}

async function listQueueMetrics(
  dashboard: EmbeddedDashboardInstance,
  input: QueueMetricsListInput,
): Promise<QueueMetricsSummary[]> {
  const queues = await getQueuesForJobList(dashboard, input);

  return Promise.all(
    queues.map(async (queue) => {
      const [completed, failed] = await Promise.all([
        dashboard.getQueueMetrics(queue.key, "completed"),
        dashboard.getQueueMetrics(queue.key, "failed"),
      ]);

      return {
        queueKey: queue.key,
        queueName: queue.name,
        prefix: queue.prefix,
        completed,
        failed,
      };
    }),
  );
}

function getQueueJobQueryOptions(input: JobListInput): JobQueryOptions {
  return {
    filter: input.status ? { status: input.status } : undefined,
    limit: input.limit,
    offset: input.offset,
  };
}

async function getQueueForTarget(
  dashboard: EmbeddedDashboardInstance,
  input: QueueTargetInput,
): Promise<DashboardQueue> {
  return getSuppliedQueueByPrivateApiInput(dashboard, input);
}

async function retryJob(
  dashboard: EmbeddedDashboardInstance,
  input: JobTargetInput,
): Promise<{ success: true; message: string; workerCount: number }> {
  const queue = await getQueueForTarget(dashboard, input);
  const job = await dashboard.getJob(queue.key, input.jobId);

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Job ${input.jobId} not found in queue ${queue.name}`,
    });
  }

  if (job.status !== "failed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job is not in failed state. Current status: ${job.status}`,
    });
  }

  const workerCount = queue.capabilities.workers
    ? await dashboard.getWorkerCount(queue.key)
    : { queueName: queue.name, count: 0 };

  if (queue.capabilities.workers && workerCount.count === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        `No workers available for queue "${queue.name}". ` +
        "Start a worker to process retried jobs.",
    });
  }

  await dashboard.retryJob(queue.key, input.jobId);

  return {
    success: true,
    message: `Job "${job.name}" has been enqueued for retry`,
    workerCount: workerCount.count,
  };
}

async function removeJob(
  dashboard: EmbeddedDashboardInstance,
  input: JobTargetInput,
): Promise<{ success: true; message: string }> {
  const queue = await getQueueForTarget(dashboard, input);
  const job = await dashboard.getJob(queue.key, input.jobId);

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Job ${input.jobId} not found in queue ${queue.name}`,
    });
  }

  await dashboard.removeJob(queue.key, input.jobId);

  return {
    success: true,
    message: `Job "${job.name}" has been removed`,
  };
}

async function getQueuesForSchedulerList(
  dashboard: EmbeddedDashboardInstance,
  input: SchedulerListInput,
): Promise<DashboardQueue[]> {
  if (input.queueKey || input.queueName) {
    return [await getSuppliedQueueByPrivateApiInput(dashboard, input)];
  }

  return dashboard.listQueues();
}

async function getQueuesForWorkerList(
  dashboard: EmbeddedDashboardInstance,
  input: WorkerListInput,
): Promise<DashboardQueue[]> {
  if (input.queueKey || input.queueName) {
    return [await getSuppliedQueueByPrivateApiInput(dashboard, input)];
  }

  return dashboard.listQueues();
}

async function upsertJobScheduler(
  dashboard: EmbeddedDashboardInstance,
  input: SchedulerUpsertInput,
): Promise<{ success: true; message: string }> {
  const queue = await getQueueForTarget(dashboard, input);
  assertSchedulerCapability(queue);

  await dashboard.upsertJobScheduler(queue.key, {
    schedulerId: input.schedulerId,
    previousKey: input.previousKey,
    repeat: input.repeat,
    template: input.template,
  });

  return {
    success: true,
    message: `Scheduler "${input.schedulerId}" has been saved`,
  };
}

async function removeJobScheduler(
  dashboard: EmbeddedDashboardInstance,
  input: SchedulerTargetInput,
): Promise<{ success: true; message: string }> {
  const queue = await getQueueForTarget(dashboard, input);
  assertSchedulerCapability(queue);

  await dashboard.removeJobScheduler(queue.key, {
    key: input.schedulerKey,
    id: input.schedulerId,
  });

  return {
    success: true,
    message: `Scheduler "${input.schedulerId ?? input.schedulerKey}" has been removed`,
  };
}

function assertSchedulerCapability(queue: DashboardQueue): void {
  if (!queue.capabilities.schedulers) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job schedulers are not supported for supplied queue "${queue.key}".`,
    });
  }
}

function assertWorkerCapability(queue: DashboardQueue): void {
  if (!queue.capabilities.workers) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Workers are not supported for supplied queue "${queue.key}".`,
    });
  }
}

async function getSuppliedQueueByPrivateApiInput(
  dashboard: EmbeddedDashboardInstance,
  input: QueueTargetInput,
): Promise<DashboardQueue> {
  if (input.queueKey) {
    const queue = await dashboard.getQueue(input.queueKey);

    if (!queue) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Supplied queue "${input.queueKey}" was not found.`,
      });
    }

    return queue;
  }

  const name = input.name ?? input.queueName;

  if (!name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A queueKey string or queue name string is required.",
    });
  }

  const lookupLabel = formatQueueLookup(name, input.prefix);
  const matches = (await dashboard.listQueues()).filter(
    (queue) =>
      queue.name === name && (!input.prefix || queue.prefix === input.prefix),
  );

  const match = matches[0];

  if (!match) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Supplied queue "${lookupLabel}" was not found.`,
    });
  }

  if (matches.length > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `Supplied queue lookup "${lookupLabel}" matched more than one queue. ` +
        "Use queueKey instead.",
    });
  }

  return match;
}

function getFlowListInput(
  input: FlowListInput,
): { limit?: number } | undefined {
  if (!input) {
    return undefined;
  }

  return { limit: input.limit };
}

function formatQueueLookup(name: string, prefix: string | undefined): string {
  return prefix ? `${prefix}/${name}` : name;
}

function toFetchRequest(request: FrameworkRequest): Request {
  return new Request(toAbsoluteUrl(request.url), {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : (request.body as BodyInit | null | undefined),
  });
}

function toFetchHeaders(
  headers: FrameworkRequest["headers"],
): HeadersInit | undefined {
  if (!headers || headers instanceof Headers) {
    return headers;
  }

  const fetchHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        fetchHeaders.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      fetchHeaders.set(name, value);
    }
  }

  return fetchHeaders;
}

function getPrivateDashboardApiEndpoint(url: string): string {
  const pathname = getPathname(url);
  const apiPathIndex = pathname.indexOf("/api/trpc");

  if (apiPathIndex === -1) {
    return "/api/trpc";
  }

  return pathname.slice(0, apiPathIndex + "/api/trpc".length);
}
