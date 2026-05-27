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

Status: Complete

Type: AFK

Blocked by: Tasks 1, 2

User stories covered: 3, 4, 6, 7, 8, 9, 18, 21

### What to build

Teach the embedded core to aggregate supplied queue adapters into the dashboard's multi-queue view. Embedded mode must only expose supplied queues, must fail fast on duplicate queue keys, and must produce queue source status instead of Redis connection details.

### Acceptance criteria

- [x] A dashboard instance can be created from one or more supplied queue adapters.
- [x] Embedded mode exposes only supplied queues.
- [x] Duplicate inferred or explicit queue keys fail fast with a clear error.
- [x] Queue source status reports supplied queue count, adapter/provider types, capabilities, and source health.
- [x] Embedded queue APIs address queues through queue keys.
- [x] Tests verify supplied-queue visibility, duplicate-key failure, queue label behavior, and queue source status.

Progress:

- Added keyed supplied-queue aggregation to `@bullstudio/embedded-core`.
- Added dashboard queue projections that preserve queue key, label, provider, capabilities, and adapter-provided queue state.
- Added keyed embedded queue APIs for queue reads, job reads, job logs, queue mutations, job mutations, and worker counts.
- Added duplicate supplied-queue key validation with a clear fail-fast error.
- Verified with `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, `pnpm --filter @bullstudio/bullmq-adapter test`, `pnpm --filter @bullstudio/bullmq-adapter typecheck`, and `pnpm exec biome check packages/embedded-core`.

## 4. Mount embedded Bullstudio in Hono at one mount path

Status: Complete

Type: AFK

Blocked by: Tasks 1, 2, 3

User stories covered: 1, 2, 3, 13, 26, 32, 33, 34

### What to build

Add the Hono framework adapter package with a native `bullstudio()` dashboard factory. A Hono app should mount the returned value at one mount path and receive the dashboard assets and private dashboard API from that same path.

### Acceptance criteria

- [x] Hono developers can import `bullstudio()` from the Hono adapter package.
- [x] The Hono adapter returns a Hono-native mountable value.
- [x] Dashboard assets are served under the mount path.
- [x] The private dashboard API is served under the same mount path.
- [x] The private dashboard API remains tRPC and is not documented as public API.
- [x] Polling remains the update mechanism; no WebSocket or Server-Sent Events support is introduced.
- [x] Tests mount the dashboard at a non-root path and verify asset and API responses.

Progress:

- Added `@bullstudio/hono` with the native `bullstudio()` dashboard factory.
- Added a Hono integration test that mounts Bullstudio at `/ops/bullstudio` and verifies dashboard HTML, dashboard assets, and private tRPC API responses from that same mount path.
- Added initial embedded-core dashboard asset handling for the embedded dashboard shell and asset script.
- Added the first private embedded-core tRPC procedures for supplied queue listing and queue source status.
- Verified with `pnpm --filter @bullstudio/hono test`, `pnpm --filter @bullstudio/hono typecheck`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, `pnpm exec biome check packages/hono-adapter packages/embedded-core`, and `pnpm typecheck`.

## 5. Add Basic Auth dashboard protection for embedded mode

Status: Complete

Type: AFK

Blocked by: Task 4

User stories covered: 13, 14

### What to build

Implement Bullstudio-owned dashboard protection in the embedded core, enabled by default through Basic Auth protection. The protection must apply to both dashboard assets and the private dashboard API, while still allowing host applications to disable or replace Bullstudio protection when they intentionally own access control.

### Acceptance criteria

- [x] Embedded dashboards are protected by Basic Auth by default.
- [x] Protection covers dashboard assets and private dashboard API routes.
- [x] Invalid or missing credentials receive an authentication challenge.
- [x] Valid credentials can access the dashboard and API.
- [x] A configured opt-out path supports host-owned access control.
- [x] Tests cover default Basic Auth, valid credentials, invalid credentials, and disabled/replaced protection behavior.

Progress:

- Added embedded-core dashboard protection enforcement around dashboard assets and the private dashboard API.
- Basic Auth protection now challenges missing or invalid credentials with `WWW-Authenticate`.
- Valid default credentials can access embedded dashboard assets and private tRPC API routes.
- Disabled and custom protection configurations bypass Bullstudio-owned protection so host applications can own access control.
- Verified with `pnpm --filter @bullstudio/hono test`, `pnpm --filter @bullstudio/hono typecheck`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, `pnpm exec biome check packages/hono-adapter packages/embedded-core`, and `pnpm typecheck`.

## 6. Enforce read-only dashboards in the core operation layer

Status: Complete

Type: AFK

Blocked by: Tasks 3, 4

User stories covered: 15, 16, 17, 18

### What to build

Add read-only dashboard support in embedded core. Mutating operations remain enabled by default, but when read-only mode is configured, mutating private dashboard API calls must be rejected by the core/server layer even if the request bypasses the UI.

### Acceptance criteria

- [x] Dashboard instances can be configured as read-only.
- [x] Read-only dashboards still allow non-mutating queue and job reads.
- [x] Read-only dashboards reject queue pause/resume, job retry, job removal, and other mutating operations exposed by the current dashboard.
- [x] Rejections use a clear authorization-style error.
- [x] The UI receives enough capability/state information to hide or disable mutating controls.
- [x] Tests verify server-side rejection of direct mutating API calls.

Progress:

- Added read-only mutation enforcement in embedded-core dashboard operations.
- Added private tRPC mutations for queue pause/resume and job retry/removal through the embedded core operation layer.
- Read-only private API mutation attempts now return a clear forbidden error before adapter operations run.
- Queue source status now exposes `readOnly` and `mutationsAllowed` for UI-facing state.
- Added core tests for read-only reads, read-only mutation rejection, and default writable mutation delegation.
- Added Hono/private API tests for read-only queue and job mutation rejection.
- Verified with `pnpm --filter @bullstudio/hono test`, `pnpm --filter @bullstudio/hono typecheck`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, `pnpm exec biome check packages/hono-adapter packages/embedded-core`, and `pnpm typecheck`.

## 7. Support dashboard and document identity in embedded mode

Status: Complete

Type: AFK

Blocked by: Task 4

User stories covered: 23, 24, 25

### What to build

Allow embedded dashboards to configure dashboard identity and document identity. Dashboard identity covers visible title and logo. Document identity covers browser document title and favicon. This slice should avoid arbitrary metadata display and full theming.

### Acceptance criteria

- [x] Dashboard instances accept title and logo configuration.
- [x] Dashboard instances accept document title and favicon configuration.
- [x] Dashboard assets receive identity configuration without requiring users to rebuild or copy frontend assets.
- [x] The UI renders the configured dashboard title and logo.
- [x] The served document uses the configured document title and favicon.
- [x] Tests verify configured identity values appear in the served dashboard experience.

Progress:

- Embedded dashboard HTML now renders configured dashboard title and logo.
- Served document HTML now uses configured document title and favicon.
- Embedded dashboard asset script now receives dashboard and document identity configuration at request time.
- Added Hono integration coverage for configured dashboard title, dashboard logo, document title, favicon, and runtime identity payload from a non-root mount path.
- Verified with `pnpm --filter @bullstudio/hono test`, `pnpm --filter @bullstudio/hono typecheck`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, `pnpm exec biome check packages/hono-adapter packages/embedded-core`, and `pnpm typecheck`.

## 8. Refactor standalone mode onto the embedded core with parity tests

Status: Complete

Type: AFK

Blocked by: Tasks 1, 3, 4, 5

User stories covered: 22, 30, 31, 35

### What to build

Refactor standalone mode to use the embedded core internally while preserving existing CLI behavior. Standalone mode should continue using Redis discovery as its queue source, keep root-mounted dashboard routes, keep private tRPC route shape, keep Basic Auth behavior, and keep existing CLI flags and environment variables.

### Acceptance criteria

- [x] Existing CLI commands, flags, environment variables, default port, and Redis discovery behavior continue to work.
- [x] The standalone dashboard remains mounted at root.
- [x] Existing health check routes continue to work.
- [x] Existing private tRPC route shape continues to work.
- [x] Existing production Basic Auth behavior continues to work.
- [x] Standalone mode uses the embedded core internally.
- [x] Parity tests verify root asset serving, private dashboard API access, health checks, Basic Auth behavior, and Redis-discovered queue behavior.

Progress:

- Added `createStandaloneDashboard()` to `@bullstudio/embedded-core` for standalone-mode asset/API mounting through the shared dashboard protection layer.
- Extracted the production Hono app into `apps/cli/server/standalone.ts`.
- Refactored `apps/cli/server/production.ts` to start the extracted standalone app while preserving port, host, shutdown, and provider disconnect behavior.
- Kept the existing standalone private tRPC router and Redis-discovery provider path intact.
- Added standalone parity tests for root asset serving, immutable asset cache headers, health checks, production Basic Auth, private tRPC access, and Redis-discovered queue listing through the real tRPC router with a mocked queue provider.
- Verified with `pnpm --filter bullstudio test`, `pnpm --filter bullstudio typecheck`, `pnpm --filter bullstudio build`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/embedded-core typecheck`, `pnpm exec biome check apps/cli/server apps/cli/src/server packages/embedded-core`, and `pnpm typecheck`.

