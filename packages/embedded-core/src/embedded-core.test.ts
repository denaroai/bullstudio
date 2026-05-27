import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type EmbeddedDashboardInstance,
  type QueueAdapter,
} from "@bullstudio/embedded-core";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("embedded core public contracts", () => {
  it("creates an importable framework-neutral dashboard instance from supplied queue adapters", () => {
    const suppliedQueue: QueueAdapter = {
      key: "email",
      label: "Email",
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
      getQueue: async () => ({
        name: "email",
        prefix: "bull",
        isPaused: false,
        jobCounts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
          prioritized: 0,
          waitingChildren: 0,
        },
      }),
      getJobCounts: async () => ({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
        prioritized: 0,
        waitingChildren: 0,
      }),
      pauseQueue: async () => {},
      resumeQueue: async () => {},
      getJobs: async () => [],
      getJobsSummary: async () => [],
      getJob: async () => null,
      getJobLogs: async () => ({ logs: [], count: 0 }),
      retryJob: async () => {},
      removeJob: async () => {},
      getWorkerCount: async () => ({ queueName: "email", count: 0 }),
    };

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
});
