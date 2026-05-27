# Embedded Mode

Bullstudio has two runtime modes with different queue sources.

## Standalone Mode

Standalone mode runs Bullstudio as its own process. It connects directly to Redis, discovers queues, and serves the dashboard at its own root route. Use standalone mode when you want to point Bullstudio at a Redis instance for local inspection or a separate dashboard deployment.

Standalone mode keeps Redis connection information visible in the dashboard because Redis discovery is its queue source.

## Embedded Mode

Embedded mode mounts Bullstudio inside a host application. The host application creates a dashboard instance with a framework adapter, supplies queue adapters for the queues operators should see, and exposes the dashboard at one mount path.

Embedded mode does not discover every queue in Redis. It exposes only supplied queues. Supplied queues are host-owned queues: the host application owns the BullMQ queue instances, Redis connections, and shutdown lifecycle. Bullstudio uses the queue adapters to inspect and manage those queues, but it does not own or close them.

## Hono And BullMQ Example

Install the first embedded slice packages alongside Hono and BullMQ:

```bash
pnpm add @bullstudio/hono @bullstudio/bullmq-adapter hono bullmq ioredis
```

Create a BullMQ queue, wrap it with the function-based queue adapter API, and mount the Hono dashboard factory at one mount path:

```ts
import { serve } from "@hono/node-server";
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/hono";
import { Queue } from "bullmq";
import { Hono } from "hono";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const emailQueue = new Queue("email", { connection });
const host = new Hono();

const dashboard = bullstudio({
  queues: [
    createBullMqQueueAdapter(emailQueue, {
      key: "email",
      label: "Email",
    }),
  ],
});

host.route("/ops/bullstudio", dashboard);

serve({
  fetch: host.fetch,
  port: 3000,
});
```

The mount path is `/ops/bullstudio` in this example. Dashboard assets and the private dashboard API are both served below that same mount path, so reverse-proxy configuration only needs one route.

## Framework Adapters

Embedded mode is exposed through framework-native adapter packages. Each adapter exports a `bullstudio()` dashboard factory and serves dashboard assets plus the private dashboard API below one mount path.

| Framework | Package | Mounting shape |
| --- | --- | --- |
| Hono | `@bullstudio/hono` | `host.route("/ops/bullstudio", bullstudio(config))` |
| Express | `@bullstudio/express` | `app.use("/ops/bullstudio", bullstudio(config))` |
| Fastify | `@bullstudio/fastify` | `app.register(bullstudio(config), { prefix: "/ops/bullstudio" })` |
| Next.js App Router | `@bullstudio/next` | `export const { GET, HEAD, POST } = bullstudio({ mountPath: "/ops/bullstudio", ...config })` |

Next.js support is for App Router route handlers. Pages Router support is not included.

## Queue Adapters

Queue adapters are function-based and wrap host-owned queue instances. Bullstudio uses the host application's installed Bull or BullMQ package and does not close the supplied queue or Redis connection.

Use `@bullstudio/bullmq-adapter` for BullMQ queues:

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";

const queue = createBullMqQueueAdapter(emailQueue, {
  key: "email",
  label: "Email",
});
```

Use `@bullstudio/bull-adapter` for Bull queues:

```ts
import { createBullQueueAdapter } from "@bullstudio/bull-adapter";

const queue = createBullQueueAdapter(emailQueue, {
  key: "email",
  label: "Email",
});
```

## Dashboard Protection

Embedded dashboards use Bullstudio-owned dashboard protection by default. The default protection is Basic Auth protection, which protects both dashboard assets and the private dashboard API.

Configure Basic Auth credentials explicitly when Bullstudio should own the dashboard login:

```ts
const dashboard = bullstudio({
  queues: [createBullMqQueueAdapter(emailQueue)],
  protection: {
    type: "basic",
    username: "operator",
    password: process.env.BULLSTUDIO_PASSWORD ?? "change-me",
  },
});
```

If the host application owns access control around the mount path, disable Bullstudio protection and enforce host-owned access control before requests reach the dashboard:

```ts
host.use("/ops/bullstudio/*", async (c, next) => {
  if (!c.req.header("x-operator-id")) {
    return c.text("Forbidden", 403);
  }

  await next();
});

host.route(
  "/ops/bullstudio",
  bullstudio({
    queues: [createBullMqQueueAdapter(emailQueue)],
    protection: {
      type: "disabled",
    },
  }),
);
```

## Read-Only Dashboards

Mutating operations are enabled by default. Configure a read-only dashboard when operators should inspect queues and jobs without changing them:

```ts
const dashboard = bullstudio({
  queues: [createBullMqQueueAdapter(emailQueue)],
  readOnly: true,
});
```

Read-only dashboard behavior is enforced by the core operation layer. Direct private dashboard API calls cannot bypass it.

## Dashboard And Document Identity

The dashboard identity controls the visible dashboard title and logo. The document identity controls browser-level details such as the document title and favicon.

```ts
const dashboard = bullstudio({
  queues: [createBullMqQueueAdapter(emailQueue)],
  dashboardIdentity: {
    title: "Production Queues",
    logo: {
      src: "/assets/queue-logo.svg",
      alt: "Production queue operations",
    },
  },
  documentIdentity: {
    title: "Queue Ops",
    favicon: "/favicon.ico",
  },
});
```

Identity configuration is supplied at runtime; developers do not need to rebuild or copy Bullstudio dashboard assets.

## Private Dashboard API

The private dashboard API is internal to Bullstudio's dashboard assets. It remains tRPC internally and is not a public integration API. Applications should use framework adapters and queue adapters as the public embedded-mode surface instead of calling the private dashboard API directly.

## Out Of Scope

The embedded-mode public surface is intentionally narrow:

- No public REST API.
- No WebSocket or Server-Sent Events support; polling remains the update mechanism.
- No Pages Router support for Next.js.
- No arbitrary metadata display.
- No full theming or custom dashboard component system.
