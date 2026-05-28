import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type FrameworkResponse,
} from "@bullstudio/embedded-core";
import type {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";

export function bullstudio(config: DashboardConfig): FastifyPluginCallback {
  const dashboard = createEmbeddedDashboard(config);
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();

  return (fastify, _options, done) => {
    fastify.all("/api/trpc/*", async (request, reply) => {
      await sendFastifyResponse(
        reply,
        await privateDashboardApi.handle(toFrameworkRequest(request)),
      );
    });

    for (const url of ["/", "/*"]) {
      fastify.route({
        method: ["GET", "HEAD"],
        url,
        handler: async (request, reply) => {
          await sendFastifyResponse(
            reply,
            await dashboard.handle(toFrameworkRequest(request)),
          );
        },
      });
    }

    done();
  };
}

function toFrameworkRequest(request: FastifyRequest) {
  return {
    method: request.method,
    url: toMountedUrl(request.url),
    headers: request.headers,
    basePath: getBasePath(request.routeOptions.url ?? "/"),
    body: toRequestBody(request.body),
  };
}

function getBasePath(routeUrl: string): string {
  const basePath = routeUrl
    .replace(/\/api\/trpc\/\*$/, "")
    .replace(/\/\*$/, "");

  return basePath || "/";
}

function toMountedUrl(url: string): string {
  const parsedUrl = new URL(url, "http://bullstudio.local");
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

function toRequestBody(body: unknown): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }

  return Buffer.isBuffer(body) || typeof body === "string"
    ? body
    : JSON.stringify(body);
}

async function sendFastifyResponse(
  reply: FastifyReply,
  response: FrameworkResponse,
): Promise<void> {
  reply.code(response.status);

  for (const [name, value] of Object.entries(response.headers ?? {})) {
    reply.header(name, value);
  }

  const body = toFastifyBody(response.body);

  if (body === undefined || body === null) {
    await reply.send();
    return;
  }

  await reply.send(body);
}

function toFastifyBody(
  body: FrameworkResponse["body"],
): string | Buffer | null {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  return JSON.stringify(body);
}
