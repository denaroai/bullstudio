import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type Redis from "ioredis";
import { createQueueProvider } from "./provider-factory";
import {
  createTestRedis,
  ensureRedisAvailable,
  flushTestDb,
  TEST_REDIS_URL,
} from "../test-utils/redis";
import {
  seedBullMqQueue,
  type SeededQueue,
} from "../test-utils/seed-bullmq";
import {
  seedBullQueue,
  type SeededBullQueue,
} from "../test-utils/seed-bull";
import type { QueueService } from "../types";

describe("createQueueProvider", () => {
  let redis: Redis;
  const bullmqSeeds: SeededQueue[] = [];
  const bullSeeds: SeededBullQueue[] = [];
  let provider: QueueService | null = null;

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    if (provider) {
      await provider.disconnect().catch(() => {});
      provider = null;
    }
    while (bullmqSeeds.length > 0) {
      const s = bullmqSeeds.pop();
      if (s) await s.close().catch(() => {});
    }
    while (bullSeeds.length > 0) {
      const s = bullSeeds.pop();
      if (s) await s.close().catch(() => {});
    }
    await flushTestDb(redis);
  });

  it("auto-discovers prefixes when configured with ['*']", async () => {
    bullmqSeeds.push(
      await seedBullMqQueue({ prefix: "stage", name: "q1" }),
      await seedBullMqQueue({ prefix: "prod", name: "q2" }),
    );

    provider = await createQueueProvider({
      redisUrl: TEST_REDIS_URL,
      prefixes: ["*"],
    });
    await provider.connect();

    expect(provider.providerType).toBe("bullmq");
    expect(await provider.getPrefixes()).toEqual(["prod", "stage"]);
  });

  it("falls back to default prefix when ['*'] discovery finds nothing", async () => {
    provider = await createQueueProvider({
      redisUrl: TEST_REDIS_URL,
      prefixes: ["*"],
    });
    await provider.connect();

    expect(await provider.getPrefixes()).toEqual(["bull"]);
  });

  it("respects a custom config.prefix as the empty-DB fallback", async () => {
    provider = await createQueueProvider({
      redisUrl: TEST_REDIS_URL,
      prefixes: ["*"],
      prefix: "legacy",
    });
    await provider.connect();

    expect(await provider.getPrefixes()).toEqual(["legacy"]);
  });

  it("does NOT invoke discovery when explicit prefixes are given (no '*')", async () => {
    bullmqSeeds.push(
      await seedBullMqQueue({ prefix: "foo", name: "q" }),
    );

    provider = await createQueueProvider({
      redisUrl: TEST_REDIS_URL,
      prefixes: ["a", "b"],
    });
    await provider.connect();

    const prefixes = await provider.getPrefixes();
    expect(prefixes).toEqual(["a", "b"]);
    expect(prefixes).not.toContain("foo");
  });

  it("returns a BullProvider when Bull id-keys dominate", async () => {
    bullSeeds.push(
      await seedBullQueue({ prefix: "bull", name: "legacy-q" }),
    );

    provider = await createQueueProvider({
      redisUrl: TEST_REDIS_URL,
      prefixes: ["bull"],
    });
    await provider.connect();

    expect(provider.providerType).toBe("bull");
  });
});
