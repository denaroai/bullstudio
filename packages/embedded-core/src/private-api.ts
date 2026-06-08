import type {
  Job,
  JobQueryOptions,
  JobSummary,
} from "@bullstudio/connect-types";
import {
  createPrivateDashboardRouter,
  type FlowListInput,
  type JobListInput,
  type JobTargetInput,
  type PrivateDashboardContext,
  type PrivateDashboardQueueSource,
  type QueueSourceStatus as PrivateQueueSourceStatus,
  type QueueTargetInput,
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
