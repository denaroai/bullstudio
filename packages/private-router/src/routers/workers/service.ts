import type { Worker } from "@bullstudio/connect-types";
import { TRPCError } from "@trpc/server";
import { assertQueueCapability } from "../../shared/guards";
import { resolveQueueTarget } from "../../shared/queue-target";
import type { PrivateDashboardQueueSource } from "../../source";
import type { WorkerListInput, WorkerTargetInput } from "./types";

export async function listWorkers(
  source: PrivateDashboardQueueSource,
  input: WorkerListInput | undefined,
): Promise<Array<Worker & { queueKey?: string }>> {
  if (input?.queueKey || input?.queueName) {
    const queue = await resolveQueueTarget(source, input);
    assertQueueCapability(source, queue, "workers", "Workers");
  }
  return source.listWorkers(input ?? { limit: 200 });
}

export async function getWorker(
  source: PrivateDashboardQueueSource,
  input: WorkerTargetInput,
): Promise<Worker> {
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "workers", "Workers");
  const worker = await source.getWorker(input);

  if (!worker) {
    const queueLabel = input.queueName ?? input.queueKey ?? "unknown";
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Worker ${input.workerId} not found in queue ${queueLabel}`,
    });
  }

  return worker;
}
