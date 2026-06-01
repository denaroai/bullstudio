import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { BullstudioModule } from "@bullstudio/nestjs";
import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export const REDIS_CONNECTION = Symbol("REDIS_CONNECTION");
export const EMAIL_QUEUE = Symbol("EMAIL_QUEUE");

@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: () =>
        new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: EMAIL_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) => new Queue("email", { connection }),
    },
  ],
  exports: [REDIS_CONNECTION, EMAIL_QUEUE],
})
export class QueueModule {}

@Module({
  imports: [
    QueueModule,
    BullstudioModule.forRootAsync({
      imports: [QueueModule],
      inject: [EMAIL_QUEUE],
      useFactory: (emailQueue: Queue) => ({
        mountPath: "/ops/bullstudio",
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
          title: "Queue Ops",
          favicon: "/favicon.ico",
        },
      }),
    }),
  ],
})
export class AppModule {}
