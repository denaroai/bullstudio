import { randomBytes } from "node:crypto";
import { createBullQueueAdapter } from "@bullstudio/bull-adapter";
import Bull from "bull";
import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";

describe("createBullQueueAdapter with Redis", () => {
  let redis: Redis;
  const cleanup: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    redis = createRedis();
    try {
      await redis.ping();
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot reach test Redis at ${TEST_REDIS_URL}: ${cause}\n` +
          "Start it with: docker compose -f docker-compose.test.yml up -d",
      );
    }
  });

  afterAll(async () => {
    await closeTrackedResources(cleanup);
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    await closeTrackedResources(cleanup);
    await redis.flushdb();
  });

  it("maps real queue state, counts, job fields, summaries, and logs", async () => {
    const prefix = uniquePrefix("bull-adapter");
    await processBullJob({
      prefix,
      name: "email",
      jobName: "complete-me",
      shouldFail: false,
    });
    await processBullJob({
      prefix,
      name: "email",
      jobName: "fail-me",
      shouldFail: true,
    });

    const queue = track(createQueue("email", prefix));
    await queue.isReady();
    const adapter = createBullQueueAdapter(queue);

    const waitingJob = await queue.add(
      "welcome",
      { userId: 123 },
      { attempts: 3, priority: 2 },
    );
    await waitingJob.progress(50);
    await waitingJob.log("created");
    await queue.add("digest", { userId: 456 }, { delay: 60_000 });

    await expect(adapter.getQueue()).resolves.toMatchObject({
      name: "email",
      prefix,
      isPaused: false,
      jobCounts: {
        waiting: 1,
        completed: 1,
        failed: 1,
        delayed: 1,
      },
    });

    await expect(adapter.getJob(String(waitingJob.id))).resolves.toMatchObject({
      id: String(waitingJob.id),
      name: "welcome",
      queueName: "email",
      data: { userId: 123 },
      status: "waiting",
      progress: 50,
      attemptsMade: 0,
      attemptsLimit: 3,
      priority: 2,
    });
    await expect(adapter.getJobLogs(String(waitingJob.id))).resolves.toEqual({
      logs: ["created"],
      count: 1,
    });

    const completed = await adapter.getJobs({
      filter: { status: "completed" },
    });
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      name: "complete-me",
      status: "completed",
      returnValue: { ok: true },
    });

    const failedSummary = await adapter.getJobsSummary({
      filter: { status: "failed" },
    });
    expect(failedSummary).toHaveLength(1);
    expect(failedSummary[0]).toMatchObject({
      name: "fail-me",
      status: "failed",
      failedReason: "simulated failure",
    });
    expect(failedSummary[0]).not.toHaveProperty("data");
    expect(failedSummary[0]).not.toHaveProperty("returnValue");
    expect(failedSummary[0]).not.toHaveProperty("stacktrace");
  });

  it("mutates the supplied host-owned queue without taking ownership of it", async () => {
    const prefix = uniquePrefix("bull-adapter");
    const queue = track(createQueue("ops", prefix));
    await queue.isReady();
    const adapter = createBullQueueAdapter(queue);
    const job = await queue.add("remove-me", { attempt: 1 });

    await adapter.pauseQueue();
    await expect(queue.isPaused()).resolves.toBe(true);
    await adapter.resumeQueue();
    await expect(queue.isPaused()).resolves.toBe(false);

    await adapter.removeJob(String(job.id));
    await expect(queue.getJob(job.id)).resolves.toBeNull();

    const failedJobId = await processBullJob({
      prefix,
      name: "ops",
      jobName: "retry-me",
      shouldFail: true,
    });
    await adapter.retryJob(failedJobId);
    const retried = await queue.getJob(failedJobId);
    await expect(retried?.getState()).resolves.toBe("waiting");

    expect(adapter).not.toHaveProperty("close");
    await expect(queue.isPaused()).resolves.toBe(false);
  });

  it("creates, lists, updates, and removes repeatable job schedulers", async () => {
    const prefix = uniquePrefix("bull-adapter");
    const queue = track(createQueue("reports", prefix));
    await queue.isReady();
    const adapter = createBullQueueAdapter(queue);

    await adapter.upsertJobScheduler?.({
      schedulerId: "daily-report",
      repeat: { strategy: "cron", pattern: "0 15 3 * * *", tz: "UTC" },
      template: { name: "build-report", data: { kind: "daily" } },
    });
    await adapter.upsertJobScheduler?.({
      schedulerId: "heartbeat",
      repeat: { strategy: "every", every: 5_000 },
      template: { name: "ping" },
    });

    const schedulers = (await adapter.listJobSchedulers?.()) ?? [];
    expect(schedulers).toHaveLength(2);
    expect(schedulers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "daily-report",
          name: "build-report",
          queueName: "reports",
          prefix,
          strategy: "cron",
          pattern: "0 15 3 * * *",
          tz: "UTC",
        }),
        expect.objectContaining({
          id: "heartbeat",
          name: "ping",
          strategy: "every",
          every: 5_000,
        }),
      ]),
    );

    // Bull has no native upsert: editing replaces the previous repeatable.
    const heartbeat = schedulers.find(
      (scheduler) => scheduler.id === "heartbeat",
    );
    await adapter.upsertJobScheduler?.({
      schedulerId: "heartbeat",
      previousKey: heartbeat?.key,
      repeat: { strategy: "every", every: 10_000 },
      template: { name: "ping" },
    });

    const afterUpdate = (await adapter.listJobSchedulers?.()) ?? [];
    expect(afterUpdate).toHaveLength(2);
    expect(
      afterUpdate.find((scheduler) => scheduler.id === "heartbeat"),
    ).toMatchObject({ every: 10_000 });

    const daily = afterUpdate.find(
      (scheduler) => scheduler.id === "daily-report",
    );
    await expect(
      adapter.removeJobScheduler?.({
        key: daily?.key ?? "",
        id: daily?.id,
      }),
    ).resolves.toBe(true);

    const remaining = (await adapter.listJobSchedulers?.()) ?? [];
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: "heartbeat", every: 10_000 });
  });

  async function processBullJob(options: {
    prefix: string;
    name: string;
    jobName: string;
    shouldFail: boolean;
  }): Promise<string> {
    const queue = createQueue(options.name, options.prefix);
    await queue.isReady();
    const job = await queue.add(options.jobName, { processed: true });

    queue.process(options.jobName, async () => {
      if (options.shouldFail) {
        throw new Error("simulated failure");
      }
      return { ok: true };
    });

    try {
      await waitForBullJob(
        queue,
        String(job.id),
        options.shouldFail ? "failed" : "completed",
      );
      return String(job.id);
    } finally {
      await queue.close().catch(() => {});
    }
  }

  function track<T extends { close: () => Promise<void> }>(resource: T): T {
    cleanup.push(() => resource.close());
    return resource;
  }
});

function createQueue(name: string, prefix: string): Bull.Queue {
  return new Bull(name, {
    createClient: (type) => {
      if (type === "client") {
        return new Redis(TEST_REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });
      }

      return new Redis(TEST_REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    },
    prefix,
  });
}

function createRedis(): Redis {
  return new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
    retryStrategy: () => null,
  });
}

function uniquePrefix(base: string): string {
  return `${base}-${randomBytes(4).toString("hex")}`;
}

async function closeTrackedResources(
  cleanup: Array<() => Promise<void>>,
): Promise<void> {
  while (cleanup.length > 0) {
    const close = cleanup.pop();
    if (close) {
      await close().catch(() => {});
    }
  }
}

async function waitForBullJob(
  queue: Bull.Queue,
  jobId: string,
  state: "completed" | "failed",
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 5_000) {
    const job = await queue.getJob(jobId);
    if ((await job?.getState()) === state) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for Bull job to become ${state}.`);
}
