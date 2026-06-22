# @bullstudio/bullmq-adapter

## 2.2.0

### Patch Changes

- c06b555: Coerce BullMQ's `Job.stacktrace` (now typed `string[] | null`) to `undefined` when null, matching the `@bullstudio/connect-types` `Job` contract.
  - @bullstudio/connect-types@2.2.0

## 2.1.0

### Patch Changes

- @bullstudio/connect-types@2.1.0

## 2.0.1

### Patch Changes

- @bullstudio/connect-types@2.0.1

## 2.0.0

### Major Changes

- Initial release of Bullstudio embedded mode.

  Mount Bullstudio inside your own application with a framework adapter — `@bullstudio/express`, `@bullstudio/fastify`, `@bullstudio/hono`, `@bullstudio/next`, or `@bullstudio/nestjs` — supply your Bull or BullMQ queues via `@bullstudio/bullmq-adapter` or `@bullstudio/bull-adapter`, and the dashboard exposes only those queues with server-side capability enforcement. `@bullstudio/embedded-core` provides the framework-neutral runtime and `@bullstudio/connect-types` the shared adapter contracts.

  These packages are versioned at 2.0.0 to align with the unified Bullstudio release line.

### Patch Changes

- Updated dependencies
  - @bullstudio/connect-types@2.0.0
