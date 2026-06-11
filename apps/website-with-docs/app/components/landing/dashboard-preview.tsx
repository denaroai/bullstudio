import {
  Activity,
  AlertTriangle,
  CircleCheck,
  Clock,
  Database,
  GitBranch,
  Layers,
  LayoutDashboard,
  ListTodo,
  RefreshCw,
  Search,
  Timer,
  TrendingDown,
  TrendingUp,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LogoMark } from "./logo";

/* ------------------------------------------------------------------ *
 * Static replicas of the real Bullstudio dashboard surfaces, built to
 * the same tokens (bg-card, border-border, the job-status palette) so the
 * marketing site shows the product instead of describing it.
 * ------------------------------------------------------------------ */

type Status =
  | "completed"
  | "failed"
  | "active"
  | "waiting"
  | "delayed"
  | "paused";

const BADGE: Record<Status, string> = {
  completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  failed: "border-red-500/20 bg-red-500/10 text-red-400",
  active: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  waiting: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  delayed: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  paused: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
};

const DOT: Record<Status, string> = {
  completed: "bg-emerald-400",
  failed: "bg-red-400",
  active: "bg-blue-400",
  waiting: "bg-amber-400",
  delayed: "bg-violet-400",
  paused: "bg-zinc-400",
};

const EDGE: Record<Status, string> = {
  completed: "#34d399",
  failed: "#f87171",
  active: "#60a5fa",
  waiting: "#fbbf24",
  delayed: "#a78bfa",
  paused: "#a1a1aa",
};

function JobBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider",
        BADGE[status],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          DOT[status],
          status === "active" && "bs-pulse animate-pulse",
        )}
      />
      {status}
    </span>
  );
}

function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="GitHub"
      role="img"
    >
      <title>GitHub</title>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.57 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.23-3.15-.12-.3-.53-1.5.12-3.14 0 0 1-.32 3.3 1.2a11.6 11.6 0 0 1 6 0c2.28-1.52 3.29-1.2 3.29-1.2.65 1.64.24 2.84.12 3.14.77.82 1.23 1.87 1.23 3.15 0 4.51-2.81 5.5-5.49 5.79.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.29 0 .32.22.69.83.57A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  );
}

/* ---------------------------------- chrome --------------------------------- */

const NAV = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "jobs", label: "Jobs", Icon: ListTodo },
  { key: "flows", label: "Flows", Icon: Workflow },
] as const;

export function DashboardFrame({
  active,
  children,
}: {
  active: "overview" | "jobs" | "flows";
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden border border-border bg-background shadow-xl">
      {/* window bar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 bg-border" />
          <span className="size-2.5 bg-border" />
          <span className="size-2.5 bg-border" />
        </div>
        <div className="mx-auto flex items-center gap-2 border border-border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          localhost:4000
        </div>
      </div>

      <div className="flex h-[440px]">
        {/* sidebar */}
        <aside className="hidden w-[176px] shrink-0 flex-col border-r border-border bg-sidebar sm:flex">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-3.5">
            <LogoMark className="h-5 text-sidebar-foreground" />
            <div className="leading-tight">
              <div className="text-xs font-semibold text-sidebar-foreground">
                Bullstudio
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Embedded
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-0.5 p-2.5">
            {NAV.map(({ key, label, Icon }) => (
              <span
                key={key}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 text-[13px]",
                  key === active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </span>
            ))}
          </nav>

          <div className="mt-auto border-t border-border p-3">
            <div className="flex items-center gap-2">
              <Database className="size-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-sidebar-foreground">
                Email service
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                BullMQ
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                3 queues
              </span>
            </div>
          </div>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/**
 * A bare, chrome-less frame for the feature previews — just the surface in
 * question (the jobs list, the graph, …), no window bar or sidebar.
 */
export function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[420px] overflow-hidden border border-border bg-card shadow-sm">
      {children}
      {/* soft fade so previews dissolve at the bottom rather than hard-cut */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-card" />
    </div>
  );
}

/* --------------------------------- overview -------------------------------- */

function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = 100 / (data.length - 1);
  const pts = data.map(
    (d, i) => `${i * step},${28 - ((d - min) / span) * 24 - 2}`,
  );
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      <title>Metric trend</title>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Metric({
  label,
  value,
  delta,
  up,
  good,
  data,
  color,
  Icon,
}: {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  good: boolean;
  data: number[];
  color: string;
  Icon: typeof Activity;
}) {
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex flex-col gap-2 border border-border bg-card p-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{label}</span>
        <Icon className="size-3.5" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums text-foreground">
          {value}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-mono text-[10px]",
            good ? "text-emerald-400" : "text-red-400",
          )}
        >
          <Trend className="size-3" />
          {delta}
        </span>
      </div>
      <Spark data={data} color={color} />
    </div>
  );
}

