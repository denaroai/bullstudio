import type { Job, JobSummary } from "@bullstudio/connect-types";
import { assertCanMutate, assertQueueCapability } from "../../shared/guards";
import {
  type QueueTargetInput,
  resolveQueueTarget,
} from "../../shared/queue-target";
import {
  countQueueJobs,
  filterSortAndPageJobs,
  getSourceJobListInput,
  type NormalizedJobListInput,
  normalizeJobListInput,
} from "./list";
import type { PrivateDashboardQueueSource } from "../../source";
import type {
  JobAddInput,
  JobAddResponse,
  JobListInput,
  JobListResponse,
  JobLogsResponse,
  JobRemoveResponse,
  JobRetryAllResponse,
  JobRetryResponse,
  JobTargetInput,
} from "./types";

async function countJobsForListInput(
  source: PrivateDashboardQueueSource,
  input: NormalizedJobListInput,
): Promise<number> {
  const queues =
    input.queueKey || input.queueName
      ? [await resolveQueueTarget(source, input)]
      : await source.listQueues();

  return queues.reduce(
    (total, queue) => total + countQueueJobs(queue, input.status),
    0,
  );
}

export async function listJobs(
  source: PrivateDashboardQueueSource,
  input: JobListInput | undefined,
): Promise<JobListResponse<Job & { queueKey?: string }>> {
  const normalized = normalizeJobListInput(input);
  const totalCandidates = await countJobsForListInput(source, normalized);
  if (totalCandidates === 0) {
    return filterSortAndPageJobs([], normalized, 0);
  }
  const jobs = await source.listJobs(
    getSourceJobListInput(normalized, totalCandidates),
  );
  return filterSortAndPageJobs(jobs, normalized, totalCandidates);
}

export async function listJobSummaries(
  source: PrivateDashboardQueueSource,
  input: JobListInput | undefined,
): Promise<JobListResponse<JobSummary & { queueKey?: string }>> {
  const normalized = normalizeJobListInput(input);
  const totalCandidates = await countJobsForListInput(source, normalized);
  if (totalCandidates === 0) {
    return filterSortAndPageJobs([], normalized, 0);
  }
  const jobs = await source.listJobSummaries(
    getSourceJobListInput(normalized, totalCandidates),
  );
  return filterSortAndPageJobs(jobs, normalized, totalCandidates);
}

export async function getJobLogs(
  source: PrivateDashboardQueueSource,
  input: JobTargetInput,
): Promise<JobLogsResponse> {
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "jobLogs", "Job logs");
  return source.getJobLogs(input);
}

export async function retryJob(
  source: PrivateDashboardQueueSource,
  input: JobTargetInput,
): Promise<JobRetryResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "jobRetry", "Job retry");
  return source.retryJob(input);
}

export async function retryAllFailedJobs(
  source: PrivateDashboardQueueSource,
  input: QueueTargetInput,
): Promise<JobRetryAllResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "jobRetry", "Job retry");
  return source.retryAllFailedJobs(input);
}

export async function removeJob(
  source: PrivateDashboardQueueSource,
  input: JobTargetInput,
): Promise<JobRemoveResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "jobRemoval", "Job removal");
  return source.removeJob(input);
}

export async function addJob(
  source: PrivateDashboardQueueSource,
  input: JobAddInput,
): Promise<JobAddResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "queueAddJob", "Add job");
  return source.addJob(input);
}
