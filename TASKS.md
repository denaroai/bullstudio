# Embedded Mode Tasks

Parent: [Embedded Mode PRD](./docs/prd/embedded-mode.md)

These tasks break the PRD into dependency-ordered tracer-bullet slices. Each task should be independently grabbable once its blockers are complete and should preserve the vocabulary and constraints in [CONTEXT.md](./CONTEXT.md), [ADR 0001](./docs/adr/0001-embedded-dashboard-architecture.md), and [ADR 0002](./docs/adr/0002-preserve-standalone-behavior-during-embedded-extraction.md).

## 1. Define the embedded core and adapter contracts

Status: Complete

Type: AFK

Blocked by: None - can start immediately

User stories covered: 31, 32, 33

### What to build

Create the first importable embedded core surface and the shared contracts for dashboard instances, queue adapters, adapter capabilities, queue source status, dashboard protection, read-only mode, dashboard identity, document identity, and private dashboard API mounting. This slice does not need a full working Hono mount yet, but it must establish the stable contract that queue and framework adapters will implement.

### Acceptance criteria

- [x] The embedded core can be imported by other workspace packages.
- [x] The queue adapter contract is per-queue and capability-based.
- [x] The dashboard configuration contract includes supplied queues, read-only mode, dashboard protection, dashboard identity, and document identity.
- [x] The embedded core exposes a small framework-neutral interface that framework adapters can mount.
- [x] Type tests or compile-time tests cover the intended public contracts.
- [x] Existing standalone mode behavior is not changed by this slice.

Progress:

