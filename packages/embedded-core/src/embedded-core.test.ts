import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type EmbeddedDashboardInstance,
  type QueueAdapter,
} from "@bullstudio/embedded-core";
import { describe, expect, expectTypeOf, it } from "vitest";

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
      source: "supplied",
      status: "healthy",
      queueCount: 1,
      providers: ["bullmq"],
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
      source: "supplied",
      status: "healthy",
      queueCount: 2,
      providers: ["bull", "bullmq"],
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
      prefix: "bull",
      isPaused: false,
      jobCounts: emptyJobCounts,
    }),
    getJobCounts: async () => emptyJobCounts,
    pauseQueue: async () => {},
    resumeQueue: async () => {},
    getJobs: async () => [],
    getJobsSummary: async () => [],
    getJob: async () => null,
    getJobLogs: async () => ({ logs: [], count: 0 }),
    retryJob: async () => {},
    removeJob: async () => {},
    getWorkerCount: async () => ({ queueName, count: 0 }),
  };
}
