import { z } from "zod";

export const flowListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    limit: z.number().min(1).max(100).default(50),
  })
  .optional();

export const flowTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  flowId: z.string(),
});
