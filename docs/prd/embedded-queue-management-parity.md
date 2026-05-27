# Embedded Queue Management Parity PRD

## Problem Statement

Embedded mode now serves the real Bullstudio dashboard assets, but those assets expect the private dashboard API shape currently provided by standalone mode. The embedded private dashboard API exposes only a smaller set of procedures, so the real dashboard can render but cannot reliably inspect or manage supplied queues across the existing queue-management screens.

Operators need embedded mode to provide queue management parity with standalone mode for supplied queues. Redis direct connection details, Redis prefix scanning, and queue discovery remain standalone-mode concerns.

## Solution

Add an embedded-mode compatibility layer to the private dashboard API so the existing dashboard assets can inspect and manage supplied queues through the current queue-management screens. The compatibility layer maps the standalone private procedure shape onto embedded core operations, using queue keys as the canonical embedded identity while accepting queue name and prefix only as private API compatibility lookup input.

This slice should make the current embedded dashboard operational for overview metrics, queue lists, job lists, job detail, logs, retry, removal, queue pause/resume, flow list, and flow detail. It should enforce read-only dashboards and adapter capabilities on the server side. A later refactor slice will converge standalone mode and embedded mode on one shared private dashboard router shape backed by mode-specific queue sources.

## User Stories

1. As an operator, I want embedded mode to show the same queue-management screens as standalone mode, so that I can use Bullstudio inside a host application without losing dashboard functionality.
2. As an operator, I want embedded mode to inspect only supplied queues, so that the dashboard reflects what the host application intentionally exposes.
3. As an operator, I want embedded mode to avoid Redis queue discovery, so that mounting Bullstudio does not expose queues outside the host application's supplied set.
4. As an operator, I want embedded mode to show queue source status instead of Redis connection details, so that the dashboard accurately describes what Bullstudio owns.
5. As an operator, I want the overview screen to load in embedded mode without missing-procedure errors, so that the dashboard is usable immediately after mounting.
6. As an operator, I want overview metrics for supplied queues, so that I can understand completed and failed job activity.
7. As an operator, I want overview metrics to support queue filtering, so that I can inspect one supplied queue at a time.
8. As an operator, I want overview metrics to preserve the current completed/failed time-range behavior, so that embedded mode matches standalone dashboard expectations.
9. As an operator, I want the jobs screen to list jobs from supplied queues, so that I can inspect recent queue activity.
10. As an operator, I want the jobs screen to filter by supplied queue, so that I can focus on one queue.
11. As an operator, I want the jobs screen to filter by job status, so that I can find failed, active, waiting, delayed, paused, completed, and waiting-children jobs.
12. As an operator, I want job list results sorted consistently after aggregating supplied queues, so that the most relevant jobs are shown first.
13. As an operator, I want aggregate job list limits to apply to the returned response, so that requesting a limit produces a bounded list across all matching queues.
14. As an operator, I want each embedded job list item to carry enough private source identity to navigate to the correct supplied queue, so that duplicate queue name and prefix combinations do not break job detail links.
15. As an operator, I want job detail to load in embedded mode, so that I can inspect job data, status, attempts, timestamps, result, failures, and related metadata.
16. As an operator, I want job logs to load when the supplied queue adapter supports logs, so that I can debug job execution.
17. As an operator, I want unsupported job logs to fail as an unsupported capability, so that missing logs are not confused with missing jobs.
18. As an operator, I want to retry failed jobs when the supplied queue adapter supports retry, so that I can recover from transient failures.
19. As an operator, I want retry to validate that a job exists and is failed, so that invalid retries return useful errors.
20. As an operator, I want retry to use worker count as a precondition when the adapter supports workers, so that I get standalone-like feedback when no workers are available.
21. As an operator, I want retry not to be blocked by unavailable worker visibility, so that adapters without worker visibility can still retry when they support retry.
22. As an operator, I want retry responses to remain compatible with the current dashboard UI, so that this slice does not require broad UI rewrites.
23. As an operator, I want to remove jobs when the supplied queue adapter supports removal, so that I can clear unwanted jobs.
24. As an operator, I want queue pause and resume operations in embedded mode, so that embedded remains a management dashboard rather than only an observer.
25. As an operator, I want queue pause and resume to respect per-queue capabilities, so that unsupported adapter operations are rejected.
26. As an operator, I want flows navigation to appear when at least one supplied queue supports flows, so that mixed queue sources still expose supported flow data.
27. As an operator, I want flows list to aggregate only queues that support flows, so that unsupported queues do not break supported flow inspection.
28. As an operator, I want flow detail to resolve against the correct supplied queue, so that flow inspection works in embedded mode.
29. As an operator, I want ambiguous queue name and prefix lookups to fail clearly, so that actions never target the wrong supplied queue.
30. As an application developer, I want queue key to remain the canonical embedded queue identity, so that duplicate supplied queue identities can be represented safely.
31. As an application developer, I want the private dashboard API to accept queue name and prefix for compatibility only, so that existing dashboard assets and standalone links keep working.
32. As an application developer, I want supplied queue prefixes to come only from supplied queue metadata, so that embedded mode does not scan Redis prefixes.
33. As an application developer, I want read-only dashboards to block mutating operations server-side, so that direct private API calls cannot bypass UI state.
34. As an application developer, I want adapter capabilities to be enforced server-side, so that private dashboard API calls cannot perform unsupported operations.
35. As an application developer, I want aggregate capabilities to control dashboard-level navigation, so that pages appear when at least one supplied queue can support them.
36. As an application developer, I want per-queue capabilities to control selected queue operations, so that each supplied queue is governed by its own adapter contract.
37. As a maintainer, I want the compatibility layer to live in embedded core for this slice, so that framework adapters remain thin wrappers.
38. As a maintainer, I want the React dashboard changes to be minimal and additive, so that standalone behavior remains compatibility-sensitive.
39. As a maintainer, I want standalone mode to remain behaviorally unchanged, so that existing CLI users keep Redis discovery, Redis connection information, routes, and auth behavior.
40. As a maintainer, I want a later refactor slice for one shared private dashboard router shape, so that the compatibility layer does not become the unspoken long-term architecture.

