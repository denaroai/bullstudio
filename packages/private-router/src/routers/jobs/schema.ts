import { z } from "zod";
import { supportedJobStatuses } from "./types";

export const jobStatusSchema = z.enum(supportedJobStatuses);

export const jobListSortFieldSchema = z.enum([
  "name",
  "queueName",
  "status",
  "timestamp",
  "duration",
]);

export const jobListSortOrderSchema = z.enum(["asc", "desc"]);

export const jobListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    status: jobStatusSchema.optional(),
    limit: z.number().min(1).max(1000).default(100),
    offset: z.number().min(0).default(0),
    search: z.string().trim().optional(),
    sortField: jobListSortFieldSchema.default("timestamp"),
    sortOrder: jobListSortOrderSchema.default("desc"),
  })
  .optional();

export const jobTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  jobId: z.string(),
});

export const jobAddSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  jobName: z.string().trim().min(1),
  data: z.unknown().optional(),
  delay: z.number().int().min(0).optional(),
  attempts: z.number().int().min(1).optional(),
});
