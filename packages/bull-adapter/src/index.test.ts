import { createBullQueueAdapter } from "@bullstudio/bull-adapter";
import type { QueueAdapter } from "@bullstudio/embedded-core";
import type Bull from "bull";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

describe("createBullQueueAdapter", () => {
  it("wraps a host-owned Bull queue with inferred identity and Bull capabilities", () => {
    const queue = { name: "email" } as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    expectTypeOf(adapter).toMatchTypeOf<QueueAdapter>();
    expect(adapter).toMatchObject({
      key: "email",
      label: "email",
      provider: "bull",
      capabilities: {
        flows: false,
        jobLogs: true,
        jobRemoval: true,
        jobRetry: true,
        queuePause: true,
        queueResume: true,
        queueDrain: true,
        workers: true,
      },
    });
  });

  it("uses explicit queue key and label overrides", () => {
    const queue = { name: "email" } as Bull.Queue;

    const adapter = createBullQueueAdapter(queue, {
      key: "critical-email",
      label: "Critical email",
    });

    expect(adapter.key).toBe("critical-email");
    expect(adapter.label).toBe("Critical email");
  });

  it("reads queue state and Bull job counts from the supplied queue", async () => {
    const queue = {
      name: "email",
      keyPrefix: "production",
      isPaused: async () => true,
      getJobCounts: async () => ({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 4,
        delayed: 5,
      }),
    } as unknown as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    await expect(adapter.getQueue()).resolves.toEqual({
      name: "email",
      prefix: "production",
      isPaused: true,
      jobCounts: {
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 4,
        delayed: 5,
        paused: 0,
        prioritized: 0,
        waitingChildren: 0,
      },
    });
  });

  it("reads jobs from the supplied queue", async () => {
    const queue = {
      name: "email",
      getJobs: async () => [
        {
          id: "1",
          name: "welcome",
          data: { userId: 123 },
          progress: () => 50,
          attemptsMade: 1,
          opts: { attempts: 3, delay: 10, priority: 2 },
          failedReason: undefined,
          stacktrace: [],
          returnvalue: { ok: true },
          timestamp: 100,
          processedOn: 110,
          finishedOn: undefined,
        },
      ],
    } as unknown as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    await expect(adapter.getJobs()).resolves.toEqual([
      {
        id: "1",
        name: "welcome",
        queueName: "email",
        data: { userId: 123 },
        status: "active",
        progress: 50,
        attemptsMade: 1,
        attemptsLimit: 3,
        failedReason: undefined,
        stacktrace: [],
        returnValue: { ok: true },
        timestamp: 100,
        processedOn: 110,
        finishedOn: undefined,
        delay: 10,
        priority: 2,
        parentId: undefined,
        repeatJobKey: undefined,
      },
    ]);
  });

  it("applies name filtering and sorting when reading job summaries", async () => {
    const queue = {
      name: "email",
      getJobs: async () => [
        createQueueJob({ id: "1", name: "digest", timestamp: 300 }),
        createQueueJob({ id: "2", name: "welcome", timestamp: 100 }),
        createQueueJob({ id: "3", name: "welcome", timestamp: 200 }),
      ],
    } as unknown as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    await expect(
      adapter.getJobsSummary({
        filter: { name: "welcome" },
        sort: { field: "timestamp", order: "desc" },
      }),
    ).resolves.toEqual([
      {
        id: "3",
        name: "welcome",
        queueName: "email",
        status: "waiting",
        progress: 0,
        attemptsMade: 0,
        failedReason: undefined,
        timestamp: 200,
        processedOn: undefined,
        finishedOn: undefined,
        delay: undefined,
        priority: undefined,
        parentId: undefined,
        repeatJobKey: undefined,
      },
      {
        id: "2",
        name: "welcome",
        queueName: "email",
        status: "waiting",
        progress: 0,
        attemptsMade: 0,
        failedReason: undefined,
        timestamp: 100,
        processedOn: undefined,
        finishedOn: undefined,
        delay: undefined,
        priority: undefined,
        parentId: undefined,
        repeatJobKey: undefined,
      },
    ]);
  });

  it("delegates supported operations without closing the supplied queue", async () => {
    const retry = vi.fn<() => Promise<void>>();
    const remove = vi.fn<() => Promise<void>>();
    const close = vi.fn<() => Promise<void>>();
    const failedRetry = vi.fn<() => Promise<void>>();
    const queue = {
      name: "email",
      getJob: async () => ({
        id: "1",
        name: "welcome",
        data: {},
        progress: () => 0,
        attemptsMade: 0,
        opts: {},
        stacktrace: [],
        timestamp: 100,
        retry,
        remove,
      }),
      getJobLogs: async () => ({ logs: ["created"], count: 1 }),
      getFailed: async () => [{ retry: failedRetry }, { retry: failedRetry }],
      pause: vi.fn<() => Promise<void>>(),
      resume: vi.fn<() => Promise<void>>(),
      getWorkers: async () => [{}, {}],
      close,
    } as unknown as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    await expect(adapter.getJob("1")).resolves.toMatchObject({
      id: "1",
      name: "welcome",
      queueName: "email",
      status: "waiting",
    });
    await expect(adapter.getJobLogs("1")).resolves.toEqual({
      logs: ["created"],
      count: 1,
    });
    await adapter.pauseQueue();
    await adapter.resumeQueue();
    await adapter.retryJob("1");
    await expect(adapter.retryFailedJobs()).resolves.toBe(2);
    expect(failedRetry).toHaveBeenCalledTimes(2);
    await adapter.removeJob("1");
    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 2,
    });
    await expect(adapter.listWorkers?.()).resolves.toEqual([
      {
        id: "bull:email:worker",
        name: "worker",
        queueName: "email",
        prefix: "bull",
        provider: "bull",
        address: undefined,
        age: 0,
        idle: 0,
        metadata: {},
      },
      {
        id: "bull:email:worker",
        name: "worker",
        queueName: "email",
        prefix: "bull",
        provider: "bull",
        address: undefined,
        age: 0,
        idle: 0,
        metadata: {},
      },
    ]);

    expect(queue.pause).toHaveBeenCalledOnce();
    expect(queue.resume).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(adapter).not.toHaveProperty("close");
    expect(adapter).not.toHaveProperty("disconnect");
  });

  it("maps Bull worker client metadata", async () => {
    const queue = {
      name: "email",
      keyPrefix: "production",
      getWorkers: async () => [
        {
          name: "worker-a",
          addr: "127.0.0.1:6379",
          age: "12",
          idle: "2",
        },
      ],
    } as unknown as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    await expect(adapter.listWorkers?.()).resolves.toEqual([
      {
        id: "production:email:worker-a:127.0.0.1:6379",
        name: "worker-a",
        queueName: "email",
        prefix: "production",
        provider: "bull",
        address: "127.0.0.1:6379",
        age: 12,
        idle: 2,
        metadata: {
          name: "worker-a",
          addr: "127.0.0.1:6379",
          age: "12",
          idle: "2",
        },
      },
    ]);
  });

  it("returns an empty Bull worker list", async () => {
    const queue = {
      name: "email",
      getWorkers: async () => [],
    } as unknown as Bull.Queue;

    const adapter = createBullQueueAdapter(queue);

    await expect(adapter.listWorkers?.()).resolves.toEqual([]);
    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 0,
    });
  });
});

function createQueueJob(overrides: {
  id: string;
  name: string;
  timestamp: number;
}) {
  return {
    data: { userId: 123 },
    progress: () => 0,
    attemptsMade: 0,
    opts: {},
    failedReason: undefined,
    stacktrace: [],
    returnvalue: { ok: true },
    processedOn: undefined,
    finishedOn: undefined,
    ...overrides,
  };
}
