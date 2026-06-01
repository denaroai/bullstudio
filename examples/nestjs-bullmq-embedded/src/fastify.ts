import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule, EMAIL_QUEUE, REDIS_CONNECTION } from "./app.module";
import type { Queue } from "bullmq";
import type IORedis from "ioredis";

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);

await app.listen({
  port: Number(process.env.PORT ?? 3000),
});

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
