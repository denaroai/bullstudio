import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/express";
import { Queue } from "bullmq";
import express from "express";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const emailQueue = new Queue("email", { connection });
const host = express();

host.use(
  "/ops/bullstudio",
  bullstudio({
    queues: [
      createBullMqQueueAdapter(emailQueue, {
        key: "email",
        label: "Email",
      }),
    ],
    readOnly: true,
    protection: {
      type: "basic",
      username: process.env.BULLSTUDIO_USERNAME ?? "operator",
      password: process.env.BULLSTUDIO_PASSWORD ?? "change-me",
    },
    dashboardIdentity: {
      title: "Production Queues",
    },
    documentIdentity: {
      title: "Queue Ops Test",
      favicon: "/favicon.ico",
    },
    // Poll Redis every 5s instead of the 2s default to ease load on
    // pay-per-command Redis. Operators can change this from the sidebar.
    polling: {
      interval: 5000,
    },
  }),
);

const server = host.listen(Number(process.env.PORT ?? 3000));

const shutdown = async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
  await emailQueue.close();
  await connection.quit();
};

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
