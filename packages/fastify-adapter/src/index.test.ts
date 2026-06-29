import type { QueueAdapter } from "@bullstudio/embedded-core";
import { bullstudio } from "@bullstudio/fastify";
import Fastify, { type FastifyPluginCallback } from "fastify";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

describe("bullstudio Fastify adapter", () => {
  it("registers dashboard assets and the private dashboard API at one non-root prefix", async () => {
    const app = Fastify();
    const dashboard = bullstudio({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "disabled",
      },
    });

    expectTypeOf(dashboard).toMatchTypeOf<FastifyPluginCallback>();

    await app.register(dashboard, { prefix: "/ops/bullstudio" });

    const htmlResponse = await app.inject("/ops/bullstudio");
    expect(htmlResponse.statusCode).toBe(200);
    expect(htmlResponse.headers["content-type"]).toContain("text/html");
    expect(htmlResponse.body).toContain("Bullstudio");

    const assetPath = extractScriptPath(htmlResponse.body);
    const assetResponse = await app.inject(assetPath);
    expect(assetResponse.statusCode).toBe(200);
    expect(assetResponse.headers["content-type"]).toContain(
      "application/javascript",
    );
    expect(assetResponse.body).toContain("createRoot");

    const apiResponse = await app.inject(
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(apiResponse.statusCode).toBe(200);
    expect(apiResponse.headers["content-type"]).toContain("application/json");
    expect(readTrpcResultData(apiResponse)).toMatchObject([
      {
        key: "email",
        label: "Email",
        name: "email",
      },
    ]);
  });

  it("protects dashboard routes and private API with a session by default", async () => {
    const app = Fastify();

    await app.register(
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
      }),
      { prefix: "/ops/bullstudio" },
    );

    const missingSession = await app.inject("/ops/bullstudio/jobs");
    expect(missingSession.statusCode).toBe(302);
    expect(missingSession.headers.location).toBe(
      "/ops/bullstudio/login?redirect=%2Fjobs",
    );

    const loginScreen = await app.inject("/ops/bullstudio/login");
    expect(loginScreen.statusCode).toBe(200);

    const missingApiSession = await app.inject(
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(missingApiSession.statusCode).toBe(401);

    const invalidLogin = await app.inject({
      method: "POST",
      url: "/ops/bullstudio/api/auth/login",
      payload: { username: "admin", password: "wrong" },
    });
    expect(invalidLogin.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/ops/bullstudio/api/auth/login",
      payload: { username: "admin", password: "bullstudio" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers["set-cookie"];
    expect(cookie).toContain("bullstudio_session=");

    const validAssetResponse = await app.inject({
      url: "/ops/bullstudio",
      headers: {
        Cookie: Array.isArray(cookie) ? cookie[0] : (cookie ?? ""),
      },
    });
    expect(validAssetResponse.statusCode).toBe(200);

    const validApiResponse = await app.inject({
      url: "/ops/bullstudio/api/trpc/queues.list",
      headers: {
        Cookie: Array.isArray(cookie) ? cookie[0] : (cookie ?? ""),
      },
    });
    expect(validApiResponse.statusCode).toBe(200);
  });

  it("serves the dashboard shell for deep client routes with the mount path base", async () => {
    const app = Fastify();

    await app.register(
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
        protection: {
          type: "disabled",
        },
      }),
      { prefix: "/ops/bullstudio" },
    );

    const htmlResponse = await app.inject("/ops/bullstudio/jobs");
    expect(htmlResponse.statusCode).toBe(200);
    expect(htmlResponse.headers["content-type"]).toContain("text/html");
    expect(htmlResponse.body).toContain('"basePath":"/ops/bullstudio"');
    expect(htmlResponse.body).not.toContain(
      '"basePath":"/ops/bullstudio/jobs"',
    );

    const apiResponse = await app.inject(
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(apiResponse.statusCode).toBe(200);

    await app.close();
  });

  it("enforces read-only dashboards at the private dashboard API layer", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>();
    const retryJob = vi.fn<() => Promise<void>>();
    const app = Fastify();

    await app.register(
      bullstudio({
        queues: [
          createQueueAdapter({
            key: "email",
            label: "Email",
            pauseQueue,
            retryJob,
          }),
        ],
        readOnly: true,
        protection: {
          type: "disabled",
        },
      }),
      { prefix: "/ops/bullstudio" },
    );

    const statusResponse = await app.inject(
      "/ops/bullstudio/api/trpc/queueSource.status",
    );
    expect(statusResponse.statusCode).toBe(200);
    expect(readTrpcResultData(statusResponse)).toMatchObject({
      readOnly: true,
      mutationsAllowed: false,
    });

    for (const mutation of [
      {
        path: "queues.pause",
        input: { queueKey: "email" },
      },
      {
        path: "jobs.retry",
        input: { queueKey: "email", jobId: "1" },
      },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/ops/bullstudio/api/trpc/${mutation.path}`,
        headers: {
          "Content-Type": "application/json",
        },
        payload: JSON.stringify({ json: mutation.input }),
      });

      expect(response.statusCode).toBe(403);
      expect(readTrpcError(response)).toMatchObject({
        message: "Read-only dashboards cannot mutate queues or jobs.",
      });
    }

    expect(pauseQueue).not.toHaveBeenCalled();
    expect(retryJob).not.toHaveBeenCalled();
  });

  it("serves configured dashboard and document identity without rebuilding assets", async () => {
    const app = Fastify();

    await app.register(
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
        protection: {
          type: "disabled",
        },
        dashboardIdentity: {
          title: "Production Queues",
          logo: {
            src: "/brand/queues.svg",
            alt: "Acme Queue Ops",
          },
        },
        documentIdentity: {
          title: "Queue Ops",
          favicon: "/brand/favicon.ico",
        },
      }),
      { prefix: "/ops/bullstudio" },
    );

    const htmlResponse = await app.inject("/ops/bullstudio");
    expect(htmlResponse.statusCode).toBe(200);
    expect(htmlResponse.body).toContain("<title>Queue Ops</title>");
    expect(htmlResponse.body).toContain('href="/brand/favicon.ico"');
    expect(htmlResponse.body).toContain("Production Queues");
    expect(htmlResponse.body).toContain('"src":"/brand/queues.svg"');
    expect(htmlResponse.body).toContain('"alt":"Acme Queue Ops"');

    const assetPath = extractScriptPath(htmlResponse.body);
    const assetResponse = await app.inject(assetPath);
    expect(assetResponse.statusCode).toBe(200);
    expect(assetResponse.body).toContain("createRoot");
  });
});

const emptyJobCounts = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  paused: 0,
  prioritized: 0,
  waitingChildren: 0,
};

function createQueueAdapter(options: {
  key: string;
  label: string;
  queueName?: string;
  provider?: QueueAdapter["provider"];
  capabilities?: QueueAdapter["capabilities"];
  pauseQueue?: () => Promise<void>;
  retryJob?: (jobId: string) => Promise<void>;
}): QueueAdapter {
  const queueName = options.queueName ?? options.key;

  return {
    key: options.key,
    label: options.label,
    provider: options.provider ?? "bullmq",
    capabilities: options.capabilities ?? {
      flows: true,
      jobLogs: true,
      jobRemoval: true,
      jobRetry: true,
      queuePause: true,
      queueResume: true,
      queueDrain: true,
      workers: true,
    },
    getQueue: async () => ({
      name: queueName,
      prefix: "bull",
      isPaused: false,
      jobCounts: emptyJobCounts,
    }),
    getJobCounts: async () => emptyJobCounts,
    pauseQueue: options.pauseQueue ?? (async () => {}),
    resumeQueue: async () => {},
    getJobs: async () => [],
    getJobsSummary: async () => [],
    getJob: async () => null,
    getJobLogs: async () => ({ logs: [], count: 0 }),
    retryJob: options.retryJob ?? (async () => {}),
    removeJob: async () => {},
    getWorkerCount: async () => ({ queueName, count: 0 }),
  };
}

function readTrpcResultData(response: { json(): unknown }) {
  const body = response.json() as TrpcResultEnvelope;
  return body.result.data.json ?? body.result.data;
}

function readTrpcError(response: { json(): unknown }) {
  const body = response.json() as TrpcErrorEnvelope;
  return body.error.json ?? body.error;
}

interface TrpcResultEnvelope {
  result: {
    data: {
      json?: unknown;
    } & unknown;
  };
}

interface TrpcErrorEnvelope {
  error: {
    json?: unknown;
  } & unknown;
}

function extractScriptPath(html: string): string {
  const match = html.match(/<script type="module"[^>]+src="([^"]+)"/);

  if (!match?.[1]) {
    throw new Error("Dashboard script was not found in HTML.");
  }

  return match[1];
}
