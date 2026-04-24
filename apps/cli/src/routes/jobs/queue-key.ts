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
