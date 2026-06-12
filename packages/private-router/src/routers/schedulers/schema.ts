import { z } from "zod";

export const schedulerListSchema = z
  .object({
    queueKey: z.string().optional(),
    queueName: z.string().optional(),
    prefix: z.string().optional(),
    limit: z.number().min(1).max(500).default(100),
  })
  .optional();

export const schedulerTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  schedulerKey: z.string(),
  schedulerId: z.string().optional(),
});

export const schedulerRepeatSchema = z
  .object({
    strategy: z.enum(["cron", "every"]),
    pattern: z.string().optional(),
    every: z.number().int().positive().optional(),
    tz: z.string().optional(),
    endDate: z.number().optional(),
    limit: z.number().int().positive().optional(),
  })
  .refine(
    (repeat) =>
      repeat.strategy === "cron"
        ? Boolean(repeat.pattern)
        : Boolean(repeat.every),
    {
      message:
        'A "cron" schedule requires a pattern and an "every" schedule requires an interval.',
    },
  );

export const schedulerUpsertSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  schedulerId: z.string().min(1),
  previousKey: z.string().optional(),
  repeat: schedulerRepeatSchema,
  template: z
    .object({
      name: z.string().optional(),
      data: z.unknown().optional(),
      opts: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
