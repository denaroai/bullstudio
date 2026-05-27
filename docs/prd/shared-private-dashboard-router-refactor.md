# Shared Private Dashboard Router Refactor Plan

## Purpose

This plan turns the embedded compatibility work into the next architecture slice:
one private dashboard router contract shared by standalone mode and embedded
mode, backed by mode-specific queue sources. The goal is to remove the copied
procedure behavior now living in `apps/cli` and `@bullstudio/embedded-core`
without changing the React dashboard client shape or regressing standalone Redis
discovery behavior.

This plan follows ADR 0003. It is intentionally a plan, not the refactor itself.

## Shared Router Contract

The shared router should expose the current private dashboard procedure surface
through tRPC with `superjson`. The React dashboard should keep calling the same
procedure names while the router delegates queue discovery, queue lookup, and
queue operations to a queue source.

### Connection and Queue Source

`connection.info`

Response shape:

```ts
type ConnectionInfo = {
  mode: "standalone" | "embedded";
  providerType: string;
  prefixes: string[];
  capabilities: {
    supportsFlows: boolean;
    supportedStatuses: string[];
  };
  queueSource: QueueSourceStatus;
  host?: string;
  port?: string;
  hasPassword?: boolean;
  database?: string;
  displayUrl?: string;
};
```

Standalone mode keeps Redis compatibility fields: `host`, `port`,
`hasPassword`, `database`, and `displayUrl`. Embedded mode must not invent those
Redis fields. Both modes return `queueSource` as the canonical source status.

`queueSource.status`

Response shape:

```ts
type QueueSourceStatus =
  | {
      mode: "standalone";
      source: "redis";
      status: "healthy" | "degraded" | "unavailable";
      connection: {
        host: string;
        port: string;
        hasPassword: boolean;
        database: string;
        displayUrl: string;
      };
      providers: string[];
      prefixes: string[];
      capabilities: {
        flows: boolean;
        supportedStatuses: string[];
        mutationsAllowed: boolean;
      };
    }
  | {
      mode: "embedded";
      source: "supplied";
      status: "healthy" | "degraded" | "unavailable";
      queueCount: number;
      providers: string[];
      capabilities: {
        flows: boolean;
        jobLogs: boolean;
        jobRemoval: boolean;
        jobRetry: boolean;
        queuePause: boolean;
        queueResume: boolean;
        workers: boolean;
        mutationsAllowed: boolean;
      };
      readOnly: boolean;
      mutationsAllowed: boolean;
    };
```

### Queues

`queues.list`

Returns the queues visible to the current mode. Standalone mode returns
discovered Redis queues. Embedded mode returns supplied queues only.

Response shape:

```ts
type DashboardQueue = {
  key?: string;
  name: string;
  label?: string;
  prefix?: string;
  provider?: string;
  isPaused?: boolean;
  jobCounts?: JobCounts;
  capabilities?: AdapterCapabilities;
};
```

Embedded mode should include `key`, `label`, `provider`, and per-queue
`capabilities`. Standalone mode does not need to create a queue key.

`queues.prefixes`

Returns discovered Redis prefixes in standalone mode and supplied queue prefixes
in embedded mode.

`queues.get`

Input shape:

```ts
type QueueTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
};
```

The shared resolver should prefer `queueKey` when present. `queueName` and
`prefix`, or legacy `name` and `prefix`, remain compatibility input. Embedded
mode must fail ambiguous queue name and prefix lookup with `BAD_REQUEST`.

`queues.pause` and `queues.resume`

Input shape: `QueueTargetInput`.

Response shape:

```ts
type QueueMutationResponse = { success: true };
```

The shared router must enforce read-only dashboards and per-queue pause/resume
capabilities before calling the queue source.

### Overview

`overview.metrics`

Input shape:

```ts
type OverviewMetricsInput = {
  timeRangeHours: number;
  queueKey?: string;
  queueName?: string;
  prefix?: string;
};
```

Response shape:

```ts
type OverviewMetricsResponse = {
  summary: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughputPerHour: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  };
  timeSeries: Array<{
    timestamp: number;
    completed: number;
    failed: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  }>;
  slowestJobs: Array<{
    id: string;
    name: string;
    queueName: string;
    processingTimeMs: number;
    timestamp: number;
    status: string;
  }>;
  failingJobTypes: Array<{
    name: string;
    queueName: string;
    failureCount: number;
    lastFailedAt: number;
    lastFailedReason?: string;
  }>;
  queuesCount: number;
  lastUpdated: number;
};
```

The implementation should keep the current completed and failed job aggregation
behavior and apply queue filtering through the shared queue target resolver.

### Jobs

`jobs.list` and `jobs.listSummary`

Input shape:

