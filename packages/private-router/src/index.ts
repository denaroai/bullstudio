import type {
  FlowSummary,
  FlowTree,
  Job,
  JobCounts,
  JobScheduler,
  JobStatus,
  JobSummary,
  AdapterCapabilities as QueueAdapterCapabilities,
  QueueMetricSnapshot,
  Worker,
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
        schedulers: boolean;
        workers: boolean;
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
    workers: boolean;
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

export type QueueMetricsListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
};

/**
 * Native throughput metrics for a single queue. `completed`/`failed` are
 * `null` when the queue's backend exposes no metrics API; both are present
 * (but may be empty) when it does. Whether metrics are actually being
 * recorded is signalled by `meta.count > 0`.
 */
export type QueueMetricsSummary = {
  queueKey?: string;
  queueName: string;
  prefix?: string;
  completed: QueueMetricSnapshot | null;
  failed: QueueMetricSnapshot | null;
};

export type OverviewMetricsResponse = {
  summary: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughputPerHour: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    minProcessingTimeMs: number;
    maxProcessingTimeMs: number;
    avgDelayMs: number;
    minDelayMs: number;
    maxDelayMs: number;
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
  /**
   * Coverage of native Bull/BullMQ throughput metrics for the queues in scope.
   * When `recordingQueues < totalQueues`, some throughput/failure figures were
   * estimated from raw jobs in Redis instead of `getMetrics()`, and may be
   * inaccurate (e.g. when finished jobs are removed).
   */
  nativeMetrics: {
    totalQueues: number;
    recordingQueues: number;
  };
  lastUpdated: number;
};

export type JobListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
  search?: string;
  sortField?: JobListSortField;
  sortOrder?: JobListSortOrder;
};

export type JobListSortField =
  | "name"
  | "queueName"
  | "status"
  | "timestamp"
  | "duration";

export type JobListSortOrder = "asc" | "desc";

export type JobListResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
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

export type FlowListInput =
  | {
      queueKey?: string;
      queueName?: string;
      prefix?: string;
      limit?: number;
    }
  | undefined;

export type FlowTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  flowId: string;
};

export type SchedulerListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  limit?: number;
};

export type SchedulerTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  schedulerKey: string;
  schedulerId?: string;
};

export type SchedulerUpsertInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  schedulerId: string;
  previousKey?: string;
  repeat: {
    strategy: "cron" | "every";
    pattern?: string;
    every?: number;
    tz?: string;
    endDate?: number;
    limit?: number;
  };
  template?: {
    name?: string;
    data?: unknown;
    opts?: Record<string, unknown>;
  };
};

export type SchedulerMutationResponse = {
  success: true;
  message: string;
};

export type WorkerListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  limit?: number;
};

export type WorkerTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
  workerId: string;
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
  listQueueMetrics(
    input: QueueMetricsListInput,
  ): Promise<QueueMetricsSummary[]>;
  getJob(input: JobTargetInput): Promise<Job | null>;
  getJobLogs(input: JobTargetInput): Promise<JobLogsResponse>;
  retryJob(input: JobTargetInput): Promise<JobRetryResponse>;
  removeJob(input: JobTargetInput): Promise<JobRemoveResponse>;
  pauseQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  resumeQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  drainQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  listFlows(
    input?: FlowListInput,
  ): Promise<Array<FlowSummary & { queueKey?: string }>>;
  getFlow(input: FlowTargetInput): Promise<FlowTree | null>;
  getJobFlow(input: JobTargetInput): Promise<FlowTree | null>;
  listWorkers(
    input: WorkerListInput,
  ): Promise<Array<Worker & { queueKey?: string }>>;
  getWorker(input: WorkerTargetInput): Promise<Worker | null>;
  listJobSchedulers(
    input: SchedulerListInput,
  ): Promise<Array<JobScheduler & { queueKey?: string }>>;
  getJobScheduler(input: SchedulerTargetInput): Promise<JobScheduler | null>;
  upsertJobScheduler(
    input: SchedulerUpsertInput,
  ): Promise<SchedulerMutationResponse>;
  removeJobScheduler(
    input: SchedulerTargetInput,
  ): Promise<SchedulerMutationResponse>;
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
const jobListSortFieldSchema = z.enum([
  "name",
  "queueName",
  "status",
  "timestamp",
  "duration",
]);
const jobListSortOrderSchema = z.enum(["asc", "desc"]);

const queueTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
});

const overviewMetricsSchema = z
  .object({
    timeRangeHours: z.number().positive().max(168).default(24),
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
    search: z.string().trim().optional(),
    sortField: jobListSortFieldSchema.default("timestamp"),
    sortOrder: jobListSortOrderSchema.default("desc"),
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
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
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

const schedulerListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    limit: z.number().min(1).max(500).default(100),
  })
  .optional();

const workerListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    limit: z.number().min(1).max(1000).default(200),
  })
  .optional();

const workerTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  workerId: z.string(),
});

const schedulerTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  schedulerKey: z.string(),
  schedulerId: z.string().optional(),
});

const schedulerRepeatSchema = z
  .object({
    strategy: z.enum(["cron", "every"]),
    pattern: z.string().optional(),
    every: z.number().int().positive().optional(),
    tz: z.string().optional(),
    endDate: z.number().optional(),
    limit: z.number().int().positive().optional(),
  })
  .refine(
    (repeat) =>
      repeat.strategy === "cron"
        ? Boolean(repeat.pattern)
        : Boolean(repeat.every),
    {
      message:
        'A "cron" schedule requires a pattern and an "every" schedule requires an interval.',
    },
  );

const schedulerUpsertSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  schedulerId: z.string().min(1),
  previousKey: z.string().optional(),
  repeat: schedulerRepeatSchema,
  template: z
    .object({
      name: z.string().optional(),
      data: z.unknown().optional(),
      opts: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
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
      drain: authenticatedProcedure
        .input(queueTargetSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "queueDrain", "Queue drain");
          return source.drainQueue(input);
        }),
    }),
    jobs: t.router({
      list: authenticatedProcedure
        .input(jobListSchema)
        .query(async ({ input }) => {
          const normalized = normalizeJobListInput(input);
          const totalCandidates = await countJobsForListInput(
            source,
            normalized,
          );
          if (totalCandidates === 0) {
            return filterSortAndPageJobs([], normalized, 0);
          }
          const jobs = await source.listJobs(
            getSourceJobListInput(normalized, totalCandidates),
          );
          return filterSortAndPageJobs(jobs, normalized, totalCandidates);
        }),
      listSummary: authenticatedProcedure
        .input(jobListSchema)
        .query(async ({ input }) => {
          const normalized = normalizeJobListInput(input);
          const totalCandidates = await countJobsForListInput(
            source,
            normalized,
          );
          if (totalCandidates === 0) {
            return filterSortAndPageJobs([], normalized, 0);
          }
          const jobs = await source.listJobSummaries(
            getSourceJobListInput(normalized, totalCandidates),
          );
          return filterSortAndPageJobs(jobs, normalized, totalCandidates);
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
      forJob: authenticatedProcedure
        .input(jobTargetSchema)
        .query(async ({ input }) => {
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "flows", "Flows");
          // Returns the full flow tree the job belongs to, or null when the
          // job is standalone. Callers use null to hide the flow view.
          return source.getJobFlow(input);
        }),
    }),
    workers: t.router({
      list: authenticatedProcedure
        .input(workerListSchema)
        .query(async ({ input }) => {
          if (input?.queueKey || input?.queueName) {
            const queue = await resolveQueueTarget(source, input);
            assertQueueCapability(source, queue, "workers", "Workers");
          }
          return source.listWorkers(input ?? { limit: 200 });
        }),
      get: authenticatedProcedure
        .input(workerTargetSchema)
        .query(async ({ input }) => {
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "workers", "Workers");
          const worker = await source.getWorker(input);

          if (!worker) {
            const queueLabel = input.queueName ?? input.queueKey ?? "unknown";
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Worker ${input.workerId} not found in queue ${queueLabel}`,
            });
          }

          return worker;
        }),
    }),
    schedulers: t.router({
      list: authenticatedProcedure
        .input(schedulerListSchema)
        .query(({ input }) =>
          source.listJobSchedulers(input ?? { limit: 100 }),
        ),
      get: authenticatedProcedure
        .input(schedulerTargetSchema)
        .query(({ input }) => source.getJobScheduler(input)),
      upsert: authenticatedProcedure
        .input(schedulerUpsertSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "schedulers", "Job schedulers");
          return source.upsertJobScheduler(input);
        }),
      remove: authenticatedProcedure
        .input(schedulerTargetSchema)
        .mutation(async ({ input }) => {
          await assertCanMutate(source);
          const queue = await resolveQueueTarget(source, input);
          assertQueueCapability(source, queue, "schedulers", "Job schedulers");
          return source.removeJobScheduler(input);
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
        workers: queueSource.capabilities.workers,
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
      workers: queueSource.capabilities.workers,
      supportedStatuses: [...supportedJobStatuses],
    },
    queueSource,
  };
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// Choose a time-series bucket size that keeps the chart readable (~5–24 points)
// for the selected range. Metric snapshots are per-minute, so 1 min is the floor.
function getBucketMs(timeRangeHours: number): number {
  const rangeMs = timeRangeHours * HOUR_MS;
  if (rangeMs <= 15 * MINUTE_MS) return MINUTE_MS; // ≤15m → 1-min
  if (rangeMs <= 30 * MINUTE_MS) return 2 * MINUTE_MS; // ≤30m → 2-min
  if (rangeMs <= HOUR_MS) return 5 * MINUTE_MS; // ≤1h  → 5-min
  if (rangeMs <= 6 * HOUR_MS) return 30 * MINUTE_MS; // ≤6h  → 30-min
  return HOUR_MS; // >6h  → 1-hour
}

type OverviewJobSummary = JobSummary & { queueKey?: string };

export function aggregateOverviewMetrics(
  jobs: OverviewJobSummary[],
  timeRangeHours: number,
  queuesCount: number,
  queueMetrics: QueueMetricsSummary[] = [],
  now: number = Date.now(),
): OverviewMetricsResponse {
  const cutoff = now - timeRangeHours * HOUR_MS;
  // A queue is "metric-backed" only when it is actively recording metrics.
  // Otherwise its throughput falls back to counting raw job summaries.
  const metricBackedQueues = queueMetrics.filter(hasRecordedMetrics);

  const fallbackJobs = jobs.filter(
    (job) => !isMetricBacked(job, metricBackedQueues),
  );
  const totalCompleted =
    fallbackJobs.filter((job) => job.status === "completed").length +
    sumMetricsInRange(metricBackedQueues, "completed", cutoff, now);
  const totalFailed =
    fallbackJobs.filter((job) => job.status === "failed").length +
    sumMetricsInRange(metricBackedQueues, "failed", cutoff, now);
  const totalJobs = totalCompleted + totalFailed;

  // Timing, slowest jobs, and failing types are never available from metrics,
  // so they always derive from the full set of raw job summaries.
  const jobsWithProcessingTime = jobs.filter(
    (job) => job.processedOn && job.finishedOn,
  );
  const jobsWithDelay = jobs.filter((job) => job.processedOn && job.timestamp);
  const failedJobs = jobs.filter((job) => job.status === "failed");

  const processingTimeRange = minMax(
    jobsWithProcessingTime.map(processingTimeOf),
  );
  const delayRange = minMax(
    jobsWithDelay.map((job) => Math.max(0, delayOf(job))),
  );

  return {
    summary: {
      totalCompleted,
      totalFailed,
      avgThroughputPerHour: totalJobs / timeRangeHours,
      failureRate: totalJobs > 0 ? (totalFailed / totalJobs) * 100 : 0,
      avgProcessingTimeMs: averageProcessingTime(jobsWithProcessingTime),
      minProcessingTimeMs: processingTimeRange.min,
      maxProcessingTimeMs: processingTimeRange.max,
      avgDelayMs: Math.max(0, averageDelay(jobsWithDelay)),
      minDelayMs: delayRange.min,
      maxDelayMs: delayRange.max,
    },
    timeSeries: buildOverviewTimeSeries(
      jobs,
      timeRangeHours,
      metricBackedQueues,
      now,
    ),
    slowestJobs: buildOverviewSlowestJobs(jobsWithProcessingTime),
    failingJobTypes: buildOverviewFailingJobTypes(failedJobs),
    queuesCount,
    nativeMetrics: {
      totalQueues: queueMetrics.length,
      recordingQueues: metricBackedQueues.length,
    },
    lastUpdated: now,
  };
}

function hasRecordedMetrics(metric: QueueMetricsSummary): boolean {
  return (
    (metric.completed?.meta.count ?? 0) > 0 ||
    (metric.failed?.meta.count ?? 0) > 0
  );
}

function isMetricBacked(
  job: OverviewJobSummary,
  metricBackedQueues: QueueMetricsSummary[],
): boolean {
  return metricBackedQueues.some((metric) => metricMatchesJob(metric, job));
}

function metricMatchesJob(
  metric: QueueMetricsSummary,
  job: OverviewJobSummary,
): boolean {
  if (metric.queueKey && job.queueKey) {
    return metric.queueKey === job.queueKey;
  }
  return (
    metric.queueName === job.queueName &&
    (!metric.prefix || metric.prefix === job.prefix)
  );
}

/**
 * Walk a metric snapshot's per-minute data points, newest first, invoking
 * `visit` for each non-zero point that falls inside `[cutoff, now]`.
 */
function forEachMetricPointInRange(
  snapshot: QueueMetricSnapshot | null,
  cutoff: number,
  now: number,
  visit: (value: number, minute: number) => void,
): void {
  if (!snapshot || snapshot.meta.count === 0) {
    return;
  }

  const newestMinute = Math.floor(snapshot.meta.prevTS / MINUTE_MS) * MINUTE_MS;
  for (let index = 0; index < snapshot.data.length; index++) {
    const value = snapshot.data[index];
    if (!value) {
      continue;
    }
    const minute = newestMinute - index * MINUTE_MS;
    if (minute < cutoff || minute > now) {
      continue;
    }
    visit(value, minute);
  }
}

function sumMetricsInRange(
  metricBackedQueues: QueueMetricsSummary[],
  type: "completed" | "failed",
  cutoff: number,
  now: number,
): number {
  let total = 0;
  for (const metric of metricBackedQueues) {
    forEachMetricPointInRange(metric[type], cutoff, now, (value) => {
      total += value;
    });
  }
  return total;
}

type NormalizedJobListInput = Required<
  Pick<JobListInput, "limit" | "offset" | "sortField" | "sortOrder" | "search">
> &
  Omit<JobListInput, "limit" | "offset" | "sortField" | "sortOrder" | "search">;

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

export function filterSortAndPageJobs<
  T extends {
    id: string;
    name: string;
    queueName: string;
    status: JobStatus;
    timestamp: number;
    prefix?: string;
    processedOn?: number;
    finishedOn?: number;
  },
>(
  jobs: T[],
  input: NormalizedJobListInput,
  totalCandidates = jobs.length,
): JobListResponse<T> {
  const searched = input.search
    ? jobs.filter((job) => jobMatchesSearch(job, input.search))
    : jobs;
  const sorted = sortJobList(searched, input.sortField, input.sortOrder);
  const total = input.search ? searched.length : totalCandidates;

  return {
    items: sorted.slice(input.offset, input.offset + input.limit),
    total,
    limit: input.limit,
    offset: input.offset,
  };
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
  const now = Date.now();
  const cutoffTimestamp = now - input.timeRangeHours * HOUR_MS;
  const sourceInput = {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
    limit: 1000,
    offset: 0,
  };
  const metricsInput: QueueMetricsListInput = {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
  };
  // Native throughput metrics give accurate completed/failed counts even when
  // jobs are removed; raw job summaries still feed timing, slowest jobs, and
  // failing-type breakdowns, which metrics cannot provide.
  const [completed, failed, queueMetrics] = await Promise.all([
    source.listJobSummaries({ ...sourceInput, status: "completed" }),
    source.listJobSummaries({ ...sourceInput, status: "failed" }),
    source.listQueueMetrics(metricsInput),
  ]);
  const jobs = [...completed, ...failed].filter(
    (job) => job.finishedOn && job.finishedOn >= cutoffTimestamp,
  );

  return aggregateOverviewMetrics(
    jobs,
    input.timeRangeHours,
    queuesCount,
    queueMetrics,
    now,
  );
}

function normalizeJobListInput(
  input: JobListInput | undefined,
): NormalizedJobListInput {
  return {
    queueKey: input?.queueKey,
    queueName: input?.queueName,
    prefix: input?.prefix,
    status: input?.status,
    limit: input?.limit ?? 100,
    offset: input?.offset ?? 0,
    search: input?.search?.trim() ?? "",
    sortField: input?.sortField ?? "timestamp",
    sortOrder: input?.sortOrder ?? "desc",
  };
}

function getSourceJobListInput(
  input: NormalizedJobListInput,
  totalCandidates: number,
): JobListInput {
  const needsFullCandidateSet =
    input.search ||
    input.sortField !== "timestamp" ||
    input.sortOrder !== "desc";

  return {
    queueKey: input.queueKey,
    queueName: input.queueName,
    prefix: input.prefix,
    status: input.status,
    limit: needsFullCandidateSet ? totalCandidates : input.limit + input.offset,
    offset: 0,
  };
}

async function countJobsForListInput(
  source: PrivateDashboardQueueSource,
  input: NormalizedJobListInput,
): Promise<number> {
  const queues =
    input.queueKey || input.queueName
      ? [await resolveQueueTarget(source, input)]
      : await source.listQueues();

  return queues.reduce(
    (total, queue) => total + countQueueJobs(queue, input.status),
    0,
  );
}

function countQueueJobs(queue: DashboardQueue, status?: JobStatus): number {
  if (!queue.jobCounts) {
    return 0;
  }

  if (!status) {
    const bullMqOnlyCount =
      queue.provider !== "bull"
        ? queue.jobCounts.paused +
          queue.jobCounts.prioritized +
          queue.jobCounts.waitingChildren
        : 0;

    return (
      queue.jobCounts.waiting +
      queue.jobCounts.active +
      queue.jobCounts.completed +
      queue.jobCounts.failed +
      queue.jobCounts.delayed +
      bullMqOnlyCount
    );
  }

  if (
    queue.provider === "bull" &&
    (status === "paused" || status === "waiting-children")
  ) {
    return 0;
  }

  if (status === "waiting-children") {
    return queue.jobCounts.waitingChildren;
  }

  return queue.jobCounts[status];
}

function jobMatchesSearch(
  job: { id: string; name: string; queueName: string; prefix?: string },
  search: string,
): boolean {
  const query = search.toLowerCase();
  return [job.id, job.name, job.queueName, job.prefix].some((field) =>
    field?.toLowerCase().includes(query),
  );
}

function sortJobList<
  T extends {
    name: string;
    queueName: string;
    status: JobStatus;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
  },
>(jobs: T[], field: JobListSortField, order: JobListSortOrder): T[] {
  return [...jobs].sort((a, b) => {
    const direction = order === "asc" ? 1 : -1;
    const comparison = compareJobListValues(a, b, field);
    if (comparison !== 0) {
      return comparison * direction;
    }
    return b.timestamp - a.timestamp || a.name.localeCompare(b.name);
  });
}

function compareJobListValues<
  T extends {
    name: string;
    queueName: string;
    status: JobStatus;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
  },
>(a: T, b: T, field: JobListSortField): number {
  switch (field) {
    case "name":
      return a.name.localeCompare(b.name);
    case "queueName":
      return a.queueName.localeCompare(b.queueName);
    case "status":
      return a.status.localeCompare(b.status);
    case "duration":
      return getJobDuration(a) - getJobDuration(b);
    case "timestamp":
      return a.timestamp - b.timestamp;
  }
}

function getJobDuration(job: {
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}): number {
  if (job.finishedOn) {
    return job.finishedOn - (job.processedOn ?? job.timestamp);
  }

  if (job.processedOn) {
    return Date.now() - job.processedOn;
  }

  return 0;
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

function processingTimeOf(job: JobSummary): number {
  return (job.finishedOn ?? job.processedOn ?? 0) - (job.processedOn ?? 0);
}

function delayOf(job: JobSummary): number {
  return (job.processedOn ?? job.timestamp) - job.timestamp - (job.delay || 0);
}

function averageProcessingTime(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return (
    jobs.reduce((sum, job) => sum + processingTimeOf(job), 0) / jobs.length
  );
}

function averageDelay(jobs: JobSummary[]): number {
  if (jobs.length === 0) {
    return 0;
  }

  return jobs.reduce((sum, job) => sum + delayOf(job), 0) / jobs.length;
}

function minMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

type TimeSeriesBucket = {
  // All raw jobs in the bucket, used for timing regardless of metric backing.
  timingJobs: OverviewJobSummary[];
  completed: number;
  failed: number;
};

function buildOverviewTimeSeries(
  jobs: OverviewJobSummary[],
  timeRangeHours: number,
  metricBackedQueues: QueueMetricsSummary[],
  now: number,
): OverviewMetricsResponse["timeSeries"] {
  const bucketMs = getBucketMs(timeRangeHours);
  const rangeMs = timeRangeHours * HOUR_MS;
  const cutoff = now - rangeMs;
  const buckets = new Map<number, TimeSeriesBucket>();

  const bucketCount = Math.ceil(rangeMs / bucketMs);
  for (let index = 0; index < bucketCount; index++) {
    const bucketStart =
      Math.floor((now - index * bucketMs) / bucketMs) * bucketMs;
    buckets.set(bucketStart, { timingJobs: [], completed: 0, failed: 0 });
  }

  for (const job of jobs) {
    if (!job.finishedOn) {
      continue;
    }

    const bucketStart = Math.floor(job.finishedOn / bucketMs) * bucketMs;
    const bucket = buckets.get(bucketStart);
    if (!bucket) {
      continue;
    }

    bucket.timingJobs.push(job);
    // Only count jobs from queues without metrics; metric-backed queues
    // contribute their counts from the snapshot below.
    if (!isMetricBacked(job, metricBackedQueues)) {
      if (job.status === "completed") {
        bucket.completed++;
      } else if (job.status === "failed") {
        bucket.failed++;
      }
    }
  }

  for (const metric of metricBackedQueues) {
    addMetricToBuckets(
      buckets,
      metric.completed,
      "completed",
      cutoff,
      now,
      bucketMs,
    );
    addMetricToBuckets(buckets, metric.failed, "failed", cutoff, now, bucketMs);
  }

  return Array.from(buckets.entries())
    .map(([timestamp, bucket]) => ({
      timestamp,
      completed: bucket.completed,
      failed: bucket.failed,
      avgProcessingTimeMs: averageProcessingTime(
        bucket.timingJobs.filter((job) => job.processedOn && job.finishedOn),
      ),
      avgDelayMs: Math.max(
        0,
        averageDelay(bucket.timingJobs.filter((job) => job.processedOn)),
      ),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function addMetricToBuckets(
  buckets: Map<number, TimeSeriesBucket>,
  snapshot: QueueMetricSnapshot | null,
  type: "completed" | "failed",
  cutoff: number,
  now: number,
  bucketMs: number,
): void {
  forEachMetricPointInRange(snapshot, cutoff, now, (value, minute) => {
    const bucketStart = Math.floor(minute / bucketMs) * bucketMs;
    const bucket = buckets.get(bucketStart);
    if (bucket) {
      bucket[type] += value;
    }
  });
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
