import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import type {
  Job,
  JobQueryOptions,
  JobStatus,
  JobSummary,
} from "@bullstudio/connect-types";
import { ReadOnlyDashboardError } from "./errors";
import { assertCanMutate } from "./mutation";
import type {
  DashboardQueue,
  EmbeddedDashboardInstance,
  FrameworkRequest,
  FrameworkResponse,
  PrivateDashboardApiMount,
  QueueAdapterProvider,
  QueueSourceStatus,
} from "./types";
import { getPathname, toAbsoluteUrl } from "./url";

const supportedJobStatuses = [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "waiting-children",
] as const;

export function createPrivateDashboardApi(
  dashboard: EmbeddedDashboardInstance,
): PrivateDashboardApiMount {
  const router = createPrivateDashboardApiRouter(dashboard);

  return {
    handle: (request) => handlePrivateDashboardApi(router, request),
  };
}

async function handlePrivateDashboardApi(
  router: ReturnType<typeof createPrivateDashboardApiRouter>,
  request: FrameworkRequest,
): Promise<FrameworkResponse> {
  const response = await fetchRequestHandler({
    endpoint: getPrivateDashboardApiEndpoint(request.url),
    req: toFetchRequest(request),
    router,
    createContext: () => ({}),
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
}

function createPrivateDashboardApiRouter(dashboard: EmbeddedDashboardInstance) {
  const t = initTRPC.create({
    transformer: superjson,
  });

  return t.router({
    connection: t.router({
      info: t.procedure.query(() => getConnectionInfo(dashboard)),
    }),
    queueSource: t.router({
      status: t.procedure.query(() => dashboard.getQueueSourceStatus()),
    }),
    overview: t.router({
      metrics: t.procedure.input((value) => value).query(({ input }) =>
        getOverviewMetrics(dashboard, getOverviewMetricsInput(input)),
      ),
    }),
    queues: t.router({
      list: t.procedure.query(() => dashboard.listQueues()),
      prefixes: t.procedure.query(() => getSuppliedQueuePrefixes(dashboard)),
      get: t.procedure.input((value) => value).query(({ input }) =>
        getSuppliedQueueByPrivateApiInput(dashboard, input),
      ),
      pause: t.procedure.input((value) => value).mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          pauseQueue(dashboard, getQueueLookupInput(getObjectInput(input))),
        ),
      ),
      resume: t.procedure.input((value) => value).mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          resumeQueue(dashboard, getQueueLookupInput(getObjectInput(input))),
        ),
      ),
    }),
    flows: t.router({
      list: t.procedure.input((value) => value).query(({ input }) =>
        dashboard.listFlows(getFlowListInput(input)),
      ),
      get: t.procedure.input((value) => value).query(async ({ input }) => {
        if (!dashboard.getQueueSourceStatus().capabilities.flows) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Flows are not supported by supplied queue adapters.",
          });
        }

        const flowInput = getFlowInput(input);
        const queue = await getSuppliedQueueByPrivateApiInput(dashboard, {
          queueKey: flowInput.queueKey,
          queueName: flowInput.queueName,
          prefix: flowInput.prefix,
        });

        if (!queue.capabilities.flows) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Flows are not supported for supplied queue "${queue.key}".`,
          });
        }

        const flow = await dashboard.getFlow(queue.key, flowInput.flowId);

        if (!flow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              `Flow ${flowInput.flowId} not found in queue ` +
              `${queue.name}`,
          });
        }

        return flow;
      }),
    }),
    jobs: t.router({
      list: t.procedure.input((value) => value).query(({ input }) =>
        getJobList(dashboard, getJobListInput(input)),
      ),
      listSummary: t.procedure.input((value) => value).query(({ input }) =>
        getJobListSummaries(dashboard, getJobListInput(input)),
      ),
      get: t.procedure.input((value) => value).query(({ input }) =>
        getJobDetail(dashboard, getJobTargetInput(input)),
      ),
      logs: t.procedure.input((value) => value).query(({ input }) =>
        getJobLogs(dashboard, getJobTargetInput(input)),
      ),
      retry: t.procedure.input((value) => value).mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          retryJob(dashboard, getJobTargetInput(input)),
        ),
      ),
      remove: t.procedure.input((value) => value).mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          removeJob(dashboard, getJobTargetInput(input)),
        ),
      ),
    }),
  });
}

type ResolvedJobTargetInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  jobId: string;
};

type ResolvedQueueTargetInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
};

async function pauseQueue(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedQueueTargetInput,
): Promise<{ success: true }> {
  const queue = await getSuppliedQueueByPrivateApiInput(dashboard, input);

  if (!queue.capabilities.queuePause) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Queue pause is not supported for supplied queue "${queue.key}".`,
    });
  }

  await dashboard.pauseQueue(queue.key);

  return { success: true };
}

