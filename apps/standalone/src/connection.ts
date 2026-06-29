import { getPrefixes } from "./prefixes";
import {
  createQueueProvider,
  type QueueService,
  type QueueServiceConfig,
} from "./queue";

let provider: QueueService | null = null;
let providerRedisUrl: string | null = null;
let connectingPromise: Promise<QueueService> | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export const getQueueProvider = async (): Promise<QueueService> => {
  const redisUrl = getRedisUrl();

  if (provider && providerRedisUrl !== redisUrl) {
    await provider.disconnect();
    provider = null;
    providerRedisUrl = null;
    connectingPromise = null;
  }

  if (provider) {
    return provider;
  }

  if (!connectingPromise) {
    connectingPromise = (async () => {
      try {
        const cfg: QueueServiceConfig = {
          redisUrl,
          prefixes: getPrefixes(),
        };
        const p = await createQueueProvider(cfg);
        await p.connect();
        providerRedisUrl = redisUrl;
        provider = p;

        const caps = p.getCapabilities();
        console.log(
          `[CLI] Connected to ` +
            `${caps.displayName} ` +
            `(${p.providerType})`,
        );
        return p;
      } catch (error) {
        provider = null;
        providerRedisUrl = null;
        throw error;
      } finally {
        connectingPromise = null;
      }
    })();
  }

  return connectingPromise;
};

export const disconnectProvider = async (): Promise<void> => {
  if (provider) {
    await provider.disconnect();
    provider = null;
    providerRedisUrl = null;
    connectingPromise = null;
  }
};
