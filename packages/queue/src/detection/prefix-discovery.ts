import type Redis from "ioredis";

/**
 * Discover all Bull/BullMQ prefixes in a Redis instance
 * by scanning for known key patterns:
 *   - BullMQ: `<prefix>:<queue>:meta`
 *   - Bull:   `<prefix>:<queue>:id`
 */
export async function discoverPrefixes(
  redis: Redis,
): Promise<string[]> {
  const prefixes = new Set<string>();

  await scanForPattern(redis, "*:*:meta", prefixes);
  await scanForPattern(redis, "*:*:id", prefixes);

  return Array.from(prefixes).sort();
}

async function scanForPattern(
  redis: Redis,
  pattern: string,
  out: Set<string>,
): Promise<void> {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      200,
    );
    cursor = next;
    for (const key of keys) {
      const prefix = key.split(":")[0];
      if (prefix) out.add(prefix);
    }
  } while (cursor !== "0");
}
