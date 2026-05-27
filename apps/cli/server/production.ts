import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import type { Context } from "hono";
import { trpcRouter } from "../src/integrations/trpc/router";
import { disconnectProvider } from "../src/integrations/trpc/connection";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// After bundling, this file is at dist/server/production.js,
// so __dirname is dist/server and the SPA is in dist/client.
const clientDir = join(__dirname, "..", "client");

const username = process.env.BULLSTUDIO_USERNAME || "bullstudio";
const password = process.env.BULLSTUDIO_PASSWORD;
const port = Number.parseInt(process.env.PORT || "4000", 10);
const host = process.env.HOST || "localhost";

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

function isHealthCheck(pathname: string): boolean {
  return pathname === "/health" || pathname === "/healthz";
}

function getStaticFilePath(pathname: string): string | null {
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

async function sendFile(
  c: Context,
  filePath: string,
  cacheControl = "public, max-age=3600",
) {
  const fileStat = await stat(filePath);
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const headers = {
    "Cache-Control": cacheControl,
    "Content-Length": fileStat.size.toString(),
    "Content-Type": contentType,
  };

  if (c.req.method === "HEAD") {
    return c.body(null, 200, headers);
  }

  const file = await readFile(filePath);
  return c.body(new Uint8Array(file), 200, headers);
}

const app = new Hono();

function healthResponse(c: Context) {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    redis: process.env.REDIS_URL ? "configured" : "not configured",
  });
}

app.get("/health", healthResponse);
app.get("/healthz", healthResponse);

app.use("*", async (c, next) => {
  if (!password || isHealthCheck(c.req.path)) {
    await next();
    return;
  }

  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Basic ")) {
    return c.text("Authentication required", 401, {
      "WWW-Authenticate": 'Basic realm="bullstudio"',
    });
  }

  const credentials = Buffer.from(auth.slice(6), "base64").toString();
  const separator = credentials.indexOf(":");
  const user = separator === -1 ? credentials : credentials.slice(0, separator);
  const pass = separator === -1 ? "" : credentials.slice(separator + 1);

  if (user !== username || pass !== password) {
    return c.text("Invalid credentials", 401, {
      "WWW-Authenticate": 'Basic realm="bullstudio"',
    });
  }

  await next();
});

app.all("/api/trpc/*", (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: trpcRouter,
    createContext: () => ({}),
  });
});

app.on(["GET", "HEAD"], "*", async (c) => {
  const staticFilePath = getStaticFilePath(c.req.path);

  if (staticFilePath && existsSync(staticFilePath)) {
    const fileStat = await stat(staticFilePath);

    if (fileStat.isFile()) {
      const cacheControl = c.req.path.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";

      return sendFile(c, staticFilePath, cacheControl);
    }
  }

  const indexPath = join(clientDir, "index.html");
  return sendFile(c, indexPath, "no-cache");
});

app.notFound((c) => c.text("Not Found", 404));

const server = serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  () => {
    console.log(`Server running at http://${host}:${port}`);
  },
);

const shutdown = (signal: string) => {
  console.log(`Process received ${signal}, attempting to shut down gracefully`);

  server.close(async () => {
    await disconnectProvider();
    console.log("Server stopped successfully");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Server stop timeout occurred, forcing shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
