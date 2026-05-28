import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import {
  createStandaloneDashboard,
  type DashboardProtection,
  type FrameworkResponse,
} from "@bullstudio/embedded-core";
import { createPrivateDashboardRouter } from "@bullstudio/private-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Context } from "hono";
import { Hono } from "hono";
import { createStandaloneQueueSource } from "../src/standalone-source";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
};

export interface StandaloneAppOptions {
  clientDir: string;
  env?: NodeJS.ProcessEnv;
  trpcHandler?: (request: Request) => Promise<Response> | Response;
}

export function createStandaloneApp(options: StandaloneAppOptions): Hono {
  const env = options.env ?? process.env;
  const app = new Hono();
  const trpcRouter = createPrivateDashboardRouter(
    createStandaloneQueueSource(),
  );
  const dashboard = createStandaloneDashboard({
    protection: getStandaloneProtection(env),
    handleDashboardAsset: (request) =>
      handleDashboardAsset(request, options.clientDir),
    mountPrivateDashboardApi: () => ({
      handle: async (request) =>
        toFrameworkResponse(
          await (options.trpcHandler?.(toFetchRequest(request)) ??
            fetchRequestHandler({
              endpoint: "/api/trpc",
              req: toFetchRequest(request),
              router: trpcRouter,
              createContext: () => ({}),
            })),
        ),
    }),
  });
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();

  app.get("/health", (c) => healthResponse(c, env));
  app.get("/healthz", (c) => healthResponse(c, env));

  app.all("/api/trpc/*", async (c) =>
    toHonoResponse(
      await privateDashboardApi.handle({
        method: c.req.method,
        url: c.req.url,
        headers: c.req.raw.headers,
        body: c.req.raw.body,
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

  app.notFound((c) => c.text("Not Found", 404));

  return app;
}

function getStandaloneProtection(
  env: StandaloneAppOptions["env"],
): DashboardProtection {
  if (!env?.BULLSTUDIO_PASSWORD) {
    return {
      type: "disabled",
    };
  }

  return {
    type: "basic",
    username: env.BULLSTUDIO_USERNAME || "bullstudio",
    password: env.BULLSTUDIO_PASSWORD,
  };
}

function healthResponse(c: Context, env: StandaloneAppOptions["env"]) {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    redis: env?.REDIS_URL ? "configured" : "not configured",
  });
}

async function handleDashboardAsset(
  request: { method: string; url: string },
  clientDir: string,
): Promise<FrameworkResponse> {
  const pathname = new URL(request.url).pathname;
  const staticFilePath = getStaticFilePath(pathname, clientDir);

  if (staticFilePath && existsSync(staticFilePath)) {
    const fileStat = await stat(staticFilePath);

    if (fileStat.isFile()) {
      const cacheControl = pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";

      return getFileResponse(request.method, staticFilePath, cacheControl);
    }
  }

  return getFileResponse(
    request.method,
    join(clientDir, "index.html"),
    "no-cache",
  );
}

function getStaticFilePath(pathname: string, clientDir: string): string | null {
  let decodedPathname: string;

  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath =
    decodedPathname === "/" ? "index.html" : decodedPathname.slice(1);
  const filePath = normalize(join(clientDir, relativePath));
  const relativeToClient = relative(clientDir, filePath);

  if (
    relativeToClient === "" ||
    relativeToClient.startsWith("..") ||
    relativeToClient.startsWith("/") ||
    relativeToClient.startsWith("\\")
  ) {
    return null;
  }

  return filePath;
}

async function getFileResponse(
  method: string,
  filePath: string,
  cacheControl: string,
): Promise<FrameworkResponse> {
  const fileStat = await stat(filePath);
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const headers = {
    "Cache-Control": cacheControl,
    "Content-Length": fileStat.size.toString(),
    "Content-Type": contentType,
  };

  if (method === "HEAD") {
    return {
      status: 200,
      headers,
    };
  }

  return {
    status: 200,
    headers,
    body: new Uint8Array(await readFile(filePath)),
  };
}

function toFetchRequest(request: {
  body?: unknown;
  headers?: Headers | Record<string, string | string[] | undefined>;
  method: string;
  url: string;
}): Request {
  return new Request(request.url, {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : (request.body as BodyInit | null | undefined),
  });
}

function toFetchHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
): HeadersInit | undefined {
  if (!headers || headers instanceof Headers) {
    return headers;
  }

  const fetchHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        fetchHeaders.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      fetchHeaders.set(name, value);
    }
  }

  return fetchHeaders;
}

async function toFrameworkResponse(
  response: Response,
): Promise<FrameworkResponse> {
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
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
