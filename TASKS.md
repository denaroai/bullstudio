# Embedded Queue Management Parity Tasks

Parent: [Embedded Queue Management Parity PRD](./docs/prd/embedded-queue-management-parity.md)

These tasks break the PRD into dependency-ordered tracer-bullet slices. Each task should preserve the vocabulary and constraints in [CONTEXT.md](./CONTEXT.md), [ADR 0001](./docs/adr/0001-embedded-dashboard-architecture.md), [ADR 0002](./docs/adr/0002-preserve-standalone-behavior-during-embedded-extraction.md), and [ADR 0003](./docs/adr/0003-shared-private-dashboard-router-shape.md).

## 1. Add embedded private API queue source compatibility

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 2, 3, 4, 5, 30, 31, 32, 37, 39

### What to build

Make the embedded private dashboard API answer the connection and queue procedures that the real dashboard assets already call, while keeping supplied queues and queue keys as the embedded-mode source of truth. This slice should make the embedded dashboard shell, sidebar, overview queue selector, and queue source display load without missing-procedure errors.

### Acceptance criteria

- [x] `connection.info` returns embedded queue source status for supplied queues.
- [x] `connection.info` does not invent Redis host, port, database, password, or display URL values in embedded mode.
- [x] `connection.info` includes any legacy compatibility fields needed by current dashboard assets without changing the canonical queue source status.
- [x] `queues.list` returns supplied queues with queue key, queue label, provider, per-queue capabilities, queue name, and prefix when available.
- [x] `queues.prefixes` returns only supplied queue prefixes derived from supplied queue metadata.
- [x] `queues.get` accepts queue key and standalone-style queue name/prefix compatibility input.
- [x] Queue name/prefix lookup returns not found when no supplied queue matches.
- [x] Queue name/prefix lookup returns bad request when more than one supplied queue matches.
- [x] Embedded core tests cover the private API behavior.
- [x] Existing standalone behavior remains unchanged.

## 2. Add embedded overview metrics parity

Type: AFK

Blocked by: Task 1

User stories covered: 5, 6, 7, 8, 29, 30, 31, 37, 39

### What to build

Make the embedded overview screen work end-to-end against supplied queues. The private dashboard API should aggregate completed and failed job summaries from matching supplied queues, apply the requested time range, and return the same overview response shape the current dashboard assets expect.

### Acceptance criteria

- [x] `overview.metrics` works in embedded mode without missing-procedure errors.
- [x] Metrics aggregate completed and failed jobs from supplied queues only.
- [x] Queue filtering works with queue key when provided.
- [x] Queue filtering accepts queue name/prefix as compatibility input.
- [x] Ambiguous queue name/prefix filters fail clearly instead of choosing a queue.
- [x] Time-range filtering matches the current completed/failed overview behavior.
- [x] Response shape remains compatible with the current overview UI.
- [x] Embedded core tests cover all-queue metrics, single-queue metrics, time ranges, and ambiguous compatibility lookup.
- [x] The overview page can be browser-verified in the Next embedded example.

## 3. Add embedded job list parity and source queue identity

Type: AFK

Blocked by: Task 1

User stories covered: 9, 10, 11, 12, 13, 14, 29, 30, 31, 37, 38, 39

### What to build

Make the embedded jobs screen list jobs from supplied queues with the current dashboard filters and sorting behavior. Aggregated embedded job list responses should carry optional private `queueKey` source identity so clicking a job can navigate to the correct supplied queue even when queue name and prefix are ambiguous.

### Acceptance criteria

- [x] `jobs.listSummary` works in embedded mode for all supplied queues.
- [x] `jobs.list` works in embedded mode for all supplied queues.
- [x] Queue filtering works with queue key when provided.
- [x] Queue filtering accepts queue name/prefix as compatibility input.
- [x] Status filtering works for the current dashboard job statuses.
- [x] Aggregated results are sorted consistently after merging supplied queue results.
- [x] Requested limits apply globally to the returned response after merge and sort.
- [x] Embedded aggregate job list items include optional `queueKey`.
- [x] The optional `queueKey` field is treated as private dashboard API data, not a public connect-types contract change.
- [x] The jobs UI prefers queue key when available and falls back to queue name/prefix for standalone behavior.
- [x] Embedded core tests cover aggregation, filtering, sorting, global limits, and optional source queue key.
- [x] UI or route tests cover preserving standalone links while adding optional queue key links for embedded mode.

