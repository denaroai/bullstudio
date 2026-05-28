import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type FrameworkResponse,
} from "@bullstudio/embedded-core";
import { Hono } from "hono";

export function bullstudio(config: DashboardConfig): Hono {
  const dashboard = createEmbeddedDashboard(config);
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();
  const app = new Hono();

  app.all("/api/trpc/*", async (c) =>
    toHonoResponse(
      await privateDashboardApi.handle({
        method: c.req.method,
        url: toMountedUrl(c.req.url),
        headers: c.req.raw.headers,
        basePath: getBasePath(c.req.routePath),
        body: await getRequestBody(c.req.raw),
      }),
    ),
  );

  app.on(["GET", "HEAD"], "*", async (c) =>
    toHonoResponse(
      await dashboard.handle({
        method: c.req.method,
        url: toMountedUrl(c.req.url),
        headers: c.req.raw.headers,
        basePath: getBasePath(c.req.routePath),
      }),
    ),
  );

  return app;
}

function getBasePath(routePath: string): string {
  const basePath = routePath
    .replace(/\/api\/trpc\/\*$/, "")
    .replace(/\/\*$/, "");

  return basePath || "/";
}

function toMountedUrl(url: string): string {
  const parsedUrl = new URL(url);
  const assetIndex = parsedUrl.pathname.search(/\/(?:assets\/|logo\.svg$)/);
  const apiIndex = parsedUrl.pathname.indexOf("/api/trpc");

  if (apiIndex >= 0) {
    parsedUrl.pathname = parsedUrl.pathname.slice(apiIndex);
  } else if (assetIndex >= 0) {
    parsedUrl.pathname = parsedUrl.pathname.slice(assetIndex);
  } else {
    parsedUrl.pathname = "/";
  }

  return `${parsedUrl.pathname}${parsedUrl.search}`;
}

async function getRequestBody(request: Request): Promise<string | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  return request.text();
}

function toHonoResponse(response: FrameworkResponse): Response {
  return new Response(toResponseBody(response.body), {
    status: response.status,
    headers: response.headers,
  });
}

function toResponseBody(body: FrameworkResponse["body"]): BodyInit | null {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return body.slice().buffer;
  }

  return JSON.stringify(body);
}
