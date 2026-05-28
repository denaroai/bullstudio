import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./connection");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("standalone dashboard parity", () => {
  it("serves root assets, health checks, private API, and production Basic Auth behavior", async () => {
    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}`,
    );
    await mkdir(join(clientDir, "assets"), { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>Bullstudio</html>");
    await writeFile(join(clientDir, "assets", "app.js"), "console.log('app')");

    const app = createStandaloneApp({
      clientDir,
      env: {
        BULLSTUDIO_PASSWORD: "secret",
        BULLSTUDIO_USERNAME: "operator",
        REDIS_URL: "redis://localhost:6379",
      },
      trpcHandler: async () =>
        new Response(JSON.stringify({ result: { data: "ok" } }), {
          headers: {
            "Content-Type": "application/json",
          },
        }),
    });

    const health = await app.request("/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      status: "ok",
      redis: "configured",
    });

    const unauthorizedAsset = await app.request("/");
    expect(unauthorizedAsset.status).toBe(401);
    expect(unauthorizedAsset.headers.get("www-authenticate")).toBe(
      'Basic realm="bullstudio"',
    );

    const authorizedAsset = await app.request("/", {
      headers: {
        Authorization: basicAuth("operator", "secret"),
      },
    });
    expect(authorizedAsset.status).toBe(200);
    expect(authorizedAsset.headers.get("content-type")).toContain("text/html");
    await expect(authorizedAsset.text()).resolves.toContain("Bullstudio");

    const authorizedStaticAsset = await app.request("/assets/app.js", {
      headers: {
        Authorization: basicAuth("operator", "secret"),
      },
    });
    expect(authorizedStaticAsset.status).toBe(200);
    expect(authorizedStaticAsset.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );

    const unauthorizedApi = await app.request("/api/trpc/queues.list");
    expect(unauthorizedApi.status).toBe(401);

    const authorizedApi = await app.request("/api/trpc/queues.list", {
      headers: {
        Authorization: basicAuth("operator", "secret"),
      },
    });
    expect(authorizedApi.status).toBe(200);
    await expect(authorizedApi.json()).resolves.toEqual({
      result: {
        data: "ok",
      },
    });
  });

  it("keeps private tRPC queue access backed by Redis-discovered queues", async () => {
    vi.doMock("./connection", () => ({
      disconnectProvider: async () => {},
      getQueueProvider: async () => ({
        getCapabilities: () => ({
          providerType: "bullmq",
          displayName: "BullMQ",
          supportsFlows: true,
          supportedJobStates: [
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
            "waiting-children",
          ],
        }),
        getQueues: async () => [
          {
            name: "email",
            prefix: "bull",
            isPaused: false,
            jobCounts: {
              active: 0,
              completed: 0,
              delayed: 0,
              failed: 0,
              paused: 0,
              prioritized: 0,
              waiting: 1,
              waitingChildren: 0,
            },
          },
        ],
      }),
    }));

    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}`,
    );
    await mkdir(clientDir, { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>Bullstudio</html>");

    const app = createStandaloneApp({
      clientDir,
      env: {},
    });

    const response = await app.request("/api/trpc/queues.list");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        data: {
          json: [
            {
              name: "email",
              prefix: "bull",
            },
          ],
        },
      },
    });
  });

  it("reports standalone Redis connection information as a mode-aware queue source", async () => {
    vi.stubEnv("REDIS_URL", "redis://:secret@cache.internal:6380/2");
    vi.doMock("./connection", async (importOriginal) => {
      const actual =
        await importOriginal<
          typeof import("./connection")
        >();

      return {
        ...actual,
        getQueueProvider: async () => ({
          getCapabilities: () => ({
            providerType: "bullmq",
            displayName: "BullMQ",
            supportsFlows: true,
            supportedJobStates: [
              "waiting",
              "active",
              "completed",
              "failed",
              "delayed",
              "paused",
              "waiting-children",
            ],
          }),
          getPrefixes: async () => ["bull", "mail"],
        }),
      };
    });

    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}`,
    );
    await mkdir(clientDir, { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>Bullstudio</html>");

    const app = createStandaloneApp({
      clientDir,
      env: {},
    });

    const response = await app.request("/api/trpc/connection.info");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        data: {
          json: {
            mode: "standalone",
            displayUrl: "cache.internal:6380",
            providerType: "bullmq",
            prefixes: ["bull", "mail"],
            queueSource: {
              mode: "standalone",
              source: "redis",
              status: "healthy",
              connection: {
                host: "cache.internal",
                port: "6380",
                database: "2",
                hasPassword: true,
                displayUrl: "cache.internal:6380",
              },
              providers: ["bullmq"],
              prefixes: ["bull", "mail"],
              capabilities: {
                flows: true,
              },
            },
          },
        },
      },
    });
  });
});

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
