# @bullstudio/hono

Hono framework adapter for Bullstudio embedded mode.

Use this package to mount a dashboard instance inside a Hono application. The
adapter serves the dashboard assets and the private dashboard API under one
route path.

## Install

```bash
pnpm add @bullstudio/hono
```

Install one queue adapter package as well, such as
`@bullstudio/bullmq-adapter` or `@bullstudio/bull-adapter`.

## Usage

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/hono";
import { Queue } from "bullmq";
import { Hono } from "hono";

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

Open `/ops/bullstudio` to view the dashboard.

## Configuration

`bullstudio(config)` accepts the shared embedded dashboard config:

| Option | Description |
| --- | --- |
| `queues` | Queue adapters to expose in the dashboard. |
| `readOnly` | Blocks mutating queue and job operations when `true`. |
| `protection` | Dashboard protection. Basic Auth is the usual production choice. |
| `dashboardIdentity` | Visible dashboard title and optional logo. |
| `documentIdentity` | Browser document title and optional favicon. |

Embedded mode only shows supplied queues. Bullstudio does not discover all Redis
queues and does not own the lifecycle of the queues passed to it.
