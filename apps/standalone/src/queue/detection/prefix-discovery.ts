import type Redis from "ioredis";

/**
 * Discover all Bull/BullMQ prefixes in a Redis instance
 * by scanning for known key patterns:
 *   - BullMQ: `<prefix>:<queue>:meta`
 *   - Bull:   `<prefix>:<queue>:id`
 */
export async function discoverPrefixes(redis: Redis): Promise<string[]> {
  const prefixes = new Set<string>();

  await scanForPattern(redis, "*:*:meta", prefixes);
  await scanForPattern(redis, "*:*:id", prefixes);

  return Array.from(prefixes).sort();
}

const MAX_SCAN_ITERATIONS = 10_000;

async function scanForPattern(
  redis: Redis,
  pattern: string,
  out: Set<string>,
): Promise<void> {
  let cursor = "0";
  let iterations = 0;
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
    iterations++;
    if (iterations >= MAX_SCAN_ITERATIONS) {
      console.warn(
        `[PrefixDiscovery] Stopped after ` +
          `${MAX_SCAN_ITERATIONS} iterations`,
      );
      break;
    }
  } while (cursor !== "0");
}
