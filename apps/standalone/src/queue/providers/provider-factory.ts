import Redis from "ioredis";
import { detectProvider, discoverPrefixes } from "../detection";
import type {
  QueueProviderType,
  QueueService,
  QueueServiceConfig,
} from "../types";
import { BullProvider } from "./bull";
import { BullMqProvider } from "./bullmq";

/**
 * Auto-detect and create appropriate queue provider.
 * When `prefixes: ["*"]` is set, discovers all
 * prefixes before detecting the provider type.
 */
export async function createQueueProvider(
  config: QueueServiceConfig,
): Promise<QueueService> {
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  let finalConfig: QueueServiceConfig = {
    ...config,
  };

  try {
    await redis.connect();

    let prefixes = config.prefixes;

    if (prefixes?.includes("*")) {
      const found = await discoverPrefixes(redis);
      if (found.length > 0) {
        prefixes = found;
        console.log(`[ProviderFactory] Discovered prefixes: ${found.join(", ")}`);
      } else {
        prefixes = [config.prefix ?? "bull"];
      }
    }

    finalConfig = { ...config, prefixes };

    const detectionPrefix = prefixes?.[0] ?? config.prefix ?? "bull";
    const detection = await detectProvider(redis, detectionPrefix);

    console.log(
      `[ProviderFactory] Detected provider: ` +
        `${detection.type} ` +
        `(${detection.confidence} confidence ` +
        `from ${detection.detectedFrom})`,
    );

    return createProviderByType(detection.type, finalConfig);
  } catch (error) {
    console.error("[ProviderFactory] Detection failed:", error);
    return new BullMqProvider(finalConfig);
  } finally {
    await redis.quit().catch(() => {});
  }
}

/**
 * Create provider with explicit type (for testing or when type is known).
 */
export function createProviderByType(
  type: QueueProviderType,
  config: QueueServiceConfig,
): QueueService {
  switch (type) {
    case "bull":
      return new BullProvider(config);
    case "bullmq":
      return new BullMqProvider(config);
    case "agenda":
    case "bee":
      throw new Error(`Provider type "${type}" not yet implemented`);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
