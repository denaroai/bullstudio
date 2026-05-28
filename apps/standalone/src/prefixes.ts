export function getPrefixes(): string[] {
  const raw = process.env.REDIS_PREFIX;
  if (!raw) return ["*"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
