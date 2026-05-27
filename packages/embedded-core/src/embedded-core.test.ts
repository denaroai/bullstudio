import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type EmbeddedDashboardInstance,
  type QueueAdapter,
  ReadOnlyDashboardError,
} from "@bullstudio/embedded-core";
import type {
  Job,
  JobQueryOptions,
  JobSummary,
} from "@bullstudio/connect-types";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});

describe("embedded core public contracts", () => {
  it("creates an importable framework-neutral dashboard instance from supplied queue adapters", () => {
    const suppliedQueue = createQueueAdapter({
      key: "email",
      label: "Email",
    });

    const config = {
      queues: [suppliedQueue],
      readOnly: true,
      protection: {
        type: "basic",
        username: "admin",
        password: "secret",
      },
      dashboardIdentity: {
        title: "Production Queues",
        logo: {
          alt: "Bullstudio",
          src: "/logo.svg",
        },
      },
      documentIdentity: {
        title: "Queues",
        favicon: "/favicon.ico",
      },
    } satisfies DashboardConfig;

    const dashboard = createEmbeddedDashboard(config);

    expectTypeOf(dashboard).toEqualTypeOf<EmbeddedDashboardInstance>();
    expect(dashboard.mode).toBe("embedded");
    expect(dashboard.queues).toEqual([suppliedQueue]);
    expect(dashboard.config.readOnly).toBe(true);
    expect(dashboard.config.protection.type).toBe("basic");
    expect(dashboard.config.dashboardIdentity.title).toBe("Production Queues");
    expect(dashboard.config.documentIdentity.title).toBe("Queues");
    expect(dashboard.getQueueSourceStatus()).toEqual({
      mode: "embedded",
      source: "supplied",
      status: "healthy",
      queueCount: 1,
      providers: ["bullmq"],
      readOnly: true,
      mutationsAllowed: false,
      capabilities: {
        flows: true,
        jobLogs: true,
        jobRemoval: true,
        jobRetry: true,
        queuePause: true,
        queueResume: true,
        workers: true,
      },
    });
    expect(dashboard.handle).toEqual(expect.any(Function));
    expect(dashboard.mountPrivateDashboardApi).toEqual(expect.any(Function));
  });

  it("aggregates only supplied queues and addresses queue APIs by queue key", async () => {
    const emailQueue = createQueueAdapter({
      key: "email-critical",
      label: "Critical email",
      queueName: "email",
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
    });
    const reportQueue = createQueueAdapter({
      key: "reports",
      label: "Reports",
      provider: "bull",
      capabilities: {
        flows: false,
        jobLogs: true,
        jobRemoval: true,
        jobRetry: true,
        queuePause: true,
        queueResume: true,
        workers: false,
      },
    });

    const dashboard = createEmbeddedDashboard({
      queues: [emailQueue, reportQueue],
    });

    await expect(dashboard.listQueues()).resolves.toEqual([
      {
        key: "email-critical",
        label: "Critical email",
        provider: "bullmq",
        capabilities: emailQueue.capabilities,
        name: "email",
        prefix: "bull",
        isPaused: false,
        jobCounts: emptyJobCounts,
      },
      {
        key: "reports",
        label: "Reports",
        provider: "bull",
        capabilities: reportQueue.capabilities,
        name: "reports",
        prefix: "bull",
        isPaused: false,
        jobCounts: emptyJobCounts,
      },
    ]);
    await expect(dashboard.getQueue("email-critical")).resolves.toMatchObject({
      key: "email-critical",
      label: "Critical email",
      name: "email",
    });
    await expect(dashboard.getQueue("missing")).resolves.toBeNull();
    await expect(dashboard.getJobCounts("reports")).resolves.toEqual(
      emptyJobCounts,
    );
    expect(dashboard.getQueueSourceStatus()).toEqual({
      mode: "embedded",
      source: "supplied",
      status: "healthy",
      queueCount: 2,
      providers: ["bull", "bullmq"],
      readOnly: false,
      mutationsAllowed: true,
      capabilities: {
        flows: true,
        jobLogs: true,
        jobRemoval: true,
        jobRetry: true,
        queuePause: true,
        queueResume: true,
        workers: true,
      },
    });
  });

  it("fails fast when supplied queue keys are duplicated", () => {
    expect(() =>
      createEmbeddedDashboard({
        queues: [
          createQueueAdapter({ key: "email", label: "Email" }),
          createQueueAdapter({ key: "email", label: "Other email" }),
        ],
      }),
    ).toThrow(
      'Duplicate supplied queue key "email". Queue keys must be unique.',
    );
  });

  it("allows reads but rejects mutating operations when configured read-only", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>();
    const resumeQueue = vi.fn<() => Promise<void>>();
    const retryJob = vi.fn<() => Promise<void>>();
    const removeJob = vi.fn<() => Promise<void>>();
    const readOnlyDashboard = createEmbeddedDashboard({
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          pauseQueue,
          resumeQueue,
          retryJob,
          removeJob,
        }),
      ],
      readOnly: true,
    });

    await expect(readOnlyDashboard.listQueues()).resolves.toHaveLength(1);
    await expect(readOnlyDashboard.getJobCounts("email")).resolves.toEqual(
      emptyJobCounts,
    );

    await expect(readOnlyDashboard.pauseQueue("email")).rejects.toBeInstanceOf(
      ReadOnlyDashboardError,
    );
    await expect(readOnlyDashboard.resumeQueue("email")).rejects.toBeInstanceOf(
      ReadOnlyDashboardError,
    );
    await expect(
      readOnlyDashboard.retryJob("email", "1"),
    ).rejects.toBeInstanceOf(ReadOnlyDashboardError);
    await expect(
      readOnlyDashboard.removeJob("email", "1"),
    ).rejects.toBeInstanceOf(ReadOnlyDashboardError);

    expect(pauseQueue).not.toHaveBeenCalled();
    expect(resumeQueue).not.toHaveBeenCalled();
    expect(retryJob).not.toHaveBeenCalled();
    expect(removeJob).not.toHaveBeenCalled();

    const writableDashboard = createEmbeddedDashboard({
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          pauseQueue,
          resumeQueue,
          retryJob,
          removeJob,
        }),
      ],
    });

    await writableDashboard.pauseQueue("email");
    await writableDashboard.resumeQueue("email");
    await writableDashboard.retryJob("email", "1");
    await writableDashboard.removeJob("email", "1");

    expect(pauseQueue).toHaveBeenCalledOnce();
    expect(resumeQueue).toHaveBeenCalledOnce();
    expect(retryJob).toHaveBeenCalledWith("1");
    expect(removeJob).toHaveBeenCalledWith("1");
  });
});

