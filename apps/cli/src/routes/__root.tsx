import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

import type { TRPCRouter } from "@/integrations/trpc/router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import {
  SidebarInset,
  SidebarProvider,
} from "@bullstudio/ui/components/sidebar";
import { AppSidebar } from "@/components/Sidebar";
import { Toaster } from "sonner";

import "../styles.css";
import { ThemeProvider } from "@/components/ThemeProvider";

interface MyRouterContext {
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<TRPCRouter>;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "bullstudio CLI",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/logo.svg",
      },
    ],
  }),

  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeadContent />
      <ThemeProvider defaultTheme="dark">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="overflow-y-auto">
            <main className="flex-1 p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster theme="dark" position="bottom-right" richColors />
      </ThemeProvider>
    </>
  );
}
