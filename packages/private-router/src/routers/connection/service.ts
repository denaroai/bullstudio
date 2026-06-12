import type { PrivateDashboardQueueSource } from "../../source";
import { supportedJobStatuses } from "../jobs/types";
import type { ConnectionInfo } from "./types";

export async function createConnectionInfo(
  source: PrivateDashboardQueueSource,
): Promise<ConnectionInfo> {
  const [queueSource, prefixes] = await Promise.all([
    source.getStatus(),
    source.listPrefixes(),
  ]);

  if (queueSource.mode === "standalone") {
    const providerType = queueSource.providers[0] ?? "unknown";

    return {
      mode: "standalone",
      providerType,
      prefixes,
      capabilities: {
        supportsFlows: queueSource.capabilities.flows,
        workers: queueSource.capabilities.workers,
        supportedStatuses: queueSource.capabilities.supportedStatuses,
      },
      queueSource,
      ...queueSource.connection,
    };
  }

  const providerType = queueSource.providers.includes("bullmq")
    ? "bullmq"
    : (queueSource.providers[0] ?? "unknown");

  return {
    mode: "embedded",
    providerType,
    prefixes,
    capabilities: {
      supportsFlows: queueSource.capabilities.flows,
      workers: queueSource.capabilities.workers,
      supportedStatuses: [...supportedJobStatuses],
    },
    queueSource,
  };
}
