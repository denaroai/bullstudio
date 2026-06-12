import { createConnectionRouter } from "./routers/connection/router";
import { createFlowsRouter } from "./routers/flows/router";
import { createJobsRouter } from "./routers/jobs/router";
import { createOverviewRouter } from "./routers/overview/router";
import { createQueueSourceRouter } from "./routers/queueSource/router";
import { createQueuesRouter } from "./routers/queues/router";
import { createSchedulersRouter } from "./routers/schedulers/router";
import { createWorkersRouter } from "./routers/workers/router";
import type { PrivateDashboardQueueSource } from "./source";
import { t } from "./trpc";

export function createPrivateDashboardRouter(
  source: PrivateDashboardQueueSource,
) {
  return t.router({
    connection: createConnectionRouter(source),
    queueSource: createQueueSourceRouter(source),
    overview: createOverviewRouter(source),
    queues: createQueuesRouter(source),
    jobs: createJobsRouter(source),
    flows: createFlowsRouter(source),
    workers: createWorkersRouter(source),
    schedulers: createSchedulersRouter(source),
  });
}

export type PrivateDashboardRouter = ReturnType<
  typeof createPrivateDashboardRouter
>;

// --- value re-exports ---
export { createConnectionInfo } from "./routers/connection/service";
export {
  filterSortAndPageJobs,
  mergeSortAndPageJobs,
} from "./routers/jobs/list";
export { supportedJobStatuses } from "./routers/jobs/types";
export { aggregateOverviewMetrics } from "./routers/overview/metrics";
export { createMutationGuard } from "./shared/guards";
export { resolveQueueTarget } from "./shared/queue-target";

// --- type re-exports ---
export type { PrivateDashboardContext } from "./trpc";
export type { PrivateDashboardQueueSource } from "./source";
export type {
  AdapterCapabilities,
  DashboardQueue,
  QueueSourceStatus,
} from "./shared/queue";
export type {
  QueueMutationResponse,
  QueueTargetInput,
  ResolvedQueue,
} from "./shared/queue-target";
export type { ConnectionInfo } from "./routers/connection/types";
export type { FlowListInput, FlowTargetInput } from "./routers/flows/types";
export type {
  JobAddInput,
  JobAddResponse,
  JobListInput,
  JobListResponse,
  JobListSortField,
  JobListSortOrder,
  JobLogsResponse,
  JobRemoveResponse,
  JobRetryAllResponse,
  JobRetryResponse,
  JobTargetInput,
} from "./routers/jobs/types";
export type {
  OverviewMetricsInput,
  OverviewMetricsResponse,
  QueueMetricsListInput,
  QueueMetricsSummary,
} from "./routers/overview/types";
export type {
  SchedulerListInput,
  SchedulerMutationResponse,
  SchedulerTargetInput,
  SchedulerUpsertInput,
} from "./routers/schedulers/types";
export type {
  WorkerListInput,
  WorkerTargetInput,
} from "./routers/workers/types";
