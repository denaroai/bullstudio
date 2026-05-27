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
        url: c.req.url,
        headers: c.req.raw.headers,
      }),
    ),
  );

  app.on(["GET", "HEAD"], "*", async (c) =>
    toHonoResponse(
      await dashboard.handle({
        method: c.req.method,
        url: c.req.url,
        headers: c.req.raw.headers,
      }),
    ),
  );

  return app;
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