async function resumeQueue(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedQueueTargetInput,
): Promise<{ success: true }> {
  const queue = await getSuppliedQueueByPrivateApiInput(dashboard, input);

  if (!queue.capabilities.queueResume) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Queue resume is not supported for supplied queue "${queue.key}".`,
    });
  }

  await dashboard.resumeQueue(queue.key);

  return { success: true };
}

async function getJobDetail(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedJobTargetInput,
): Promise<Job | null> {
  const queue = await getQueueForJobTarget(dashboard, input);
  return dashboard.getJob(queue.key, input.jobId);
}

async function getJobLogs(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedJobTargetInput,
): Promise<{ logs: string[]; count: number }> {
  const queue = await getQueueForJobTarget(dashboard, input);

  if (!queue.capabilities.jobLogs) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job logs are not supported for supplied queue "${queue.key}".`,
    });
  }

  return dashboard.getJobLogs(queue.key, input.jobId);
}

async function retryJob(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedJobTargetInput,
): Promise<{ success: true; message: string; workerCount: number }> {
  const queue = await getQueueForJobTarget(dashboard, input);

  if (!queue.capabilities.jobRetry) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job retry is not supported for supplied queue "${queue.key}".`,
    });
  }

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
  input: ResolvedJobTargetInput,
): Promise<{ success: true; message: string }> {
  const queue = await getQueueForJobTarget(dashboard, input);

  if (!queue.capabilities.jobRemoval) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job removal is not supported for supplied queue "${queue.key}".`,
    });
  }

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

async function getQueueForJobTarget(
  dashboard: EmbeddedDashboardInstance,
  input: Pick<ResolvedJobTargetInput, "queueKey" | "queueName" | "prefix">,
): Promise<DashboardQueue> {
  return getSuppliedQueueByPrivateApiInput(dashboard, {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
  });
}

function getJobTargetInput(input: unknown): ResolvedJobTargetInput {
  const value = getObjectInput(input);
  const jobId =
    "jobId" in value && typeof value.jobId === "string"
      ? value.jobId
      : undefined;

  if (!jobId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A jobId string is required.",
    });
  }

  return {
    ...getQueueLookupInput(value),
    jobId,
  };
}

function getQueueLookupInput(input: Record<string, unknown>): {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
} {
  return {
    queueKey:
      "queueKey" in input && typeof input.queueKey === "string"
        ? input.queueKey
        : undefined,
    queueName:
      "queueName" in input && typeof input.queueName === "string"
        ? input.queueName
        : "name" in input && typeof input.name === "string"
          ? input.name
          : undefined,
    prefix:
      "prefix" in input && typeof input.prefix === "string"
        ? input.prefix
        : undefined,
  };
}

type PrivateJobSourceKey = {
  queueKey?: string;
};

