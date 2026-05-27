# Embedded Mode PRD

## Problem Statement

Bullstudio currently works as standalone mode: developers run a separate dashboard process that connects directly to Redis, discovers queues, and serves the UI. This is good for local inspection and standalone deployments, but it forces teams that want Bullstudio in production to provide extra infrastructure, networking, credentials, and operational surface area for a separate service.

Developers also need embedded mode: a way to mount Bullstudio inside an existing application, expose it at a mount path such as `/bullstudio`, and provide only the queues that application intentionally supplies. Embedded mode should preserve Bullstudio's management-dashboard behavior while reducing deployment friction and keeping the dashboard protected out of the box.

## Solution

Add embedded mode through a shared embedded core and framework adapter packages. A host application creates a dashboard through the `bullstudio()` dashboard factory exported by its framework adapter, supplies one or more function-created queue adapters, and mounts the native framework value at a single mount path.

The embedded core serves dashboard assets and the private dashboard API from the same mount path, uses Basic Auth protection by default, supports read-only dashboards, and treats supplied queues as host-owned queues. Standalone mode will be refactored to use the same embedded core internally while preserving existing CLI behavior, Redis discovery, root-mounted dashboard routes, private tRPC routes, and authentication behavior.

The first implementation slice is core + Hono + BullMQ adapter + standalone refactor. Express, Fastify, Next.js App Router, and Bull support follow after the first slice proves the core contract.

## User Stories

1. As an application developer, I want to mount Bullstudio in my existing application, so that I do not need to run a separate dashboard service.
2. As an application developer, I want to expose Bullstudio under one mount path, so that deployment and reverse-proxy configuration stay simple.
3. As an application developer, I want Bullstudio to serve its own dashboard assets, so that I do not need to copy or configure frontend files.
4. As an application developer, I want to provide queue adapters for specific queues, so that embedded mode only exposes queues I intentionally supply.
5. As an application developer, I want queue adapter setup to be function-based, so that configuration code stays concise.
6. As an application developer, I want queue keys to be inferred by default, so that the simplest setup requires minimal configuration.
7. As an application developer, I want duplicate inferred queue keys to fail fast, so that queue actions and URLs are never ambiguous.
8. As an application developer, I want to override a queue key when needed, so that I can disambiguate queues with the same natural identity.
9. As an application developer, I want to configure queue labels when useful, so that operators see clear queue names in the dashboard.
10. As an application developer, I want supplied queues to remain host-owned queues, so that Bullstudio never closes or owns my application's queue connections.
11. As an application developer, I want Bullstudio to use my installed BullMQ package, so that embedded mode operates on the same queue instances as my application.
12. As an application developer, I want Bullstudio to use my installed Bull package, so that Bull support does not install a second queue library copy.
13. As an application developer, I want Basic Auth protection by default, so that mounting Bullstudio does not accidentally expose production queue controls.
14. As an application developer, I want to disable or replace Bullstudio protection when my host app owns access control, so that embedded mode can fit existing security models.
15. As an application developer, I want a read-only dashboard option, so that production users can inspect queues without mutating jobs or queues.
16. As an application developer, I want read-only mode enforced by the server/core operation layer, so that direct API calls cannot bypass the UI.
17. As an operator, I want mutating operations available by default, so that embedded mode remains a management dashboard rather than only an observer.
18. As an operator, I want unsupported queue features hidden or disabled, so that the UI reflects each queue adapter's capabilities.
19. As an operator, I want BullMQ flows available when the adapter supports them, so that embedded mode preserves modern BullMQ inspection features.
20. As an operator, I want Bull queues to work after BullMQ support lands, so that existing Bullstudio users keep their current queue-library coverage.
21. As an operator, I want embedded mode to show queue source status instead of Redis connection details, so that the dashboard reflects what Bullstudio actually owns.
22. As an operator, I want standalone mode to keep showing Redis connection information, so that existing standalone diagnostics remain useful.
23. As an application developer, I want to configure the dashboard title, so that users know which dashboard they are viewing.
24. As an application developer, I want to configure the dashboard logo, so that embedded mode can reflect the host product or environment.
25. As an application developer, I want to configure the favicon and browser document title, so that the dashboard tab is recognizable.
26. As a Hono developer, I want a Hono-native `bullstudio()` return value, so that mounting the dashboard feels idiomatic in Hono.
27. As an Express developer, I want an Express-native adapter package, so that I can mount Bullstudio with normal Express middleware patterns.
28. As a Fastify developer, I want a Fastify-native adapter package, so that I can register Bullstudio with normal Fastify plugin patterns.
29. As a Next.js developer, I want App Router route-handler support, so that I can expose Bullstudio from a modern Next.js application.
30. As a CLI user, I want existing Bullstudio commands, environment variables, auth behavior, and routes to keep working, so that embedded mode does not break my current workflow.
31. As a maintainer, I want standalone mode and embedded mode to share one dashboard runtime, so that fixes and features do not drift between modes.
32. As a maintainer, I want framework adapters to be thin wrappers around the embedded core, so that behavior is consistent across supported frameworks.
33. As a maintainer, I want the private dashboard API to remain private in v1, so that the team can preserve implementation flexibility.
34. As a maintainer, I want polling in v1, so that all target framework adapters avoid live-update runtime complexity initially.
35. As a maintainer, I want parity tests around standalone behavior, so that extracting the embedded core does not regress the existing CLI.

## Implementation Decisions