describe("embedded private dashboard API queue source compatibility", () => {
  it("answers connection.info with embedded queue source status and legacy compatibility fields", async () => {
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email-critical",
          label: "Critical email",
          queueName: "email",
          provider: "bullmq",
        }),
        createQueueAdapter({
          key: "reports",
          label: "Reports",
          queueName: "reports",
          provider: "bull",
          prefix: "tenant",
          capabilities: {
            flows: false,
            jobLogs: true,
            jobRemoval: true,
            jobRetry: true,
            queuePause: true,
            queueResume: true,
            workers: false,
          },
        }),
      ],
    });

    const response = await callPrivateDashboardApi(
      dashboard,
      "connection.info",
    );

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      mode: "embedded",
      providerType: "bullmq",
      prefixes: ["bull", "tenant"],
      capabilities: {
        supportsFlows: true,
        supportedStatuses: [
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
          "paused",
          "waiting-children",
        ],
      },
      queueSource: {
        mode: "embedded",
        source: "supplied",
        status: "healthy",
        queueCount: 2,
        providers: ["bull", "bullmq"],
        readOnly: false,
        mutationsAllowed: true,
        capabilities: {
          flows: true,
          jobLogs: true,
          jobRemoval: true,
          jobRetry: true,
          queuePause: true,
          queueResume: true,
          workers: true,
        },
      },
    });
    expect(response.json).not.toHaveProperty("host");
    expect(response.json).not.toHaveProperty("port");
    expect(response.json).not.toHaveProperty("database");
    expect(response.json).not.toHaveProperty("hasPassword");
    expect(response.json).not.toHaveProperty("displayUrl");
  });

  it("lists supplied queues, prefixes, and resolves queues by key or name and prefix", async () => {
    const emailQueue = createQueueAdapter({
      key: "email-critical",
      label: "Critical email",
      queueName: "email",
      provider: "bullmq",
    });
    const reportQueue = createQueueAdapter({
      key: "reports",
      label: "Reports",
      queueName: "reports",
      provider: "bull",
      prefix: "tenant",
    });
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [emailQueue, reportQueue],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "queues.list"),
    ).resolves.toMatchObject({
      status: 200,
      json: [
        {
          key: "email-critical",
          label: "Critical email",
          provider: "bullmq",
          capabilities: emailQueue.capabilities,
          name: "email",
          prefix: "bull",
        },
        {
          key: "reports",
          label: "Reports",
          provider: "bull",
          capabilities: reportQueue.capabilities,
          name: "reports",
          prefix: "tenant",
        },
      ],
    });
    await expect(
      callPrivateDashboardApi(dashboard, "queues.prefixes"),
    ).resolves.toMatchObject({
      status: 200,
      json: ["bull", "tenant"],
    });
    await expect(
      callPrivateDashboardApi(dashboard, "queues.get", {
        queueKey: "email-critical",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        key: "email-critical",
        label: "Critical email",
        name: "email",
        prefix: "bull",
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "queues.get", {
        name: "reports",
        prefix: "tenant",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        key: "reports",
        label: "Reports",
        name: "reports",
        prefix: "tenant",
      },
    });
  });

  it("fails name and prefix queue lookup clearly when missing or ambiguous", async () => {
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email-a",
          label: "Email A",
          queueName: "email",
        }),
        createQueueAdapter({
          key: "email-b",
          label: "Email B",
          queueName: "email",
        }),
      ],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "queues.get", {
        name: "missing",
        prefix: "bull",
      }),
    ).resolves.toMatchObject({
      status: 404,
      error: {
        code: -32004,
        message: 'Supplied queue "bull/missing" was not found.',
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "queues.get", {
        name: "email",
        prefix: "bull",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message:
          'Supplied queue lookup "bull/email" matched more than one queue. Use queueKey instead.',
      },
    });
  });
});

