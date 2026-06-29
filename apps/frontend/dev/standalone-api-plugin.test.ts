import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installStandaloneApiMiddleware,
  toViteFsModuleId,
} from "./standalone-api-plugin";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

const createStandaloneApp = vi.fn(() => ({
  fetch: mocks.fetch,
}));

describe("standalone API Vite middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetch.mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: {
          "content-type": "text/plain",
        },
      }),
    );
  });

  it("handles private dashboard API requests through the standalone app", async () => {
    const { server, runMiddleware } = createServerHarness();
    await installStandaloneApiMiddleware(server);

    const { next, res } = await runMiddleware({
      url: "/api/trpc/connection.info?batch=1",
      method: "GET",
      headers: {
        host: "localhost:5173",
      },
    });

    expect(next).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledOnce();

    const request = mocks.fetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://localhost:5173/api/trpc/connection.info?batch=1",
    );
    expect(request.method).toBe("GET");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/plain");
    expect(res.body).toBe("ok");
  });

  it("leaves frontend routes for Vite to handle", async () => {
    const { server, runMiddleware } = createServerHarness();
    await installStandaloneApiMiddleware(server);

    const { next } = await runMiddleware({
      url: "/jobs",
      method: "GET",
      headers: {
        host: "localhost:5173",
      },
    });

    expect(next).toHaveBeenCalledOnce();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("passes the process environment to standalone mode", async () => {
    vi.stubEnv("REDIS_URL", "redis://cache.internal:6380/2");
    vi.stubEnv("REDIS_PREFIX", "stage,prod");

    const { server } = createServerHarness();
    await installStandaloneApiMiddleware(server);

    expect(createStandaloneApp).toHaveBeenCalledWith({
      clientDir: "/repo/apps/frontend",
      env: expect.objectContaining({
        REDIS_URL: "redis://cache.internal:6380/2",
        REDIS_PREFIX: "stage,prod",
      }),
    });

    vi.unstubAllEnvs();
  });

  it("loads the standalone server through a Windows-safe Vite fs module id", async () => {
    const { server } = createServerHarness();
    await installStandaloneApiMiddleware(server);

    expect(server.ssrLoadModule).toHaveBeenCalledOnce();
    expect(server.ssrLoadModule).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/@fs\/(?:[A-Za-z]:\/)?repo\/apps\/standalone\/server\/standalone\.ts$/,
      ),
    );
  });
});

describe("toViteFsModuleId", () => {
  it("normalizes Windows absolute paths for Vite's /@fs URL format", () => {
    expect(
      toViteFsModuleId(
        "C:\\Users\\celovie\\Desktop\\Development\\bullstudio\\apps\\standalone\\server\\standalone.ts",
      ),
    ).toBe(
      "/@fs/C:/Users/celovie/Desktop/Development/bullstudio/apps/standalone/server/standalone.ts",
    );
  });
});

function createServerHarness() {
  let middleware:
    | ((
        req: IncomingMessage,
        res: ServerResponse,
        next: (error?: unknown) => void,
      ) => void | Promise<void>)
    | undefined;
  const server = {
    config: {
      root: "/repo/apps/frontend",
      server: {
        port: 5173,
      },
    },
    middlewares: {
      use: vi.fn((handler) => {
        middleware = handler as typeof middleware;
      }),
    },
    ssrLoadModule: vi.fn(async () => ({
      createStandaloneApp,
    })),
  } as unknown as ViteDevServer;

  return {
    server,
    async runMiddleware(request: {
      url: string;
      method: string;
      headers: Record<string, string>;
    }) {
      if (!middleware) {
        throw new Error("Middleware was not registered.");
      }

      const next = vi.fn();
      const req = new PassThrough() as PassThrough & {
        headers: Record<string, string>;
        method: string;
        url: string;
      };
      req.headers = request.headers;
      req.method = request.method;
      req.url = request.url;

      const res = createResponse();
      await middleware(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        next,
      );

      return { next, res };
    },
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {} as Record<string, number | string | string[]>,
    body: "",
    setHeader(name: string, value: number | string | string[]) {
      this.headers[name] = value;
    },
    end(body?: Buffer | string) {
      this.body = body?.toString() ?? "";
    },
  };
}
