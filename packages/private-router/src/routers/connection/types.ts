import type { QueueSourceStatus } from "../../shared/queue";

export type ConnectionInfo = {
  mode: "standalone" | "embedded";
  providerType: string;
  prefixes: string[];
  capabilities: {
    supportsFlows: boolean;
    workers: boolean;
    supportedStatuses: string[];
  };
  queueSource: QueueSourceStatus;
  host?: string;
  port?: string;
  hasPassword?: boolean;
  database?: string;
  displayUrl?: string;
};
