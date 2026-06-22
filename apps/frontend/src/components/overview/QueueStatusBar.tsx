import type { JobCounts } from "@bullstudio/connect-types";
import { cn } from "@bullstudio/ui/lib/utils";
import { formatNumber } from "@bullstudio/ui/shared";

type QueueStatusBarProps = {
  counts: JobCounts;
  className?: string;
};

// Same status palette as JobDistributionPie so the bar and the sidebar pie read
// consistently. Order defines left-to-right fill order in the bar.
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

/**
 * Horizontal stacked bar that fills with one colored segment per non-empty job
 * status, sized proportionally to its share of the total. Each segment shows
 * its count and names its status on hover.
 *
 * @param counts - Per-status job counts driving the segment sizes.
 * @param className - Optional extra classes applied to the wrapper.
 */
export function QueueStatusBar({ counts, className }: QueueStatusBarProps) {
  const segments = SEGMENTS.map((segment) => ({
    ...segment,
    value: counts[segment.key],
  })).filter((segment) => segment.value > 0);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-4 w-full gap-px overflow-hidden rounded-full bg-muted text-[10px] font-medium leading-none text-white/95">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="flex min-w-min items-center justify-center"
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${segment.value}`}
          >
            <span className="truncate px-1">{formatNumber(segment.value)}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatNumber(total)} {total === 1 ? "job" : "jobs"}
      </div>
    </div>
  );
}
