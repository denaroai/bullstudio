import type {
  FlowSummary,
  FlowTree,
  Job,
  JobSummary,
  QueueMetricSnapshot,
  Worker,
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
  type QueueMetricsListInput,
  type QueueMetricsSummary,
  type QueueMutationResponse,
  type QueueSourceStatus,
  type QueueTargetInput,
  type WorkerListInput,
  type WorkerTargetInput,
} from "./index";

const allCapabilities: AdapterCapabilities = {
  flows: true,
  jobLogs: true,
  jobRemoval: true,
  jobRetry: true,
  queuePause: true,
  queueResume: true,
  queueDrain: true,
  schedulers: true,
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
    await expect(caller.jobs.list({ limit: 10 })).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: "failed" }),
        expect.objectContaining({ id: "completed" }),
        expect.objectContaining({ id: "waiting" }),
      ]),
      total: 3,
      limit: 10,
      offset: 0,
    });
    await expect(caller.jobs.listSummary({ limit: 10 })).resolves.toMatchObject(
      {
        items: expect.arrayContaining([
          expect.objectContaining({ id: "failed" }),
          expect.objectContaining({ id: "completed" }),
          expect.objectContaining({ id: "waiting" }),
        ]),
        total: 3,
        limit: 10,
        offset: 0,
      },
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
    await expect(caller.workers.list({ limit: 10 })).resolves.toHaveLength(2);
    await expect(
      caller.workers.get({
        queueKey: "email-critical",
        queueName: "email",
        workerId: "critical:email:worker-a:127.0.0.1:1",
      }),
    ).resolves.toMatchObject({ name: "worker-a" });
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
            workers: false,
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
    await expectTrpcError(
      caller.workers.list({ queueKey: "email-critical" }),
      "BAD_REQUEST",
      "Workers",
    );
  });

  it("lists workers with queue filters and returns NOT_FOUND for a missing worker", async () => {
    const source = createFakeSource();
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expect(
      caller.workers.list({ queueName: "email", prefix: "critical" }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "critical:email:worker-a:127.0.0.1:1",
        queueKey: "email-critical",
      }),
    ]);
    expect(source.listWorkers).toHaveBeenCalledWith({
      queueName: "email",
      prefix: "critical",
      limit: 200,
    });

    await expectTrpcError(
      caller.workers.get({
        queueKey: "email-critical",
        queueName: "email",
        workerId: "missing",
      }),
      "NOT_FOUND",
      "Worker missing not found",
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

    await expect(caller.jobs.list({ limit: 1, offset: 1 })).resolves.toEqual({
      items: [expect.objectContaining({ id: "middle" })],
      total: 3,
      limit: 1,
      offset: 1,
    });
    expect(source.listJobs).toHaveBeenCalledWith({
      limit: 2,
      offset: 0,
      queueKey: undefined,
      queueName: undefined,
      prefix: undefined,
      status: undefined,
    });
    expect(mergeSortAndPageJobs(source.jobs, { limit: 2 })).toMatchObject([
      { id: "newest" },
      { id: "middle" },
    ]);
  });

  it("searches job summaries on summary fields before paging", async () => {
    const source = createFakeSource({
      jobs: [
        createJob({ id: "1", name: "send-email", queueName: "email" }),
        createJob({ id: "2", name: "build-report", queueName: "reports" }),
        createJob({ id: "3", name: "send-sms", queueName: "sms" }),
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expect(
      caller.jobs.listSummary({ search: "report", limit: 10 }),
    ).resolves.toMatchObject({
      items: [{ id: "2" }],
      total: 1,
      limit: 10,
      offset: 0,
    });
  });

  it("sorts job summaries by jobs table fields before paging", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const source = createFakeSource({
      jobs: [
        createJob({
          id: "a",
          name: "zeta",
          queueName: "email",
          status: "waiting",
          timestamp: 100,
          processedOn: 150,
          finishedOn: 250,
        }),
        createJob({
          id: "b",
          name: "alpha",
          queueName: "reports",
          status: "failed",
          timestamp: 300,
          processedOn: 320,
          finishedOn: 340,
        }),
        createJob({
          id: "c",
          name: "middle",
          queueName: "audit",
          status: "completed",
          timestamp: 200,
          processedOn: 210,
          finishedOn: 260,
        }),
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    await expect(
      caller.jobs.listSummary({ sortField: "name", sortOrder: "asc" }),
    ).resolves.toMatchObject({
      items: [{ id: "b" }, { id: "c" }, { id: "a" }],
    });
    await expect(
      caller.jobs.listSummary({ sortField: "queueName", sortOrder: "asc" }),
    ).resolves.toMatchObject({
      items: [{ id: "c" }, { id: "a" }, { id: "b" }],
    });
    await expect(
      caller.jobs.listSummary({ sortField: "status", sortOrder: "asc" }),
    ).resolves.toMatchObject({
      items: [{ id: "c" }, { id: "b" }, { id: "a" }],
    });
    await expect(
      caller.jobs.listSummary({ sortField: "timestamp", sortOrder: "asc" }),
    ).resolves.toMatchObject({
      items: [{ id: "a" }, { id: "c" }, { id: "b" }],
    });
    await expect(
      caller.jobs.listSummary({ sortField: "duration", sortOrder: "desc" }),
    ).resolves.toMatchObject({
      items: [{ id: "a" }, { id: "c" }, { id: "b" }],
    });

    vi.useRealTimers();
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

  it("prefers recorded queue metrics over raw job counts for throughput", () => {
    const now = Date.UTC(2026, 4, 27, 12, 0, 0);
    const snapshot = (data: number[]): QueueMetricSnapshot => ({
      meta: {
        count: data.reduce((sum, point) => sum + point, 0),
        prevTS: now,
        prevCount: 0,
      },
      data,
      count: data.length,
    });

    const response = aggregateOverviewMetrics(
      [
        // Queue A records metrics: its raw jobs must not be counted again, but
        // they still feed processing-time, since metrics carry no timing.
        {
          ...createJobSummary({
            id: "a1",
            queueName: "qa",
            prefix: "p",
            status: "completed",
            processedOn: now - 2000,
            finishedOn: now - 1000,
          }),
          queueKey: "A",
        },
        // Queue B has no metrics, so its raw jobs are counted as a fallback.
        {
          ...createJobSummary({
            id: "b1",
            queueName: "qb",
            prefix: "p",
            status: "completed",
            processedOn: now - 2000,
            finishedOn: now - 1000,
          }),
          queueKey: "B",
        },
        {
          ...createJobSummary({
            id: "b2",
            queueName: "qb",
            prefix: "p",
            status: "failed",
            processedOn: now - 2000,
            finishedOn: now - 1000,
          }),
          queueKey: "B",
        },
      ],
      2,
      2,
      [
        {
          queueKey: "A",
          queueName: "qa",
          prefix: "p",
          completed: snapshot([3, 2]),
          failed: snapshot([1]),
        },
        {
          queueKey: "B",
          queueName: "qb",
          prefix: "p",
          completed: null,
          failed: null,
        },
      ],
      now,
    );

    expect(response.summary).toMatchObject({
      totalCompleted: 6, // 5 from queue A metrics + 1 raw job from queue B
      totalFailed: 2, // 1 from queue A metrics + 1 raw job from queue B
      avgThroughputPerHour: 4, // 8 finished jobs / 2 hours
      failureRate: 25,
      // Timing still comes from all raw jobs, including metric-backed queue A.
      avgProcessingTimeMs: 1000,
    });
    // Queue B falls back to raw jobs, so coverage is partial.
    expect(response.nativeMetrics).toEqual({
      totalQueues: 2,
      recordingQueues: 1,
    });
  });

  it("uses recorded queue metrics for overview throughput via the router", async () => {
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const now = Date.now();
    const source = createFakeSource({
      summaries: [],
      queueMetrics: [
        {
          queueKey: "email-critical",
          queueName: "email",
          prefix: "critical",
          completed: {
            meta: { count: 9, prevTS: now, prevCount: 0 },
            data: [5, 4],
            count: 2,
          },
          failed: {
            meta: { count: 1, prevTS: now, prevCount: 0 },
            data: [1],
            count: 1,
          },
        },
      ],
    });
    const caller =
      createPrivateDashboardRouter(source).createCaller(authenticatedContext);

    const response = await caller.overview.metrics({ timeRangeHours: 24 });

    expect(response.summary).toMatchObject({
      totalCompleted: 9,
      totalFailed: 1,
    });
    expect(response.nativeMetrics).toEqual({
      totalQueues: 1,
      recordingQueues: 1,
    });
    expect(source.listQueueMetrics).toHaveBeenCalled();

    vi.useRealTimers();
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
      minProcessingTimeMs: 100,
      maxProcessingTimeMs: 200,
    });
  });

  it("buckets the 1h range into 5-minute time-series points", () => {
    const now = Date.UTC(2026, 4, 27, 12, 0, 0);
    const at = (minutesAgo: number) => now - minutesAgo * 60 * 1000;

    const response = aggregateOverviewMetrics(
      [
        createJobSummary({
          id: "j1",
          status: "completed",
          finishedOn: at(2), // bucket [t-5m, t)
        }),
        createJobSummary({
          id: "j2",
          status: "completed",
          finishedOn: at(4), // same bucket as j1
        }),
        createJobSummary({
          id: "j3",
          status: "failed",
          finishedOn: at(12), // bucket [t-15m, t-10m)
        }),
      ],
      1,
      1,
      [],
      now,
    );

    // 1 hour / 5-minute buckets = 12 points.
    expect(response.timeSeries).toHaveLength(12);

    // j1 and j2 (2m and 4m ago) share one 5-minute bucket; j3 (12m ago) sits
    // in an earlier one — finer than the old single-hour point.
    const fiveMin = 5 * 60 * 1000;
    const bucketWithCompletions = response.timeSeries.find(
      (point) => point.timestamp === Math.floor(at(4) / fiveMin) * fiveMin,
    );
    expect(bucketWithCompletions).toMatchObject({ completed: 2, failed: 0 });

    const totalFailed = response.timeSeries.reduce((s, p) => s + p.failed, 0);
    expect(totalFailed).toBe(1);

    expect(response.summary.totalCompleted).toBe(2);
    expect(response.summary.totalFailed).toBe(1);
  });

  it("buckets a sub-hour range into 1-minute time-series points", () => {
    const now = Date.UTC(2026, 4, 27, 12, 0, 0);
    const response = aggregateOverviewMetrics([], 5 / 60, 1, [], now);

    // 5 minutes / 1-minute buckets = 5 points.
    expect(response.timeSeries).toHaveLength(5);
  });
});

type FakeSource = PrivateDashboardQueueSource & {
  jobs: Job[];
  summaries: JobSummary[];
  workers: Worker[];
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
  listQueueMetrics: ReturnType<
    typeof vi.fn<[QueueMetricsListInput], Promise<QueueMetricsSummary[]>>
  >;
  retryJob: ReturnType<
    typeof vi.fn<[JobTargetInput], Promise<JobRetryResponse>>
  >;
  removeJob: ReturnType<
    typeof vi.fn<[JobTargetInput], Promise<JobRemoveResponse>>
  >;
  listWorkers: ReturnType<
    typeof vi.fn<
      [WorkerListInput],
      Promise<Array<Worker & { queueKey?: string }>>
    >
  >;
};

type FakeSourceOptions = {
  mode?: "standalone" | "embedded";
  readOnly?: boolean;
  queues?: DashboardQueue[];
  jobs?: Job[];
  summaries?: JobSummary[];
  queueMetrics?: QueueMetricsSummary[];
  workers?: Worker[];
  getJob?: (input: JobTargetInput) => Job | null;
  retryJob?: (input: JobTargetInput) => JobRetryResponse;
  getFlow?: (input: FlowTargetInput) => FlowTree | null;
};

function createFakeSource(options: FakeSourceOptions = {}): FakeSource {
  const mode = options.mode ?? "embedded";
  const jobs = options.jobs ?? [
    createJob({ id: "failed", status: "failed", timestamp: 300 }),
    createJob({ id: "completed", status: "completed", timestamp: 200 }),
    createJob({ id: "waiting", status: "waiting", timestamp: 100 }),
  ];
  const queues =
    options.queues ??
    withJobCounts(
      [
        createQueue({
          key: "email-critical",
          name: "email",
          prefix: "critical",
        }),
        createQueue({ key: "reports", name: "reports", prefix: "ops" }),
      ],
      jobs,
    );
  const summaries =
    options.summaries ??
    jobs.map((job) =>
      createJobSummary({
        id: job.id,
        name: job.name,
        queueName: job.queueName,
        prefix: job.prefix,
        status: job.status,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      }),
    );
  const workers = options.workers ?? [
    createWorker({
      id: "critical:email:worker-a:127.0.0.1:1",
      name: "worker-a",
      queueName: "email",
      prefix: "critical",
      queueKey: "email-critical",
      address: "127.0.0.1:1",
    }),
    createWorker({
      id: "ops:reports:worker-b:127.0.0.1:2",
      name: "worker-b",
      queueName: "reports",
      prefix: "ops",
      queueKey: "reports",
      address: "127.0.0.1:2",
    }),
  ];
  const resolveCalls: QueueTargetInput[] = [];

  return {
    mode,
    readOnly: options.readOnly ?? false,
    jobs,
    summaries,
    workers,
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
    listQueueMetrics: vi.fn(
      async (_input: QueueMetricsListInput) => options.queueMetrics ?? [],
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
    getJobFlow: async () => null,
    listWorkers: vi.fn(async (input: WorkerListInput) =>
      workers.filter(
        (worker) =>
          (!input.queueKey || worker.queueKey === input.queueKey) &&
          (!input.queueName || worker.queueName === input.queueName) &&
          (!input.prefix || worker.prefix === input.prefix),
      ),
    ),
    getWorker: async (input: WorkerTargetInput) =>
      workers.find(
        (worker) =>
          worker.id === input.workerId &&
          (!input.queueKey || worker.queueKey === input.queueKey) &&
          (!input.queueName || worker.queueName === input.queueName) &&
          (!input.prefix || worker.prefix === input.prefix),
      ) ?? null,
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
        schedulers: true,
        workers: true,
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

function withJobCounts(
  queues: DashboardQueue[],
  jobs: Array<Job | JobSummary>,
): DashboardQueue[] {
  return queues.map((queue) => {
    const matchingJobs = jobs.filter(
      (job) =>
        job.queueName === queue.name &&
        (job.prefix ?? "bull") === (queue.prefix ?? "bull"),
    );

    return {
      ...queue,
      jobCounts: {
        waiting: matchingJobs.filter((job) => job.status === "waiting").length,
        active: matchingJobs.filter((job) => job.status === "active").length,
        completed: matchingJobs.filter((job) => job.status === "completed")
          .length,
        failed: matchingJobs.filter((job) => job.status === "failed").length,
        delayed: matchingJobs.filter((job) => job.status === "delayed").length,
        paused: matchingJobs.filter((job) => job.status === "paused").length,
        prioritized: 0,
        waitingChildren: matchingJobs.filter(
          (job) => job.status === "waiting-children",
        ).length,
      },
    };
  });
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

function createWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "critical:email:worker-a:127.0.0.1:1",
    name: "worker-a",
    queueName: "email",
    prefix: "critical",
    queueKey: "email-critical",
    provider: "bullmq",
    address: "127.0.0.1:1",
    age: 10,
    idle: 1,
    metadata: {
      name: "worker-a",
      addr: "127.0.0.1:1",
    },
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
