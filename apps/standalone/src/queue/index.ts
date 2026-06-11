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
  QueueProviderType,
  QueueService,
  QueueServiceConfig,
} from "./types";
