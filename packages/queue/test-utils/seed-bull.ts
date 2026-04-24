import Bull from "bull";
import Redis from "ioredis";
import { TEST_REDIS_URL } from "./redis";

export interface SeedBullJob {
  name?: string;
  data?: Record<string, unknown>;
  opts?: Bull.JobOptions;
}

export interface SeedBullOptions {
  prefix: string;
  name: string;
  jobs?: SeedBullJob[];
  redisUrl?: string;
}

const DEFAULT_JOBS: SeedBullJob[] = [
  { name: "job-a", data: { i: 0 } },
  { name: "job-b", data: { i: 1 } },
];

export interface SeededBullQueue {
  queue: Bull.Queue;
  close: () => Promise<void>;
}

export async function seedBullQueue(
  options: SeedBullOptions,
): Promise<SeededBullQueue> {
  const { prefix, name, jobs = DEFAULT_JOBS } = options;
  const redisUrl = options.redisUrl ?? TEST_REDIS_URL;

  const queue = new Bull(name, {
    createClient: (type) => {
      if (type === "client") {
        return new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });
      }
      return new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
    },
    prefix,
  });

  await queue.isReady();

  for (const job of jobs) {
    if (job.name) {
      await queue.add(job.name, job.data ?? {}, job.opts);
    } else {
      await queue.add(job.data ?? {}, job.opts);
    }
  }

  return {
    queue,
    close: async () => {
      await queue.close();
    },
  };
}
