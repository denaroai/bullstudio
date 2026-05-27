import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type FrameworkResponse,
} from "@bullstudio/embedded-core";

export interface NextDashboardConfig extends DashboardConfig {
  mountPath: string;
}

export interface NextAppRouterHandlers {
  GET(request: Request): Promise<Response>;
  HEAD(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

export function bullstudio(config: NextDashboardConfig): NextAppRouterHandlers {
  const mountPath = normalizeMountPath(config.mountPath);
  const dashboard = createEmbeddedDashboard({
    ...config,
    basePath: mountPath,
  });
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();

  const handle = async (request: Request): Promise<Response> => {
    if (!isMountedRequest(request, mountPath)) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const frameworkRequest = await toFrameworkRequest(request, mountPath);
    const frameworkResponse = isPrivateDashboardApiRequest(frameworkRequest.url)
      ? await privateDashboardApi.handle(frameworkRequest)
      : await dashboard.handle(frameworkRequest);

    return toResponse(frameworkResponse);
  };

  return {
    GET: handle,
    HEAD: handle,
    POST: handle,
  };
}

function normalizeMountPath(mountPath: string): string {
  const trimmed = mountPath.trim();

  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function isMountedRequest(request: Request, mountPath: string): boolean {
  const pathname = new URL(request.url).pathname;

  return (
    pathname === mountPath ||
    pathname.startsWith(`${mountPath === "/" ? "" : mountPath}/`)
  );
}

async function toFrameworkRequest(
  request: Request,
  mountPath: string,
): Promise<{
  method: string;
  url: string;
  headers: Headers;
  body: BodyInit | undefined;
}> {
  const url = new URL(request.url);
  url.pathname = getRelativePathname(url.pathname, mountPath);

  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: request.headers,
    basePath: mountPath,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text(),
  };
}

function getRelativePathname(pathname: string, mountPath: string): string {
  if (mountPath === "/") {
    return pathname;
  }

  const relativePathname = pathname.slice(mountPath.length);
  return relativePathname || "/";
}

function isPrivateDashboardApiRequest(url: string): boolean {
  return new URL(url, "http://bullstudio.local").pathname.startsWith(
    "/api/trpc",
  );
}

function toResponse(response: FrameworkResponse): Response {
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
