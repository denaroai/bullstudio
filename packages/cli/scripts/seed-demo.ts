/**
 * Seeds a realistic, production-ish BullMQ setup into Redis so every bullstudio
 * screen (queues, jobs, schedulers, flows, workers) has convincing demo data.
 *
 * Creates ~7 queues with mixed job states (waiting / active / completed /
 * failed / delayed / paused), several job schedulers (cron + fixed interval),
 * and a batch of multi-level parent/child flows.
 *
 * The backlog is dripped in gradually over ~30 minutes (SEED_SPREAD_MINUTES)
 * while workers run, so completed/failed timestamps and throughput metrics span
 * a realistic timespan instead of a single instant.
 *
 * Snapshot (default): drip the backlog over the window, then print a summary
 *                     and exit. Shorten the window for a quick run:
 *   npx tsx scripts/seed-demo.ts
 *   SEED_SPREAD_MINUTES=2 npx tsx scripts/seed-demo.ts
 *
 * Live: keep workers + schedulers running so the dashboard updates in realtime.
 *   npx tsx scripts/seed-demo.ts --live
 *   npx tsx scripts/seed-demo.ts --live --clean   # remove schedulers on exit
 *
 * Point bullstudio at the same Redis, e.g.:
 *   REDIS_URL=redis://localhost:6379 pnpm --filter @bullstudio/standalone dev
 *
 * Re-running appends jobs and upserts schedulers. To reset, flush Redis
 * (`redis-cli flushall`) before seeding again.
 */

import {
  type ConnectionOptions,
  FlowProducer,
  type JobsOptions,
  MetricsTime,
  Queue,
  Worker,
} from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const LIVE = process.argv.includes("--live");
const CLEAN_ON_EXIT = process.argv.includes("--clean");

/**
 * Wall-clock window over which the backlog is dripped in (workers run the whole
 * time), so completed/failed timestamps and throughput metrics span a realistic
 * range instead of a single instant. Override with SEED_SPREAD_MINUTES.
 */
const SPREAD_MS = (Number(process.env.SEED_SPREAD_MINUTES) || 30) * 60_000;

/** How often a drip batch is enqueued; ~120 ticks across the window. */
const TICK_MS = Math.min(15_000, Math.max(2_000, Math.round(SPREAD_MS / 120)));

// ---------------------------------------------------------------------------
// Domain model — a production-ish SaaS backend.
// ---------------------------------------------------------------------------

interface JobType {
  name: string;
  /** Share of runs that throw, to populate the failed state. */
  failRate?: number;
}

interface QueueSpec {
  name: string;
  jobTypes: JobType[];
  /** Rough backlog size to enqueue. */
  backlog: number;
  /** Worker concurrency for the snapshot/live processing pass. */
  concurrency: number;
}

const QUEUES: QueueSpec[] = [
  {
    name: "email",
    backlog: 320,
    concurrency: 5,
    jobTypes: [
      { name: "send-welcome" },
      { name: "send-password-reset" },
      { name: "send-receipt", failRate: 0.05 },
      { name: "send-digest" },
    ],
  },
  {
    name: "payments",
    backlog: 220,
    concurrency: 4,
    jobTypes: [
      { name: "charge-card", failRate: 0.18 },
      { name: "issue-refund", failRate: 0.08 },
      { name: "reconcile-ledger" },
    ],
  },
  {
    name: "notifications",
    backlog: 400,
    concurrency: 6,
    jobTypes: [
      { name: "push-notification", failRate: 0.12 },
      { name: "send-sms", failRate: 0.1 },
      { name: "in-app-alert" },
    ],
  },
  {
    name: "media-processing",
    backlog: 160,
    concurrency: 3,
    jobTypes: [
      { name: "transcode-video", failRate: 0.15 },
      { name: "generate-thumbnail" },
      { name: "compress-image" },
    ],
  },
  {
    name: "data-sync",
    backlog: 180,
    concurrency: 4,
    jobTypes: [
      { name: "sync-crm", failRate: 0.2 },
      { name: "import-csv", failRate: 0.1 },
      { name: "rebuild-search-index" },
    ],
  },
  {
    name: "reports",
    backlog: 90,
    concurrency: 2,
    jobTypes: [
      { name: "build-report" },
      { name: "export-analytics", failRate: 0.07 },
    ],
  },
  {
    name: "webhooks",
    backlog: 280,
    concurrency: 6,
    jobTypes: [
      { name: "deliver-webhook", failRate: 0.25 },
      { name: "retry-webhook", failRate: 0.3 },
    ],
  },
];

interface SchedulerSpec {
  queueName: string;
  schedulerId: string;
  jobName: string;
  pattern?: string;
  every?: number;
  data: Record<string, unknown>;
}

