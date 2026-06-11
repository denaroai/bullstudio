import {
  type ConnectionOptions,
  type JobsOptions,
  Queue,
  Worker,
} from "bullmq";
import { TEST_REDIS_URL } from "./redis";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const db =
    parsed.pathname && parsed.pathname !== "/"
      ? Number(parsed.pathname.slice(1))
      : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db,
    maxRetriesPerRequest: null,
  };
}

export interface SeedJob {
  name: string;
  data?: Record<string, unknown>;
  opts?: JobsOptions;
}

export interface SeedBullMqOptions {
  prefix: string;
  name: string;
  jobs?: SeedJob[];
  /** Defaults to TEST_REDIS_URL. */
  redisUrl?: string;
}

const DEFAULT_JOBS: SeedJob[] = [
  { name: "job-a", data: { i: 0 } },
  { name: "job-b", data: { i: 1 } },
  { name: "job-c", data: { i: 2 } },
];

export interface SeededQueue {
  queue: Queue;
  close: () => Promise<void>;
}

export async function seedBullMqQueue(
  options: SeedBullMqOptions,
): Promise<SeededQueue> {
  const { prefix, name, jobs = DEFAULT_JOBS } = options;
  const connection = parseRedisUrl(options.redisUrl ?? TEST_REDIS_URL);
  const queue = new Queue(name, { prefix, connection });

  for (const job of jobs) {
    await queue.add(job.name, job.data ?? {}, job.opts);
  }

  return {
    queue,
    close: async () => {
      await queue.close();
    },
  };
}

export interface ProcessedJobs {
  completed: number;
  failed: number;
}

/**
 * Seed a queue and run a short-lived worker that processes `count` jobs,
 * then closes. Use when tests need completed/failed jobs in Redis.
 */
export async function seedBullMqProcessed(options: {
  prefix: string;
  name: string;
  count: number;
  shouldFail?: boolean;
  redisUrl?: string;
}): Promise<ProcessedJobs> {
  const { prefix, name, count, shouldFail = false } = options;
  const connection = parseRedisUrl(options.redisUrl ?? TEST_REDIS_URL);
  const queue = new Queue(name, { prefix, connection });

  for (let i = 0; i < count; i++) {
    await queue.add(`proc-${i}`, { i });
  }

  const counts: ProcessedJobs = { completed: 0, failed: 0 };

  const worker = new Worker(
    name,
    async () => {
      if (shouldFail) {
        throw new Error("seedBullMqProcessed: simulated failure");
      }
      return { ok: true };
    },
    { prefix, connection, concurrency: 4 },
  );

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      worker.off("completed", onCompleted);
      worker.off("failed", onFailed);
      worker.off("error", onError);
    };
    const check = () => {
      if (counts.completed + counts.failed >= count) {
        cleanup();
        resolve();
      }
    };
    const onCompleted = () => {
      counts.completed++;
      check();
    };
    const onFailed = () => {
      counts.failed++;
      check();
    };
    const onError = (err: Error) => {
      // Ignore BullMQ internal lock errors that can surface after a throw.
      if (err?.message?.includes("Missing lock for job")) return;
      cleanup();
      reject(err);
    };
    worker.on("completed", onCompleted);
    worker.on("failed", onFailed);
    worker.on("error", onError);
  });

  await worker.close();
  await queue.close();
  return counts;
}
