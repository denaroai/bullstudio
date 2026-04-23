const COMPOSITE_SEP = "::";

export function queueKey(
  prefix: string,
  name: string,
): string {
  return `${prefix}${COMPOSITE_SEP}${name}`;
}

export function parseQueueKey(
  key: string,
): { prefix: string; name: string } | null {
  const idx = key.indexOf(COMPOSITE_SEP);
  if (idx === -1) return null;
  return {
    prefix: key.slice(0, idx),
    name: key.slice(
      idx + COMPOSITE_SEP.length,
    ),
  };
}