- Added `@bullstudio/embedded-core` as the first importable embedded core package.
- Added public contracts for dashboard instances, queue adapters, adapter capabilities, queue source status, dashboard protection, read-only mode, dashboard identity, document identity, and private dashboard API mounting.
- Added a compile-time/runtime contract test for the public embedded core surface.
- Verified with `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, and `pnpm typecheck`.

## 2. Implement the BullMQ queue adapter

Status: Complete

Type: AFK

Blocked by: Task 1

User stories covered: 4, 5, 6, 7, 8, 9, 10, 11, 18, 19

### What to build

Add the function-based BullMQ queue adapter package for BullMQ 5+. The adapter should expose a host-owned BullMQ queue as a supplied queue, infer queue key and queue label by default, allow explicit key and label overrides, expose adapter capabilities, and implement the queue/job operations required by the current dashboard surface.

### Acceptance criteria

- [x] Developers can create a queue adapter with a function-based API.
- [x] BullMQ is a peer dependency of the adapter package.
- [x] The adapter infers a queue key and queue label from the supplied BullMQ queue.
- [x] The adapter accepts explicit queue key and queue label overrides.
- [x] The adapter exposes BullMQ capabilities, including flow support where available.
- [x] The adapter does not close or otherwise own the supplied queue or its connection.
- [x] Tests verify queue key inference, overrides, capabilities, job reads, queue reads, and host-owned queue lifecycle behavior.

Progress:

- Added `@bullstudio/bullmq-adapter` with the `createBullMqQueueAdapter()` function-based API.
- Declared BullMQ as a peer dependency while using the host-supplied queue instance for all queue and job operations.
- Extended the embedded queue adapter contract with queue reads, job reads, job logs, queue pause/resume, job retry/removal, and worker count operations.
- Added adapter tests for inferred identity, explicit key/label overrides, BullMQ capabilities, queue reads, job reads, delegated operations, and host-owned lifecycle behavior.
- Verified with `pnpm --filter @bullstudio/bullmq-adapter test`, `pnpm --filter @bullstudio/bullmq-adapter typecheck`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, and `pnpm exec biome check packages/bullmq-adapter packages/embedded-core`.

## 3. Aggregate supplied queues in the embedded core

Type: AFK

Blocked by: Tasks 1, 2

User stories covered: 3, 4, 6, 7, 8, 9, 18, 21

### What to build

Teach the embedded core to aggregate supplied queue adapters into the dashboard's multi-queue view. Embedded mode must only expose supplied queues, must fail fast on duplicate queue keys, and must produce queue source status instead of Redis connection details.

### Acceptance criteria

- [ ] A dashboard instance can be created from one or more supplied queue adapters.
- [ ] Embedded mode exposes only supplied queues.
- [ ] Duplicate inferred or explicit queue keys fail fast with a clear error.
- [ ] Queue source status reports supplied queue count, adapter/provider types, capabilities, and source health.
- [ ] Embedded queue APIs address queues through queue keys.
- [ ] Tests verify supplied-queue visibility, duplicate-key failure, queue label behavior, and queue source status.

## 4. Mount embedded Bullstudio in Hono at one mount path

Type: AFK

Blocked by: Tasks 1, 2, 3

User stories covered: 1, 2, 3, 13, 26, 32, 33, 34

### What to build

Add the Hono framework adapter package with a native `bullstudio()` dashboard factory. A Hono app should mount the returned value at one mount path and receive the dashboard assets and private dashboard API from that same path.

### Acceptance criteria

- [ ] Hono developers can import `bullstudio()` from the Hono adapter package.
- [ ] The Hono adapter returns a Hono-native mountable value.
- [ ] Dashboard assets are served under the mount path.
- [ ] The private dashboard API is served under the same mount path.
- [ ] The private dashboard API remains tRPC and is not documented as public API.
- [ ] Polling remains the update mechanism; no WebSocket or Server-Sent Events support is introduced.
- [ ] Tests mount the dashboard at a non-root path and verify asset and API responses.

## 5. Add Basic Auth dashboard protection for embedded mode

Type: AFK

Blocked by: Task 4

User stories covered: 13, 14

### What to build

Implement Bullstudio-owned dashboard protection in the embedded core, enabled by default through Basic Auth protection. The protection must apply to both dashboard assets and the private dashboard API, while still allowing host applications to disable or replace Bullstudio protection when they intentionally own access control.

### Acceptance criteria

- [ ] Embedded dashboards are protected by Basic Auth by default.
- [ ] Protection covers dashboard assets and private dashboard API routes.
- [ ] Invalid or missing credentials receive an authentication challenge.
- [ ] Valid credentials can access the dashboard and API.
- [ ] A configured opt-out path supports host-owned access control.
- [ ] Tests cover default Basic Auth, valid credentials, invalid credentials, and disabled/replaced protection behavior.

## 6. Enforce read-only dashboards in the core operation layer

Type: AFK

Blocked by: Tasks 3, 4

User stories covered: 15, 16, 17, 18

### What to build

Add read-only dashboard support in embedded core. Mutating operations remain enabled by default, but when read-only mode is configured, mutating private dashboard API calls must be rejected by the core/server layer even if the request bypasses the UI.

### Acceptance criteria

- [ ] Dashboard instances can be configured as read-only.
- [ ] Read-only dashboards still allow non-mutating queue and job reads.
- [ ] Read-only dashboards reject queue pause/resume, job retry, job removal, and other mutating operations exposed by the current dashboard.
- [ ] Rejections use a clear authorization-style error.
- [ ] The UI receives enough capability/state information to hide or disable mutating controls.
- [ ] Tests verify server-side rejection of direct mutating API calls.

## 7. Support dashboard and document identity in embedded mode

Type: AFK

Blocked by: Task 4

User stories covered: 23, 24, 25

### What to build

Allow embedded dashboards to configure dashboard identity and document identity. Dashboard identity covers visible title and logo. Document identity covers browser document title and favicon. This slice should avoid arbitrary metadata display and full theming.

### Acceptance criteria

- [ ] Dashboard instances accept title and logo configuration.
- [ ] Dashboard instances accept document title and favicon configuration.
- [ ] Dashboard assets receive identity configuration without requiring users to rebuild or copy frontend assets.
- [ ] The UI renders the configured dashboard title and logo.
- [ ] The served document uses the configured document title and favicon.
- [ ] Tests verify configured identity values appear in the served dashboard experience.

## 8. Refactor standalone mode onto the embedded core with parity tests

Type: AFK

Blocked by: Tasks 1, 3, 4, 5

User stories covered: 22, 30, 31, 35

### What to build

Refactor standalone mode to use the embedded core internally while preserving existing CLI behavior. Standalone mode should continue using Redis discovery as its queue source, keep root-mounted dashboard routes, keep private tRPC route shape, keep Basic Auth behavior, and keep existing CLI flags and environment variables.

### Acceptance criteria

- [ ] Existing CLI commands, flags, environment variables, default port, and Redis discovery behavior continue to work.
- [ ] The standalone dashboard remains mounted at root.
- [ ] Existing health check routes continue to work.
- [ ] Existing private tRPC route shape continues to work.
- [ ] Existing production Basic Auth behavior continues to work.
- [ ] Standalone mode uses the embedded core internally.
- [ ] Parity tests verify root asset serving, private dashboard API access, health checks, Basic Auth behavior, and Redis-discovered queue behavior.

## 9. Make the dashboard UI mode-aware for queue source status

Type: AFK

Blocked by: Tasks 3, 8

User stories covered: 18, 21, 22

### What to build

Update the dashboard UI and private dashboard API responses so standalone mode continues to show Redis connection information while embedded mode shows queue source status. The UI should use adapter capabilities to hide or disable unsupported features.

### Acceptance criteria

- [ ] Standalone mode still displays Redis connection information.
- [ ] Embedded mode displays queue source status instead of Redis connection details.
- [ ] Embedded mode shows supplied queue count and adapter/provider information.
- [ ] Unsupported features are hidden or disabled based on adapter capabilities.
- [ ] Tests verify mode-specific status responses and UI-facing data shape.

## 10. Document and demo the first embedded slice

Type: AFK

Blocked by: Tasks 4, 5, 6, 7, 8, 9

User stories covered: 1, 2, 3, 5, 13, 15, 23, 24, 25, 26, 30

### What to build

Add documentation and a minimal Hono + BullMQ example for embedded mode. The docs should distinguish standalone mode from embedded mode, show the function-based queue adapter API, explain mount path behavior, describe Basic Auth protection, show read-only configuration, and document dashboard/document identity options.

### Acceptance criteria

- [ ] Documentation introduces standalone mode and embedded mode using glossary language.
- [ ] Documentation includes a Hono + BullMQ embedded example.
- [ ] Documentation explains that embedded mode exposes only supplied queues.
- [ ] Documentation explains that supplied queues are host-owned queues.
- [ ] Documentation explains Basic Auth protection and host-owned access control opt-out.
- [ ] Documentation explains read-only dashboard behavior.
- [ ] Documentation explains title, logo, favicon, and document title configuration.
- [ ] Documentation states that the private dashboard API is private and remains tRPC internally.

## 11. Add the Bull queue adapter

Type: AFK

Blocked by: Tasks 1, 3, 6

User stories covered: 4, 5, 10, 12, 18, 20

### What to build

Add the function-based Bull queue adapter package for Bull 4+. The adapter should use Bull as a peer dependency, expose host-owned Bull queues as supplied queues, infer queue identity by default, expose capabilities accurately for Bull, and implement supported queue/job operations through the shared adapter contract.

### Acceptance criteria

- [ ] Developers can create a Bull queue adapter with a function-based API.
- [ ] Bull is a peer dependency of the adapter package.
- [ ] The adapter infers queue key and queue label and supports explicit overrides.
- [ ] The adapter exposes Bull capabilities accurately, including lack of flow support.
- [ ] The adapter does not close or otherwise own the supplied Bull queue or its connection.
- [ ] Tests verify Bull queue reads, job reads, supported mutations, capabilities, key behavior, and host-owned lifecycle behavior.

## 12. Add the Express framework adapter

Type: AFK

Blocked by: Tasks 4, 5, 6, 7, 9

User stories covered: 1, 2, 3, 13, 15, 27, 32

### What to build

Add the Express framework adapter package with a native `bullstudio()` dashboard factory. Express developers should mount Bullstudio with normal middleware patterns at a single mount path and receive the same core behavior as Hono.

### Acceptance criteria

- [ ] Express developers can import `bullstudio()` from the Express adapter package.
- [ ] The Express adapter returns an Express-native mountable value.
- [ ] Dashboard assets and private dashboard API are served under one mount path.
- [ ] Basic Auth protection works by default.
- [ ] Read-only mode rejects mutating operations server-side.
- [ ] Dashboard and document identity work without rebuilding assets.
- [ ] Tests verify an Express app can mount and use the dashboard at a non-root path.

## 13. Add the Fastify framework adapter

Type: AFK

Blocked by: Tasks 4, 5, 6, 7, 9

User stories covered: 1, 2, 3, 13, 15, 28, 32

### What to build

Add the Fastify framework adapter package with a native `bullstudio()` dashboard factory. Fastify developers should register Bullstudio with normal plugin patterns at a single mount path and receive the same core behavior as Hono.

### Acceptance criteria

- [ ] Fastify developers can import `bullstudio()` from the Fastify adapter package.
- [ ] The Fastify adapter returns a Fastify-native plugin or registerable value.
- [ ] Dashboard assets and private dashboard API are served under one mount path.
- [ ] Basic Auth protection works by default.
- [ ] Read-only mode rejects mutating operations server-side.
- [ ] Dashboard and document identity work without rebuilding assets.
- [ ] Tests verify a Fastify app can register and use the dashboard at a non-root path.

## 14. Add the Next.js App Router adapter

Type: AFK

Blocked by: Tasks 4, 5, 6, 7, 9

User stories covered: 1, 2, 3, 13, 15, 29, 32, 34

### What to build

Add the Next.js framework adapter package for App Router route handlers. Next.js developers should export route handlers from `bullstudio()` and serve the dashboard from a configured mount path without Pages Router support.

### Acceptance criteria

- [ ] Next.js developers can import `bullstudio()` from the Next.js adapter package.
- [ ] The adapter returns App Router-compatible route handlers.
- [ ] Dashboard assets and private dashboard API are served from the configured mount path.
- [ ] Basic Auth protection works by default.
- [ ] Read-only mode rejects mutating operations server-side.
- [ ] Dashboard and document identity work without rebuilding assets.
- [ ] Tests or an example verify App Router route-handler behavior.
- [ ] Pages Router support is not introduced in this slice.

## 15. Final embedded-mode verification and release readiness

Type: AFK

Blocked by: Tasks 10, 11, 12, 13, 14

User stories covered: 1-35

### What to build

Run the full embedded-mode feature through repository-level verification, documentation review, and package readiness checks. This slice should confirm that standalone mode remains compatibility-sensitive and that embedded mode behaves consistently across completed adapters.

### Acceptance criteria

- [ ] Workspace typecheck passes.
- [ ] Workspace lint/check passes.
- [ ] Queue and dashboard tests pass.
- [ ] Standalone parity tests pass.
- [ ] Embedded Hono, Express, Fastify, and Next.js adapter tests or examples pass.
- [ ] BullMQ and Bull queue adapter tests pass.
- [ ] Documentation reflects the final public API and package names.
- [ ] Out-of-scope items remain out of scope.
- [ ] No public REST API, WebSockets, SSE, Pages Router support, arbitrary metadata display, or full theming is introduced accidentally.