describe("embedded private dashboard API overview metrics", () => {
  it("aggregates completed and failed jobs from supplied queues within the requested time range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const now = Date.now();
    const emailQueue = createQueueAdapter({
      key: "email",
      label: "Email",
      queueName: "email",
      jobSummaries: [
        createJobSummary({
          id: "completed-email",
          name: "send",
          queueName: "email",
          status: "completed",
          timestamp: now - 60 * 60 * 1000,
          processedOn: now - 50 * 60 * 1000,
          finishedOn: now - 49 * 60 * 1000,
        }),
        createJobSummary({
          id: "old-email",
          name: "send",
          queueName: "email",
          status: "completed",
          timestamp: now - 4 * 60 * 60 * 1000,
          processedOn: now - 4 * 60 * 60 * 1000,
          finishedOn: now - 4 * 60 * 60 * 1000,
        }),
      ],
    });
    const reportQueue = createQueueAdapter({
      key: "reports",
      label: "Reports",
      queueName: "reports",
      jobSummaries: [
        createJobSummary({
          id: "failed-report",
          name: "render",
          queueName: "reports",
          status: "failed",
          timestamp: now - 30 * 60 * 1000,
          processedOn: now - 20 * 60 * 1000,
          finishedOn: now - 18 * 60 * 1000,
          failedReason: "template missing",
        }),
      ],
    });
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [emailQueue, reportQueue],
    });

    const response = await callPrivateDashboardApi(dashboard, "overview.metrics", {
      timeRangeHours: 2,
    });

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      summary: {
        totalCompleted: 1,
        totalFailed: 1,
        avgThroughputPerHour: 1,
        failureRate: 50,
        avgProcessingTimeMs: 90_000,
        avgDelayMs: 600_000,
      },
      queuesCount: 2,
      lastUpdated: now,
      slowestJobs: [
        {
          id: "failed-report",
          name: "render",
          queueName: "reports",
          processingTimeMs: 120_000,
          timestamp: now - 30 * 60 * 1000,
          status: "failed",
        },
        {
          id: "completed-email",
          name: "send",
          queueName: "email",
          processingTimeMs: 60_000,
          timestamp: now - 60 * 60 * 1000,
          status: "completed",
        },
      ],
      failingJobTypes: [
        {
          name: "render",
          queueName: "reports",
          failureCount: 1,
          lastFailedAt: now - 18 * 60 * 1000,
          lastFailedReason: "template missing",
        },
      ],
    });
    expect(response.json.timeSeries).toHaveLength(2);
    expect(
      response.json.timeSeries.reduce(
        (total: number, point: { completed: number; failed: number }) =>
          total + point.completed + point.failed,
        0,
      ),
    ).toBe(2);
  });

  it("filters metrics by queue key or queue name and prefix and rejects ambiguous compatibility filters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const now = Date.now();
    const emailPrimary = createQueueAdapter({
      key: "email-primary",
      label: "Primary email",
      queueName: "email",
      jobSummaries: [
        createJobSummary({
          id: "primary-completed",
          name: "send",
          queueName: "email",
          status: "completed",
          timestamp: now - 60_000,
          finishedOn: now - 30_000,
        }),
      ],
    });
    const emailSecondary = createQueueAdapter({
      key: "email-secondary",
      label: "Secondary email",
      queueName: "email",
      prefix: "tenant",
      jobSummaries: [
        createJobSummary({
          id: "secondary-failed",
          name: "send",
          queueName: "email",
          status: "failed",
          timestamp: now - 60_000,
          finishedOn: now - 30_000,
        }),
      ],
    });
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [emailPrimary, emailSecondary],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "overview.metrics", {
        timeRangeHours: 1,
        queueKey: "email-primary",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        summary: {
          totalCompleted: 1,
          totalFailed: 0,
        },
        queuesCount: 1,
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "overview.metrics", {
        timeRangeHours: 1,
        queueName: "email",
        prefix: "tenant",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        summary: {
          totalCompleted: 0,
          totalFailed: 1,
        },
        queuesCount: 1,
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "overview.metrics", {
        timeRangeHours: 1,
        queueName: "email",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message:
          'Supplied queue lookup "email" matched more than one queue. Use queueKey instead.',
      },
    });
  });
});

