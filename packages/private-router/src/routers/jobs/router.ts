import { queueTargetSchema } from "../../shared/queue-target";
import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import { jobAddSchema, jobListSchema, jobTargetSchema } from "./schema";
import {
  addJob,
  getJobLogs,
  listJobs,
  listJobSummaries,
  removeJob,
  retryAllFailedJobs,
  retryJob,
} from "./service";

export function createJobsRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    list: authenticatedProcedure
      .input(jobListSchema)
      .query(({ input }) => listJobs(source, input)),
    listSummary: authenticatedProcedure
      .input(jobListSchema)
      .query(({ input }) => listJobSummaries(source, input)),
    get: authenticatedProcedure
      .input(jobTargetSchema)
      .query(({ input }) => source.getJob(input)),
    logs: authenticatedProcedure
      .input(jobTargetSchema)
      .query(({ input }) => getJobLogs(source, input)),
    retry: authenticatedProcedure
      .input(jobTargetSchema)
      .mutation(({ input }) => retryJob(source, input)),
    retryAllFailed: authenticatedProcedure
      .input(queueTargetSchema)
      .mutation(({ input }) => retryAllFailedJobs(source, input)),
    remove: authenticatedProcedure
      .input(jobTargetSchema)
      .mutation(({ input }) => removeJob(source, input)),
    add: authenticatedProcedure
      .input(jobAddSchema)
      .mutation(({ input }) => addJob(source, input)),
  });
}
