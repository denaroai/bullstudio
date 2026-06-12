import { z } from "zod";

export const workerListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    limit: z.number().min(1).max(1000).default(200),
  })
  .optional();

export const workerTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  workerId: z.string(),
});
