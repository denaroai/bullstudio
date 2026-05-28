# @bullstudio/bull-adapter

Bullstudio queue adapter for host-owned Bull queues.

Use this package in embedded mode when your application already creates Bull
`Queue` instances and you want to expose selected queues to a Bullstudio
dashboard instance.

## Install

```bash
pnpm add @bullstudio/bull-adapter
```

`bull` is a peer dependency. Bullstudio uses the queue instance and Redis
connection owned by your host application.

## Usage

```ts
import { createBullQueueAdapter } from "@bullstudio/bull-adapter";
import Bull from "bull";

const emailQueue = new Bull("email", {
  redis: process.env.REDIS_URL,
});

const emailQueueAdapter = createBullQueueAdapter(emailQueue, {
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
| `key` | Stable Bullstudio queue key. Defaults to the Bull queue name. |
| `label` | Human-facing queue label in the dashboard. Defaults to the Bull queue name. |

Provide a custom `key` when multiple supplied queues could share the same queue
name or prefix.

## Capabilities

The Bull adapter supports queue inspection, job lists, job details, job logs,
job retry, job removal, queue pause and resume, and worker counts.

Bull flows are not supported by this adapter. Bullstudio does not close the
supplied queue or Redis connection. Keep that lifecycle in your host application
shutdown path.
