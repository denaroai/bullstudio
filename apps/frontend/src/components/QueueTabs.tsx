import { cn } from "@bullstudio/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
  CalendarClock,
  Cpu,
  LayoutDashboard,
  ListTodo,
  type LucideIcon,
  Workflow,
} from "lucide-react";

type QueueTabTo =
  | "/queues/$queueName"
  | "/queues/$queueName/jobs"
  | "/queues/$queueName/flows"
  | "/queues/$queueName/schedulers"
  | "/queues/$queueName/workers";

interface QueueTab {
  title: string;
  to: QueueTabTo;
  /** Path suffix appended to the queue base path; "" is the Overview index. */
  segment: string;
  icon: LucideIcon;
}

interface QueueTabsProps {
  /** Prefix-qualified route param identifying the queue (see queueRouteParam). */
  queueParam: string;
  /** Provider capabilities — gates which sub-sections are reachable. */
  features: { flows: boolean; schedulers: boolean; workers: boolean };
}

/**
 * Sub-navigation for a queue, rendered as route-driven tabs on the queue page.
 * Each tab is a real Link so the URL stays the source of truth (deep-linkable,
 * middle-clickable) instead of being driven by local tab state.
 */
export function QueueTabs({ queueParam, features }: QueueTabsProps) {
  const { pathname } = useLocation();
  const base = `/queues/${queueParam}`;

  const tabs: QueueTab[] = [
    {
      title: "Overview",
      to: "/queues/$queueName",
      segment: "",
      icon: LayoutDashboard,
    },
    {
      title: "Jobs",
      to: "/queues/$queueName/jobs",
      segment: "/jobs",
      icon: ListTodo,
    },
  ];
  if (features.flows) {
    tabs.push({
      title: "Flows",
      to: "/queues/$queueName/flows",
      segment: "/flows",
      icon: Workflow,
    });
  }
  if (features.schedulers) {
    tabs.push({
      title: "Schedulers",
      to: "/queues/$queueName/schedulers",
      segment: "/schedulers",
      icon: CalendarClock,
    });
  }
  if (features.workers) {
    tabs.push({
      title: "Workers",
      to: "/queues/$queueName/workers",
      segment: "/workers",
      icon: Cpu,
    });
  }

  return (
    <nav className="-mx-6 flex items-center gap-1 border-b border-border px-6">
      {tabs.map((tab) => {
        const active = pathname === `${base}${tab.segment}`;
        return (
          <Link
            key={tab.title}
            to={tab.to}
            params={{ queueName: queueParam }}
            className={cn(
              "relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" />
            {tab.title}
            <span
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
