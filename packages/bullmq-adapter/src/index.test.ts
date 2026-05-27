import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import type { QueueAdapter } from "@bullstudio/embedded-core";
import type { Queue } from "bullmq";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

describe("createBullMqQueueAdapter", () => {
  it("wraps a host-owned BullMQ queue with inferred identity and capabilities", () => {
    const queue = { name: "email" } as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    expectTypeOf(adapter).toMatchTypeOf<QueueAdapter>();
    expect(adapter).toMatchObject({
      key: "email",
      label: "email",
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
  });

  it("uses explicit queue key and label overrides", () => {
    const queue = { name: "email" } as Queue;

    const adapter = createBullMqQueueAdapter(queue, {
      key: "critical-email",
      label: "Critical email",
    });

    expect(adapter.key).toBe("critical-email");
    expect(adapter.label).toBe("Critical email");
  });

  it("reads queue state and counts from the supplied queue", async () => {
    const queue = {
      name: "email",
      opts: { prefix: "production" },
      isPaused: async () => true,
      getJobCounts: async () => ({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 4,
        delayed: 5,
        paused: 6,
        prioritized: 7,
        "waiting-children": 8,
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

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
        paused: 6,
        prioritized: 7,
        waitingChildren: 8,
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
          progress: 50,
          attemptsMade: 1,
          opts: { attempts: 3, delay: 10, priority: 2 },
          failedReason: undefined,
          stacktrace: [],
          returnvalue: { ok: true },
          timestamp: 100,
          processedOn: 110,
          finishedOn: undefined,
          parentKey: "bull:parent:42",
          repeatJobKey: "repeat:welcome",
          getState: async () => "active",
        },
      ],
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

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
        parentId: "42",
        repeatJobKey: "repeat:welcome",
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
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

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

  it("delegates job and queue operations without closing the supplied queue", async () => {
    const retry = vi.fn<() => Promise<void>>();
    const remove = vi.fn<() => Promise<void>>();
    const close = vi.fn<() => Promise<void>>();
    const queue = {
      name: "email",
      getJob: async () => ({
        id: "1",
        name: "welcome",
        data: {},
        progress: 0,
        attemptsMade: 0,
        opts: {},
        stacktrace: [],
        timestamp: 100,
        getState: async () => "waiting",
        retry,
        remove,
      }),
      getJobLogs: async () => ({ logs: ["created"], count: 1 }),
      pause: vi.fn<() => Promise<void>>(),
      resume: vi.fn<() => Promise<void>>(),
      getWorkers: async () => [{}, {}],
      close,
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

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
    await adapter.removeJob("1");
    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 2,
    });

    expect(queue.pause).toHaveBeenCalledOnce();
    expect(queue.resume).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(adapter).not.toHaveProperty("close");
    expect(adapter).not.toHaveProperty("disconnect");
  });
});

function createQueueJob(overrides: {
  id: string;
  name: string;
  timestamp: number;
}) {
  return {
    data: { userId: 123 },
    progress: 0,
    attemptsMade: 0,
    opts: {},
    failedReason: undefined,
    stacktrace: [],
    returnvalue: { ok: true },
    processedOn: undefined,
    finishedOn: undefined,
    getState: async () => "waiting",
    ...overrides,
  };
}