const SCHEDULERS: SchedulerSpec[] = [
  {
    queueName: "reports",
    schedulerId: "daily-report",
    jobName: "build-report",
    pattern: "0 6 * * *", // 06:00 every day
    data: { kind: "daily", format: "pdf" },
  },
  {
    queueName: "notifications",
    schedulerId: "email-digest",
    jobName: "send-digest",
    every: 30_000,
    data: { channel: "email", segment: "weekly-active" },
  },
  {
    queueName: "data-sync",
    schedulerId: "crm-sync",
    jobName: "sync-crm",
    pattern: "*/15 * * * *", // every 15 minutes
    data: { provider: "salesforce", mode: "incremental" },
  },
  {
    queueName: "webhooks",
    schedulerId: "heartbeat",
    jobName: "deliver-webhook",
    every: 5_000,
    data: { source: "scheduler", event: "heartbeat" },
  },
];

/** The queue used as the host for flow children. */
const FLOW_QUEUE = "media-processing";
const FLOW_COUNT = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRedisConnection(url: string): ConnectionOptions {
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) {
    throw new Error("Cannot pick a random element from an empty array");
  }
  return item;
}

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

function generateJobData(): Record<string, unknown> {
  return {
    userId: `user_${randomInt(1000, 9999)}`,
    email: `user${randomInt(1, 5000)}@example.com`,
    amount: randomInt(5, 2500),
    currency: randomElement(["USD", "EUR", "GBP", "JPY"]),
    metadata: {
      source: randomElement(["web", "mobile", "api", "cron"]),
      region: randomElement(["us-east", "us-west", "eu-west", "ap-south"]),
      requestId: `req_${randomInt(100000, 999999)}`,
    },
  };
}

/** Returns options that scatter jobs across waiting/delayed/priority/retry. */
function randomJobOptions(): JobsOptions {
  const rand = Math.random();
  if (rand < 0.35) {
    // plain — picked up by workers, ends completed/failed/active/waiting
    return {};
  }
  if (rand < 0.55) {
    // delayed (5s – 2h)
    return { delay: randomInt(5_000, 2 * 60 * 60 * 1000) };
  }
  if (rand < 0.72) {
    return { priority: randomInt(1, 10) };
  }
  if (rand < 0.9) {
    return {
      attempts: randomInt(2, 5),
      backoff: { type: "exponential", delay: 1000 },
    };
  }
  // bounded retention so completed/failed lists stay realistic
  return { removeOnComplete: 1000, removeOnFail: 500, attempts: 2 };
}

async function simulateWork(): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, 150 + Math.random() * 650),
  );
}

// ---------------------------------------------------------------------------
// Seeding steps
// ---------------------------------------------------------------------------

function buildQueues(connection: ConnectionOptions): Map<string, Queue> {
  const queues = new Map<string, Queue>();
  for (const spec of QUEUES) {
    queues.set(spec.name, new Queue(spec.name, { connection }));
  }
  return queues;
}

interface DripJob {
  name: string;
  data: Record<string, unknown>;
  opts: JobsOptions;
}

/** Builds a queue's backlog already bucketed into one array per tick. */
function planDrip(spec: QueueSpec, ticks: number): DripJob[][] {
  const buckets: DripJob[][] = Array.from({ length: ticks }, () => []);
  for (let i = 0; i < spec.backlog; i++) {
    const jobType = randomElement(spec.jobTypes);
    const tick = randomInt(0, ticks - 1);
    buckets[tick]?.push({
      name: jobType.name,
      data: generateJobData(),
      opts: randomJobOptions(),
    });
  }
  return buckets;
}

/**
 * Enqueues every queue's backlog gradually over SPREAD_MS while the already
 * running workers consume it, so the data spans a realistic timespan.
 */
async function dripBacklog(queues: Map<string, Queue>): Promise<void> {
  const ticks = Math.max(1, Math.round(SPREAD_MS / TICK_MS));
  const total = QUEUES.reduce((sum, spec) => sum + spec.backlog, 0);
  const plans = QUEUES.map((spec) => ({
    spec,
    buckets: planDrip(spec, ticks),
  }));
  console.log(
    `  dripping ~${total} jobs over ${Math.round(SPREAD_MS / 60_000)}m ` +
      `(${ticks} ticks, every ${Math.round(TICK_MS / 1000)}s)`,
  );

  let enqueued = 0;
  for (let tick = 0; tick < ticks; tick++) {
    for (const { spec, buckets } of plans) {
      const batch = buckets[tick];
      if (!batch || batch.length === 0) {
        continue;
      }
      await queues.get(spec.name)?.addBulk(batch);
      enqueued += batch.length;
    }
    if (tick % 10 === 0 || tick === ticks - 1) {
      console.log(`  [${ts()}] enqueued ${enqueued}/${total}`);
    }
    if (tick < ticks - 1) {
      await new Promise((resolve) => setTimeout(resolve, TICK_MS));
    }
  }
}

