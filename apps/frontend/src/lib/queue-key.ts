export const COMPOSITE_SEP = "::";

export interface ParsedQueueKey {
  prefix: string;
  name: string;
}

export function queueKey(prefix: string, name: string): string {
  return `${prefix}${COMPOSITE_SEP}${name}`;
}

export function parseQueueKey(key: string): ParsedQueueKey | null {
  const idx = key.indexOf(COMPOSITE_SEP);
  if (idx === -1) return null;
  return {
    prefix: key.slice(0, idx),
    name: key.slice(idx + COMPOSITE_SEP.length),
  };
}

/**
 * Builds the value carried in the `$queueName` route param. We encode both
 * prefix and name so two queues that share a name across different prefixes
 * map to distinct URLs and never collide.
 */
export function queueRouteParam(queue: {
  name: string;
  prefix?: string;
}): string {
  return queueKey(queue.prefix ?? "", queue.name);
}

/** Bare queue name from a route param, tolerating legacy name-only params. */
export function queueNameFromParam(param: string): string {
  return parseQueueKey(param)?.name ?? param;
}

/**
 * Resolves the queue a route param points at. Prefers an exact (prefix, name)
 * match so name collisions across prefixes are disambiguated, then falls back
 * to a name-only match for legacy URLs or when the prefix has since changed.
 */
export function resolveQueueFromParam<
  T extends { name: string; prefix?: string },
>(param: string, queues: readonly T[] | undefined): T | undefined {
  if (!queues) return undefined;
  const parsed = parseQueueKey(param);
  if (parsed) {
    const exact = queues.find(
      (queue) =>
        queue.name === parsed.name && (queue.prefix ?? "") === parsed.prefix,
    );
    if (exact) return exact;
  }
  const name = parsed?.name ?? param;
  return queues.find((queue) => queue.name === name);
}
