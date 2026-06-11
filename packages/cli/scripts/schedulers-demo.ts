/**
 * Spins up a couple of job schedulers (cron + fixed interval) with live
 * workers so you can watch them produce and process jobs in real time on the
 * `/schedulers` screen.
 *
 * BullMQ (default):  npx tsx scripts/schedulers-demo.ts
 * Bull:              PROVIDER=bull npx tsx scripts/schedulers-demo.ts
 *
 * Point bullstudio at the same Redis, e.g.:
 *   REDIS_URL=redis://localhost:6379 pnpm start
 *
 * The process stays alive until you press Ctrl+C. Schedulers are left in Redis
 * on exit so you can keep inspecting them; pass --clean to remove them instead.
 */

import Bull from "bull";
import { Queue, Worker } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const PROVIDER = (process.env.PROVIDER || "bullmq").toLowerCase();
const CLEAN_ON_EXIT = process.argv.includes("--clean");

interface SchedulerSpec {
  queueName: string;
  schedulerId: string;
  jobName: string;
  /** Cron pattern (6-field, leading seconds) — mutually exclusive with `every`. */
  pattern?: string;
  /** Fixed interval in milliseconds. */
  every?: number;
  data: Record<string, unknown>;
  /** Roughly this share of runs will throw, to populate the failed state. */
  failRate?: number;
}

const SCHEDULERS: SchedulerSpec[] = [
  {
    queueName: "reports",
    schedulerId: "daily-report",
    jobName: "build-report",
    pattern: "*/20 * * * * *", // every 20 seconds
    data: { kind: "daily", format: "pdf" },
  },
  {
    queueName: "reports",
    schedulerId: "heartbeat",
    jobName: "heartbeat",
    every: 5_000, // every 5 seconds
    data: { source: "scheduler-demo" },
  },
  {
    queueName: "notifications",
    schedulerId: "digest",
    jobName: "send-digest",
    every: 8_000, // every 8 seconds
    data: { channel: "email", segment: "weekly-active" },
    failRate: 0.25,
  },
  {
    queueName: "notifications",
    schedulerId: "reminder",
    jobName: "send-reminder",
    pattern: "*/30 * * * * *", // every 30 seconds
    data: { channel: "push" },
  },
];

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

function queueNames(): string[] {
  return [...new Set(SCHEDULERS.map((spec) => spec.queueName))];
}

function specsFor(queueName: string): SchedulerSpec[] {
  return SCHEDULERS.filter((spec) => spec.queueName === queueName);
}

function describe(spec: SchedulerSpec): string {
  return spec.pattern ? `cron "${spec.pattern}"` : `every ${spec.every}ms`;
}

async function simulateWork(): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, 200 + Math.random() * 600),
  );
}

async function runBullMq(): Promise<() => Promise<void>> {
  const connection = parseRedisConnection(REDIS_URL);
  const queues = new Map<string, Queue>();
  const workers: Worker[] = [];

  for (const name of queueNames()) {
    queues.set(name, new Queue(name, { connection }));
  }

  for (const spec of SCHEDULERS) {
    const queue = queues.get(spec.queueName);
    if (!queue) {
      continue;
    }
    await queue.upsertJobScheduler(
      spec.schedulerId,
      spec.pattern ? { pattern: spec.pattern } : { every: spec.every },
      { name: spec.jobName, data: spec.data },
    );
    console.log(
      `  ✓ ${spec.queueName} → ${spec.schedulerId} (${describe(spec)})`,
    );
  }

  for (const name of queueNames()) {
    const failByName = new Map(
      specsFor(name).map((spec) => [spec.jobName, spec.failRate ?? 0]),
    );
    const worker = new Worker(
      name,
      async (job) => {
        console.log(`[${ts()}] ▶ ${name}/${job.name} (job ${job.id})`);
        await simulateWork();
        if (Math.random() < (failByName.get(job.name) ?? 0)) {
          throw new Error(`Simulated failure for ${job.name}`);
        }
        return { ok: true, at: Date.now() };
      },
      { connection },
    );
    worker.on("failed", (job, err) =>
      console.log(`[${ts()}] ✗ ${name}/${job?.name}: ${err.message}`),
    );
    workers.push(worker);
  }

  return async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    if (CLEAN_ON_EXIT) {
      for (const spec of SCHEDULERS) {
        await queues
          .get(spec.queueName)
          ?.removeJobScheduler(spec.schedulerId)
          .catch(() => {});
      }
    }
    await Promise.all([...queues.values()].map((queue) => queue.close()));
  };
}

async function runBull(): Promise<() => Promise<void>> {
  const queues = new Map<string, Bull.Queue>();

  for (const name of queueNames()) {
    queues.set(name, new Bull(name, REDIS_URL));
  }

  for (const spec of SCHEDULERS) {
    const queue = queues.get(spec.queueName);
    if (!queue) {
      continue;
    }
    await queue.add(spec.jobName, spec.data, {
      jobId: spec.schedulerId,
      repeat: spec.pattern
        ? { cron: spec.pattern }
        : { every: spec.every ?? 0 },
    });
    console.log(
      `  ✓ ${spec.queueName} → ${spec.schedulerId} (${describe(spec)})`,
    );
  }

  for (const name of queueNames()) {
    const queue = queues.get(name);
    if (!queue) {
      continue;
    }
    for (const spec of specsFor(name)) {
      queue.process(spec.jobName, async (job) => {
        console.log(`[${ts()}] ▶ ${name}/${job.name} (job ${job.id})`);
        await simulateWork();
        if (Math.random() < (spec.failRate ?? 0)) {
          throw new Error(`Simulated failure for ${spec.jobName}`);
        }
        return { ok: true, at: Date.now() };
      });
    }
    queue.on("failed", (job, err) =>
      console.log(`[${ts()}] ✗ ${name}/${job.name}: ${err.message}`),
    );
  }

  return async () => {
    if (CLEAN_ON_EXIT) {
      for (const queue of queues.values()) {
        const repeatables = await queue.getRepeatableJobs();
        for (const repeatable of repeatables) {
          await queue.removeRepeatableByKey(repeatable.key).catch(() => {});
        }
      }
    }
    await Promise.all([...queues.values()].map((queue) => queue.close()));
  };
}

function parseRedisConnection(url: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db:
      parsed.pathname && parsed.pathname !== "/"
        ? Number(parsed.pathname.slice(1))
        : undefined,
  };
}

async function main(): Promise<void> {
  if (PROVIDER !== "bullmq" && PROVIDER !== "bull") {
    throw new Error(`Unknown PROVIDER "${PROVIDER}". Use "bullmq" or "bull".`);
  }

  console.log(`Job scheduler demo (${PROVIDER})`);
  console.log(`Redis: ${REDIS_URL}\n`);
  console.log("Registering schedulers:");

  const shutdown = PROVIDER === "bull" ? await runBull() : await runBullMq();

  console.log("\nWorkers are running. Watching jobs in real time...");
  console.log("Open bullstudio and visit /schedulers to manage them.");
  console.log("Press Ctrl+C to stop.\n");

  let stopping = false;
  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log("\nShutting down...");
    await shutdown().catch((error) => console.error("Shutdown error:", error));
    console.log(
      CLEAN_ON_EXIT
        ? "Schedulers removed. Done."
        : "Schedulers left in Redis. Done.",
    );
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
