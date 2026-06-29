# @bullstudio/bullmq-adapter

Bullstudio queue adapter for host-owned BullMQ queues.

Use this package in embedded mode when your application already creates BullMQ
`Queue` instances and you want to expose selected queues to a Bullstudio
dashboard instance.

## Install

```bash
pnpm add @bullstudio/bullmq-adapter
```

`bullmq` is a peer dependency. Bullstudio uses the queue instance and Redis
connection owned by your host application.

## Usage

```ts
import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { Queue } from "bullmq";

const emailQueue = new Queue("email", {
  connection,
});

const emailQueueAdapter = createBullMqQueueAdapter(emailQueue, {
  key: "email",
  label: "Email",
});
```

Pass the returned queue adapter to a framework adapter dashboard factory:

```ts
const dashboard = bullstudio({
  queues: [emailQueueAdapter],
});
```

## Options

| Option | Description |
| --- | --- |
| `key` | Stable Bullstudio queue key. Defaults to the BullMQ queue name. |
| `label` | Human-facing queue label in the dashboard. Defaults to the BullMQ queue name. |

Provide a custom `key` when multiple supplied queues could share the same queue
name or prefix.

## Capabilities

The BullMQ adapter supports queue inspection, job lists, job details, job logs,
job retry, job removal, queue pause and resume, worker counts, and BullMQ flows.

Bullstudio does not close the supplied queue or Redis connection. Keep that
lifecycle in your host application shutdown path.
