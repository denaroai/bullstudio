<p align="center">
  <img src="assets/logo.svg" alt="bullstudio" width="120" />
</p>

<h1 align="center">bullstudio</h1>

<p align="center">
  Queue management dashboard for <a href="https://github.com/OptimalBits/bull">Bull</a> and <a href="https://docs.bullmq.io/">BullMQ</a>.
</p>

<p align="center">
  <a href="https://hub.docker.com/r/emirce/bullstudio"><img src="https://img.shields.io/docker/v/emirce/bullstudio?sort=semver&label=Docker%20Hub" alt="Docker Hub" /></a>
  <a href="https://hub.docker.com/r/emirce/bullstudio"><img src="https://img.shields.io/docker/pulls/emirce/bullstudio" alt="Docker Pulls" /></a>
  <img src="https://img.shields.io/badge/BullMQ-5.x-orange" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Bull-4.x-orange" alt="Bull" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript" />
</p>

<div align="center">
  <img width="80%" src="https://github.com/user-attachments/assets/b5eea348-5919-40ff-ad55-3a0387dbec47" alt="Bullstudio dashboard screenshot" />
</div>

Bullstudio runs in two modes:

- **Standalone mode**: run a separate dashboard process that connects to Redis and discovers queues.
- **Embedded mode**: mount Bullstudio inside your app and expose only the queues you supply.

## Standalone

```bash
npx bullstudio -r redis://localhost:6379
```

The dashboard opens at `http://localhost:4000`.

```bash
bullstudio --help
bullstudio -r redis://:password@redis.example.com:6379 -p 8080 --no-open
bullstudio --prefix stage,stage2
bullstudio --username operator --password change-me
```

## Docker

```bash
docker run -d \
  -p 4000:4000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  emirce/bullstudio
```

```yaml
services:
  bullstudio:
    image: emirce/bullstudio
    ports:
      - "4000:4000"
    environment:
      REDIS_URL: redis://redis:6379
      BULLSTUDIO_USERNAME: operator
      BULLSTUDIO_PASSWORD: change-me

  redis:
    image: redis:7-alpine
```

## Embedded

Install one framework adapter and one queue adapter:

```bash
pnpm add @bullstudio/hono @bullstudio/bullmq-adapter bullmq ioredis
```

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/hono";
import { Queue } from "bullmq";
import { Hono } from "hono";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const emailQueue = new Queue("email", { connection });
const app = new Hono();

app.route(
  "/ops/bullstudio",
  bullstudio({
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
);
```

Open `/ops/bullstudio`. Dashboard assets and the private dashboard API are served under the same mount path.

## Framework Adapters

| Framework | Package | Mount |
| --- | --- | --- |
| Hono | `@bullstudio/hono` | `app.route("/ops/bullstudio", bullstudio(config))` |
| Express | `@bullstudio/express` | `app.use("/ops/bullstudio", bullstudio(config))` |
| Fastify | `@bullstudio/fastify` | `app.register(bullstudio(config), { prefix: "/ops/bullstudio" })` |
| Next.js App Router | `@bullstudio/next` | `export const { GET, HEAD, POST } = bullstudio({ mountPath: "/ops/bullstudio", ...config })` |
| NestJS | `@bullstudio/nestjs` | `BullstudioModule.forRoot({ mountPath: "/ops/bullstudio", ...config })` |

```ts
// Express
import { bullstudio } from "@bullstudio/express";

app.use("/ops/bullstudio", bullstudio({ queues }));
```

```ts
// Fastify
import { bullstudio } from "@bullstudio/fastify";

await app.register(bullstudio({ queues }), {
  prefix: "/ops/bullstudio",
});
```

```ts
// app/ops/bullstudio/[[...bullstudio]]/route.ts
import { bullstudio } from "@bullstudio/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, HEAD, POST } = bullstudio({
  mountPath: "/ops/bullstudio",
  queues,
});
```

## Queue Adapters

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";

const queue = createBullMqQueueAdapter(emailQueue, {
  key: "email",
  label: "Email",
});
```

```ts
import { createBullQueueAdapter } from "@bullstudio/bull-adapter";

const queue = createBullQueueAdapter(emailQueue, {
  key: "email",
  label: "Email",
});
```

Embedded mode only shows supplied queues. Bullstudio does not discover all Redis queues in embedded mode and does not close host-owned queue connections.

## Embedded Options

```ts
bullstudio({
  queues,
  readOnly: true,
  protection: {
    type: "basic",
    username: "operator",
    password: process.env.BULLSTUDIO_PASSWORD ?? "change-me",
  },
  dashboardIdentity: {
    title: "Production Queues",
  },
  documentIdentity: {
    title: "Queue Ops",
    favicon: "/favicon.ico",
  },
});
```

Set `protection: { type: "disabled" }` only when your host application protects the mount path.

## Runnable Examples

| Framework | Command |
| --- | --- |
| Hono | `pnpm --filter @bullstudio/example-hono-bullmq-embedded dev` |
| Express | `pnpm --filter @bullstudio/example-express-bullmq-embedded dev` |
| Fastify | `pnpm --filter @bullstudio/example-fastify-bullmq-embedded dev` |
| Next.js App Router | `pnpm --filter @bullstudio/example-next-bullmq-embedded dev` |
| NestJS | `pnpm --filter @bullstudio/example-nestjs-bullmq-embedded dev:express` |

## Packages

- `bullstudio`: standalone CLI.
- `@bullstudio/hono`, `@bullstudio/express`, `@bullstudio/fastify`, `@bullstudio/next`, `@bullstudio/nestjs`: framework adapters.
- `@bullstudio/bullmq-adapter`, `@bullstudio/bull-adapter`: queue adapters.
- `@bullstudio/connect-types`: contracts for custom queue adapters.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

See `docs/embedded-mode.md` for embedded-mode details and package-level READMEs for adapter-specific usage.

## License

MIT