async function getJobList(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedJobListInput,
): Promise<Array<Job & PrivateJobSourceKey>> {
  const queuesToProcess = await getQueuesForJobList(dashboard, input);
  const jobs: Array<Job & PrivateJobSourceKey> = [];

  for (const queue of queuesToProcess) {
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

  return sortAndPageJobs(jobs, input);
}

async function getJobListSummaries(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedJobListInput,
): Promise<Array<JobSummary & PrivateJobSourceKey>> {
  const queuesToProcess = await getQueuesForJobList(dashboard, input);
  const jobs: Array<JobSummary & PrivateJobSourceKey> = [];

  for (const queue of queuesToProcess) {
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

  return sortAndPageJobs(jobs, input);
}

type ResolvedJobListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  status?: JobStatus;
  limit: number;
  offset: number;
};

async function getQueuesForJobList(
  dashboard: EmbeddedDashboardInstance,
  input: ResolvedJobListInput,
): Promise<DashboardQueue[]> {
  if (input.queueKey || input.queueName) {
    return [
      await getSuppliedQueueByPrivateApiInput(dashboard, {
        queueKey: input.queueKey,
        queueName: input.queueName,
        prefix: input.prefix,
      }),
    ];
  }

  return dashboard.listQueues();
}

function getQueueJobQueryOptions(
  input: ResolvedJobListInput,
): JobQueryOptions {
  return {
    filter: input.status ? { status: input.status } : undefined,
    limit: input.limit + input.offset,
    offset: 0,
  };
}

function sortAndPageJobs<T extends { timestamp: number }>(
  jobs: T[],
  input: ResolvedJobListInput,
): T[] {
  return [...jobs]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(input.offset, input.offset + input.limit);
}

function getJobListInput(input: unknown): ResolvedJobListInput {
  const value = unwrapJsonInput(input);

  if (value === undefined || value === null) {
    return {
      limit: 100,
      offset: 0,
    };
  }

  if (!value || typeof value !== "object") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Job list input must be an object when provided.",
    });
  }

  const queueKey =
    "queueKey" in value && typeof value.queueKey === "string"
      ? value.queueKey
      : undefined;
  const queueName =
    "queueName" in value && typeof value.queueName === "string"
      ? value.queueName
      : undefined;
  const prefix =
    "prefix" in value && typeof value.prefix === "string"
      ? value.prefix
      : undefined;
  const status =
    "status" in value && isSupportedJobStatus(value.status)
      ? value.status
      : undefined;
  const limit =
    "limit" in value && typeof value.limit === "number" ? value.limit : 100;
  const offset =
    "offset" in value && typeof value.offset === "number" ? value.offset : 0;

  return {
    queueKey,
    queueName,
    prefix,
    status,
    limit: Math.min(Math.max(Math.floor(limit), 1), 1000),
    offset: Math.max(Math.floor(offset), 0),
  };
}

function isSupportedJobStatus(status: unknown): status is JobStatus {
  return (
    typeof status === "string" &&
    supportedJobStatuses.includes(status as (typeof supportedJobStatuses)[number])
  );
}

type TimeSeriesDataPoint = {
  timestamp: number;
  completed: number;
  failed: number;
  avgProcessingTimeMs: number;
  avgDelayMs: number;
};

type OverviewMetricsResponse = {
  summary: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughputPerHour: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  };
  timeSeries: TimeSeriesDataPoint[];
  slowestJobs: Array<{
    id: string;
    name: string;
    queueName: string;
    processingTimeMs: number;
    timestamp: number;
    status: string;
  }>;
  failingJobTypes: Array<{
    name: string;
    queueName: string;
    failureCount: number;
    lastFailedAt: number;
    lastFailedReason?: string;
  }>;
  queuesCount: number;
  lastUpdated: number;
};

async function getOverviewMetrics(
  dashboard: EmbeddedDashboardInstance,
  input: {
    timeRangeHours: number;
    queueKey?: string;
    queueName?: string;
    prefix?: string;
  },
): Promise<OverviewMetricsResponse> {
  const queuesToProcess =
    input.queueKey || input.queueName
      ? [
          await getSuppliedQueueByPrivateApiInput(dashboard, {
            queueKey: input.queueKey,
            queueName: input.queueName,
            prefix: input.prefix,
          }),
        ]
      : await dashboard.listQueues();
  const cutoffTimestamp = Date.now() - input.timeRangeHours * 60 * 60 * 1000;
  const allJobs: JobSummary[] = [];

  for (const queue of queuesToProcess) {
    const [completed, failed] = await Promise.all([
      dashboard.getJobsSummary(queue.key, {
        filter: { status: "completed" },
        limit: 1000,
      }),
      dashboard.getJobsSummary(queue.key, {
        filter: { status: "failed" },
        limit: 1000,
      }),
    ]);

    allJobs.push(
      ...completed.filter(
        (job) => job.finishedOn && job.finishedOn >= cutoffTimestamp,
      ),
      ...failed.filter(
        (job) => job.finishedOn && job.finishedOn >= cutoffTimestamp,
      ),
    );
  }

  return aggregateOverviewMetrics(
    allJobs,
    input.timeRangeHours,
    queuesToProcess.length,
  );
}

