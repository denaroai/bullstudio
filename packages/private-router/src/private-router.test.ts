import type {
  FlowSummary,
  FlowTree,
  Job,
  JobSummary,
} from "@bullstudio/connect-types";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import {
  type AdapterCapabilities,
  aggregateOverviewMetrics,
  createConnectionInfo,
  createPrivateDashboardRouter,
  type DashboardQueue,
  type FlowListInput,
  type FlowTargetInput,
  type JobListInput,
  type JobLogsResponse,
  type JobRemoveResponse,
  type JobRetryResponse,
  type JobTargetInput,
  mergeSortAndPageJobs,
  type PrivateDashboardQueueSource,
  type QueueMutationResponse,
  type QueueSourceStatus,
  type QueueTargetInput,
} from "./index";

const allCapabilities: AdapterCapabilities = {
  flows: true,
  jobLogs: true,
  jobRemoval: true,
  jobRetry: true,
  queuePause: true,
  queueResume: true,
  queueDrain: true,
  workers: true,
};
const authenticatedContext = { authenticated: true };

describe("createPrivateDashboardRouter", () => {
  it("rejects private procedures without an authenticated context", async () => {
    const source = createFakeSource();
    const caller = createPrivateDashboardRouter(source).createCaller({
      authenticated: false,
    });

    await expect(caller.connection.info()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("exposes the shared private dashboard procedure surface", async () => {
    const source = createFakeSource();
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expect(caller.connection.info()).resolves.toMatchObject({
      mode: "embedded",
      providerType: "bullmq",
      queueSource: { source: "supplied" },
    });
    await expect(caller.queueSource.status()).resolves.toMatchObject({
      mode: "embedded",
      source: "supplied",
    });
    await expect(
      caller.overview.metrics({ timeRangeHours: 24 }),
    ).resolves.toHaveProperty("summary");
    await expect(caller.queues.list()).resolves.toHaveLength(2);
    await expect(caller.queues.prefixes()).resolves.toEqual([
      "critical",
      "ops",
    ]);
    await expect(
      caller.queues.get({ queueKey: "email-critical" }),
    ).resolves.toMatchObject({
      key: "email-critical",
    });
    await expect(
      caller.queues.pause({ queueKey: "email-critical" }),
    ).resolves.toEqual({
      success: true,
    });
    await expect(
      caller.queues.resume({ queueKey: "email-critical" }),
    ).resolves.toEqual({
      success: true,
    });
    await expect(caller.jobs.list({ limit: 10 })).resolves.toHaveLength(3);
    await expect(caller.jobs.listSummary({ limit: 10 })).resolves.toHaveLength(
      3,
    );
    await expect(
      caller.jobs.get({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
    ).resolves.toMatchObject({ id: "failed" });
    await expect(
      caller.jobs.logs({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
    ).resolves.toEqual({ logs: ["one", "two"], count: 2 });
    await expect(
      caller.jobs.retry({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
    ).resolves.toMatchObject({ success: true, workerCount: 1 });
    await expect(
      caller.jobs.remove({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
    ).resolves.toMatchObject({ success: true });
    await expect(caller.flows.list({ limit: 5 })).resolves.toHaveLength(1);
    await expect(
      caller.flows.get({
        queueKey: "email-critical",
        queueName: "email",
        flowId: "flow-1",
      }),
    ).resolves.toMatchObject({ id: "flow-1" });
  });

  it("preserves standalone Redis connection fields and omits them in embedded mode", async () => {
    await expect(
      createConnectionInfo(createFakeSource({ mode: "standalone" })),
    ).resolves.toEqual(
      expect.objectContaining({
        mode: "standalone",
        host: "localhost",
        port: "6379",
        hasPassword: false,
        database: "0",
        displayUrl: "localhost:6379",
        queueSource: expect.objectContaining({
          mode: "standalone",
          source: "redis",
        }),
      }),
    );

    const embedded = await createConnectionInfo(createFakeSource());

    expect(embedded).toEqual(
      expect.objectContaining({
        mode: "embedded",
        queueSource: expect.objectContaining({
          mode: "embedded",
          source: "supplied",
        }),
      }),
    );
    expect(embedded).not.toHaveProperty("host");
    expect(embedded).not.toHaveProperty("port");
    expect(embedded).not.toHaveProperty("hasPassword");
    expect(embedded).not.toHaveProperty("database");
    expect(embedded).not.toHaveProperty("displayUrl");
  });

  it("prefers queueKey over queue name and prefix compatibility lookup", async () => {
    const source = createFakeSource();
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    const queue = await caller.queues.get({
      queueKey: "email-critical",
      queueName: "reports",
      prefix: "ops",
    });

    expect(queue).toMatchObject({ key: "email-critical", name: "email" });
    expect(source.resolveCalls[0]).toEqual({
      queueKey: "email-critical",
      queueName: "reports",
      prefix: "ops",
    });
  });

  it("returns BAD_REQUEST for ambiguous embedded queue name and prefix lookup", async () => {
    const source = createFakeSource({
      queues: [
        createQueue({ key: "first", name: "email", prefix: "critical" }),
        createQueue({ key: "second", name: "email", prefix: "critical" }),
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expectTrpcError(
      caller.queues.get({ queueName: "email", prefix: "critical" }),
      "BAD_REQUEST",
      "matched more than one queue",
    );
  });

  it("rejects read-only dashboard mutations before calling the source operation", async () => {
    const source = createFakeSource({ readOnly: true });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expectTrpcError(
      caller.queues.pause({ queueKey: "email-critical" }),
      "FORBIDDEN",
      "Read-only",
    );
    await expectTrpcError(
      caller.queues.resume({ queueKey: "email-critical" }),
      "FORBIDDEN",
      "Read-only",
    );
    await expectTrpcError(
      caller.jobs.retry({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
      "FORBIDDEN",
      "Read-only",
    );
    await expectTrpcError(
      caller.jobs.remove({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
      "FORBIDDEN",
      "Read-only",
    );

    expect(source.pauseQueue).not.toHaveBeenCalled();
    expect(source.resumeQueue).not.toHaveBeenCalled();
    expect(source.retryJob).not.toHaveBeenCalled();
    expect(source.removeJob).not.toHaveBeenCalled();
  });

  it("rejects unsupported per-queue capabilities", async () => {
    const source = createFakeSource({
      queues: [
        createQueue({
          key: "email-critical",
          capabilities: {
            ...allCapabilities,
            flows: false,
            jobLogs: false,
            jobRemoval: false,
            jobRetry: false,
            queuePause: false,
            queueResume: false,
            queueDrain: false,
          },
        }),
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);
    const target = {
      queueKey: "email-critical",
      queueName: "email",
      jobId: "failed",
    };

    await expectTrpcError(
      caller.queues.pause({ queueKey: "email-critical" }),
      "BAD_REQUEST",
      "Queue pause",
    );
    await expectTrpcError(
      caller.queues.resume({ queueKey: "email-critical" }),
      "BAD_REQUEST",
      "Queue resume",
    );
    await expectTrpcError(caller.jobs.logs(target), "BAD_REQUEST", "Job logs");
    await expectTrpcError(
      caller.jobs.retry(target),
      "BAD_REQUEST",
      "Job retry",
    );
    await expectTrpcError(
      caller.jobs.remove(target),
      "BAD_REQUEST",
      "Job removal",
    );
    await expectTrpcError(
      caller.flows.get({
        queueKey: "email-critical",
        queueName: "email",
        flowId: "flow-1",
      }),
      "BAD_REQUEST",
      "Flows",
    );
  });

  it("aggregates overview metrics from completed and failed jobs inside the time range", async () => {
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const now = Date.now();
    const source = createFakeSource({
      summaries: [
        createJobSummary({
          id: "complete-fast",
          status: "completed",
          timestamp: now - 3_600_000,
          processedOn: now - 3_000_000,
          finishedOn: now - 2_000_000,
        }),
        createJobSummary({
          id: "failed-recent",
          status: "failed",
          name: "send-email",
          timestamp: now - 2_000_000,
          processedOn: now - 1_500_000,
          finishedOn: now - 1_000_000,
          failedReason: "SMTP rejected",
        }),
        createJobSummary({
          id: "failed-old",
          status: "failed",
          timestamp: now - 48 * 3_600_000,
          processedOn: now - 47 * 3_600_000,
          finishedOn: now - 46 * 3_600_000,
        }),
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    const response = await caller.overview.metrics({ timeRangeHours: 24 });

    expect(response.summary).toMatchObject({
      totalCompleted: 1,
      totalFailed: 1,
      avgThroughputPerHour: 2 / 24,
      failureRate: 50,
    });
    expect(response.queuesCount).toBe(2);
    expect(response.slowestJobs[0]).toMatchObject({ id: "complete-fast" });
    expect(response.failingJobTypes[0]).toMatchObject({
      name: "send-email",
      queueName: "email",
      failureCount: 1,
      lastFailedReason: "SMTP rejected",
    });

    vi.useRealTimers();
  });

  it("merges, sorts, and paginates jobs globally after source fetch", async () => {
    const source = createFakeSource({
      jobs: [
        createJob({ id: "oldest", timestamp: 100 }),
        createJob({ id: "newest", timestamp: 300 }),
        createJob({ id: "middle", timestamp: 200 }),
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expect(
      caller.jobs.list({ limit: 1, offset: 1 }),
    ).resolves.toMatchObject([{ id: "middle" }]);
    expect(source.listJobs).toHaveBeenCalledWith({
      limit: 2,
      offset: 0,
    });
    expect(mergeSortAndPageJobs(source.jobs, { limit: 2 })).toMatchObject([
      { id: "newest" },
      { id: "middle" },
    ]);
  });

  it("preserves job and flow error payloads from the queue source", async () => {
    const source = createFakeSource({
      getJob: () => null,
      retryJob: () => {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            'No workers available for queue "email". Start a worker to process retried jobs.',
        });
      },
      getFlow: () => null,
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expect(
      caller.jobs.get({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "missing",
      }),
    ).resolves.toBeNull();
    await expectTrpcError(
      caller.jobs.retry({
        queueKey: "email-critical",
        queueName: "email",
        jobId: "failed",
      }),
      "PRECONDITION_FAILED",
      "No workers available",
    );
    await expectTrpcError(
      caller.flows.get({
        queueKey: "email-critical",
        queueName: "email",
        flowId: "missing",
      }),
      "NOT_FOUND",
      "Flow missing not found in queue email",
    );
  });

  it("exports pure aggregation helpers", () => {
    const response = aggregateOverviewMetrics(
      [
        createJobSummary({
          id: "completed",
          status: "completed",
          processedOn: 100,
          finishedOn: 300,
        }),
        createJobSummary({
          id: "failed",
          status: "failed",
          processedOn: 100,
          finishedOn: 200,
        }),
      ],
      2,
      1,
    );

    expect(response.summary).toMatchObject({
      totalCompleted: 1,
      totalFailed: 1,
      avgThroughputPerHour: 1,
      failureRate: 50,
      avgProcessingTimeMs: 150,
    });
  });
});

type FakeSource = PrivateDashboardQueueSource & {
  jobs: Job[];
  summaries: JobSummary[];
  resolveCalls: QueueTargetInput[];
  pauseQueue: ReturnType<
    typeof vi.fn<[QueueTargetInput], Promise<QueueMutationResponse>>
  >;
  resumeQueue: ReturnType<
    typeof vi.fn<[QueueTargetInput], Promise<QueueMutationResponse>>
  >;
  drainQueue: ReturnType<
    typeof vi.fn<[QueueTargetInput], Promise<QueueMutationResponse>>
  >;
  listJobs: ReturnType<
    typeof vi.fn<[JobListInput], Promise<Array<Job & { queueKey?: string }>>>
  >;
  listJobSummaries: ReturnType<
    typeof vi.fn<
      [JobListInput],
      Promise<Array<JobSummary & { queueKey?: string }>>
    >
  >;
  retryJob: ReturnType<
    typeof vi.fn<[JobTargetInput], Promise<JobRetryResponse>>
  >;
  removeJob: ReturnType<
    typeof vi.fn<[JobTargetInput], Promise<JobRemoveResponse>>
  >;
};

type FakeSourceOptions = {
  mode?: "standalone" | "embedded";
  readOnly?: boolean;
  queues?: DashboardQueue[];
  jobs?: Job[];
  summaries?: JobSummary[];
  getJob?: (input: JobTargetInput) => Job | null;
  retryJob?: (input: JobTargetInput) => JobRetryResponse;
  getFlow?: (input: FlowTargetInput) => FlowTree | null;
};

function createFakeSource(options: FakeSourceOptions = {}): FakeSource {
  const mode = options.mode ?? "embedded";
  const queues = options.queues ?? [
    createQueue({ key: "email-critical", name: "email", prefix: "critical" }),
    createQueue({ key: "reports", name: "reports", prefix: "ops" }),
  ];
  const jobs = options.jobs ?? [
    createJob({ id: "failed", status: "failed", timestamp: 300 }),
    createJob({ id: "completed", status: "completed", timestamp: 200 }),
    createJob({ id: "waiting", status: "waiting", timestamp: 100 }),
  ];
  const summaries =
    options.summaries ??
    jobs.map((job) =>
      createJobSummary({
        id: job.id,
        status: job.status,
        timestamp: job.timestamp,
      }),
    );
  const resolveCalls: QueueTargetInput[] = [];

  return {
    mode,
    readOnly: options.readOnly ?? false,
    jobs,
    summaries,
    resolveCalls,
    getStatus: async () => createStatus(mode, options.readOnly ?? false),
    listQueues: async () => queues,
    listPrefixes: async () =>
      [...new Set(queues.map((queue) => queue.prefix ?? ""))].sort(),
    resolveQueue: async (input) => {
      resolveCalls.push(input);

      if (input.queueKey) {
        const queue = queues.find((item) => item.key === input.queueKey);

        if (!queue) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Supplied queue "${input.queueKey}" was not found.`,
          });
        }

        return queue;
      }

      const name = input.queueName ?? input.name;

      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A queueKey string or queue name string is required.",
        });
      }

      const matches = queues.filter(
        (queue) =>
          queue.name === name &&
          (!input.prefix || queue.prefix === input.prefix),
      );

      if (matches.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Supplied queue "${name}" was not found.`,
        });
      }

      if (matches.length > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Supplied queue lookup "${input.prefix}/${name}" matched more than one queue. Use queueKey instead.`,
        });
      }

      const match = matches[0];
      if (!match) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Supplied queue "${name}" was not found.`,
        });
      }

      return match;
    },
    listJobs: vi.fn(async (input: JobListInput) =>
      jobs.filter((job) => !input.status || job.status === input.status),
    ),
    listJobSummaries: vi.fn(async (input: JobListInput) =>
      summaries.filter((job) => !input.status || job.status === input.status),
    ),
    getJob: async (input) =>
      options.getJob
        ? options.getJob(input)
        : (jobs.find((job) => job.id === input.jobId) ?? null),
    getJobLogs: async (): Promise<JobLogsResponse> => ({
      logs: ["one", "two"],
      count: 2,
    }),
    retryJob: vi.fn(async (input: JobTargetInput) =>
      options.retryJob
        ? options.retryJob(input)
        : {
            success: true,
            message: 'Job "send-email" has been enqueued for retry',
            workerCount: 1,
          },
    ),
    removeJob: vi.fn(
      async (): Promise<JobRemoveResponse> => ({
        success: true,
        message: 'Job "send-email" has been removed',
      }),
    ),
    pauseQueue: vi.fn(
      async (): Promise<QueueMutationResponse> => ({
        success: true,
      }),
    ),
    resumeQueue: vi.fn(
      async (): Promise<QueueMutationResponse> => ({
        success: true,
      }),
    ),
    drainQueue: vi.fn(
      async (): Promise<QueueMutationResponse> => ({
        success: true,
      }),
    ),
    listFlows: async (_input?: FlowListInput): Promise<FlowSummary[]> => [
      {
        id: "flow-1",
        name: "email-flow",
        queueName: "email",
        prefix: "critical",
        status: "waiting-children",
        totalJobs: 2,
        completedJobs: 1,
        failedJobs: 0,
        timestamp: 300,
      },
    ],
    getFlow: async (input) =>
      options.getFlow
        ? options.getFlow(input)
        : {
            id: input.flowId,
            queueName: input.queueName,
            totalNodes: 1,
            completedNodes: 0,
            failedNodes: 0,
            root: {
              id: input.flowId,
              name: "root",
              queueName: input.queueName,
              status: "waiting",
              data: {},
              timestamp: 100,
              children: undefined,
            },
          },
  };
}

function createStatus(
  mode: "standalone" | "embedded",
  readOnly: boolean,
): QueueSourceStatus {
  if (mode === "standalone") {
    return {
      mode: "standalone",
      source: "redis",
      status: "healthy",
      connection: {
        host: "localhost",
        port: "6379",
        hasPassword: false,
        database: "0",
        displayUrl: "localhost:6379",
      },
      providers: ["bullmq"],
      prefixes: ["critical", "ops"],
      capabilities: {
        flows: true,
        supportedStatuses: [
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
          "paused",
          "waiting-children",
        ],
        mutationsAllowed: !readOnly,
      },
    };
  }

  return {
    mode: "embedded",
    source: "supplied",
    status: "healthy",
    queueCount: 2,
    providers: ["bullmq"],
    capabilities: {
      ...allCapabilities,
      mutationsAllowed: !readOnly,
    },
    readOnly,
    mutationsAllowed: !readOnly,
  };
}

function createQueue(overrides: Partial<DashboardQueue> = {}): DashboardQueue {
  return {
    key: "email-critical",
    name: "email",
    label: "Email",
    prefix: "critical",
    provider: "bullmq",
    isPaused: false,
    jobCounts: {
      waiting: 0,
      active: 0,
      completed: 1,
      failed: 1,
      delayed: 0,
      paused: 0,
      prioritized: 0,
      waitingChildren: 0,
    },
    capabilities: allCapabilities,
    ...overrides,
  };
}

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "failed",
    name: "send-email",
    queueName: "email",
    prefix: "critical",
    data: {},
    status: "failed",
    progress: 0,
    attemptsMade: 1,
    attemptsLimit: 3,
    timestamp: 100,
    ...overrides,
  };
}

function createJobSummary(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: "failed",
    name: "send-email",
    queueName: "email",
    prefix: "critical",
    status: "failed",
    progress: 0,
    attemptsMade: 1,
    timestamp: 100,
    ...overrides,
  };
}

async function expectTrpcError(
  promise: Promise<unknown>,
  code: TRPCError["code"],
  message: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code });
    expect((error as Error).message).toContain(message);
    return;
  }

  throw new Error("Expected a TRPCError to be thrown.");
}
