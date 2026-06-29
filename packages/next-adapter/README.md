# @bullstudio/next

Next.js App Router framework adapter for Bullstudio embedded mode.

Use this package to mount a dashboard instance from a catch-all App Router route
handler. The adapter serves the dashboard assets and the private dashboard API
under one `mountPath`.

## Install

```bash
pnpm add @bullstudio/next
```

Install one queue adapter package as well, such as
`@bullstudio/bullmq-adapter` or `@bullstudio/bull-adapter`.

## Usage

Create a route handler whose folder matches the mount path:

```ts
// app/ops/bullstudio/[[...bullstudio]]/route.ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/next";
import { emailQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, HEAD, POST } = bullstudio({
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
});
```

Open `/ops/bullstudio` to view the dashboard.

## Configuration

`bullstudio(config)` accepts the shared embedded dashboard config plus the
required Next.js `mountPath` option:

| Option | Description |
| --- | --- |
| `mountPath` | URL path where the dashboard route handler is mounted. |
| `queues` | Queue adapters to expose in the dashboard. |
| `readOnly` | Blocks mutating queue and job operations when `true`. |
| `protection` | Dashboard protection. Basic Auth is the usual production choice. |
| `dashboardIdentity` | Visible dashboard title and optional logo. |
| `documentIdentity` | Browser document title and optional favicon. |

Only App Router route handlers are supported. Pages Router support is not
included. Embedded mode only shows supplied queues and does not own the
lifecycle of the queues passed to it.
