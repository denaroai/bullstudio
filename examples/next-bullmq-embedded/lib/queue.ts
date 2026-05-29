import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

declare global {
  // eslint-disable-next-line no-var
  var bullstudioExampleConnection: IORedis | undefined;
  // eslint-disable-next-line no-var
  var bullstudioExampleEmailQueue: Queue | undefined;
}

export const connection =
  globalThis.bullstudioExampleConnection ??
  new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

export const emailQueue =
  globalThis.bullstudioExampleEmailQueue ??
  new Queue("email", {
    connection,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.bullstudioExampleConnection = connection;
  globalThis.bullstudioExampleEmailQueue = emailQueue;
}
