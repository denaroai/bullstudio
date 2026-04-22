import { createTRPCRouter, publicProcedure } from "../init";
import { getQueueProvider } from "../connection";

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port || "6379",
      hasPassword: !!parsed.password,
      database: parsed.pathname.slice(1) || "0",
    };
  } catch {
    return {
      host: "localhost",
      port: "6379",
      hasPassword: false,
      database: "0",
    };
  }
}

export const connectionRouter = createTRPCRouter({
  info: publicProcedure.query(async () => {
    const redisUrl = getRedisUrl();
    const parsed = parseRedisUrl(redisUrl);
    const provider = await getQueueProvider();
    const capabilities = provider.getCapabilities();

    const prefixes =
      await provider.getPrefixes();

    return {
      host: parsed.host,
      port: parsed.port,
      hasPassword: parsed.hasPassword,
      database: parsed.database,
      displayUrl: `${parsed.host}:${parsed.port}`,
      providerType: capabilities.providerType,
      prefixes,
      capabilities: {
        supportsFlows:
          capabilities.supportsFlows,
        supportedStatuses:
          capabilities.supportedJobStates,
      },
    };
  }),
});
