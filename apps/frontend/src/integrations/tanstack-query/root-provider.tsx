import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { TRPCRouter } from "@/integrations/trpc/router";

import { TRPCProvider } from "@/integrations/trpc/react";
import { getApiUrl, getBasePath } from "@/lib/runtime-config";

function getUrl() {
  if (typeof window !== "undefined") {
    return getApiUrl();
  }

  return `http://localhost:${process.env.PORT ?? 3000}/api/trpc`;
}

export const trpcClient = createTRPCClient<TRPCRouter>({
  links: [
    httpBatchStreamLink({
      transformer: superjson,
      url: getUrl(),
      fetch: async (url, options) => {
        const response = await fetch(url, {
          ...options,
          credentials: "same-origin",
        });

        if (
          response.status === 401 &&
          typeof window !== "undefined" &&
          window.location.pathname !== `${getBasePath()}/login`
        ) {
          const basePath = getBasePath();
          const pathname = basePath
            ? window.location.pathname.slice(basePath.length) || "/"
            : window.location.pathname;
          const redirect = `${pathname}${window.location.search}`;
          window.location.assign(
            `${basePath}/login?redirect=${encodeURIComponent(redirect)}`,
          );
        }

        return response;
      },
    }),
  ],
});

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: { serializeData: superjson.serialize },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });

  const serverHelpers = createTRPCOptionsProxy({
    client: trpcClient,
    queryClient: queryClient,
  });
  return {
    queryClient,
    trpc: serverHelpers,
  };
}

export function Provider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
