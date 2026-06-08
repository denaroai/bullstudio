import type {
  FlowSummary,
  FlowTree,
  Job,
  JobQueryOptions,
  JobSummary,
} from "@bullstudio/connect-types";
import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type EmbeddedDashboardInstance,
  type QueueAdapter,
  ReadOnlyDashboardError,
} from "@bullstudio/embedded-core";
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

  it("reports whether Bullstudio auth protection is enabled", async () => {
    const protectedDashboard = createEmbeddedDashboard({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "session",
        username: "admin",
        password: "secret",
      },
    });
    const publicDashboard = createEmbeddedDashboard({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: { type: "disabled" },
    });

    const protectedSession = await protectedDashboard.handle({
      method: "GET",
      url: "/api/auth/session",
    });
    const publicSession = await publicDashboard.handle({
      method: "GET",
      url: "/api/auth/session",
    });

    expect(JSON.parse(String(protectedSession.body))).toMatchObject({
      authEnabled: true,
      authenticated: false,
    });
    expect(JSON.parse(String(publicSession.body))).toMatchObject({
      authEnabled: false,
      authenticated: true,
    });
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

    const response = await callPrivateDashboardApi(
      dashboard,
      "overview.metrics",
      {
        timeRangeHours: 2,
      },
    );

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

describe("embedded private dashboard API job detail operations", () => {
  it("gets jobs by queue key or compatibility queue identity and returns supported job logs", async () => {
    const job = createJob({
      id: "job-1",
      name: "send",
      queueName: "email",
      status: "completed",
      timestamp: 100,
    });
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          jobs: [job],
          jobLogs: {
            "job-1": { logs: ["queued", "completed"], count: 2 },
          },
        }),
        createQueueAdapter({
          key: "reports",
          label: "Reports",
          queueName: "reports",
          capabilities: {
            flows: true,
            jobLogs: false,
            jobRemoval: true,
            jobRetry: true,
            queuePause: true,
            queueResume: true,
            workers: true,
          },
          jobs: [
            createJob({
              id: "report-1",
              name: "render",
              queueName: "reports",
              status: "completed",
              timestamp: 200,
            }),
          ],
        }),
      ],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "jobs.get", {
        queueKey: "email",
        jobId: "job-1",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        id: "job-1",
        queueName: "email",
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "jobs.get", {
        queueName: "email",
        prefix: "bull",
        jobId: "job-1",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        id: "job-1",
        queueName: "email",
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "jobs.logs", {
        queueKey: "email",
        jobId: "job-1",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        logs: ["queued", "completed"],
        count: 2,
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "jobs.logs", {
        queueKey: "reports",
        jobId: "report-1",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message: 'Job logs are not supported for supplied queue "reports".',
      },
    });
  });

  it("retries failed jobs with capability and worker preconditions", async () => {
    const retryJob = vi.fn<() => Promise<void>>(async () => {});
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          workerCount: 2,
          retryJob,
          jobs: [
            createJob({
              id: "failed-job",
              name: "send",
              queueName: "email",
              status: "failed",
              timestamp: 100,
            }),
            createJob({
              id: "completed-job",
              name: "send",
              queueName: "email",
              status: "completed",
              timestamp: 200,
            }),
          ],
        }),
        createQueueAdapter({
          key: "unsupported",
          label: "Unsupported",
          queueName: "unsupported",
          capabilities: {
            flows: true,
            jobLogs: true,
            jobRemoval: true,
            jobRetry: false,
            queuePause: true,
            queueResume: true,
            workers: true,
          },
          jobs: [
            createJob({
              id: "failed-job",
              name: "blocked",
              queueName: "unsupported",
              status: "failed",
              timestamp: 100,
            }),
          ],
        }),
        createQueueAdapter({
          key: "no-workers",
          label: "No workers",
          queueName: "no-workers",
          workerCount: 0,
          jobs: [
            createJob({
              id: "failed-job",
              name: "stalled",
              queueName: "no-workers",
              status: "failed",
              timestamp: 100,
            }),
          ],
        }),
        createQueueAdapter({
          key: "workerless",
          label: "Workerless",
          queueName: "workerless",
          capabilities: {
            flows: true,
            jobLogs: true,
            jobRemoval: true,
            jobRetry: true,
            queuePause: true,
            queueResume: true,
            workers: false,
          },
          jobs: [
            createJob({
              id: "failed-job",
              name: "workerless",
              queueName: "workerless",
              status: "failed",
              timestamp: 100,
            }),
          ],
        }),
      ],
    });

    await expect(
      callPrivateDashboardApiMutation(dashboard, "jobs.retry", {
        queueKey: "email",
        jobId: "failed-job",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        success: true,
        message: 'Job "send" has been enqueued for retry',
        workerCount: 2,
      },
    });
    expect(retryJob).toHaveBeenCalledWith("failed-job");

    await expect(
      callPrivateDashboardApiMutation(dashboard, "jobs.retry", {
        queueKey: "unsupported",
        jobId: "failed-job",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message: 'Job retry is not supported for supplied queue "unsupported".',
      },
    });
    await expect(
      callPrivateDashboardApiMutation(dashboard, "jobs.retry", {
        queueKey: "email",
        jobId: "missing",
      }),
    ).resolves.toMatchObject({
      status: 404,
      error: {
        code: -32004,
        message: "Job missing not found in queue email",
      },
    });
    await expect(
      callPrivateDashboardApiMutation(dashboard, "jobs.retry", {
        queueKey: "email",
        jobId: "completed-job",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message: "Job is not in failed state. Current status: completed",
      },
    });
    await expect(
      callPrivateDashboardApiMutation(dashboard, "jobs.retry", {
        queueKey: "no-workers",
        jobId: "failed-job",
      }),
    ).resolves.toMatchObject({
      status: 412,
      error: {
        code: -32012,
        message:
          'No workers available for queue "no-workers". Start a worker to process retried jobs.',
      },
    });
    await expect(
      callPrivateDashboardApiMutation(dashboard, "jobs.retry", {
        queueKey: "workerless",
        jobId: "failed-job",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        success: true,
        workerCount: 0,
      },
    });
  });

  it("removes jobs with capability checks and rejects mutating operations for read-only dashboards", async () => {
    const removeJob = vi.fn<() => Promise<void>>(async () => {});
    const writableDashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          removeJob,
          jobs: [
            createJob({
              id: "job-1",
              name: "send",
              queueName: "email",
              status: "completed",
              timestamp: 100,
            }),
          ],
        }),
        createQueueAdapter({
          key: "unsupported",
          label: "Unsupported",
          queueName: "unsupported",
          capabilities: {
            flows: true,
            jobLogs: true,
            jobRemoval: false,
            jobRetry: true,
            queuePause: true,
            queueResume: true,
            workers: true,
          },
          jobs: [
            createJob({
              id: "job-1",
              name: "blocked",
              queueName: "unsupported",
              status: "completed",
              timestamp: 100,
            }),
          ],
        }),
      ],
    });

    await expect(
      callPrivateDashboardApiMutation(writableDashboard, "jobs.remove", {
        queueName: "email",
        prefix: "bull",
        jobId: "job-1",
      }),
    ).resolves.toMatchObject({
      status: 200,
      json: {
        success: true,
        message: 'Job "send" has been removed',
      },
    });
    expect(removeJob).toHaveBeenCalledWith("job-1");

    await expect(
      callPrivateDashboardApiMutation(writableDashboard, "jobs.remove", {
        queueKey: "unsupported",
        jobId: "job-1",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message:
          'Job removal is not supported for supplied queue "unsupported".',
      },
    });

    const readOnlyDashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      readOnly: true,
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          jobs: [
            createJob({
              id: "failed-job",
              name: "send",
              queueName: "email",
              status: "failed",
              timestamp: 100,
            }),
          ],
        }),
      ],
    });

    await expect(
      callPrivateDashboardApiMutation(readOnlyDashboard, "jobs.retry", {
        queueKey: "email",
        jobId: "failed-job",
      }),
    ).resolves.toMatchObject({
      status: 403,
    });
    await expect(
      callPrivateDashboardApiMutation(readOnlyDashboard, "jobs.remove", {
        queueKey: "email",
        jobId: "failed-job",
      }),
    ).resolves.toMatchObject({
      status: 403,
    });
  });

  it("fails ambiguous compatibility lookup for all job detail procedures", async () => {
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

    for (const procedure of ["jobs.get", "jobs.logs"]) {
      await expect(
        callPrivateDashboardApi(dashboard, procedure, {
          queueName: "email",
          jobId: "job-1",
        }),
      ).resolves.toMatchObject({
        status: 400,
        error: {
          code: -32600,
          message:
            'Supplied queue lookup "email" matched more than one queue. Use queueKey instead.',
        },
      });
    }

    for (const procedure of ["jobs.retry", "jobs.remove"]) {
      await expect(
        callPrivateDashboardApiMutation(dashboard, procedure, {
          queueName: "email",
          jobId: "job-1",
        }),
      ).resolves.toMatchObject({
        status: 400,
        error: {
          code: -32600,
          message:
            'Supplied queue lookup "email" matched more than one queue. Use queueKey instead.',
        },
      });
    }
  });
});