function getOverviewMetricsInput(input: unknown): {
  timeRangeHours: number;
  queueKey?: string;
  queueName?: string;
  prefix?: string;
} {
  const value = unwrapJsonInput(input);

  if (value === undefined || value === null) {
    return { timeRangeHours: 24 };
  }

  if (
    value &&
    typeof value === "object" &&
    (!("timeRangeHours" in value) || typeof value.timeRangeHours === "number")
  ) {
    const queueKey =
      "queueKey" in value && typeof value.queueKey === "string"
        ? value.queueKey
        : undefined;
    const queueName =
      "queueName" in value && typeof value.queueName === "string"
        ? value.queueName
        : undefined;
    const prefix =
      "prefix" in value && typeof value.prefix === "string"
        ? value.prefix
        : undefined;

    const timeRangeHours =
      "timeRangeHours" in value && typeof value.timeRangeHours === "number"
        ? value.timeRangeHours
        : 24;

    return {
      timeRangeHours: Math.min(Math.max(timeRangeHours, 1), 168),
      queueKey,
      queueName,
      prefix,
    };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A numeric timeRangeHours is required when overview input is provided.",
  });
}

function aggregateOverviewMetrics(
  jobs: JobSummary[],
  timeRangeHours: number,
  queuesCount: number,
): OverviewMetricsResponse {
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const jobsWithProcessingTime = jobs.filter(
    (job) => job.processedOn && job.finishedOn,
  );
  const jobsWithDelay = jobs.filter((job) => job.processedOn && job.timestamp);
  const totalJobs = completedJobs.length + failedJobs.length;

  return {
    summary: {
      totalCompleted: completedJobs.length,
      totalFailed: failedJobs.length,
      avgThroughputPerHour: totalJobs / timeRangeHours,
      failureRate: totalJobs > 0 ? (failedJobs.length / totalJobs) * 100 : 0,
      avgProcessingTimeMs: averageProcessingTime(jobsWithProcessingTime),
      avgDelayMs: Math.max(0, averageDelay(jobsWithDelay)),
    },
    timeSeries: buildOverviewTimeSeries(jobs, timeRangeHours),
    slowestJobs: buildOverviewSlowestJobs(jobsWithProcessingTime),
    failingJobTypes: buildOverviewFailingJobTypes(failedJobs),
    queuesCount,
    lastUpdated: Date.now(),
  };
}

function averageProcessingTime(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return (
    jobs.reduce(
      (sum, job) =>
        sum + ((job.finishedOn ?? job.processedOn ?? 0) - (job.processedOn ?? 0)),
      0,
    ) / jobs.length
  );
}

function averageDelay(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return (
    jobs.reduce(
      (sum, job) =>
        sum + ((job.processedOn ?? job.timestamp) - job.timestamp - (job.delay || 0)),
      0,
    ) / jobs.length
  );
}

