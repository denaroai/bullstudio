// Types

// Classes
export {
  ConnectionManager,
  type ConnectionManagerConfig,
} from "./connection-manager";
// Detection
export {
  detectProvider,
  discoverPrefixes,
  type ProviderDetectionResult,
} from "./detection";
// Errors
export * from "./errors";
export { BullMqProvider, BullProvider } from "./providers";

// Factory
export {
  createProviderByType,
  createQueueProvider,
} from "./providers/provider-factory";
export type {
  ConnectionConfig,
  ConnectionEvent,
  ConnectionEventListener,
  ConnectionState,
  ConnectionStatus,
  ConnectionTestResult,
  QueueProviderType,
  QueueService,
  QueueServiceConfig,
} from "./types";

// Singleton instance factory
import { ConnectionManager } from "./connection-manager";

let instance: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!instance) {
    instance = new ConnectionManager({});
  }
  return instance;
}

export function resetConnectionManager(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
