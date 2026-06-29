import { randomBytes } from "node:crypto";
import Redis from "ioredis";

export const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";

export function createTestRedis(): Redis {
  return new Redis(TEST_REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
    retryStrategy: () => null,
  });
}

export async function flushTestDb(redis: Redis): Promise<void> {
  await redis.flushdb();
}

export async function ensureRedisAvailable(): Promise<void> {
  const redis = createTestRedis();
  try {
    await redis.ping();
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach test Redis at ${TEST_REDIS_URL}: ${cause}\n` +
        `Start it with: docker compose -f docker-compose.test.yml up -d\n` +
        `Or override with TEST_REDIS_URL.`,
    );
  } finally {
    await redis.quit().catch(() => {});
  }
}

export function uniquePrefix(base: string): string {
  return `${base}-${randomBytes(4).toString("hex")}`;
}
