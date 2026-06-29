import { assertCanMutate, assertQueueCapability } from "../../shared/guards";
import {
  type QueueMutationResponse,
  type QueueTargetInput,
  resolveQueueTarget,
} from "../../shared/queue-target";
import type { PrivateDashboardQueueSource } from "../../source";

export async function pauseQueue(
  source: PrivateDashboardQueueSource,
  input: QueueTargetInput,
): Promise<QueueMutationResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "queuePause", "Queue pause");
  return source.pauseQueue(input);
}

export async function resumeQueue(
  source: PrivateDashboardQueueSource,
  input: QueueTargetInput,
): Promise<QueueMutationResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "queueResume", "Queue resume");
  return source.resumeQueue(input);
}

export async function drainQueue(
  source: PrivateDashboardQueueSource,
  input: QueueTargetInput,
): Promise<QueueMutationResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "queueDrain", "Queue drain");
  return source.drainQueue(input);
}