## 4. Add embedded job detail, logs, retry, and remove parity

Type: AFK

Blocked by: Tasks 1, 3

User stories covered: 15, 16, 17, 18, 19, 20, 21, 22, 23, 29, 30, 31, 33, 34, 36, 37, 38, 39

### What to build

Make job detail routes operational in embedded mode. The private dashboard API should resolve target queues by queue key when present, accept queue name/prefix compatibility input, enforce read-only and per-queue capabilities, and return payloads compatible with the current job detail UI.

### Acceptance criteria

- [x] `jobs.get` works in embedded mode with queue key.
- [x] `jobs.get` accepts queue name/prefix compatibility input.
- [x] `jobs.logs` returns logs and count when the target queue supports job logs.
- [x] `jobs.logs` returns bad request when the target queue does not support job logs.
- [x] `jobs.retry` requires job retry capability.
- [x] `jobs.retry` validates that the target job exists.
- [x] `jobs.retry` validates that the target job is failed.
- [x] `jobs.retry` checks worker count as a precondition when the target queue supports workers.
- [x] `jobs.retry` does not block on worker count when worker visibility is unsupported.
- [x] `jobs.retry` returns the current UI-compatible success payload with a numeric worker count.
- [x] `jobs.remove` requires job removal capability.
- [x] Mutating job operations are rejected for read-only dashboards.
- [x] Ambiguous queue name/prefix lookup fails clearly for all job detail procedures.
- [x] Job detail routes accept optional queue key while preserving queue name/prefix for standalone and existing links.
- [x] Embedded core tests cover success, not found, unsupported capability, read-only rejection, worker precondition, and ambiguous lookup behavior.
- [x] The job detail screen can be browser-verified in the Next embedded example.

## 5. Add embedded queue pause and resume parity

Type: AFK

Blocked by: Task 1

User stories covered: 24, 25, 29, 30, 31, 33, 34, 36, 37, 39

### What to build

Make queue pause and resume work through the embedded private dashboard API using queue key as canonical identity and queue name/prefix as compatibility lookup input. This task is in scope even if the current React screens expose little or no queue pause/resume UI, because pause and resume are core queue-management operations.

### Acceptance criteria

- [x] `queues.pause` accepts queue key.
- [x] `queues.pause` accepts queue name/prefix compatibility input.
- [x] `queues.pause` requires the target queue's pause capability.
- [x] `queues.resume` accepts queue key.
- [x] `queues.resume` accepts queue name/prefix compatibility input.
- [x] `queues.resume` requires the target queue's resume capability.
- [x] Pause and resume return `{ success: true }` on success.
- [x] Pause and resume are rejected for read-only dashboards.
- [x] Ambiguous queue name/prefix lookup fails clearly for pause and resume.
- [x] Embedded core tests cover success, unsupported capability, read-only rejection, not found, and ambiguous lookup behavior.

## 6. Add embedded flow list and flow detail parity

Type: AFK

Blocked by: Tasks 1, 3

User stories covered: 26, 27, 28, 29, 30, 31, 34, 35, 36, 37, 38, 39

### What to build

Make the embedded flows screen and flow detail screen operate against supplied queues. Dashboard-level flow navigation should follow aggregate capabilities, while flow operations should use per-queue capabilities and queue-key-aware target resolution.

### Acceptance criteria