function buildOverviewTimeSeries(
  jobs: JobSummary[],
  timeRangeHours: number,
): TimeSeriesDataPoint[] {
  const hourlyBuckets = new Map<number, JobSummary[]>();
  const now = Date.now();

  for (let index = 0; index < timeRangeHours; index++) {
    const bucketTime = now - index * 60 * 60 * 1000;
    const hourStart =
      Math.floor(bucketTime / (60 * 60 * 1000)) * (60 * 60 * 1000);
    hourlyBuckets.set(hourStart, []);
  }

  for (const job of jobs) {
    if (!job.finishedOn) {
      continue;
    }

    const hourStart =
      Math.floor(job.finishedOn / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const bucket = hourlyBuckets.get(hourStart);
    if (bucket) {
      bucket.push(job);
    }
  }

  return Array.from(hourlyBuckets.entries())
    .map(([timestamp, bucketJobs]) => ({
      timestamp,
      completed: bucketJobs.filter((job) => job.status === "completed").length,
      failed: bucketJobs.filter((job) => job.status === "failed").length,
      avgProcessingTimeMs: averageProcessingTime(
        bucketJobs.filter((job) => job.processedOn && job.finishedOn),
      ),
      avgDelayMs: Math.max(
        0,
        averageDelay(bucketJobs.filter((job) => job.processedOn)),
      ),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function buildOverviewSlowestJobs(jobs: JobSummary[]) {
  return jobs
    .map((job) => ({
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      processingTimeMs:
        (job.finishedOn ?? job.processedOn ?? 0) - (job.processedOn ?? 0),
      timestamp: job.timestamp,
      status: job.status,
    }))
    .sort((a, b) => b.processingTimeMs - a.processingTimeMs)
    .slice(0, 10);
}

function buildOverviewFailingJobTypes(failedJobs: JobSummary[]) {
  const grouped = new Map<string, JobSummary[]>();

  for (const job of failedJobs) {
    const key = `${job.queueName}:${job.name}`;
    const jobs = grouped.get(key) ?? [];
    jobs.push(job);
    grouped.set(key, jobs);
  }

  return Array.from(grouped.entries())
    .map(([key, jobs]) => {
      const parts = key.split(":");
      const queueName = parts[0] ?? "";
      const name = parts.slice(1).join(":");
      const sorted = [...jobs].sort(
        (a, b) => (b.finishedOn || 0) - (a.finishedOn || 0),
      );
      const latest = sorted[0];

      return {
        name,
        queueName,
        failureCount: jobs.length,
        lastFailedAt: latest?.finishedOn || latest?.timestamp || 0,
        lastFailedReason: latest?.failedReason,
      };
    })
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10);
}

async function getConnectionInfo(dashboard: EmbeddedDashboardInstance) {
  const queueSource = dashboard.getQueueSourceStatus();
  const prefixes = await getSuppliedQueuePrefixes(dashboard);

  return {
    mode: "embedded" as const,
    providerType: getLegacyProviderType(queueSource.providers),
    prefixes,
    capabilities: {
      supportsFlows: queueSource.capabilities.flows,
      supportedStatuses: [...supportedJobStatuses],
    },
    queueSource,
  };
}

async function getSuppliedQueuePrefixes(
  dashboard: EmbeddedDashboardInstance,
): Promise<string[]> {
  const queues = await dashboard.listQueues();
  return [...new Set(queues.map((queue) => queue.prefix))].sort();
}

function getLegacyProviderType(
  providers: QueueSourceStatus["providers"],
): QueueAdapterProvider {
  if (providers.includes("bullmq")) {
    return "bullmq";
  }

  return providers[0] ?? "bullmq";
}

async function getSuppliedQueueByPrivateApiInput(
  dashboard: EmbeddedDashboardInstance,
  input: unknown,
): Promise<DashboardQueue> {
  const value = getObjectInput(input);

  if ("queueKey" in value && typeof value.queueKey === "string") {
    const queue = await dashboard.getQueue(value.queueKey);

    if (!queue) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Supplied queue "${value.queueKey}" was not found.`,
      });
    }

    return queue;
  }

  const name =
    "name" in value && typeof value.name === "string"
      ? value.name
      : "queueName" in value && typeof value.queueName === "string"
        ? value.queueName
        : undefined;

  if (!name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A queueKey string or queue name string is required.",
    });
  }

  const prefix =
    "prefix" in value && typeof value.prefix === "string"
      ? value.prefix
      : undefined;
  const lookupLabel = formatQueueLookup(name, prefix);
  const matches = (await dashboard.listQueues()).filter(
    (queue) => queue.name === name && (!prefix || queue.prefix === prefix),
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

function getObjectInput(input: unknown): Record<string, unknown> {
  const value = unwrapJsonInput(input);

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "An object input is required.",
  });
}

function formatQueueLookup(name: string, prefix: string | undefined): string {
  return prefix ? `${prefix}/${name}` : name;
}

async function runPrivateDashboardMutation(
  dashboard: EmbeddedDashboardInstance,
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    assertCanMutate(dashboard.config);
    return await operation();
  } catch (error) {
    if (error instanceof ReadOnlyDashboardError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: error.message,
      });
    }

    throw error;
  }
}

function getFlowListInput(input: unknown): { limit?: number } | undefined {
  const value = unwrapJsonInput(input);

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    value &&
    typeof value === "object" &&
    "limit" in value &&
    typeof value.limit === "number"
  ) {
    return {
      limit: value.limit,
    };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A numeric limit is required when flow list input is provided.",
  });
}

function getFlowInput(input: unknown): {
  queueKey?: string;
  queueName?: string;
  flowId: string;
  prefix?: string;
} {
  const value = getObjectInput(input);
  const flowId =
    "flowId" in value && typeof value.flowId === "string"
      ? value.flowId
      : undefined;

  if (!flowId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A flowId string is required.",
    });
  }

  return {
    ...getQueueLookupInput(value),
    flowId,
  };
}

function unwrapJsonInput(input: unknown): unknown {
  if (input && typeof input === "object" && "json" in input) {
    return input.json;
  }

  return input;
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
