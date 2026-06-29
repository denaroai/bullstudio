import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { Queue } from "bullmq";
import type IORedis from "ioredis";
import { AppModule, EMAIL_QUEUE, REDIS_CONNECTION } from "./app.module";

const app = await NestFactory.create(AppModule);

await app.listen(Number(process.env.PORT ?? 3000));

const shutdown = async () => {
  await app.close();
  await app.get<Queue>(EMAIL_QUEUE).close();
  await app.get<IORedis>(REDIS_CONNECTION).quit();
};

process.once("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