```ts
type JobListInput = {
  queueKey?: string;
  queueName?: string;
  prefix?: string;
  status?: JobStatus;
  limit?: number;
  offset?: number;
};
```

`jobs.list` returns `Job[]`. `jobs.listSummary` returns `JobSummary[]`.
Embedded mode may add a private optional `queueKey` field to each returned item
so dashboard navigation can target the correct supplied queue. Standalone mode
should tolerate that field but should not require it.

The shared router should merge queue results, sort by descending timestamp, and
apply `offset` and `limit` globally after merge.

`jobs.get`, `jobs.logs`, `jobs.retry`, and `jobs.remove`

Input shape:

```ts
type JobTargetInput = {
  queueKey?: string;
  queueName: string;
  prefix?: string;
  jobId: string;
};
```

Response shapes:

```ts
type JobLogsResponse = { logs: string[]; count: number };

type JobRetryResponse = {
  success: true;
  message: string;
  workerCount: number;
};

type JobRemoveResponse = {
  success: true;
  message: string;
};
```

The shared router should enforce job logs, retry, removal, and worker
visibility capabilities through the selected queue source. Retry keeps the
current preconditions: the job must exist, the job must be failed, and when
worker visibility is supported the selected queue must have at least one worker.

### Flows

`flows.list`

Input shape:

```ts
type FlowListInput = { limit?: number } | undefined;
```

Response shape: `FlowSummary[]`, with embedded mode allowed to add optional
private `queueKey` source identity.

`flows.get`

Input shape:

```ts
type FlowTargetInput = {
  queueKey?: string;
  queueName: string;
  prefix?: string;
  flowId: string;
};
```

Response shape: `FlowTree`.

The shared router should expose flows only when the queue source and selected
queue support flows. Embedded mode skips unsupported supplied queues for
`flows.list` and returns `BAD_REQUEST` for `flows.get` against an unsupported
queue.

## Mode-Specific Queue Sources

The shared router should depend on a small queue source interface rather than on
Redis discovery or embedded dashboard instances directly.

```ts
interface PrivateDashboardQueueSource {
  mode: "standalone" | "embedded";
  readOnly: boolean;
  getStatus(): Promise<QueueSourceStatus>;
  listQueues(): Promise<DashboardQueue[]>;
  listPrefixes(): Promise<string[]>;
  resolveQueue(input: QueueTargetInput): Promise<ResolvedQueue>;
  listJobs(input: JobListInput): Promise<Array<Job & { queueKey?: string }>>;
  listJobSummaries(
    input: JobListInput,
  ): Promise<Array<JobSummary & { queueKey?: string }>>;
  getJob(input: JobTargetInput): Promise<Job | null>;
  getJobLogs(input: JobTargetInput): Promise<JobLogsResponse>;
  retryJob(input: JobTargetInput): Promise<JobRetryResponse>;
  removeJob(input: JobTargetInput): Promise<JobRemoveResponse>;
  pauseQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  resumeQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  listFlows(input?: FlowListInput): Promise<Array<FlowSummary & { queueKey?: string }>>;
  getFlow(input: FlowTargetInput): Promise<FlowTree | null>;
}
```

`StandaloneQueueSource` plugs the existing `apps/cli` queue provider into this
interface. It owns Redis connection parsing, Redis prefix discovery, standalone
queue discovery, and standalone compatibility-sensitive error messages.

`EmbeddedQueueSource` plugs supplied queue adapters from
`@bullstudio/embedded-core` into this interface. It owns supplied queue lookup,
queue key preference, ambiguous queue name and prefix rejection, read-only
configuration, and per-queue adapter capability checks.

The router should own shared input parsing, shared response envelopes, mutation
guard calls, and aggregation policies that are identical across modes. The queue
sources should own mode-specific discovery and queue operation mechanics.

## Compatibility Shims to Remove

After the shared router is adopted, these compatibility shims should be removed
or reduced:

- The separate embedded `createPrivateDashboardApiRouter` procedure matrix in
  `@bullstudio/embedded-core`.
- Duplicate overview aggregation code between `apps/cli` and
  `@bullstudio/embedded-core`.
- Duplicate job list merge, sort, and global pagination code.
- Duplicate job retry and remove response message construction.
- Duplicate flow list and flow detail response construction.
- Embedded input unwrapping helpers that exist only because the embedded router
  manually mirrors tRPC behavior.
- Standalone UI tolerance code should remain only where it protects older links
  or optional embedded `queueKey` fields.

Do not remove the private optional `queueKey` navigation support until the UI has
another safe way to target duplicate supplied queues.

## Package Boundaries

Create a new internal package, `@bullstudio/private-router`, for the shared
router and mode-neutral helpers. It should be private to the workspace at first.