describe("embedded private dashboard API flow operations", () => {
  it("aggregates flow summaries from flow-capable supplied queues with source queue keys and a global limit", async () => {
    const emailListFlows = vi.fn(async () => [
      createFlowSummary({
        id: "email-old",
        name: "Email old",
        queueName: "email",
        timestamp: 100,
      }),
      createFlowSummary({
        id: "email-new",
        name: "Email new",
        queueName: "email",
        timestamp: 300,
      }),
    ]);
    const unsupportedListFlows = vi.fn(async () => [
      createFlowSummary({
        id: "unsupported",
        name: "Unsupported",
        queueName: "unsupported",
        timestamp: 400,
      }),
    ]);
    const reportListFlows = vi.fn(async () => [
      createFlowSummary({
        id: "report",
        name: "Report",
        queueName: "reports",
        prefix: "tenant",
        timestamp: 200,
      }),
    ]);
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          listFlows: emailListFlows,
        }),
        createQueueAdapter({
          key: "unsupported",
          label: "Unsupported",
          capabilities: {
            flows: false,
            jobLogs: true,
            jobRemoval: true,
            jobRetry: true,
            queuePause: true,
            queueResume: true,
            workers: true,
          },
          listFlows: unsupportedListFlows,
        }),
        createQueueAdapter({
          key: "reports",
          label: "Reports",
          queueName: "reports",
          prefix: "tenant",
          listFlows: reportListFlows,
        }),
      ],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "flows.list", { limit: 2 }),
    ).resolves.toEqual({
      status: 200,
      json: [
        expect.objectContaining({
          id: "email-new",
          queueName: "email",
          queueKey: "email",
        }),
        expect.objectContaining({
          id: "report",
          queueName: "reports",
          prefix: "tenant",
          queueKey: "reports",
        }),
      ],
    });
    await expect(
      callPrivateDashboardApi(
        createEmbeddedDashboard({
          protection: { type: "disabled" },
          queues: [
            createQueueAdapter({
              key: "unsupported",
              label: "Unsupported",
              capabilities: {
                flows: false,
                jobLogs: true,
                jobRemoval: true,
                jobRetry: true,
                queuePause: true,
                queueResume: true,
                workers: true,
              },
              listFlows: unsupportedListFlows,
            }),
          ],
        }),
        "flows.list",
      ),
    ).resolves.toEqual({
      status: 200,
      json: [],
    });

    expect(emailListFlows).toHaveBeenCalledWith({ limit: 2 });
    expect(unsupportedListFlows).not.toHaveBeenCalled();
    expect(reportListFlows).toHaveBeenCalledWith({ limit: 2 });
  });

  it("gets flow details by queue key or compatibility queue identity with clear target errors", async () => {
    const emailFlow = createFlowTree({
      id: "email-flow",
      queueName: "email",
    });
    const reportFlow = createFlowTree({
      id: "report-flow",
      queueName: "reports",
    });
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          queueName: "email",
          flows: {
            "email-flow": emailFlow,
          },
        }),
        createQueueAdapter({
          key: "reports",
          label: "Reports",
          queueName: "reports",
          prefix: "tenant",
          flows: {
            "report-flow": reportFlow,
          },
        }),
        createQueueAdapter({
          key: "unsupported",
          label: "Unsupported",
          queueName: "unsupported",
          capabilities: {
            flows: false,
            jobLogs: true,
            jobRemoval: true,
            jobRetry: true,
            queuePause: true,
            queueResume: true,
            workers: true,
          },
        }),
      ],
    });

    await expect(
      callPrivateDashboardApi(dashboard, "flows.get", {
        queueKey: "email",
        flowId: "email-flow",
      }),
    ).resolves.toEqual({
      status: 200,
      json: emailFlow,
    });
    await expect(
      callPrivateDashboardApi(dashboard, "flows.get", {
        queueName: "reports",
        prefix: "tenant",
        flowId: "report-flow",
      }),
    ).resolves.toEqual({
      status: 200,
      json: reportFlow,
    });
    await expect(
      callPrivateDashboardApi(dashboard, "flows.get", {
        queueKey: "unsupported",
        flowId: "unsupported-flow",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message: 'Flows are not supported for supplied queue "unsupported".',
      },
    });
    await expect(
      callPrivateDashboardApi(dashboard, "flows.get", {
        queueKey: "email",
        flowId: "missing",
      }),
    ).resolves.toMatchObject({
      status: 404,
      error: {
        code: -32004,
        message: "Flow missing not found in queue email",
      },
    });

    const ambiguousDashboard = createEmbeddedDashboard({
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
      callPrivateDashboardApi(ambiguousDashboard, "flows.get", {
        queueName: "email",
        flowId: "email-flow",
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

describe("embedded private dashboard API queue pause and resume operations", () => {
  it("pauses and resumes supplied queues by queue key or compatibility queue identity", async () => {
    const pauseEmailQueue = vi.fn<() => Promise<void>>(async () => {});
    const resumeEmailQueue = vi.fn<() => Promise<void>>(async () => {});
    const pauseReportsQueue = vi.fn<() => Promise<void>>(async () => {});
    const resumeReportsQueue = vi.fn<() => Promise<void>>(async () => {});
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "email-critical",
          label: "Critical email",
          queueName: "email",
          pauseQueue: pauseEmailQueue,
          resumeQueue: resumeEmailQueue,
        }),
        createQueueAdapter({
          key: "reports",
          label: "Reports",
          queueName: "reports",
          prefix: "tenant",
          pauseQueue: pauseReportsQueue,
          resumeQueue: resumeReportsQueue,
        }),
      ],
    });

    await expect(
      callPrivateDashboardApiMutation(dashboard, "queues.pause", {
        queueKey: "email-critical",
      }),
    ).resolves.toEqual({
      status: 200,
      json: { success: true },
    });
    await expect(
      callPrivateDashboardApiMutation(dashboard, "queues.resume", {
        name: "reports",
        prefix: "tenant",
      }),
    ).resolves.toEqual({
      status: 200,
      json: { success: true },
    });

    expect(pauseEmailQueue).toHaveBeenCalledOnce();
    expect(resumeEmailQueue).not.toHaveBeenCalled();
    expect(pauseReportsQueue).not.toHaveBeenCalled();
    expect(resumeReportsQueue).toHaveBeenCalledOnce();
  });

  it("requires pause and resume capabilities on the target supplied queue", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>(async () => {});
    const resumeQueue = vi.fn<() => Promise<void>>(async () => {});
    const dashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      queues: [
        createQueueAdapter({
          key: "unsupported",
          label: "Unsupported",
          pauseQueue,
          resumeQueue,
          capabilities: {
            flows: true,
            jobLogs: true,
            jobRemoval: true,
            jobRetry: true,
            queuePause: false,
            queueResume: false,
            workers: true,
          },
        }),
      ],
    });

    await expect(
      callPrivateDashboardApiMutation(dashboard, "queues.pause", {
        queueKey: "unsupported",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message:
          'Queue pause is not supported for supplied queue "unsupported".',
      },
    });
    await expect(
      callPrivateDashboardApiMutation(dashboard, "queues.resume", {
        queueKey: "unsupported",
      }),
    ).resolves.toMatchObject({
      status: 400,
      error: {
        code: -32600,
        message:
          'Queue resume is not supported for supplied queue "unsupported".',
      },
    });

    expect(pauseQueue).not.toHaveBeenCalled();
    expect(resumeQueue).not.toHaveBeenCalled();
  });

  it("rejects read-only, missing, and ambiguous pause and resume targets", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>(async () => {});
    const resumeQueue = vi.fn<() => Promise<void>>(async () => {});
    const readOnlyDashboard = createEmbeddedDashboard({
      protection: { type: "disabled" },
      readOnly: true,
      queues: [
        createQueueAdapter({
          key: "email",
          label: "Email",
          pauseQueue,
          resumeQueue,
        }),
      ],
    });

    await expect(
      callPrivateDashboardApiMutation(readOnlyDashboard, "queues.pause", {
        queueKey: "email",
      }),
    ).resolves.toMatchObject({
      status: 403,
    });
    await expect(
      callPrivateDashboardApiMutation(readOnlyDashboard, "queues.resume", {
        queueKey: "email",
      }),
    ).resolves.toMatchObject({
      status: 403,
    });
    expect(pauseQueue).not.toHaveBeenCalled();
    expect(resumeQueue).not.toHaveBeenCalled();

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

    for (const procedure of ["queues.pause", "queues.resume"]) {
      await expect(
        callPrivateDashboardApiMutation(dashboard, procedure, {
          queueKey: "missing",
        }),
      ).resolves.toMatchObject({
        status: 404,
        error: {
          code: -32004,
          message: 'Supplied queue "missing" was not found.',
        },
      });
      await expect(
        callPrivateDashboardApiMutation(dashboard, procedure, {
          name: "email",
        }),
      ).resolves.toMatchObject({
        status: 400,
        error: {
          code: -32600,
          message:
            'Supplied queue lookup "email" matched more than one queue. Use queueKey instead.',
        },
      });
    }
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
    jobLogs?: Record<string, { logs: string[]; count: number }>;
    listFlows?: (options?: { limit?: number }) => Promise<FlowSummary[]>;
    flows?: Record<string, FlowTree>;
    workerCount?: number;
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
    getJob: async (jobId) =>
      options.jobs?.find((job) => job.id === jobId) ?? null,
    getJobLogs: async (jobId) =>
      options.jobLogs?.[jobId] ?? { logs: [], count: 0 },
    retryJob: options.retryJob ?? (async () => {}),
    removeJob: options.removeJob ?? (async () => {}),
    getWorkerCount: async () => ({
      queueName,
      count: options.workerCount ?? 0,
    }),
    listFlows: options.listFlows,
    getFlow: async (flowId) => options.flows?.[flowId] ?? null,
  };
}

