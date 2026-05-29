import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type Redis from "ioredis";
import { discoverPrefixes } from "./prefix-discovery";
import {
  createTestRedis,
  ensureRedisAvailable,
  flushTestDb,
} from "../test-utils/redis";

describe("discoverPrefixes", () => {
  let redis: Redis;

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    await flushTestDb(redis);
  });

  it("returns an empty array for an empty DB", async () => {
    expect(await discoverPrefixes(redis)).toEqual([]);
  });

  it("detects a BullMQ prefix via :meta keys", async () => {
    await redis.set("stage:q1:meta", "1");
    expect(await discoverPrefixes(redis)).toEqual(["stage"]);
  });

  it("detects a Bull prefix via :id keys", async () => {
    await redis.set("bull:q1:id", "1");
    expect(await discoverPrefixes(redis)).toEqual(["bull"]);
  });

  it("returns prefixes from both Bull and BullMQ key patterns merged and sorted", async () => {
    await redis.set("stage:q1:meta", "1");
    await redis.set("legacy:q1:id", "1");
    expect(await discoverPrefixes(redis)).toEqual(["legacy", "stage"]);
  });

  it("deduplicates a prefix that appears in both :meta and :id patterns", async () => {
    await redis.set("shared:q1:meta", "1");
    await redis.set("shared:q2:id", "1");
    expect(await discoverPrefixes(redis)).toEqual(["shared"]);
  });

  it("returns a prefix once when it has multiple queues", async () => {
    await redis.mset(
      "stage:q1:meta",
      "1",
      "stage:q2:meta",
      "1",
      "stage:q3:meta",
      "1",
    );
    expect(await discoverPrefixes(redis)).toEqual(["stage"]);
  });

  it("returns prefixes sorted alphabetically", async () => {
    await redis.set("z-prefix:q:meta", "1");
    await redis.set("a-prefix:q:meta", "1");
    await redis.set("m-prefix:q:meta", "1");
    expect(await discoverPrefixes(redis)).toEqual([
      "a-prefix",
      "m-prefix",
      "z-prefix",
    ]);
  });

  it("iterates SCAN cursor beyond a single COUNT batch", async () => {
    const pipeline = redis.pipeline();
    for (let i = 0; i < 600; i++) {
      pipeline.set(`load:q${i}:meta`, "1");
    }
    pipeline.set("edge:q:meta", "1");
    await pipeline.exec();

    expect(await discoverPrefixes(redis)).toEqual(["edge", "load"]);
  });

  it("ignores keys that do not match the :meta or :id patterns", async () => {
    await redis.set("random:key:value", "1");
    await redis.set("user:1:email", "x@y.z");
    await redis.set("session:abc", "1");
    expect(await discoverPrefixes(redis)).toEqual([]);
  });

  it("skips a key whose first segment is empty", async () => {
    await redis.set(":garbage:meta", "1");
    expect(await discoverPrefixes(redis)).toEqual([]);
  });
});
