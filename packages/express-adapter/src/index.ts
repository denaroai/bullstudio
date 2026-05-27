import {
  createEmbeddedDashboard,
  type DashboardConfig,
  type FrameworkResponse,
} from "@bullstudio/embedded-core";
import type { Request, RequestHandler, Response } from "express";

export function bullstudio(config: DashboardConfig): RequestHandler {
  const dashboard = createEmbeddedDashboard(config);
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();

  return async (request, response, next) => {
    try {
      const frameworkRequest = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        basePath: request.baseUrl,
        body: await readRequestBody(request),
      };
      const frameworkResponse = isPrivateDashboardApiRequest(request)
        ? await privateDashboardApi.handle(frameworkRequest)
        : await dashboard.handle(frameworkRequest);

      sendExpressResponse(response, frameworkResponse);
    } catch (error) {
      next(error);
    }
  };
}

function isPrivateDashboardApiRequest(request: Request): boolean {
  return new URL(request.url, "http://bullstudio.local").pathname.startsWith(
    "/api/trpc",
  );
}

async function readRequestBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  if (request.body !== undefined) {
    return Buffer.isBuffer(request.body) || typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

function sendExpressResponse(
  response: Response,
  frameworkResponse: FrameworkResponse,
): void {
  response.status(frameworkResponse.status);

  for (const [name, value] of Object.entries(frameworkResponse.headers ?? {})) {
    response.setHeader(name, value);
  }

  const body = toExpressBody(frameworkResponse.body);

  if (body === undefined || body === null) {
    response.end();
    return;
  }

  response.send(body);
}

function toExpressBody(
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