function createFlowSummary(
  options: Partial<FlowSummary> & {
    id: string;
    name: string;
    queueName: string;
    timestamp: number;
  },
): FlowSummary {
  return {
    prefix: "bull",
    status: "waiting",
    totalJobs: 2,
    completedJobs: 0,
    failedJobs: 0,
    ...options,
  };
}

function createFlowTree(
  options: Partial<FlowTree> & {
    id: string;
    queueName: string;
  },
): FlowTree {
  return {
    totalNodes: 1,
    completedNodes: 0,
    failedNodes: 0,
    root: {
      id: options.id,
      name: options.id,
      queueName: options.queueName,
      status: "waiting",
      data: {},
      timestamp: 100,
      children: [],
    },
    ...options,
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
      error: body.error.json ?? body.error,
    };
  }

  return {
    status: response.status,
    json: body.result.data.json ?? body.result.data,
  };
}

async function callPrivateDashboardApiMutation(
  dashboard: EmbeddedDashboardInstance,
  procedure: string,
  input: unknown,
) {
  const response = await dashboard.mountPrivateDashboardApi().handle({
    method: "POST",
    url: `http://localhost/api/trpc/${procedure}`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const body = JSON.parse(String(response.body));

  if ("error" in body) {
    return {
      status: response.status,
      error: body.error.json ?? body.error,
    };
  }

  return {
    status: response.status,
    json: body.result.data.json ?? body.result.data,
  };
}
