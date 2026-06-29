export const TIME_RANGES = [
  { value: String(5 / 60), label: "Last 5m" },
  { value: String(15 / 60), label: "Last 15m" },
  { value: String(30 / 60), label: "Last 30m" },
  { value: "1", label: "Last 1h" },
  { value: "6", label: "Last 6h" },
  { value: "24", label: "Last 24h" },
  { value: "72", label: "Last 3d" },
  { value: "168", label: "Last 7d" },
];

// Compact label for chart descriptions, e.g. 0.0833→"5m", 1→"1h", 168→"7d".
export function formatRangeLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours}h`;
  return `${hours / 24}d`;
}