Proposed ownership:

- `@bullstudio/private-router`: tRPC router factory, procedure input schemas,
  response contracts, shared aggregation, target resolution orchestration,
  mutation guard orchestration, and contract tests.
- `apps/cli`: `StandaloneQueueSource`, Redis URL parsing, Redis provider
  lifecycle, standalone server wiring, standalone auth, and CLI production
  server behavior.
- `@bullstudio/embedded-core`: `EmbeddedQueueSource`, embedded dashboard asset
  serving, supplied queue adapter contracts, read-only configuration, framework
  request/response types, and framework-neutral embedded mount behavior.
- Framework adapters: continue to be thin request/response wrappers around
  `@bullstudio/embedded-core`.
- Queue adapters: continue to implement the supplied queue adapter contract and
  should not import the private router.

Deep modules worth extracting inside `@bullstudio/private-router`:

- `createPrivateDashboardRouter(source)` as the small public entrypoint.
- `resolveQueueTarget(source, input)` for queue key and compatibility lookup.
- `createMutationGuard(source)` for read-only and capability enforcement.
- `aggregateOverviewMetrics(jobs, timeRangeHours, queuesCount)`.
- `mergeSortAndPageJobs(jobs, input)`.
- `createConnectionInfo(source)` for standalone and embedded response shaping.

## Standalone Preservation

Standalone mode must preserve:

- Root-mounted dashboard routes and `/api/trpc` private API paths.
- Basic Auth behavior in production.
- Redis URL parsing and displayed connection details.
- Redis queue discovery and Redis prefix discovery.
- Existing queue name and prefix inputs for all queue-targeted routes.
- Existing retry precondition behavior requiring workers.
- Existing tRPC procedure names and response shapes consumed by the React
  dashboard.
- Existing standalone tests and CLI build behavior.

Standalone mode may accept optional `queueKey` fields in shared schemas, but it
must ignore them unless a future standalone queue source defines canonical queue
keys.

## Migration Order

1. Add `@bullstudio/private-router` with the shared contract, pure aggregation
   helpers, and contract tests driven by fake queue sources.
2. Port embedded core to `EmbeddedQueueSource` behind the shared router while
   keeping framework adapter tests green.
3. Port standalone `apps/cli` routers to `StandaloneQueueSource` behind the
   shared router while keeping standalone server tests green.
4. Delete duplicate embedded compatibility router helpers after both modes use
   the shared router.
5. Delete duplicate standalone router helpers after standalone uses the shared
   router.
6. Run browser verification through the Next embedded example and standalone CLI
   smoke checks.
7. Revisit whether `@bullstudio/private-router` remains private or becomes an
   internal export of `@bullstudio/embedded-core` after package boundaries settle.

Each migration step should be small enough to land independently with tests.

## Test Strategy

Contract tests in `@bullstudio/private-router` should use fake
`StandaloneQueueSource` and `EmbeddedQueueSource` implementations to verify:

- Every shared procedure name exists and returns the documented response shape.
- `connection.info` preserves standalone Redis compatibility fields and omits
  them in embedded mode.
- `queueSource.status` reports mode-specific status.
- Queue key lookup is preferred when present.
- Queue name and prefix compatibility lookup works.
- Embedded ambiguous queue name and prefix lookup returns `BAD_REQUEST`.
- Read-only dashboards reject `queues.pause`, `queues.resume`, `jobs.retry`,
  and `jobs.remove`.
- Capability checks reject unsupported logs, retry, removal, pause, resume, and
  flows.
- Overview metrics keep the existing completed and failed aggregation behavior.
- Jobs list and summary merge, sort, and paginate globally.
- Job detail, logs, retry, and remove preserve current success and error
  payloads.
- Flows list and detail preserve current success and error payloads.

Mode integration tests should then verify:

- `@bullstudio/embedded-core` uses `EmbeddedQueueSource` and still passes the
  embedded parity matrix.
- `apps/cli` uses `StandaloneQueueSource` and still passes standalone server
  behavior.
- Hono, Express, Fastify, and Next adapter smoke tests still prove mounted
  private API requests remain under the configured mount path.
- The Next embedded example still loads overview, jobs, job detail, logs,
  retry/remove, flows list, and flow detail without missing procedure errors.
- Standalone typecheck and build remain green.

## Maintainer Review Gate

Implementation of this refactor should not start until a maintainer confirms:

- `@bullstudio/private-router` is the desired package boundary.
- The `PrivateDashboardQueueSource` interface is the desired deep module seam.
- The shared procedure contract above is complete for the current dashboard.
- The migration order is acceptable.
- The standalone preservation list is sufficient.

If review changes the package boundary, update this plan before starting the
implementation slice.