## 9. Make the dashboard UI mode-aware for queue source status

Status: Complete

Type: AFK

Blocked by: Tasks 3, 8

User stories covered: 18, 21, 22

### What to build

Update the dashboard UI and private dashboard API responses so standalone mode continues to show Redis connection information while embedded mode shows queue source status. The UI should use adapter capabilities to hide or disable unsupported features.

### Acceptance criteria

- [x] Standalone mode still displays Redis connection information.
- [x] Embedded mode displays queue source status instead of Redis connection details.
- [x] Embedded mode shows supplied queue count and adapter/provider information.
- [x] Unsupported features are hidden or disabled based on adapter capabilities.
- [x] Tests verify mode-specific status responses and UI-facing data shape.

Progress:

- Added a mode-aware standalone `connection.info` response that preserves Redis connection fields and exposes a UI-facing Redis queue source.
- Added embedded queue source status mode metadata so supplied-queue dashboards can be distinguished without Redis-specific fields.
- Added a queue source view model helper for standalone Redis status and embedded supplied-queue status, including adapter capability feature visibility/enabled state.
- Updated the sidebar, overview, and jobs routes to read queue source details and flow support through the normalized view model.
- Added tests for standalone Redis status responses, embedded supplied-queue status responses, and UI-facing status/capability normalization.
- Verified with `pnpm --filter bullstudio test`, `pnpm --filter @bullstudio/embedded-core test`, `pnpm --filter @bullstudio/hono test`, `pnpm exec biome check ...`, `pnpm --filter bullstudio build`, and `pnpm typecheck`.

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
