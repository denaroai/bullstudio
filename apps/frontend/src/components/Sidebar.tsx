"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@bullstudio/ui/components/sidebar";
import { cn } from "@bullstudio/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Database, Github, LogOut, Twitter } from "lucide-react";
import { useEffect, useState } from "react";
import { JobDistributionPie } from "@/components/overview/JobDistributionPie";
import { usePolling } from "@/components/PollingProvider";
import { SettingsDialog } from "@/components/SettingsDialog";
import { VERSION } from "@/const";
import { useTRPC } from "@/integrations/trpc/react";
import { queueRouteParam } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";
import {
  getAssetUrl,
  getAuthUrl,
  getBasePath,
  getDashboardIdentity,
} from "@/lib/runtime-config";

interface AuthSessionResponse {
  authEnabled?: boolean;
}

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const trpc = useTRPC();
  const dashboardIdentity = getDashboardIdentity();
  const dashboardLogo = dashboardIdentity?.logo;
  const dashboardTitle = dashboardIdentity?.title ?? "bullstudio";
  const { enabled: pollEnabled, interval: pollInterval } = usePolling();

  const { data: connectionInfo, isError: connectionError } = useQuery(
    // Poll so the connection indicator reflects Redis going down/recovering
    // instead of staying frozen on the last successful fetch. Honors the
    // user's polling preference so we don't keep hitting Redis when disabled.
    trpc.connection.info.queryOptions(undefined, {
      refetchInterval: pollEnabled ? pollInterval : false,
    }),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const hasMultiplePrefixes =
    queueSource?.prefixes && queueSource.prefixes.length > 1;

  // If the status query itself fails the API is unreachable; treat that as the
  // worst case so the indicator never shows a stale "connected" state.
  const connectionStatus = connectionError
    ? "unavailable"
    : (queueSource?.status ?? null);

  const queueBasePath = (queueName: string) => `/queues/${queueName}`;

  const isQueueActive = (queueName: string) => {
    const base = queueBasePath(queueName);
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const queues = useQuery(trpc.queues.list.queryOptions());

  const queueList = queues.data ?? [];

  // Bucket queues by prefix so each Redis prefix can render as its own labelled
  // subsection. Insertion order is preserved (the backend already returns
  // queues grouped by prefix), and queue names are unique within a prefix.
  const queuesByPrefix = new Map<string, typeof queueList>();
  for (const queue of queueList) {
    const bucket = queuesByPrefix.get(queue.prefix ?? "");
    if (bucket) {
      bucket.push(queue);
    } else {
      queuesByPrefix.set(queue.prefix ?? "", [queue]);
    }
  }

  const renderQueueItem = (queue: (typeof queueList)[number]) => {
    const routeParam = queueRouteParam(queue);
    const queueActive = isQueueActive(routeParam);

    return (
      <SidebarMenuItem key={routeParam}>
        <SidebarMenuButton
          asChild
          isActive={queueActive}
          tooltip={queue.name}
          className="h-9"
        >
          <Link
            to="/queues/$queueName"
            params={{ queueName: routeParam }}
            className="h-9"
          >
            {queue.jobCounts && (
              <JobDistributionPie
                counts={queue.jobCounts}
                className="group-data-[collapsible=icon]:hidden"
              />
            )}
            <span className="font-mono text-sm">{queue.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="none" className="border-r-0">
      {/* Header with Logo */}
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-3">
          <img
            src={dashboardLogo?.src ?? getAssetUrl("/logo.svg")}
            alt={dashboardLogo?.alt ?? "bullstudio"}
            className="size-8 shrink-0"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm text-sidebar-foreground">
              {dashboardTitle}
            </span>
            <span className="text-[10px] text-sidebar-foreground/55 uppercase tracking-wider">
              {dashboardIdentity ? "Embedded" : "Standalone"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {hasMultiplePrefixes ? (
          Array.from(queuesByPrefix, ([prefix, prefixQueues]) => (
            <SidebarGroup key={prefix}>
              <SidebarGroupLabel className="font-mono">
                {prefix}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{prefixQueues.map(renderQueueItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Queues</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{queueList.map(renderQueueItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Redis Connection Info */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div className="px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:justify-center">
                <Database
                  className={cn(
                    "size-3.5 shrink-0",
                    connectionStatus === "healthy"
                      ? "text-emerald-500"
                      : connectionStatus === "degraded"
                        ? "text-amber-500"
                        : "text-destructive",
                  )}
                />
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-sidebar-foreground/80 font-medium">
                      {queueSource?.title ?? "Queue source"}
                    </span>
                    {queueSource?.providerLabel && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground uppercase">
                        {queueSource.providerLabel}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      connectionStatus === "degraded"
                        ? "text-amber-500"
                        : connectionStatus === "unavailable"
                          ? "text-destructive"
                          : "text-sidebar-foreground/60",
                    )}
                  >
                    {connectionStatus === "degraded"
                      ? "reconnecting…"
                      : connectionStatus === "unavailable"
                        ? "disconnected"
                        : queueSource?.detail || "connecting…"}
                  </span>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="gap-3 border-t border-sidebar-border p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <SettingsDialog />
          <LogoutButton />
        </div>
        <div className="flex items-center justify-between text-xs text-sidebar-foreground/55 group-data-[collapsible=icon]:justify-center">
          <span className="group-data-[collapsible=icon]:hidden">
            {VERSION}
          </span>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <a
              href="https://github.com/emirce/bullstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sidebar-foreground transition-colors"
            >
              <Github className="size-4" />
            </a>
            <a
              href="https://x.com/emirthedev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sidebar-foreground transition-colors"
            >
              <Twitter className="size-4" />
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function LogoutButton() {
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(getAuthUrl("/api/auth/session"), {
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((session: AuthSessionResponse) => {
        if (!cancelled) {
          setAuthEnabled(session.authEnabled === true);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await fetch(getAuthUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);

    window.location.assign(`${getBasePath()}/login`);
  };

  if (!authEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={logout}
      title="Log out"
      className="flex h-8 flex-1 items-center justify-center gap-2 rounded-md text-sidebar-foreground/60 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none"
    >
      <LogOut className="size-4" />
      <span className="group-data-[collapsible=icon]:hidden">Log out</span>
    </button>
  );
}
