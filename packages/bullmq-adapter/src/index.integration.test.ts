import { randomBytes } from "node:crypto";
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { type ConnectionOptions, FlowProducer, Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";

describe("createBullMqQueueAdapter with Redis", () => {
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
    const prefix = uniquePrefix("bullmq-adapter");
    const queue = track(new Queue("email", { prefix, connection }));
    const adapter = createBullMqQueueAdapter(queue);

    await processBullMqJob({
      prefix,
      name: "email",
      jobName: "complete-me",
      shouldFail: false,
    });
    await processBullMqJob({
      prefix,
      name: "email",
      jobName: "fail-me",
      shouldFail: true,
    });
    const waitingJob = await queue.add(
      "welcome",
      { userId: 123 },
      { attempts: 3, delay: 0 },
    );
    await waitingJob.updateProgress(50);
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

    await expect(
      adapter.getJob(waitingJob.id as string),
    ).resolves.toMatchObject({
      id: waitingJob.id,
      name: "welcome",
      queueName: "email",
      data: { userId: 123 },
      status: "waiting",
      progress: 50,
      attemptsMade: 0,
      attemptsLimit: 3,
      delay: 0,
    });
    await expect(adapter.getJobLogs(waitingJob.id as string)).resolves.toEqual({
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
    const prefix = uniquePrefix("bullmq-adapter");
    const queue = track(new Queue("ops", { prefix, connection }));
    const adapter = createBullMqQueueAdapter(queue);
    const job = await queue.add("retryable", { attempt: 1 });

    await adapter.pauseQueue();
    await expect(queue.isPaused()).resolves.toBe(true);
    await adapter.resumeQueue();
    await expect(queue.isPaused()).resolves.toBe(false);

    await adapter.removeJob(job.id as string);
    await expect(adapter.getJob(job.id as string)).resolves.toBeNull();

    const failedJobId = await processBullMqJob({
      prefix,
      name: "ops",
      jobName: "retry-me",
      shouldFail: true,
    });
    await adapter.retryJob(failedJobId);
    await expect(queue.getJobState(failedJobId)).resolves.toBe("waiting");

    expect(adapter).not.toHaveProperty("close");
    await expect(queue.isPaused()).resolves.toBe(false);
  });

  it("lists and reads real BullMQ flows from the supplied queue", async () => {
    const prefix = uniquePrefix("bullmq-adapter");
    const queue = track(new Queue("parent", { prefix, connection }));
    const flowProducer = track(new FlowProducer({ prefix, connection }));
    const adapter = createBullMqQueueAdapter(queue);

    const flow = await flowProducer.add({
      name: "send-campaign",
      queueName: "parent",
      data: { campaignId: 7 },
      children: [
        {
          name: "send-email",
          queueName: "child",
          data: { channel: "email" },
        },
      ],
    });
    const flowId = flow.job.id as string;

    await expect(adapter.listFlows?.()).resolves.toEqual([
      expect.objectContaining({
        id: flowId,
        name: "send-campaign",
        queueName: "parent",
        prefix,
        status: "waiting-children",
        totalJobs: 2,
        completedJobs: 0,
        failedJobs: 0,
      }),
    ]);

    await expect(adapter.getFlow?.(flowId)).resolves.toMatchObject({
      id: flowId,
      queueName: "parent",
      totalNodes: 2,
      completedNodes: 0,
      failedNodes: 0,
      root: {
        id: flowId,
        name: "send-campaign",
        queueName: "parent",
        status: "waiting-children",
        data: { campaignId: 7 },
        children: [
          {
            name: "send-email",
            queueName: "child",
            status: "waiting",
            data: { channel: "email" },
            children: [],
          },
        ],
      },
    });
  });

  async function processBullMqJob(options: {
    prefix: string;
    name: string;
    jobName: string;
    shouldFail: boolean;
  }): Promise<string> {
    const queue = new Queue(options.name, {
      prefix: options.prefix,
      connection,
    });
    const job = await queue.add(options.jobName, { processed: true });
    const worker = new Worker(
      options.name,
      async () => {
        if (options.shouldFail) {
          throw new Error("simulated failure");
        }
        return { ok: true };
      },
      { prefix: options.prefix, connection },
    );

    try {
      await waitForBullMqJob(
        queue,
        job.id as string,
        options.shouldFail ? "failed" : "completed",
      );
      return job.id as string;
    } finally {
      await worker.close().catch(() => {});
      await queue.close().catch(() => {});
    }
  }

  function track<T extends { close: () => Promise<void> }>(resource: T): T {
    cleanup.push(() => resource.close());
    return resource;
  }
});

const connection = parseRedisUrl(TEST_REDIS_URL);

function createRedis(): Redis {
  return new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
    retryStrategy: () => null,
  });
}

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db:
      parsed.pathname && parsed.pathname !== "/"
        ? Number(parsed.pathname.slice(1))
        : 0,
    maxRetriesPerRequest: null,
  };
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

async function waitForBullMqJob(
  queue: Queue,
  jobId: string,
  state: "completed" | "failed",
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 5_000) {
    if ((await queue.getJobState(jobId)) === state) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for BullMQ job to become ${state}.`);
}
