import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/fastify";
import { Queue } from "bullmq";
import Fastify from "fastify";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const emailQueue = new Queue("email", { connection });
const host = Fastify();

await host.register(
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
    documentIdentity: {
      title: "Queue Ops",
      favicon: "/favicon.ico",
    },
    // Poll Redis every 5s instead of the 2s default to ease load on
    // pay-per-command Redis. Operators can change this from the sidebar.
    polling: {
      interval: 5000,
    },
  }),
  {
    prefix: "/ops/bullstudio",
  },
);

await host.listen({
  port: Number(process.env.PORT ?? 3000),
});

const shutdown = async () => {
  await host.close();
  await emailQueue.close();
  await connection.quit();
};

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
