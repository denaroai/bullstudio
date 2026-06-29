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

interface BullstudioFastifyOptions {
  prefix?: string;
}

export function bullstudio(
  config: DashboardConfig,
): FastifyPluginCallback<BullstudioFastifyOptions> {
  const dashboard = createEmbeddedDashboard(config);
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();

  return (fastify, options, done) => {
    const mountPath = normalizeMountPath(options.prefix);

    fastify.all("/api/auth/*", async (request, reply) => {
      await sendFastifyResponse(
        reply,
        await dashboard.handle(toFrameworkRequest(request, mountPath)),
      );
    });

    fastify.all("/api/trpc/*", async (request, reply) => {
      await sendFastifyResponse(
        reply,
        await privateDashboardApi.handle(
          toFrameworkRequest(request, mountPath),
        ),
      );
    });

    for (const url of ["/", "/*"]) {
      fastify.route({
        method: ["GET", "HEAD"],
        url,
        handler: async (request, reply) => {
          await sendFastifyResponse(
            reply,
            await dashboard.handle(toFrameworkRequest(request, mountPath)),
          );
        },
      });
    }

    done();
  };
}

function toFrameworkRequest(request: FastifyRequest, mountPath: string) {
  return {
    method: request.method,
    url: toMountedUrl(request.url, mountPath),
    headers: request.headers,
    basePath: mountPath,
    body: toRequestBody(request.body),
  };
}

function toMountedUrl(url: string, mountPath: string): string {
  const parsedUrl = new URL(url, "http://bullstudio.local");
  const prefix = mountPath === "/" ? "" : mountPath;

  if (prefix && parsedUrl.pathname === prefix) {
    parsedUrl.pathname = "/";
  } else if (prefix && parsedUrl.pathname.startsWith(`${prefix}/`)) {
    parsedUrl.pathname = parsedUrl.pathname.slice(prefix.length);
  }

  return `${parsedUrl.pathname}${parsedUrl.search}`;
}

function normalizeMountPath(mountPath: string | undefined): string {
  if (!mountPath || mountPath === "/") {
    return "/";
  }

  return `/${mountPath.replace(/^\/+|\/+$/g, "")}`;
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