const SLOW = [
  { name: "render-newsletter", queue: "email", ms: "4.2s" },
  { name: "generate-invoice", queue: "billing", ms: "3.1s" },
  { name: "export-report", queue: "reports", ms: "2.8s" },
];

export function OverviewPanel() {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Overview" />
      <div className="flex-1 space-y-3 overflow-hidden p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Throughput"
            value="1.24k/h"
            delta="12%"
            up
            good
            color="#34d399"
            Icon={Activity}
            data={[3, 5, 4, 6, 8, 7, 9, 11, 10, 13]}
          />
          <Metric
            label="Failure rate"
            value="0.4%"
            delta="8%"
            up={false}
            good
            color="#f87171"
            Icon={AlertTriangle}
            data={[9, 7, 8, 5, 6, 4, 5, 3, 2, 2]}
          />
          <Metric
            label="Avg. processing"
            value="312ms"
            delta="3%"
            up
            good={false}
            color="#60a5fa"
            Icon={Clock}
            data={[5, 6, 5, 7, 6, 8, 7, 9, 8, 9]}
          />
          <Metric
            label="Queue delay"
            value="1.4s"
            delta="5%"
            up={false}
            good
            color="#fbbf24"
            Icon={Timer}
            data={[8, 7, 9, 6, 7, 5, 6, 4, 5, 4]}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* throughput bars */}
          <div className="border border-border bg-card p-3 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Job throughput
              </span>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 bg-emerald-400" /> completed
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 bg-red-400" /> failed
                </span>
              </div>
            </div>
            <div className="flex h-28 items-end gap-1.5">
              {[52, 64, 48, 72, 80, 60, 88, 76, 94, 70, 84, 96].map((h) => (
                <div
                  key={h}
                  className="flex flex-1 flex-col justify-end gap-px"
                >
                  <div
                    className="bg-red-400/80"
                    style={{ height: `${h * 0.06}px` }}
                  />
                  <div
                    className="bg-emerald-400/80"
                    style={{ height: `${h}px` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* slowest jobs */}
          <div className="border border-border bg-card lg:col-span-2">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-foreground">
              Slowest jobs
            </div>
            <table className="w-full">
              <tbody>
                {SLOW.map((r) => (
                  <tr
                    key={r.name}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-[11px] text-foreground">
                      {r.name}
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">
                      {r.queue}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-amber-400">
                      {r.ms}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- jobs ---------------------------------- */

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="sr-only">{title}</span>
        <span className="flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-[11px] text-foreground">
          <Layers className="size-3.5 text-muted-foreground" />
          email
        </span>
        <span className="border border-border bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground">
          24h
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground md:flex">
          <Search className="size-3.5" />
          Search jobs…
        </span>
        <span className="flex size-7 items-center justify-center border border-border bg-card text-muted-foreground">
          <RefreshCw className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

const TABS = ["All", "Waiting", "Active", "Completed", "Failed", "Delayed"];

const JOBS: {
  id: string;
  name: string;
  status: Status;
  at: string;
  dur: string;
}[] = [
  {
    id: "#48213",
    name: "send-welcome",
    status: "completed",
    at: "2m ago",
    dur: "284ms",
  },
  {
    id: "#48212",
    name: "render-newsletter",
    status: "active",
    at: "2m ago",
    dur: "—",
  },
  {
    id: "#48210",
    name: "deliver-receipt",
    status: "failed",
    at: "5m ago",
    dur: "1.2s",
  },
  {
    id: "#48209",
    name: "sync-contacts",
    status: "completed",
    at: "6m ago",
    dur: "512ms",
  },
  {
    id: "#48205",
    name: "digest-weekly",
    status: "delayed",
    at: "in 3h",
    dur: "—",
  },
];

export function JobsPanel() {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Jobs" />
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {TABS.map((t, i) => (
          <span
            key={t}
            className={cn(
              "px-2.5 py-1 text-[11px]",
              i === 0
                ? "bg-card font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              {["Job", "Queue", "Status", "Queued", "Duration"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground last:text-right"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JOBS.map((j) => (
              <tr key={j.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-[13px] font-medium text-foreground">
                    {j.name}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {j.id}
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  email
                </td>
                <td className="px-4 py-2.5">
                  <JobBadge status={j.status} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {j.at}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-mono text-xs",
                    j.status === "active"
                      ? "text-blue-400"
                      : j.dur === "—"
                        ? "text-muted-foreground"
                        : "text-foreground",
                  )}
                >
                  {j.status === "active" ? "in progress" : j.dur}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------- flows ---------------------------------- */

type Node = {
  id: string;
  name: string;
  queue: string;
  status: Status;
  x: number;
  y: number;
};

const NODE_W = 200;
const NODE_H = 84;
const GRAPH_W = 580;
const GRAPH_H = 364;
const NODES: Node[] = [
  {
    id: "a",
    name: "send-campaign",
    queue: "email",
    status: "active",
    x: 190,
    y: 0,
  },
  {
    id: "b",
    name: "fetch-recipients",
    queue: "email",
    status: "completed",
    x: 0,
    y: 140,
  },
  {
    id: "c",
    name: "render-template",
    queue: "email",
    status: "completed",
    x: 380,
    y: 140,
  },
  {
    id: "d",
    name: "deliver-batch",
    queue: "email",
    status: "waiting",
    x: 0,
    y: 280,
  },
  {
    id: "e",
    name: "track-opens",
    queue: "metrics",
    status: "delayed",
    x: 380,
    y: 280,
  },
];
const LINKS: [string, string][] = [
  ["a", "b"],
  ["a", "c"],
  ["b", "d"],
  ["c", "e"],
];

function byId(id: string) {
  const node = NODES.find((n) => n.id === id);
  if (!node) {
    throw new Error(`Missing flow preview node: ${id}`);
  }
  return node;
}

export function FlowsPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
            <GitBranch className="size-3" />
            Flow
          </span>
          <span className="text-[13px] font-medium text-foreground">
            campaign-2048
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 text-emerald-400">
            <CircleCheck className="size-3" /> 2
          </span>
          <span className="flex items-center gap-1 text-blue-400">5 jobs</span>
        </div>
      </div>

      {/* graph canvas — one scaling SVG (nodes embedded via foreignObject) so
       * the graph fills the editor height on desktop and shrinks to fit on
       * narrow screens, always centered and fully visible. */}
      <div className="relative flex-1 overflow-hidden bg-muted/20">
        <svg
          className="absolute inset-0 h-full w-full p-4"
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <title>Flow dependency graph</title>
          {LINKS.map(([from, to]) => {
            const a = byId(from);
            const b = byId(to);
            const x1 = a.x + NODE_W / 2;
            const y1 = a.y + NODE_H;
            const x2 = b.x + NODE_W / 2;
            const y2 = b.y;
            const my = (y1 + y2) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                fill="none"
                stroke={EDGE[b.status]}
                strokeOpacity={0.5}
                strokeWidth={1.5}
              />
            );
          })}

          {NODES.map((n) => (
            <foreignObject
              key={n.id}
              x={n.x}
              y={n.y}
              width={NODE_W}
              height={NODE_H}
            >
              <div
                className="h-full border bg-card shadow-md"
                style={{ borderColor: `${EDGE[n.status]}66` }}
              >
                <div
                  className="flex items-center justify-between border-b border-border px-3 py-2"
                  style={{ background: `${EDGE[n.status]}14` }}
                >
                  <JobBadge status={n.status} />
                </div>
                <div className="px-3 py-2">
                  <div className="truncate text-sm font-medium text-foreground">
                    {n.name}
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {n.queue}
                  </div>
                </div>
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>
    </div>
  );
}

export { GithubGlyph };
