import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type EmbeddedDashboardInstance,
  type QueueAdapter,
  ReadOnlyDashboardError,
} from "@bullstudio/embedded-core";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

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
    getJobs: async () => [],
    getJobsSummary: async () => [],
    getJob: async () => null,
    getJobLogs: async () => ({ logs: [], count: 0 }),
    retryJob: options.retryJob ?? (async () => {}),
    removeJob: options.removeJob ?? (async () => {}),
    getWorkerCount: async () => ({ queueName, count: 0 }),
  };
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
