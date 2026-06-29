import { TRPCError } from "@trpc/server";
import type { PrivateDashboardQueueSource } from "../source";
import type { AdapterCapabilities, DashboardQueue } from "./queue";

export async function assertCanMutate(
  source: PrivateDashboardQueueSource,
): Promise<void> {
  if (source.readOnly) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Read-only dashboards cannot mutate queues or jobs.",
    });
  }

  const status = await source.getStatus();

  if (!status.capabilities.mutationsAllowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Queue mutations are not allowed by this queue source.",
    });
  }
}

export function assertQueueCapability(
  source: PrivateDashboardQueueSource,
  queue: DashboardQueue,
  capability: keyof AdapterCapabilities,
  label: string,
): void {
  if (queue.capabilities && !queue.capabilities[capability]) {
    const queueKind = source.mode === "embedded" ? "supplied queue" : "queue";
    const verb = label.endsWith("s") ? "are" : "is";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${label} ${verb} not supported for ${queueKind} "${queue.key ?? queue.name}".`,
    });
  }
}

export function createMutationGuard(source: PrivateDashboardQueueSource) {
  return {
    assertCanMutate: () => assertCanMutate(source),
  };
}
