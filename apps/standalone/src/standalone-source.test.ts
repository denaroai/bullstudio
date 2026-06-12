import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./connection");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("standalone private dashboard queue source", () => {
  it("reports standalone Redis queue source status", async () => {
    vi.stubEnv("REDIS_URL", "redis://:secret@cache.internal:6380/2");
    vi.doMock("./connection", () => ({
      getQueueProvider: async () => ({
        getCapabilities: () => ({
          providerType: "bullmq",
          displayName: "BullMQ",
          supportsFlows: true,
          supportedJobStates: [
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
            "waiting-children",
          ],
        }),
        getPrefixes: async () => ["bull", "mail"],
        isConnected: () => true,
      }),
    }));

    const { createStandaloneQueueSource } = await import("./standalone-source");

    await expect(
      createStandaloneQueueSource().getStatus(),
    ).resolves.toMatchObject({
      mode: "standalone",
      source: "redis",
      status: "healthy",
      connection: {
        host: "cache.internal",
        port: "6380",
        hasPassword: true,
        database: "2",
        displayUrl: "cache.internal:6380",
      },
      providers: ["bullmq"],
      prefixes: ["bull", "mail"],
      capabilities: {
        flows: true,
        mutationsAllowed: true,
      },
    });
  });

  it("aggregates jobs from discovered queues and preserves queue prefixes", async () => {
    vi.doMock("./connection", () => ({
      getQueueProvider: async () => ({
        getQueues: async () => [
          queue("email", "bull"),
          queue("notifications", "mail"),
        ],
        getJobsSummary: async (
          queueName: string,
          _options: unknown,
          prefix: string,
        ) => [
          {
            id: `${prefix}-${queueName}`,
            name: "send",
            queueName,
            status: "completed",
            progress: 100,
            attemptsMade: 1,
            timestamp: queueName === "email" ? 2 : 1,
          },
        ],
      }),
    }));

    const { createStandaloneQueueSource } = await import("./standalone-source");

    await expect(
      createStandaloneQueueSource().listJobSummaries({
        limit: 100,
        offset: 0,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "bull-email",
        prefix: "bull",
      }),
      expect.objectContaining({
        id: "mail-notifications",
        prefix: "mail",
      }),
    ]);
  });

  it("delegates queue mutations and job retry through resolved queue targets", async () => {
    const pauseQueue = vi.fn();
    const retryJob = vi.fn();

    vi.doMock("./connection", () => ({
      getQueueProvider: async () => ({
        getQueue: async (name: string, prefix?: string) =>
          name === "email" ? queue(name, prefix ?? "bull") : null,
        pauseQueue,
        getJob: async () => ({
          id: "1",
          name: "send",
          queueName: "email",
          status: "failed",
          progress: 0,
          attemptsMade: 1,
          attemptsLimit: 3,
          data: {},
          timestamp: 1,
        }),
        getWorkerCount: async () => ({
          queueName: "email",
          count: 1,
        }),
        retryJob,
      }),
    }));

    const { createStandaloneQueueSource } = await import("./standalone-source");
    const source = createStandaloneQueueSource();

    await expect(
      source.pauseQueue({ name: "email", prefix: "bull" }),
    ).resolves.toEqual({ success: true });
    expect(pauseQueue).toHaveBeenCalledWith("email", "bull");

    await expect(
      source.retryJob({
        queueName: "email",
        prefix: "bull",
        jobId: "1",
      }),
    ).resolves.toMatchObject({
      success: true,
      workerCount: 1,
    });
    expect(retryJob).toHaveBeenCalledWith("email", "1", "bull");
  });

  it("retries all failed jobs through the resolved queue target", async () => {
    const retryFailedJobs = vi.fn(async () => 3);

    vi.doMock("./connection", () => ({
      getQueueProvider: async () => ({
        getQueue: async (name: string, prefix?: string) =>
          name === "email" ? queue(name, prefix ?? "bull") : null,
        getWorkerCount: async () => ({ queueName: "email", count: 2 }),
        retryFailedJobs,
      }),
    }));

    const { createStandaloneQueueSource } = await import("./standalone-source");
    const source = createStandaloneQueueSource();

    await expect(
      source.retryAllFailedJobs({ queueName: "email", prefix: "bull" }),
    ).resolves.toMatchObject({
      success: true,
      count: 3,
      workerCount: 2,
    });
    expect(retryFailedJobs).toHaveBeenCalledWith("email", "bull");
  });

  it("blocks retrying all failed jobs when no workers are available", async () => {
    const retryFailedJobs = vi.fn(async () => 0);

    vi.doMock("./connection", () => ({
      getQueueProvider: async () => ({
        getQueue: async (name: string, prefix?: string) =>
          name === "email" ? queue(name, prefix ?? "bull") : null,
        getWorkerCount: async () => ({ queueName: "email", count: 0 }),
        retryFailedJobs,
      }),
    }));

    const { createStandaloneQueueSource } = await import("./standalone-source");
    const source = createStandaloneQueueSource();

    await expect(
      source.retryAllFailedJobs({ queueName: "email", prefix: "bull" }),
    ).rejects.toThrow(/No workers available/);
    expect(retryFailedJobs).not.toHaveBeenCalled();
  });

  it("returns no flows for providers without flow support", async () => {
    vi.doMock("./connection", () => ({
      getQueueProvider: async () => ({
        getCapabilities: () => ({
          providerType: "bull",
          displayName: "Bull",
          supportsFlows: false,
          supportedJobStates: ["waiting", "active", "completed", "failed"],
        }),
      }),
    }));

    const { createStandaloneQueueSource } = await import("./standalone-source");

    await expect(createStandaloneQueueSource().listFlows()).resolves.toEqual(
      [],
    );
  });
});

function queue(name: string, prefix: string) {
  return {
    name,
    prefix,
    isPaused: false,
    jobCounts: {
      active: 0,
      completed: 0,
      delayed: 0,
      failed: 0,
      paused: 0,
      prioritized: 0,
      waiting: 0,
      waitingChildren: 0,
    },
  };
}