## Implementation Decisions

- Queue management parity means operator-facing inspection and mutation capabilities over supplied queues, not Redis connection parity or queue discovery parity.
- Embedded mode continues to expose only supplied queues.
- Standalone mode continues to own Redis direct connection, Redis queue discovery, Redis connection details, and Redis prefix discovery.
- The immediate slice will add private dashboard API compatibility procedures in embedded core.
- The later refactor slice will converge standalone mode and embedded mode on one shared private dashboard router shape backed by mode-specific queue sources.
- The compatibility layer will support the existing private procedure surface used by the dashboard assets: connection information, queue list, queue prefixes, queue get, queue pause/resume, overview metrics, job list, job list summary, job get, job logs, job retry, job remove, flow list, and flow get.
- Embedded `connection.info` will return canonical queue source status for supplied queues.
- Embedded `connection.info` may include legacy top-level compatibility fields, but must not invent Redis host, port, database, password, or display URL values.
- Queue key is the canonical identity for embedded operations.
- Queue name and prefix are accepted only as compatibility lookup input in the private dashboard API.
- When queue key is present, the private dashboard API should prefer queue key over queue name and prefix.
- When queue name and prefix match no supplied queue, the private dashboard API should return a not-found error.
- When queue name and prefix match more than one supplied queue, the private dashboard API should return a bad-request error instead of choosing one.
- Supplied queue prefixes may be exposed only when derived from supplied queue metadata.
- Aggregate capabilities are used for dashboard-level navigation decisions.
- Per-queue capabilities are used for operations against a selected supplied queue.
- Read-only dashboards block mutating operations at the embedded core/private dashboard API boundary.
- Adapter capabilities are enforced at the embedded core/private dashboard API boundary.
- Overview metrics match the current dashboard behavior by aggregating completed and failed jobs within the requested time range.
- Aggregated list-style procedures apply the response limit globally after merging and sorting matching supplied queue results.
- Job list and job summary responses may include an optional private `queueKey` field in embedded mode so dashboard assets can navigate from aggregated lists to the correct supplied queue.
- The optional private `queueKey` field is not a public connect-types job contract change in this slice.
- Job logs require the target queue's job logs capability.
- Job retry requires the target queue's job retry capability.
- Job retry validates that the target job exists and is failed.
- Job retry uses worker count as a precondition when the target queue supports worker visibility.
- Job retry does not block on worker count when the target queue does not support worker visibility.
- Job retry returns a numeric worker count for current UI compatibility.
- Job removal requires the target queue's job removal capability.
- Queue pause requires the target queue's pause capability.
- Queue resume requires the target queue's resume capability.
- Flow list aggregates only supplied queues with flow capability and skips unsupported queues.
- Flow detail requires the matched supplied queue to support flows.
- The React dashboard should prefer queue key when available for embedded queue filters and target routes.
- Route/search params for queue-targeted pages should support optional queue key while preserving queue name and prefix for standalone and existing links.
- Standalone mode remains behaviorally unchanged except for tolerating optional queue key fields in shared UI code.

