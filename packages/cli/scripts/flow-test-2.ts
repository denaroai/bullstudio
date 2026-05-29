import { FlowProducer, type Job, Queue, Worker } from "bullmq";

const connection = { host: "localhost", port: 6379 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const shouldFail = (probability: number = 0.15) => Math.random() < probability;

const jobTypes = [
  "process-payment",
  "send-email",
  "generate-report",
  "sync-inventory",
  "update-analytics",
  "compress-image",
  "validate-data",
  "notify-user",
  "backup-database",
  "calculate-metrics",
] as const;

type JobType = (typeof jobTypes)[number];

interface JobData {
  type: JobType;
  userId?: string;
  payload: Record<string, unknown>;
  priority: "low" | "medium" | "high";
  retryCount?: number;
}

const generateJobData = (type: JobType, index: number): JobData => {
  const payloads: Record<JobType, () => Record<string, unknown>> = {
    "process-payment": () => ({
      amount: randomBetween(10, 5000),
      currency: ["USD", "EUR", "GBP"][randomBetween(0, 2)],
      orderId: `ORD-${Date.now()}-${index}`,
    }),
    "send-email": () => ({
      template: ["welcome", "receipt", "reminder", "promo"][randomBetween(0, 3)],
      recipientCount: randomBetween(1, 100),
    }),
    "generate-report": () => ({
      reportType: ["sales", "inventory", "analytics"][randomBetween(0, 2)],
      dateRange: { start: "2024-01-01", end: "2024-12-31" },
      format: ["pdf", "csv", "xlsx"][randomBetween(0, 2)],
    }),
    "sync-inventory": () => ({
      warehouseId: `WH-${randomBetween(1, 10)}`,
      itemCount: randomBetween(50, 500),
    }),
    "update-analytics": () => ({
      eventType: ["pageview", "click", "conversion"][randomBetween(0, 2)],
      batchSize: randomBetween(100, 10000),
    }),
    "compress-image": () => ({
      imageUrl: `https://example.com/images/${randomBetween(1000, 9999)}.jpg`,
      quality: randomBetween(60, 95),
      targetSize: randomBetween(100, 500),
    }),
    "validate-data": () => ({
      recordCount: randomBetween(100, 5000),
      schema: "user-profile",
    }),
    "notify-user": () => ({
      channel: ["push", "sms", "in-app"][randomBetween(0, 2)],
      messageType: ["alert", "info", "promo"][randomBetween(0, 2)],
    }),
    "backup-database": () => ({
      tables: randomBetween(5, 20),
      estimatedSize: `${randomBetween(10, 500)}MB`,
    }),
    "calculate-metrics": () => ({
      metricType: ["revenue", "churn", "engagement"][randomBetween(0, 2)],
      aggregation: ["daily", "weekly", "monthly"][randomBetween(0, 2)],
    }),
  };

  return {
    type,
    userId: `user-${randomBetween(1000, 9999)}`,
    payload: payloads[type](),
    priority: ["low", "medium", "high"][randomBetween(0, 2)] as JobData["priority"],
  };
};

const processJob = async (job: Job<JobData>): Promise<{ success: boolean; result: unknown }> => {
  const { type, payload, priority } = job.data;

  console.log(`[Worker] Starting job ${job.id} - ${type} (${priority} priority)`);

  const baseTime = {
    low: randomBetween(500, 1500),
    medium: randomBetween(1000, 3000),
    high: randomBetween(2000, 5000),
  }[priority];

  const steps = randomBetween(3, 6);
  const stepTime = Math.floor(baseTime / steps);

  for (let i = 1; i <= steps; i++) {
    await sleep(stepTime);
    const progress = Math.floor((i / steps) * 100);
    await job.updateProgress(progress);
    console.log(`[Worker] Job ${job.id} - ${type}: ${progress}% complete`);

    if (i === Math.floor(steps / 2) && shouldFail(0.2)) {
      const errorTypes = [
        "Connection timeout",
        "Rate limit exceeded",
        "Invalid data format",
        "Service unavailable",
        "Authentication failed",
      ];
      const error = errorTypes[randomBetween(0, errorTypes.length - 1)];
      console.log(`[Worker] Job ${job.id} - ${type}: FAILED - ${error}`);
      throw new Error(`${type}: ${error}`);
    }
  }

  const result = {
    success: true,
    result: {
      processedAt: new Date().toISOString(),
      type,
      payload,
      duration: baseTime,
      metadata: {
        workerId: process.pid,
        steps,
      },
    },
  };

  console.log(`[Worker] Job ${job.id} - ${type}: COMPLETED successfully`);
  return result;
};

async function main() {
  console.log("Starting flow test with 10 jobs and workers...\n");
  
  const queueName = "flowQueue";

  const queue = new Queue(queueName, { connection });
  await queue.obliterate({ force: true });
  console.log(`Queue "${queueName}" cleared.\n`);

  const worker = new Worker<JobData>(queueName, processJob, {
    connection,
    concurrency: 3,
  });

  worker.on("completed", (job) => {
    console.log(`[Event] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.log(`[Event] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[Event] Job ${job.id} progress: ${progress}%`);
  });

  const flowProducer = new FlowProducer({ connection });

  const children = jobTypes.slice(0, 8).map((type, index) => ({
    name: type,
    queueName,
    data: generateJobData(type, index),
    opts: {
      attempts: 3,
      backoff: {
        type: "exponential" as const,
        delay: 1000,
      },
    },
  }));

  const midLevelJobs = [
    {
      name: "aggregate-results",
      queueName,
      data: generateJobData("calculate-metrics", 8),
      children: children.slice(0, 4),
      opts: {
        attempts: 3,
        backoff: { type: "exponential" as const, delay: 1000 },
      },
    },
    {
      name: "prepare-notifications",
      queueName,
      data: generateJobData("notify-user", 9),
      children: children.slice(4, 8),
      opts: {
        attempts: 3,
        backoff: { type: "exponential" as const, delay: 1000 },
      },
    },
  ];

  const flow = await flowProducer.add({
    name: "root-orchestrator",
    queueName,
    data: {
      type: "generate-report" as JobType,
      userId: "system",
      payload: {
        description: "Root job that orchestrates the entire flow",
        totalJobs: 10,
        createdAt: new Date().toISOString(),
      },
      priority: "high" as const,
    },
    children: midLevelJobs,
    opts: {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 1000 },
    },
  });

  console.log(`Flow created with root job ID: ${flow.job.id}`);
  console.log("Flow structure:");
  console.log("  └─ root-orchestrator");
  console.log("      ├─ aggregate-results");
  console.log("      │   ├─ process-payment");
  console.log("      │   ├─ send-email");
  console.log("      │   ├─ generate-report");
  console.log("      │   └─ sync-inventory");
  console.log("      └─ prepare-notifications");
  console.log("          ├─ update-analytics");
  console.log("          ├─ compress-image");
  console.log("          ├─ validate-data");
  console.log("          └─ notify-user");
  console.log("\nWaiting for jobs to complete...\n");

  await new Promise<void>((resolve) => {
    let completedCount = 0;
    let failedCount = 0;
    const totalJobs = 11;

    const checkCompletion = () => {
      if (completedCount + failedCount >= totalJobs) {
        console.log(`\n--- Flow Summary ---`);
        console.log(`Completed: ${completedCount}`);
        console.log(`Failed: ${failedCount}`);
        console.log(`Total: ${totalJobs}`);
        resolve();
      }
    };

    worker.on("completed", () => {
      completedCount++;
      checkCompletion();
    });

    worker.on("failed", () => {
      failedCount++;
      checkCompletion();
    });

    setTimeout(() => {
      console.log("\n[Timeout] Exiting after 60 seconds");
      resolve();
    }, 60000);
  });

  //await worker.close();
  ////await flowProducer.close();
  //await queue.close();

  //console.log("\nFlow test completed. Exiting...");
  //process.exit(0);
}

main().catch((err) => {
  console.error("Error running flow test:", err);
  process.exit(1);
});
