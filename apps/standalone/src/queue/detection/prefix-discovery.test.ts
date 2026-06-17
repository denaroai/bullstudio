import type Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestRedis,
  ensureRedisAvailable,
  flushTestDb,
} from "../test-utils/redis";
import {
  discoverPrefixes,
  discoverPrefixesMatching,
  prefixPatternToRegExp,
  resolveConfiguredPrefixes,
} from "./prefix-discovery";

describe("discoverPrefixes", () => {
  let redis: Redis;

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    if (!redis) return;
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

describe("prefixPatternToRegExp", () => {
  it("extracts a hash-tagged prefix from a full key", () => {
    const re = prefixPatternToRegExp("local:{*}");
    expect("local:{event}:event--company.created:meta".match(re)?.[0]).toBe(
      "local:{event}",
    );
  });

  it("confines the wildcard to a single key segment", () => {
    const re = prefixPatternToRegExp("local:*");
    expect("local:my-queue:meta".match(re)?.[0]).toBe("local:my-queue");
  });

  it("does not match a key outside the pattern", () => {
    const re = prefixPatternToRegExp("local:{*}");
    expect(re.test("staging:{event}:q:meta")).toBe(false);
  });
});

describe("discoverPrefixesMatching", () => {
  let redis: Redis;

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    if (!redis) return;
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    await flushTestDb(redis);
  });

  it("expands a hash-tag glob into the concrete prefixes present", async () => {
    await redis.mset(
      "local:{event}:q1:meta",
      "1",
      "local:{open-search}:q2:meta",
      "1",
      "local:{audit}:q3:id",
      "1",
    );
    expect(await discoverPrefixesMatching(redis, "local:{*}")).toEqual([
      "local:{audit}",
      "local:{event}",
      "local:{open-search}",
    ]);
  });

  it("ignores prefixes that do not match the pattern", async () => {
    await redis.set("local:{event}:q:meta", "1");
    await redis.set("staging:{event}:q:meta", "1");
    expect(await discoverPrefixesMatching(redis, "local:{*}")).toEqual([
      "local:{event}",
    ]);
  });
});

describe("resolveConfiguredPrefixes", () => {
  let redis: Redis;

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    if (!redis) return;
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    await flushTestDb(redis);
  });

  it("falls back to the default prefix when nothing is configured", async () => {
    expect(await resolveConfiguredPrefixes(redis, undefined, "bull")).toEqual([
      "bull",
    ]);
  });

  it("uses literal prefixes verbatim", async () => {
    expect(
      await resolveConfiguredPrefixes(redis, ["alpha", "beta"], "bull"),
    ).toEqual(["alpha", "beta"]);
  });

  it("expands a glob pattern against Redis", async () => {
    await redis.mset(
      "local:{event}:q1:meta",
      "1",
      "local:{open-search}:q2:meta",
      "1",
    );
    expect(
      await resolveConfiguredPrefixes(redis, ["local:{*}"], "bull"),
    ).toEqual(["local:{event}", "local:{open-search}"]);
  });

  it("merges literal and glob entries, de-duplicated and sorted", async () => {
    await redis.set("local:{event}:q:meta", "1");
    expect(
      await resolveConfiguredPrefixes(redis, ["zeta", "local:{*}"], "bull"),
    ).toEqual(["local:{event}", "zeta"]);
  });
});
