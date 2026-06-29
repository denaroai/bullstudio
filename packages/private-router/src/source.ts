import type {
  FlowSummary,
  FlowTree,
  Job,
  JobScheduler,
  JobSummary,
  Worker,
} from "@bullstudio/connect-types";
import type { DashboardQueue, QueueSourceStatus } from "./shared/queue";
import type {
  QueueMutationResponse,
  QueueTargetInput,
  ResolvedQueue,
} from "./shared/queue-target";
import type { FlowListInput, FlowTargetInput } from "./routers/flows/types";
import type {
  JobAddInput,
  JobAddResponse,
  JobListInput,
  JobLogsResponse,
  JobRemoveResponse,
  JobRetryAllResponse,
  JobRetryResponse,
  JobTargetInput,
} from "./routers/jobs/types";
import type {
  QueueMetricsListInput,
  QueueMetricsSummary,
} from "./routers/overview/types";
import type {
  SchedulerListInput,
  SchedulerMutationResponse,
  SchedulerTargetInput,
  SchedulerUpsertInput,
} from "./routers/schedulers/types";
import type {
  WorkerListInput,
  WorkerTargetInput,
} from "./routers/workers/types";

export interface PrivateDashboardQueueSource {
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
  listQueueMetrics(
    input: QueueMetricsListInput,
  ): Promise<QueueMetricsSummary[]>;
  getJob(input: JobTargetInput): Promise<Job | null>;
  getJobLogs(input: JobTargetInput): Promise<JobLogsResponse>;
  retryJob(input: JobTargetInput): Promise<JobRetryResponse>;
  retryAllFailedJobs(input: QueueTargetInput): Promise<JobRetryAllResponse>;
  removeJob(input: JobTargetInput): Promise<JobRemoveResponse>;
  addJob(input: JobAddInput): Promise<JobAddResponse>;
  pauseQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  resumeQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  drainQueue(input: QueueTargetInput): Promise<QueueMutationResponse>;
  listFlows(
    input?: FlowListInput,
  ): Promise<Array<FlowSummary & { queueKey?: string }>>;
  getFlow(input: FlowTargetInput): Promise<FlowTree | null>;
  getJobFlow(input: JobTargetInput): Promise<FlowTree | null>;
  listWorkers(
    input: WorkerListInput,
  ): Promise<Array<Worker & { queueKey?: string }>>;
  getWorker(input: WorkerTargetInput): Promise<Worker | null>;
  listJobSchedulers(
    input: SchedulerListInput,
  ): Promise<Array<JobScheduler & { queueKey?: string }>>;
  getJobScheduler(input: SchedulerTargetInput): Promise<JobScheduler | null>;
  upsertJobScheduler(
    input: SchedulerUpsertInput,
  ): Promise<SchedulerMutationResponse>;
  removeJobScheduler(
    input: SchedulerTargetInput,
  ): Promise<SchedulerMutationResponse>;
}
