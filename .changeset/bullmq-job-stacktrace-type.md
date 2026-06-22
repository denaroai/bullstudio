---
"@bullstudio/bullmq-adapter": patch
---

Coerce BullMQ's `Job.stacktrace` (now typed `string[] | null`) to `undefined` when null, matching the `@bullstudio/connect-types` `Job` contract.
