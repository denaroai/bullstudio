import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DocumentIdentity,
  FrameworkRequest,
  FrameworkResponse,
  ResolvedDashboardConfig,
} from "./types";
import { getPathname } from "./url";

const packageDistDir = dirname(fileURLToPath(import.meta.url));
const clientDistPath = findClientDistPath();

export async function handleDashboardAsset(
  request: FrameworkRequest,
  config: ResolvedDashboardConfig,
): Promise<FrameworkResponse> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
      },
      body: "Method Not Allowed",
    };
  }

  const pathname = getPathname(request.url);
  const assetPath = getAssetPath(pathname);
  const basePath = normalizeBasePath(request.basePath ?? config.basePath);

  if (!clientDistPath) {
    return missingBuiltDashboardResponse(request);
  }

  if (assetPath === "index.html") {
    return {
      status: 200,
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
      },
      body:
        request.method === "HEAD"
          ? undefined
          : await renderDashboardHtml(config, basePath),
    };
  }

  const filePath = resolve(clientDistPath, assetPath);
  const clientRoot = resolve(clientDistPath);

  if (!filePath.startsWith(clientRoot)) {
    return notFoundResponse(request);
  }

  try {
    const body = await readAssetFile(filePath, basePath);
    return {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getContentType(filePath),
      },
      body: request.method === "HEAD" ? undefined : body,
    };
  } catch {
    return notFoundResponse(request);
  }
}

async function readAssetFile(
  filePath: string,
  basePath: string,
): Promise<Buffer | string> {
  const body = await readFile(filePath);

  if (extname(filePath) !== ".css" || !basePath) {
    return body;
  }

  return body
    .toString("utf8")
    .replaceAll("url(/assets/", `url(${basePath}/assets/`);
}

function findClientDistPath(): string | null {
  const candidates = [
    process.env.BULLSTUDIO_CLIENT_DIR,
    join(packageDistDir, "client"),
    join(process.cwd(), "apps/frontend/dist/client"),
    join(process.cwd(), "../../apps/frontend/dist/client"),
    join(process.cwd(), "../apps/frontend/dist/client"),
    join(process.cwd(), "packages/cli/dist/client"),
    join(process.cwd(), "../../packages/cli/dist/client"),
    join(process.cwd(), "../packages/cli/dist/client"),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getAssetPath(pathname: string): string {
  const normalizedPathname = pathname.replace(/^\/+/, "");

  if (
    !normalizedPathname ||
    normalizedPathname === "." ||
    (!normalizedPathname.startsWith("assets/") &&
      normalizedPathname !== "logo.svg")
  ) {
    return "index.html";
  }

  return normalizedPathname;
}

async function renderDashboardHtml(
  config: ResolvedDashboardConfig,
  basePath: string,
): Promise<string> {
  const html = await readFile(join(clientDistPath ?? "", "index.html"), "utf8");
  const runtimeConfig = escapeScriptJson({
    mode: "embedded",
    basePath,
    dashboardIdentity: config.dashboardIdentity,
    documentIdentity: config.documentIdentity,
    polling: config.polling,
  });

  return html
    .replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(config.documentIdentity.title)}</title>`,
    )
    .replaceAll('href="/assets/', `href="${basePath}/assets/`)
    .replaceAll('src="/assets/', `src="${basePath}/assets/`)
    .replaceAll('href="/logo.svg"', `href="${basePath}/logo.svg"`)
    .replace(
      /<link rel="icon"[^>]*>/,
      renderFavicon(config.documentIdentity, basePath),
    )
    .replace(
      "</head>",
      `<script>window.__BULLSTUDIO__=${runtimeConfig};</script></head>`,
    );
}

function renderFavicon(identity: DocumentIdentity, basePath: string): string {
  const favicon = identity.favicon ?? `${basePath}/logo.svg`;

  return `<link rel="icon" href="${escapeHtml(favicon)}">`;
}

function missingBuiltDashboardResponse(
  request: FrameworkRequest,
): FrameworkResponse {
  return {
    status: 500,
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
    },
    body:
      request.method === "HEAD"
        ? undefined
        : "Bullstudio dashboard assets are missing. Reinstall @bullstudio/embedded-core or set BULLSTUDIO_CLIENT_DIR to a built Bullstudio dashboard asset directory.",
  };
}

function notFoundResponse(request: FrameworkRequest): FrameworkResponse {
  return {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: request.method === "HEAD" ? undefined : "Not Found",
  };
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".ttf":
      return "font/ttf";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === "/") {
    return "";
  }

  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}
