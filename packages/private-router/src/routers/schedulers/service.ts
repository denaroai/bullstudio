import { assertCanMutate, assertQueueCapability } from "../../shared/guards";
import { resolveQueueTarget } from "../../shared/queue-target";
import type { PrivateDashboardQueueSource } from "../../source";
import type {
  SchedulerMutationResponse,
  SchedulerTargetInput,
  SchedulerUpsertInput,
} from "./types";

export async function upsertJobScheduler(
  source: PrivateDashboardQueueSource,
  input: SchedulerUpsertInput,
): Promise<SchedulerMutationResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "schedulers", "Job schedulers");
  return source.upsertJobScheduler(input);
}

export async function removeJobScheduler(
  source: PrivateDashboardQueueSource,
  input: SchedulerTargetInput,
): Promise<SchedulerMutationResponse> {
  await assertCanMutate(source);
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "schedulers", "Job schedulers");
  return source.removeJobScheduler(input);
}
