"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@bullstudio/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Database,
  Github,
  LayoutDashboard,
  ListTodo,
  Monitor,
  Moon,
  Sun,
  Twitter,
  Workflow,
} from "lucide-react";
import { VERSION } from "@/const";
import { type Theme, useTheme } from "@/components/ThemeProvider";
import { useTRPC } from "@/integrations/trpc/react";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";
import { getAssetUrl, getDashboardIdentity } from "@/lib/runtime-config";
import { cn } from "@bullstudio/ui/lib/utils";

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const trpc = useTRPC();
  const dashboardIdentity = getDashboardIdentity();
  const dashboardLogo = dashboardIdentity?.logo;
  const dashboardTitle = dashboardIdentity?.title ?? "bullstudio";

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  // Build navigation items based on provider capabilities
  const baseNavItems = [
    {
      title: "Overview",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Jobs",
      href: "/jobs",
      icon: ListTodo,
    },
  ];

  // Only show Flows for providers that support it (BullMQ)
  const navItems = queueSource?.features.flows.visible
    ? [
        ...baseNavItems,
        {
          title: "Flows",
          href: "/flows",
          icon: Workflow,
        },
      ]
    : baseNavItems;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
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
              {dashboardIdentity ? "Embedded" : "CLI"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup className="py-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 transition-colors"
                    >
                      <Link to={item.href}>
                        <item.icon className="size-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Redis Connection Info */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div className="px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:justify-center">
                <Database className="size-3.5 shrink-0 text-emerald-500" />
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
                  <span className="text-sidebar-foreground/60 font-mono text-[11px]">
                    {queueSource?.detail || "connecting..."}
                  </span>
                  {queueSource?.prefixes && queueSource.prefixes.length > 1 && (
                    <span className="text-sidebar-foreground/45 font-mono text-[10px] mt-0.5">
                      prefixes: {queueSource.prefixes.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="gap-3 border-t border-sidebar-border p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
        <ThemeSwitcher />
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

      {/* Rail for resizing */}
      <SidebarRail />
    </Sidebar>
  );
}

const themeOptions: Array<{
  icon: typeof Moon;
  label: string;
  value: Theme;
}> = [
  {
    icon: Moon,
    label: "Dark",
    value: "dark",
  },
  {
    icon: Sun,
    label: "Light",
    value: "light",
  },
  {
    icon: Monitor,
    label: "System",
    value: "system",
  },
];

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const activeTheme =
    themeOptions.find((option) => option.value === theme) ?? themeOptions[0];
  const ActiveIcon = activeTheme.icon;

  const cycleTheme = () => {
    const index = themeOptions.findIndex((option) => option.value === theme);
    const next = themeOptions[(index + 1) % themeOptions.length];
    setTheme(next.value);
  };

  return (
    <div className="w-full group-data-[collapsible=icon]:w-auto">
      <div className="grid grid-cols-3 gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/45 p-1 group-data-[collapsible=icon]:hidden">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const active = option.value === theme;

          return (
            <button
              key={option.value}
              type="button"
              aria-label={`Use ${option.label.toLowerCase()} theme`}
              aria-pressed={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex h-7 items-center justify-center rounded text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
                active && "bg-sidebar text-sidebar-foreground shadow-sm",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={`Theme: ${activeTheme.label}. Click to change theme.`}
        title={`Theme: ${activeTheme.label}`}
        onClick={cycleTheme}
        className="hidden size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 group-data-[collapsible=icon]:flex"
      >
        <ActiveIcon className="size-4" />
      </button>
    </div>
  );
}
