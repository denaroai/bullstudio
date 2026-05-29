import type {
  AdapterCapabilities as QueueAdapterCapabilities,
  FlowSummary,
  FlowTree,
  Job,
  JobCounts,
  JobStatus,
  JobSummary,
} from "@bullstudio/connect-types";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

export const supportedJobStatuses = [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "waiting-children",
] as const satisfies readonly JobStatus[];

export type QueueSourceStatus =
  | {
      mode: "standalone";
      source: "redis";
      status: "healthy" | "degraded" | "unavailable";
      connection: {
        host: string;
        port: string;
        hasPassword: boolean;
        database: string;
        displayUrl: string;
      };
      providers: string[];
      prefixes: string[];
      capabilities: {
        flows: boolean;
        supportedStatuses: string[];
        mutationsAllowed: boolean;
      };
    }
  | {
      mode: "embedded";
      source: "supplied";
      status: "healthy" | "degraded" | "unavailable";
      queueCount: number;
      providers: string[];
      capabilities: AdapterCapabilities & {
        mutationsAllowed: boolean;
      };
      readOnly: boolean;
      mutationsAllowed: boolean;
    };

export type ConnectionInfo = {
  mode: "standalone" | "embedded";
  providerType: string;
  prefixes: string[];
  capabilities: {
    supportsFlows: boolean;
    supportedStatuses: string[];
  };
  queueSource: QueueSourceStatus;
  host?: string;
  port?: string;
  hasPassword?: boolean;
  database?: string;
  displayUrl?: string;
};

export type AdapterCapabilities = QueueAdapterCapabilities;

export type DashboardQueue = {
  key?: string;
  name: string;
  label?: string;
  prefix?: string;
  provider?: string;
  isPaused?: boolean;
  jobCounts?: JobCounts;
  capabilities?: AdapterCapabilities;
};

export type QueueTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
};

export type ResolvedQueue = DashboardQueue;

export type QueueMutationResponse = { success: true };

export type OverviewMetricsInput = {
  timeRangeHours: number;
  queueKey?: string;
  queueName?: string;
  prefix?: string;
};

export type OverviewMetricsResponse = {
  summary: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughputPerHour: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  };
  timeSeries: Array<{
    timestamp: number;
    completed: number;
    failed: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  }>;
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

export type JobListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
};

export type JobTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  jobId: string;
};

export type JobLogsResponse = { logs: string[]; count: number };

export type JobRetryResponse = {
  success: true;
  message: string;
  workerCount: number;
};

export type JobRemoveResponse = {
  success: true;
  message: string;
};

export type FlowListInput = { limit?: number } | undefined;

export type FlowTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  flowId: string;
};

export interface PrivateDashboardQueueSource {
  mode: "standalone" | "embedded";
  readOnly: boolean;
  getStatus(): Promise<QueueSourceStatus>;
  listQueues(): Promise<DashboardQueue[]>;
  listPrefixes(): Promise<string[]>;
  resolveQueue(input: QueueTargetInput): Promise<ResolvedQueue>;
  listJobs(input: JobListInput): Promise<Array<Job & { queueKey?: string }>>;
  listJobSummaries(
    input: JobListInput,
  ): Promise<Array<JobSummary & { queueKey?: string }>>;
  getJob(input: JobTargetInput): Promise<Job | null>;
  getJobLogs(input: JobTargetInput): Promise<JobLogsResponse>;
  retryJob(input: JobTargetInput): Promise<JobRetryResponse>;
  removeJob(input: JobTargetInput): Promise<JobRemoveResponse>;
  pauseQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  resumeQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  listFlows(
    input?: FlowListInput,
  ): Promise<Array<FlowSummary & { queueKey?: string }>>;
  getFlow(input: FlowTargetInput): Promise<FlowTree | null>;
}

export interface PrivateDashboardContext {
  authenticated: boolean;
  username?: string;
}

const t = initTRPC.context<PrivateDashboardContext>().create({
  transformer: superjson,
});

const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.authenticated) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  return next({
    ctx,
  });
});

const jobStatusSchema = z.enum(supportedJobStatuses);

const queueTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
});

const overviewMetricsSchema = z
  .object({
    timeRangeHours: z.number().min(1).max(168).default(24),
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
  })
  .optional();

const jobListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    status: jobStatusSchema.optional(),
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
  })
  .optional();

const jobTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  jobId: z.string(),
});

const flowListSchema = z
  .object({
    limit: z.number().min(1).max(100).default(50),
  })
  .optional();

const flowTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  flowId: z.string(),
});

export function createPrivateDashboardRouter(
  source: PrivateDashboardQueueSource,
) {
  return t.router({
    connection: t.router({
      info: authenticatedProcedure.query(() => createConnectionInfo(source)),
    }),
    queueSource: t.router({
      status: authenticatedProcedure.query(() => source.getStatus()),
    }),
    overview: t.router({
      metrics: authenticatedProcedure
        .input(overviewMetricsSchema)
        .query(({ input }) =>
          getOverviewMetrics(source, input ?? { timeRangeHours: 24 }),
        ),
    }),
    queues: t.router({
      list: authenticatedProcedure.query(() => source.listQueues()),
      prefixes: authenticatedProcedure.query(() => source.listPrefixes()),
      get: authenticatedProcedure
        .input(queueTargetSchema)
        .query(({ input }) => resolveQueueTarget(source, input)),
      pause: authenticatedProcedure
        .input(queueTargetSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "queuePause", "Queue pause");
          return source.pauseQueue(input);
        }),
      resume: authenticatedProcedure
        .input(queueTargetSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "queueResume", "Queue resume");
          return source.resumeQueue(input);
        }),
    }),
    jobs: t.router({
      list: authenticatedProcedure
        .input(jobListSchema)
        .query(async ({ input }) => {
          const normalized = normalizeJobListInput(input);
          const jobs = await source.listJobs(getSourceJobListInput(normalized));
          return mergeSortAndPageJobs(jobs, normalized);
        }),
      listSummary: authenticatedProcedure
        .input(jobListSchema)
        .query(async ({ input }) => {
          const normalized = normalizeJobListInput(input);
          const jobs = await source.listJobSummaries(
            getSourceJobListInput(normalized),
          );
          return mergeSortAndPageJobs(jobs, normalized);
        }),
      get: authenticatedProcedure
        .input(jobTargetSchema)
        .query(({ input }) => source.getJob(input)),
      logs: authenticatedProcedure
        .input(jobTargetSchema)
        .query(async ({ input }) => {
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "jobLogs", "Job logs");
          return source.getJobLogs(input);
        }),
      retry: authenticatedProcedure
        .input(jobTargetSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "jobRetry", "Job retry");
          return source.retryJob(input);
        }),
      remove: authenticatedProcedure
        .input(jobTargetSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "jobRemoval", "Job removal");
          return source.removeJob(input);
        }),
    }),
    flows: t.router({
      list: authenticatedProcedure
        .input(flowListSchema)
        .query(({ input }) => source.listFlows(input)),
      get: authenticatedProcedure
        .input(flowTargetSchema)
        .query(async ({ input }) => {
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "flows", "Flows");
          const flow = await source.getFlow(input);

          if (!flow) {
            const queueLabel = input.queueName ?? input.queueKey ?? "unknown";
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Flow ${input.flowId} not found in queue ${queueLabel}`,
            });
          }

          return flow;
        }),
    }),
  });
}

export type PrivateDashboardRouter = ReturnType<
  typeof createPrivateDashboardRouter
>;

export async function resolveQueueTarget(
  source: PrivateDashboardQueueSource,
  input: QueueTargetInput,
): Promise<ResolvedQueue> {
  return source.resolveQueue(input);
}

export function createMutationGuard(source: PrivateDashboardQueueSource) {
  return {
    assertCanMutate: () => assertCanMutate(source),
  };
}

export async function createConnectionInfo(
  source: PrivateDashboardQueueSource,
): Promise<ConnectionInfo> {
  const [queueSource, prefixes] = await Promise.all([
    source.getStatus(),
    source.listPrefixes(),
  ]);

  if (queueSource.mode === "standalone") {
    const providerType = queueSource.providers[0] ?? "unknown";

    return {
      mode: "standalone",
      providerType,
      prefixes,
      capabilities: {
        supportsFlows: queueSource.capabilities.flows,
        supportedStatuses: queueSource.capabilities.supportedStatuses,
      },
      queueSource,
      ...queueSource.connection,
    };
  }

  const providerType = queueSource.providers.includes("bullmq")
    ? "bullmq"
    : (queueSource.providers[0] ?? "unknown");

  return {
    mode: "embedded",
    providerType,
    prefixes,
    capabilities: {
      supportsFlows: queueSource.capabilities.flows,
      supportedStatuses: [...supportedJobStatuses],
    },
    queueSource,
  };
}

export function aggregateOverviewMetrics(
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

async function getOverviewMetrics(
  source: PrivateDashboardQueueSource,
  input: OverviewMetricsInput,
): Promise<OverviewMetricsResponse> {
  const target =
    input.queueKey || input.queueName
      ? await resolveQueueTarget(source, input)
      : undefined;
  const queuesCount = target ? 1 : (await source.listQueues()).length;
  const cutoffTimestamp = Date.now() - input.timeRangeHours * 60 * 60 * 1000;
  const sourceInput = {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
    limit: 1000,
    offset: 0,
  };
  const [completed, failed] = await Promise.all([
    source.listJobSummaries({ ...sourceInput, status: "completed" }),
    source.listJobSummaries({ ...sourceInput, status: "failed" }),
  ]);
  const jobs = [...completed, ...failed].filter(
    (job) => job.finishedOn && job.finishedOn >= cutoffTimestamp,
  );

  return aggregateOverviewMetrics(jobs, input.timeRangeHours, queuesCount);
}

function normalizeJobListInput(
  input: JobListInput | undefined,
): Required<Pick<JobListInput, "limit" | "offset">> &
  Omit<JobListInput, "limit" | "offset"> {
  return {
    queueKey: input?.queueKey,
    queueName: input?.queueName,
    prefix: input?.prefix,
    status: input?.status,
    limit: input?.limit ?? 100,
    offset: input?.offset ?? 0,
  };
}

function getSourceJobListInput(
  input: Required<Pick<JobListInput, "limit" | "offset">> &
    Omit<JobListInput, "limit" | "offset">,
): JobListInput {
  return {
    ...input,
    limit: input.limit + input.offset,
    offset: 0,
  };
}

async function assertCanMutate(
  source: PrivateDashboardQueueSource,
): Promise<void> {
  if (source.readOnly) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Read-only dashboards cannot mutate queues or jobs.",
    });
  }

  const status = await source.getStatus();

  if (!status.capabilities.mutationsAllowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Queue mutations are not allowed by this queue source.",
    });
  }
}

function assertQueueCapability(
  source: PrivateDashboardQueueSource,
  queue: DashboardQueue,
  capability: keyof AdapterCapabilities,
  label: string,
): void {
  if (queue.capabilities && !queue.capabilities[capability]) {
    const queueKind = source.mode === "embedded" ? "supplied queue" : "queue";
    const verb = label.endsWith("s") ? "are" : "is";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} ${verb} not supported for ${queueKind} "${queue.key ?? queue.name}".`,
    });
  }
}

function averageProcessingTime(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return (
    jobs.reduce(
      (sum, job) =>
        sum +
        ((job.finishedOn ?? job.processedOn ?? 0) - (job.processedOn ?? 0)),
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
        sum +
        ((job.processedOn ?? job.timestamp) - job.timestamp - (job.delay || 0)),
      0,
    ) / jobs.length
  );
}

function buildOverviewTimeSeries(
  jobs: JobSummary[],
  timeRangeHours: number,
): OverviewMetricsResponse["timeSeries"] {
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

function buildOverviewSlowestJobs(
  jobs: JobSummary[],
): OverviewMetricsResponse["slowestJobs"] {
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

function buildOverviewFailingJobTypes(
  failedJobs: JobSummary[],
): OverviewMetricsResponse["failingJobTypes"] {
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
