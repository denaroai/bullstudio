import type { JobCounts } from "@bullstudio/connect-types";
import { cn } from "@bullstudio/ui/lib/utils";

type JobDistributionPieProps = {
  counts: JobCounts;
  className?: string;
};

const SEGMENTS = [
  { key: "active", label: "Active", color: "#60a5fa" },
  { key: "waiting", label: "Waiting", color: "#f59e0b" },
  { key: "delayed", label: "Delayed", color: "#38bdf8" },
  { key: "prioritized", label: "Prioritized", color: "#a78bfa" },
  { key: "waitingChildren", label: "Waiting children", color: "#2dd4bf" },
  { key: "paused", label: "Paused", color: "#a1a1aa" },
  { key: "completed", label: "Completed", color: "#10b981" },
  { key: "failed", label: "Failed", color: "#f87171" },
] as const satisfies ReadonlyArray<{
  key: keyof JobCounts;
  label: string;
  color: string;
}>;

export function JobDistributionPie({
  counts,
  className,
}: JobDistributionPieProps) {
  const active = SEGMENTS.map((segment) => ({
    ...segment,
    value: counts[segment.key],
  })).filter((segment) => segment.value > 0);

  const total = active.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return (
      <span
        className={cn(
          "size-4 shrink-0 rounded-full bg-sidebar-accent/60",
          className,
        )}
        title="No jobs"
      />
    );
  }

  // Single non-zero status renders as a solid disc (no seam).
  if (active.length === 1) {
    return (
      <span
        className={cn("size-4 shrink-0 rounded-full", className)}
        style={{ backgroundColor: active[0].color }}
        title={`${active[0].label}: ${active[0].value}`}
      />
    );
  }

  const stops: string[] = [];
  let cursor = 0;
  for (const segment of active) {
    const start = (cursor / total) * 360;
    cursor += segment.value;
    const end = (cursor / total) * 360;
    stops.push(`${segment.color} ${start}deg ${end}deg`);
  }

  const title = active
    .map((segment) => `${segment.label}: ${segment.value}`)
    .join("\n");

  return (
    <span
      className={cn(
        "size-4 shrink-0 rounded-full border border-white",
        className,
      )}
      style={{ backgroundImage: `conic-gradient(${stops.join(", ")})` }}
      title={title}
    />
  );
}
