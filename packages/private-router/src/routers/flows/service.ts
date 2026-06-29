import type { FlowTree } from "@bullstudio/connect-types";
import { TRPCError } from "@trpc/server";
import { assertQueueCapability } from "../../shared/guards";
import { resolveQueueTarget } from "../../shared/queue-target";
import type { PrivateDashboardQueueSource } from "../../source";
import type { JobTargetInput } from "../jobs/types";
import type { FlowTargetInput } from "./types";

export async function getFlow(
  source: PrivateDashboardQueueSource,
  input: FlowTargetInput,
): Promise<FlowTree> {
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "flows", "Flows");
  const flow = await source.getFlow(input);

  if (!flow) {
    const queueLabel = input.queueName ?? input.queueKey ?? "unknown";
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Flow ${input.flowId} not found in queue ${queueLabel}`,
    });
  }

  return flow;
}

export async function getJobFlow(
  source: PrivateDashboardQueueSource,
  input: JobTargetInput,
): Promise<FlowTree | null> {
  const queue = await resolveQueueTarget(source, input);
  assertQueueCapability(source, queue, "flows", "Flows");
  // Returns the full flow tree the job belongs to, or null when the
  // job is standalone. Callers use null to hide the flow view.
  return source.getJobFlow(input);
}