async function seedSchedulers(queues: Map<string, Queue>): Promise<void> {
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
    const cadence = spec.pattern
      ? `cron "${spec.pattern}"`
      : `every ${spec.every}ms`;
    console.log(`  ✓ ${spec.queueName} → ${spec.schedulerId} (${cadence})`);
  }
}

async function seedFlows(connection: ConnectionOptions): Promise<void> {
  const flowProducer = new FlowProducer({ connection });
  const flowOpts: JobsOptions = {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  };

  for (let i = 0; i < FLOW_COUNT; i++) {
    const orderId = `order_${randomInt(10000, 99999)}`;
    await flowProducer.add({
      name: "fulfill-order-flow",
      queueName: FLOW_QUEUE,
      data: { orderId, items: randomInt(1, 6) },
      opts: flowOpts,
      children: [
        {
          name: "charge-payment",
          queueName: "payments",
          data: { orderId, amount: randomInt(20, 900) },
          opts: flowOpts,
        },
        {
          name: "render-assets",
          queueName: FLOW_QUEUE,
          data: { orderId },
          opts: flowOpts,
          children: [
            {
              name: "generate-thumbnail",
              queueName: FLOW_QUEUE,
              data: { orderId, size: "medium" },
            },
            {
              name: "compress-image",
              queueName: FLOW_QUEUE,
              data: { orderId, quality: 80 },
            },
          ],
        },
        {
          name: "notify-customer",
          queueName: "notifications",
          data: { orderId, channel: randomElement(["email", "push", "sms"]) },
          opts: flowOpts,
        },
      ],
    });
  }
  await flowProducer.close();
  console.log(`  ✓ created ${FLOW_COUNT} multi-level flows`);
}

function startWorkers(connection: ConnectionOptions): Worker[] {
  return QUEUES.map((spec) => {
    const failByName = new Map(
      spec.jobTypes.map((jobType) => [jobType.name, jobType.failRate ?? 0]),
    );
    const worker = new Worker(
      spec.name,
      async (job) => {
        await simulateWork();
        if (Math.random() < (failByName.get(job.name) ?? 0)) {
          throw new Error(`Simulated failure for ${spec.name}/${job.name}`);
        }
        return { ok: true, at: Date.now() };
      },
      {
        connection,
        concurrency: spec.concurrency,
        //metrics: { maxDataPoints: MetricsTime.ONE_WEEK },
      },
    );
    worker.on("failed", (job, err) =>
      console.log(`[${ts()}] ✗ ${spec.name}/${job?.name}: ${err.message}`),
    );
    return worker;
  });
}

async function printSummary(queues: Map<string, Queue>): Promise<void> {
  console.log("\n=== Summary ===");
  for (const [name, queue] of queues) {
    const c = await queue.getJobCounts();
    const paused = (await queue.isPaused()) ? " (paused)" : "";
    console.log(
      `${name}${paused}: waiting ${c.waiting ?? 0}, active ${c.active ?? 0}, ` +
        `completed ${c.completed ?? 0}, failed ${c.failed ?? 0}, ` +
        `delayed ${c.delayed ?? 0}, waiting-children ${c["waiting-children"] ?? 0}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const connection = parseRedisConnection(REDIS_URL);

  console.log(`Seeding bullstudio demo data (${LIVE ? "live" : "snapshot"})`);
  console.log(`Redis: ${REDIS_URL}\n`);

  const queues = buildQueues(connection);

  console.log("Registering schedulers:");
  await seedSchedulers(queues);

  console.log("\nCreating flows:");
  await seedFlows(connection);

  console.log("\nStarting workers and dripping in the backlog:");
  const workers = startWorkers(connection);
  await dripBacklog(queues);

  // Leave one queue paused so the dashboard shows a paused state.
  await queues.get("webhooks")?.pause();

  await printSummary(queues);

  if (LIVE) {
    console.log(
      "\nLive mode: workers + schedulers running. Press Ctrl+C to stop.",
    );
    let stopping = false;
    const stop = async () => {
      if (stopping) {
        return;
      }
      stopping = true;
      console.log("\nShutting down...");
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
      console.log("Done.");
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    return;
  }

  console.log("\nFreezing snapshot...");
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all([...queues.values()].map((queue) => queue.close()));

  console.log("\nDone! Point bullstudio at the same Redis to inspect:");
  console.log(
    `  REDIS_URL=${REDIS_URL} pnpm --filter @bullstudio/standalone dev`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
