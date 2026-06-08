import type { ServerResponse } from "node:http";
import { resolve } from "node:path";
import { normalizePath, type Connect, type Plugin, type ViteDevServer } from "vite";

type StandaloneApp = {
  fetch(request: Request): Promise<Response> | Response;
};

type StandaloneModule = {
  createStandaloneApp(options: {
    clientDir: string;
    env?: NodeJS.ProcessEnv;
  }): StandaloneApp;
};

export function standaloneApiPlugin(): Plugin {
  return {
    name: "bullstudio-standalone-api",
    apply: "serve",
    async configureServer(server) {
      await installStandaloneApiMiddleware(server);
    },
  };
}

export async function installStandaloneApiMiddleware(server: ViteDevServer) {
  const { createStandaloneApp } = await loadStandaloneModule(server);
  const app = createStandaloneApp({
    clientDir: server.config.root,
    env: process.env,
  });

  server.middlewares.use(async (req, res, next) => {
    if (!req.url || !shouldHandleRequest(req.url)) {
      next();
      return;
    }

    try {
      const response = await app.fetch(toRequest(req, server));
      await writeResponse(res, response);
    } catch (error) {
      next(error);
    }
  });
}

async function loadStandaloneModule(
  server: ViteDevServer,
): Promise<StandaloneModule> {
  const standaloneServerPath = resolve(
    server.config.root,
    "../standalone/server/standalone.ts",
  );

  return server.ssrLoadModule(
    toViteFsModuleId(standaloneServerPath),
  ) as Promise<StandaloneModule>;
}

export function toViteFsModuleId(filePath: string): string {
  return `/@fs/${normalizePath(filePath).replace(/^\/+/, "")}`;
}

function shouldHandleRequest(url: string): boolean {
  const pathname = getPathname(url);

  return (
    pathname === "/health" ||
    pathname === "/healthz" ||
    pathname === "/api/trpc" ||
    pathname.startsWith("/api/trpc/")
  );
}

function getPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function toRequest(req: Connect.IncomingMessage, server: ViteDevServer) {
  const url = new URL(req.url ?? "/", getRequestOrigin(req, server));
  const method = req.method ?? "GET";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: toHeaders(req.headers),
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = req as unknown as BodyInit;
    init.duplex = "half";
  }

  return new Request(url, init);
}

function getRequestOrigin(req: Connect.IncomingMessage, server: ViteDevServer) {
  const protocol =
    req.headers["x-forwarded-proto"]?.toString().split(",")[0]?.trim() ??
    "http";
  const host =
    req.headers.host ??
    `localhost:${server.config.server.port ?? process.env.PORT ?? 5173}`;

  return `${protocol}://${host}`;
}

function toHeaders(headers: Connect.IncomingMessage["headers"]): Headers {
  const result = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      result.set(name, value);
    }
  }

  return result;
}

async function writeResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;

  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  res.end(Buffer.from(await response.arrayBuffer()));
}
