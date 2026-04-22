import {
  createQueueProvider,
  type QueueService,
  type QueueServiceConfig,
} from "@bullstudio/queue";

let provider: QueueService | null = null;
let providerRedisUrl: string | null = null;
let connectingPromise: Promise<QueueService> | null =
  null;

function getRedisUrl(): string {
  return (
    process.env.REDIS_URL || "redis://localhost:6379"
  );
}

function getPrefixes(): string[] | undefined {
  const raw = process.env.REDIS_PREFIX;
  if (!raw) return ["*"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const getQueueProvider =
  async (): Promise<QueueService> => {
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
        const cfg: QueueServiceConfig = {
          redisUrl,
          prefixes: getPrefixes(),
        };
        const p = await createQueueProvider(cfg);
        providerRedisUrl = redisUrl;
        await p.connect();
        const caps = p.getCapabilities();
        console.log(
          `[CLI] Connected to ` +
            `${caps.displayName} ` +
            `(${p.providerType})`,
        );
        provider = p;
        return p;
      })();
    }

    return connectingPromise;
  };

export const disconnectProvider = async (): Promise<void> => {
  if (provider) {
    await provider.disconnect();
    provider = null;
  }
};