describe("embedded private dashboard API job lists", () => {
  it("aggregates job summaries from supplied queues with source queue keys, merged sorting, and a global limit", async () => {
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          jobSummaries: [
            createJobSummary({
              id: "old-email",
              name: "send-old",
              queueName: "email",
              status: "completed",
              timestamp: 100,
            }),
            createJobSummary({
              id: "new-email",
              name: "send-new",
              queueName: "email",
              status: "completed",
              timestamp: 300,
            }),
          ],
        }),
        createQueueAdapter({
          key: "reports",
          label: "Reports",
          queueName: "reports",
          jobSummaries: [
            createJobSummary({
              id: "new-report",
              name: "render",
              queueName: "reports",
              status: "failed",
              timestamp: 200,
            }),
          ],
        }),
      ],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "jobs.listSummary", {
        limit: 2,
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: [
        {
          id: "new-email",
          queueName: "email",
          prefix: "bull",
          queueKey: "email",
          timestamp: 300,
        },
        {
          id: "new-report",
          queueName: "reports",
          prefix: "bull",
          queueKey: "reports",
          timestamp: 200,
        },
      ],
    });
  });

  it("lists full jobs with status filters and queue key or compatibility queue filters", async () => {
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email-primary",
          label: "Primary email",
          queueName: "email",
          jobs: [
            createJob({
              id: "waiting-email",
              name: "send",
              queueName: "email",
              status: "waiting",
              timestamp: 100,
            }),
            createJob({
              id: "failed-email",
              name: "send",
              queueName: "email",
              status: "failed",
              timestamp: 400,
            }),
          ],
        }),
        createQueueAdapter({
          key: "email-secondary",
          label: "Secondary email",
          queueName: "email",
          prefix: "tenant",
          jobs: [
            createJob({
              id: "failed-tenant-email",
              name: "send",
              queueName: "email",
              prefix: "tenant",
              status: "failed",
              timestamp: 300,
            }),
          ],
        }),
      ],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "jobs.list", {
        queueKey: "email-primary",
        status: "failed",
        limit: 10,
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: [
        {
          id: "failed-email",
          queueName: "email",
          prefix: "bull",
          queueKey: "email-primary",
          status: "failed",
        },
      ],
    });
    await expect(
      callPrivateDashboardApi(dashboard, "jobs.list", {
        queueName: "email",
        prefix: "tenant",
        status: "failed",
        limit: 10,
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: [
        {
          id: "failed-tenant-email",
          queueName: "email",
          prefix: "tenant",
          queueKey: "email-secondary",
          status: "failed",
        },
      ],
    });
    await expect(
      callPrivateDashboardApi(dashboard, "jobs.list", {
        queueName: "email",
        status: "failed",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message:
          'Supplied queue lookup "email" matched more than one queue. Use queueKey instead.',
      },
    });
  });
});