- Bullstudio has two runtime modes: standalone mode and embedded mode.
- Standalone mode runs as its own process, connects directly to Redis, discovers queues, and serves the dashboard.
- Embedded mode is mounted inside a host application and works only with supplied queues.
- Embedded mode does not auto-discover queues from Redis in v1.
- The public embedded primitive is the dashboard factory named `bullstudio()`.
- Each framework adapter package exports `bullstudio()` as the primary factory.
- `bullstudio()` returns the native mountable value for its framework rather than a universal `.router` object.
- Supported framework adapters are Hono, Express, Fastify, and Next.js App Router.
- Framework adapters ship as separate packages.
- Queue adapters ship as separate packages from framework adapters.
- A shared embedded core owns dashboard instances, common behavior, dashboard assets, the private dashboard API, read-only enforcement, dashboard protection, queue source aggregation, and adapter contracts.
- Framework adapters are thin wrappers around the embedded core.
- Standalone mode is rebuilt internally on the embedded core, but its existing user-visible behavior remains compatibility-sensitive.
- The first implementation slice is embedded core + Hono adapter + BullMQ queue adapter + standalone refactor.
- Bull support follows immediately after the first slice rather than shipping inside the first slice.
- Express, Fastify, and Next.js App Router adapters follow after the first slice proves the core contract.
- Queue adapters are function-based as the primary public API.
- Queue adapters are per-queue values, not whole Redis backend providers.
- The embedded core aggregates many queue adapters into the dashboard's multi-queue view.
- BullMQ adapter support targets BullMQ 5+.
- Bull adapter support targets Bull 4+.
- Bull and BullMQ are peer dependencies of their queue adapter packages.
- Queue adapter packages may use Bull or BullMQ as development dependencies for tests.
- Queue adapters expose adapter capabilities so the UI and core can account for feature differences.
- Queue adapter capabilities cover operations and features such as flows, workers, job logs, queue pause/resume, job retry, and job removal.
- Supplied queues are host-owned queues. Bullstudio does not close or own their queue instances or Redis connections.
- Queue keys are inferred by default.
- Explicit queue keys are optional and used only to disambiguate collisions or unclear identity.
- Duplicate queue keys fail fast with a clear duplicate-key error.
- Queue labels are human-facing display names and can be inferred or configured.
- Embedded mode uses one mount path for UI, dashboard assets, and private dashboard API.
- Dashboard assets are served automatically by the dashboard instance.
- The private dashboard API remains tRPC for v1.
- The private dashboard API is not documented as a public integration API.
- Embedded mode uses polling in v1 rather than WebSockets or Server-Sent Events.
- Basic Auth protection is the default dashboard protection in embedded mode.
- Host applications may add their own access control around the mount path.
- Bullstudio protection can be disabled or replaced when the host application owns access control.
- Mutating operations are enabled by default.
- Read-only dashboards block mutating operations at the core/server operation layer.
- Dashboard identity supports title and logo in v1.
- Document identity supports favicon and browser document title in v1.
- Arbitrary metadata display is out of scope for v1.
- Embedded mode shows queue source status rather than Redis connection details.
- Standalone mode keeps Redis connection information.
- Existing CLI flags, environment variables, Basic Auth behavior, Redis discovery, root-mounted dashboard routes, and private tRPC routes remain compatibility-sensitive.
- ADR 0001 records the embedded dashboard architecture.
- ADR 0002 records the standalone compatibility constraint during embedded extraction.

## Testing Decisions

- Tests should focus on external behavior rather than implementation details.
- Existing queue provider tests remain part of the safety net.
- Standalone tests should verify that existing routes, health checks, private dashboard API behavior, Redis discovery behavior, and Basic Auth behavior remain compatible.
- Embedded Hono tests should mount a dashboard at a non-root mount path and verify dashboard asset responses from that mount path.
- Embedded Hono tests should verify private dashboard API responses from the same mount path.
- Embedded queue source tests should verify that only supplied queues are visible.
- Queue key tests should verify inferred keys, explicit keys, and duplicate-key failure.
- Queue adapter tests should verify BullMQ 5+ behavior through the adapter contract.
- Read-only tests should verify that mutating operations are rejected by the core/server layer, not only hidden by UI state.
- Dashboard protection tests should verify Basic Auth protection by default and the configured disabled/replaced protection path.
- Host-owned queue tests should verify that embedded adapters do not close supplied queue instances or connections.
- Adapter capability tests should verify that unsupported features are represented through capabilities.
- Standalone parity tests are required before changing CLI internals to depend on the embedded core.
- Prior art exists in the current provider and router tests for queue behavior, multi-prefix behavior, provider detection, and tRPC route behavior.

## Out of Scope

- Redis auto-discovery in embedded mode.
- A public REST API.
- Replacing tRPC in v1.
- WebSockets or Server-Sent Events in v1.
- Pages Router support for Next.js in v1.
- Bull support in the first implementation slice.
- Express, Fastify, and Next.js adapters in the first implementation slice.
- Arbitrary dashboard metadata display.
- Full theming or custom dashboard components.
- Bullstudio owning or closing host application queue instances.
- Silent queue key renaming.
- Changing existing CLI flags, environment variables, default port, Redis discovery behavior, authentication behavior, or root route behavior.

## Further Notes

This PRD uses the glossary in the Bullstudio context document. The most important distinction is queue source: standalone mode uses discovered queues from Redis, while embedded mode uses supplied queues from the host application.

The embedded core should be treated as a deep module. It should hide the complexity of dashboard assets, private dashboard API routing, protection, read-only enforcement, queue source aggregation, and mode-specific status behind a small stable interface used by framework adapters.

The first slice should prove that the shared runtime can support both an embedded Hono mount and the existing standalone CLI without user-visible CLI regressions. Once that is stable, adding more framework adapters should be mostly translation work.
