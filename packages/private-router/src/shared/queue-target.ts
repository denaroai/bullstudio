import { z } from "zod";
import type { PrivateDashboardQueueSource } from "../source";
import type { DashboardQueue } from "./queue";

export type QueueTargetInput = {
  queueKey?: string;
  queueName?: string;
  name?: string;
  prefix?: string;
};

export type ResolvedQueue = DashboardQueue;

export type QueueMutationResponse = { success: true };

export const queueTargetSchema = z.object({
  queueKey: z.string().optional(),
  queueName: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
});

export async function resolveQueueTarget(
  source: PrivateDashboardQueueSource,
  input: QueueTargetInput,
): Promise<ResolvedQueue> {
  return source.resolveQueue(input);
}