## Testing Decisions

- Tests should focus on external behavior of the private dashboard API and dashboard navigation, not implementation details.
- Embedded core private dashboard API tests should be the primary coverage for this slice.
- Framework adapter tests should include smoke coverage proving mounted private dashboard API requests reach the embedded core behavior.
- Existing standalone tests remain part of the safety net and should continue to pass.
- Embedded core tests should cover `connection.info` returning embedded queue source status without Redis connection details.
- Embedded core tests should cover queue list, queue prefixes, queue get, queue pause, and queue resume.
- Embedded core tests should cover overview metrics over supplied queues.
- Embedded core tests should cover job list and job list summary aggregation, sorting, global limits, status filtering, and optional queue key source identity.
- Embedded core tests should cover job get, job logs, retry, and removal.
- Embedded core tests should cover flow list and flow get.
- Embedded core tests should cover queue-key targeting.
- Embedded core tests should cover compatibility lookup by queue name and prefix.
- Embedded core tests should cover ambiguous queue name and prefix lookup failure.
- Embedded core tests should cover read-only mutation rejection.
- Embedded core tests should cover per-queue capability enforcement for logs, retry, removal, pause, resume, and flows.
- UI-oriented verification should prove the embedded dashboard can use every current queue-management screen without missing-procedure errors.
- Browser verification should run against the Next.js embedded example mounted under a non-root mount path.
- Verification should confirm dashboard assets and private dashboard API requests stay under the configured mount path.
- The broader safety run should include relevant embedded core tests, framework adapter tests, standalone dashboard checks, typecheck, and build.

## Out of Scope

- Redis queue discovery in embedded mode.
- Redis prefix scanning in embedded mode.
- Redis connection details in embedded mode.
- A public dashboard HTTP API.
- Replacing tRPC in this slice.
- A full React dashboard data-layer refactor in this slice.
- Making the optional embedded `queueKey` job source field a public connect-types job field.
- Changing standalone CLI flags, environment variables, Redis discovery behavior, authentication behavior, or root-mounted routes.
- Changing the dashboard product metrics beyond matching current completed/failed overview behavior.
- Adding new queue-management screens beyond the current dashboard surface.
- Reworking visual design of the dashboard.

## Further Notes

This PRD follows the glossary in the Bullstudio context document. The key distinction is that queue management parity applies to supplied queues in embedded mode, while Redis direct connection and queue discovery remain standalone-mode responsibilities.

ADR 0003 records the long-term architecture direction: converge on one shared private dashboard router shape for standalone mode and embedded mode, with mode-specific queue sources underneath. This PRD covers the compatibility slice needed to make the real embedded dashboard operational before that refactor.
