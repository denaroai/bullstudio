# @bullstudio/nestjs

NestJS framework adapter for Bullstudio embedded mode.

## Install

```sh
pnpm add @bullstudio/nestjs @bullstudio/bullmq-adapter
```

Install the Nest platform you already use:

```sh
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express
```

or:

```sh
pnpm add @nestjs/common @nestjs/core @nestjs/platform-fastify
```

## forRootAsync

Use `forRootAsync()` when queues are provided by Nest dependency injection.
Pass any module that exports injected queue providers through `imports`.

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { BullstudioModule } from "@bullstudio/nestjs";
import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";

@Module({
  imports: [
    BullstudioModule.forRootAsync({
      imports: [QueueModule],
      inject: [getQueueToken("email")],
      useFactory: (emailQueue: Queue) => ({
        mountPath: "/ops/bullstudio",
        queues: [
          createBullMqQueueAdapter(emailQueue, {
            key: "email",
            label: "Email",
          }),
        ],
        readOnly: true,
      }),
    }),
  ],
})
export class AppModule {}
```

## forRoot

Use `forRoot()` when queue adapters can be created directly.

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { BullstudioModule } from "@bullstudio/nestjs";
import { Module } from "@nestjs/common";
import { Queue } from "bullmq";

const emailQueue = new Queue("email");

@Module({
  imports: [
    BullstudioModule.forRoot({
      mountPath: "/ops/bullstudio",
      queues: [
        createBullMqQueueAdapter(emailQueue, {
          key: "email",
          label: "Email",
        }),
      ],
      protection: {
        type: "basic",
        username: process.env.BULLSTUDIO_USERNAME ?? "operator",
        password: process.env.BULLSTUDIO_PASSWORD ?? "change-me",
      },
    }),
  ],
})
export class AppModule {}
```

`mountPath` is the public dashboard URL. It is mounted directly on the
underlying Express or Fastify server and is independent of
`app.setGlobalPrefix()`.

Embedded mode only shows the queue adapters supplied in configuration.
Bullstudio does not create queues, register processors, or own queue lifecycle.