- [x] `flows.list` aggregates flows only from supplied queues whose per-queue capabilities include flows.
- [x] `flows.list` skips supplied queues that do not support flows.
- [x] `flows.list` returns an empty list when no supplied queues support flows.
- [x] `flows.list` applies the requested response limit after aggregation.
- [x] `flows.get` accepts queue key when provided.
- [x] `flows.get` accepts queue name/prefix compatibility input.
- [x] `flows.get` returns bad request when the matched supplied queue does not support flows.
- [x] `flows.get` returns not found when no matching flow exists.
- [x] Ambiguous queue name/prefix lookup fails clearly for flow detail.
- [x] Flow routes preserve standalone queue name/prefix links while carrying optional queue key for embedded links.
- [x] Embedded core tests cover mixed capability queues, unsupported flows, not found, and ambiguous lookup behavior.
- [x] The flows list and flow detail screens can be browser-verified in the Next embedded example when a supplied queue supports flows.

## 7. Add mounted adapter smoke coverage for the compatibility layer

Type: AFK

Blocked by: Tasks 1, 2, 3, 4, 5, 6

User stories covered: 1, 5, 33, 34, 37, 39

### What to build

Add framework-adapter smoke tests that prove mounted private dashboard API requests reach the embedded core compatibility behavior under a non-root mount path. The behavior matrix belongs in embedded core tests; adapter tests should stay narrow and verify integration at the mount boundary.

### Acceptance criteria

- [x] At least one framework adapter test verifies `connection.info` through a mounted embedded dashboard.
- [x] At least one framework adapter test verifies a read procedure such as `jobs.listSummary` or `overview.metrics` through the mount path.
- [x] At least one framework adapter test verifies a mutating procedure still respects read-only protection through the mount path.
- [x] Tests prove private dashboard API requests stay under the configured mount path.
- [x] Tests avoid duplicating the full embedded core behavior matrix across every framework adapter.
- [x] Existing framework adapter tests continue to pass.

## 8. Verify embedded dashboard parity in the Next example

Type: AFK

Blocked by: Tasks 1, 2, 3, 4, 5, 6, 7

User stories covered: 1, 5, 9, 15, 16, 18, 23, 26, 28, 38, 39

### What to build

Run the real dashboard assets inside the Next.js embedded example and verify the current queue-management screens work against supplied queues from the browser. This task closes the loop between embedded core compatibility, framework mounting, runtime base path handling, and the React dashboard.

### Acceptance criteria

- [x] The Next embedded example starts successfully.
- [x] The dashboard renders at the configured non-root mount path.
- [x] Dashboard assets load from the configured mount path.
- [x] Private dashboard API requests use the configured mount path.
- [x] Overview loads without missing-procedure errors.
- [x] Jobs list loads without missing-procedure errors.
- [x] Job detail loads without missing-procedure errors.
- [x] Job logs, retry, and remove behavior can be exercised or explicitly verified with fixture constraints.
- [x] Flows list and flow detail are verified when the example supplies flow-capable data.
- [x] Browser console has no relevant errors or warnings from missing private dashboard API procedures.
- [x] Standalone mode still passes its existing tests, typecheck, and build checks after the embedded UI changes.

## 9. Plan the shared private dashboard router refactor

Type: HITL

Blocked by: Tasks 1, 2, 3, 4, 5, 6, 7, 8

User stories covered: 37, 38, 39, 40

### What to build

Turn the compatibility-layer learnings into a concrete refactor plan for the long-term shared private dashboard router shape described by ADR 0003. This task should not implement the refactor; it should define the target contract, package boundaries, migration order, and tests needed to move standalone and embedded mode onto one private router shape.

### Acceptance criteria

- [ ] The plan defines the shared private dashboard router contract at the procedure and response-shape level.
- [ ] The plan defines how standalone discovered queues and embedded supplied queues plug into the shared router through mode-specific queue sources.
- [ ] The plan identifies which compatibility shims can be removed after the refactor.
- [ ] The plan identifies package boundary changes and any deep modules worth extracting.
- [ ] The plan preserves standalone compatibility-sensitive behavior.
- [ ] The plan includes a test strategy for migrating without regressing embedded parity or standalone behavior.
- [ ] Maintainer review confirms the refactor direction before implementation starts.
