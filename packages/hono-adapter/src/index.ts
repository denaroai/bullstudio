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

  app.all("/api/auth/*", async (c) =>
    toHonoResponse(
      await dashboard.handle({
        method: c.req.method,
        url: toMountedUrl(c.req.url, getBasePath(c.req.routePath)),
        headers: c.req.raw.headers,
        basePath: getBasePath(c.req.routePath),
        body: await getRequestBody(c.req.raw),
      }),
    ),
  );

  app.all("/api/trpc/*", async (c) =>
    toHonoResponse(
      await privateDashboardApi.handle({
        method: c.req.method,
        url: toMountedUrl(c.req.url, getBasePath(c.req.routePath)),
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
        url: toMountedUrl(c.req.url, getBasePath(c.req.routePath)),
        headers: c.req.raw.headers,
        basePath: getBasePath(c.req.routePath),
      }),
    ),
  );

  return app;
}

function getBasePath(routePath: string): string {
  const basePath = routePath
    .replace(/\/api\/auth\/\*$/, "")
    .replace(/\/api\/trpc\/\*$/, "")
    .replace(/\/\*$/, "");

  return basePath || "/";
}

function toMountedUrl(url: string, basePath: string): string {
  const parsedUrl = new URL(url);
  const normalizedBasePath = basePath === "/" ? "" : basePath;

  if (normalizedBasePath && parsedUrl.pathname === normalizedBasePath) {
    parsedUrl.pathname = "/";
  }

  if (
    normalizedBasePath &&
    parsedUrl.pathname.startsWith(`${normalizedBasePath}/`)
  ) {
    parsedUrl.pathname = parsedUrl.pathname.slice(normalizedBasePath.length);
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
