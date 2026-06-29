import { z } from "zod";

export const overviewMetricsSchema = z
  .object({
    timeRangeHours: z.number().positive().max(168).default(24),
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
  })
  .optional();