const emptyJobCounts = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  paused: 0,
  prioritized: 0,
  waitingChildren: 0,
};

function createQueueAdapter(
  options: Partial<QueueAdapter> & {
    key: string;
    label: string;
    queueName?: string;
    prefix?: string;
    jobs?: Job[];
    jobSummaries?: JobSummary[];
    pauseQueue?: () => Promise<void>;
    resumeQueue?: () => Promise<void>;
    retryJob?: (jobId: string) => Promise<void>;
    removeJob?: (jobId: string) => Promise<void>;
  },
): QueueAdapter {
  const capabilities = options.capabilities ?? {
    flows: true,
    jobLogs: true,
    jobRemoval: true,
    jobRetry: true,
    queuePause: true,
    queueResume: true,
    workers: true,
  };
  const queueName = options.queueName ?? options.key;

  return {
    key: options.key,
    label: options.label,
    provider: options.provider ?? "bullmq",
    capabilities,
    getQueue: async () => ({
      name: queueName,
      prefix: options.prefix ?? "bull",
      isPaused: false,
      jobCounts: emptyJobCounts,
    }),
    getJobCounts: async () => emptyJobCounts,
    pauseQueue: options.pauseQueue ?? (async () => {}),
    resumeQueue: options.resumeQueue ?? (async () => {}),
    getJobs: async (queryOptions?: JobQueryOptions) =>
      getJobs(options.jobs ?? [], queryOptions),
    getJobsSummary: async (queryOptions?: JobQueryOptions) =>
      getJobSummaries(options.jobSummaries ?? [], queryOptions),
    getJob: async () => null,
    getJobLogs: async () => ({ logs: [], count: 0 }),
    retryJob: options.retryJob ?? (async () => {}),
    removeJob: options.removeJob ?? (async () => {}),
    getWorkerCount: async () => ({ queueName, count: 0 }),
  };
}

function createJob(
  options: Partial<Job> & {
    id: string;
    name: string;
    queueName: string;
    status: Job["status"];
    timestamp: number;
  },
): Job {
  return {
    data: {},
    progress: 0,
    attemptsMade: 0,
    attemptsLimit: 1,
    ...options,
  };
}

function createJobSummary(
  options: Partial<JobSummary> & {
    id: string;
    name: string;
    queueName: string;
    status: JobSummary["status"];
    timestamp: number;
  },
): JobSummary {
  return {
    progress: 0,
    attemptsMade: 0,
    ...options,
  };
}

function getJobSummaries(
  jobs: JobSummary[],
  options: JobQueryOptions | undefined,
): JobSummary[] {
  return filterJobs(jobs, options);
}

function getJobs(jobs: Job[], options: JobQueryOptions | undefined): Job[] {
  return filterJobs(jobs, options);
}

function filterJobs<T extends Job | JobSummary>(
  jobs: T[],
  options: JobQueryOptions | undefined,
): T[] {
  const statuses = options?.filter?.status
    ? Array.isArray(options.filter.status)
      ? options.filter.status
      : [options.filter.status]
    : undefined;
  const filtered = statuses
    ? jobs.filter((job) => statuses.includes(job.status))
    : jobs;

  return filtered.slice(0, options?.limit);
}

async function callPrivateDashboardApi(
  dashboard: EmbeddedDashboardInstance,
  procedure: string,
  input?: unknown,
) {
  const query =
    input !== undefined
      ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : "";
  const response = await dashboard.mountPrivateDashboardApi().handle({
    method: "GET",
    url: `http://localhost/api/trpc/${procedure}${query}`,
  });
  const body = JSON.parse(String(response.body));

  if ("error" in body) {
    return {
      status: response.status,
      error: body.error,
    };
  }

  return {
    status: response.status,
    json: body.result.data.json ?? body.result.data,
  };
}
