import { type TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
import type { Job, JobSummary } from "@bullstudio/connect-types";

const jobStatusSchema = z.enum([
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "waiting-children",
]);

const queueIdSchema = z.object({
  queueName: z.string(),
  prefix: z.string().optional(),
});

export const jobRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          queueName: z.string().optional(),
          prefix: z.string().optional(),
          status: jobStatusSchema.optional(),
          limit: z
            .number()
            .min(1)
            .max(1000)
            .default(100),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input }): Promise<Job[]> => {
      const provider = await getQueueProvider();
      const queues = await provider.getQueues();

      const queuesToFetch = queues.filter(
        (q) => {
          if (
            input?.queueName &&
            q.name !== input.queueName
          )
            return false;
          if (
            input?.prefix &&
            q.prefix !== input.prefix
          )
            return false;
          return true;
        },
      );

      const allJobs: Job[] = [];
      for (const queue of queuesToFetch) {
        const jobs = await provider.getJobs(
          queue.name,
          {
            filter: input?.status
              ? { status: input.status }
              : undefined,
            limit: input?.limit ?? 100,
            offset: input?.offset ?? 0,
          },
          queue.prefix,
        );
        for (const j of jobs) {
          j.prefix = queue.prefix;
        }
        allJobs.push(...jobs);
      }

      return allJobs.sort(
        (a, b) => b.timestamp - a.timestamp,
      );
    }),

  listSummary: publicProcedure
    .input(
      z
        .object({
          queueName: z.string().optional(),
          prefix: z.string().optional(),
          status: jobStatusSchema.optional(),
          limit: z
            .number()
            .min(1)
            .max(1000)
            .default(100),
          offset: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(
      async ({ input }): Promise<JobSummary[]> => {
        const provider = await getQueueProvider();
        const queues = await provider.getQueues();

        const queuesToFetch = queues.filter(
          (q) => {
            if (
              input?.queueName &&
              q.name !== input.queueName
            )
              return false;
            if (
              input?.prefix &&
              q.prefix !== input.prefix
            )
              return false;
            return true;
          },
        );

        const allJobs: JobSummary[] = [];
        for (const queue of queuesToFetch) {
          const jobs =
            await provider.getJobsSummary(
              queue.name,
              {
                filter: input?.status
                  ? { status: input.status }
                  : undefined,
                limit: input?.limit ?? 100,
                offset: input?.offset ?? 0,
              },
              queue.prefix,
            );
          for (const j of jobs) {
            j.prefix = queue.prefix;
          }
          allJobs.push(...jobs);
        }

        return allJobs.sort(
          (a, b) => b.timestamp - a.timestamp,
        );
      },
    ),

  get: publicProcedure
    .input(
      queueIdSchema.extend({
        jobId: z.string(),
      }),
    )
    .query(
      async ({ input }): Promise<Job | null> => {
        const provider = await getQueueProvider();
        return provider.getJob(
          input.queueName,
          input.jobId,
          input.prefix,
        );
      },
    ),

  logs: publicProcedure
    .input(
      queueIdSchema.extend({
        jobId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const provider = await getQueueProvider();
      return provider.getJobLogs(
        input.queueName,
        input.jobId,
        input.prefix,
      );
    }),

  retry: publicProcedure
    .input(
      queueIdSchema.extend({
        jobId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();

      const job = await provider.getJob(
        input.queueName,
        input.jobId,
        input.prefix,
      );
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            `Job ${input.jobId} not found ` +
            `in queue ${input.queueName}`,
        });
      }

      if (job.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Job is not in failed state. ` +
            `Current status: ${job.status}`,
        });
      }

      const workerCount =
        await provider.getWorkerCount(
          input.queueName,
          input.prefix,
        );
      if (workerCount.count === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            `No workers available for ` +
            `queue "${input.queueName}". ` +
            `Start a worker to process ` +
            `retried jobs.`,
        });
      }

      await provider.retryJob(
        input.queueName,
        input.jobId,
        input.prefix,
      );

      return {
        success: true,
        message:
          `Job "${job.name}" has been ` +
          `enqueued for retry`,
        workerCount: workerCount.count,
      };
    }),

  remove: publicProcedure
    .input(
      queueIdSchema.extend({
        jobId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();

      const job = await provider.getJob(
        input.queueName,
        input.jobId,
        input.prefix,
      );
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            `Job ${input.jobId} not found ` +
            `in queue ${input.queueName}`,
        });
      }

      await provider.removeJob(
        input.queueName,
        input.jobId,
        input.prefix,
      );

      return {
        success: true,
        message:
          `Job "${job.name}" has been removed`,
      };
    }),
} satisfies TRPCRouterRecord;
