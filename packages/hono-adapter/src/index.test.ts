import type { QueueAdapter } from "@bullstudio/embedded-core";
import { bullstudio } from "@bullstudio/hono";
import { Hono } from "hono";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

describe("bullstudio Hono adapter", () => {
  it("mounts dashboard assets and the private dashboard API at one non-root path", async () => {
    const host = new Hono();
    const dashboard = bullstudio({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "disabled",
      },
    });

    expectTypeOf(dashboard).toMatchTypeOf<Hono>();

    host.route("/ops/bullstudio", dashboard);

    const htmlResponse = await host.request("/ops/bullstudio");
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    const html = await htmlResponse.text();
    expect(html).toContain("Bullstudio");

    const assetPath = extractScriptPath(html);
    const assetResponse = await host.request(assetPath);
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "application/javascript",
    );
    await expect(assetResponse.text()).resolves.toContain("createRoot");

    const apiResponse = await host.request(
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.headers.get("content-type")).toContain(
      "application/json",
    );
    await expect(readTrpcResultData(apiResponse)).resolves.toMatchObject([
      {
        key: "email",
        label: "Email",
        name: "email",
      },
    ]);
  });

  it("reaches embedded compatibility procedures through the configured mount path", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>();
    const host = new Hono();

    host.route(
      "/ops/bullstudio",
      bullstudio({
        queues: [
          createQueueAdapter({
            key: "email",
            label: "Email",
            pauseQueue,
          }),
        ],
        readOnly: true,
        protection: {
          type: "disabled",
        },
      }),
    );

    const connectionResponse = await host.request(
      "/ops/bullstudio/api/trpc/connection.info",
    );
    expect(connectionResponse.status).toBe(200);
    await expect(readTrpcResultData(connectionResponse)).resolves.toMatchObject({
      mode: "embedded",
      queueSource: {
        mode: "embedded",
        source: "supplied",
        queueCount: 1,
      },
    });

    const jobsResponse = await host.request(
      "/ops/bullstudio/api/trpc/jobs.listSummary",
    );
    expect(jobsResponse.status).toBe(200);
    await expect(readTrpcResultData(jobsResponse)).resolves.toEqual([]);

    const readOnlyMutationResponse = await host.request(
      "/ops/bullstudio/api/trpc/queues.pause",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ json: { queueKey: "email" } }),
      },
    );
    expect(readOnlyMutationResponse.status).toBe(403);
    await expect(readTrpcError(readOnlyMutationResponse)).resolves.toMatchObject(
      {
        message: "Read-only dashboards cannot mutate queues or jobs.",
      },
    );

    const outsideMountResponse = await host.request(
      "/api/trpc/connection.info",
    );
    expect(outsideMountResponse.status).toBe(404);
    expect(pauseQueue).not.toHaveBeenCalled();
  });

  it("protects dashboard assets and private dashboard API with Basic Auth by default", async () => {
    const host = new Hono();
    const dashboard = bullstudio({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
    });

    host.route("/ops/bullstudio", dashboard);

    for (const path of [
      "/ops/bullstudio",
      "/ops/bullstudio/assets/app.js",
      "/ops/bullstudio/api/trpc/queues.list",
    ]) {
      const missingCredentials = await host.request(path);
      expect(missingCredentials.status).toBe(401);
      expect(missingCredentials.headers.get("www-authenticate")).toBe(
        'Basic realm="bullstudio"',
      );

      const invalidCredentials = await host.request(path, {
        headers: {
          Authorization: basicAuth("admin", "wrong"),
        },
      });
      expect(invalidCredentials.status).toBe(401);
      expect(invalidCredentials.headers.get("www-authenticate")).toBe(
        'Basic realm="bullstudio"',
      );
    }

    const validAssetResponse = await host.request("/ops/bullstudio", {
      headers: {
        Authorization: basicAuth("admin", "bullstudio"),
      },
    });
    expect(validAssetResponse.status).toBe(200);
    expect(validAssetResponse.headers.get("content-type")).toContain(
      "text/html",
    );

    const validApiResponse = await host.request(
      "/ops/bullstudio/api/trpc/queues.list",
      {
        headers: {
          Authorization: basicAuth("admin", "bullstudio"),
        },
      },
    );
    expect(validApiResponse.status).toBe(200);
    await expect(readTrpcResultData(validApiResponse)).resolves.toMatchObject([
      {
        key: "email",
        label: "Email",
      },
    ]);
  });

  it("allows hosts to disable or replace Bullstudio dashboard protection", async () => {
    const disabledHost = new Hono();
    disabledHost.route(
      "/ops/bullstudio",
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
        protection: {
          type: "disabled",
        },
      }),
    );

    await expect(
      disabledHost.request("/ops/bullstudio"),
    ).resolves.toMatchObject({
      status: 200,
    });

    const hostOwnedProtection = new Hono();
    hostOwnedProtection.route(
      "/ops/bullstudio",
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
        protection: {
          type: "custom",
        },
      }),
    );

    await expect(
      hostOwnedProtection.request("/ops/bullstudio/api/trpc/queues.list"),
    ).resolves.toMatchObject({
      status: 200,
    });
  });

  it("enforces read-only dashboards at the private dashboard API layer", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>();
    const resumeQueue = vi.fn<() => Promise<void>>();
    const retryJob = vi.fn<() => Promise<void>>();
    const removeJob = vi.fn<() => Promise<void>>();
    const host = new Hono();

    host.route(
      "/ops/bullstudio",
      bullstudio({
        queues: [
          createQueueAdapter({
            key: "email",
            label: "Email",
            pauseQueue,
            resumeQueue,
            retryJob,
            removeJob,
          }),
        ],
        readOnly: true,
        protection: {
          type: "disabled",
        },
      }),
    );

    const listResponse = await host.request(
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(listResponse.status).toBe(200);

    const statusResponse = await host.request(
      "/ops/bullstudio/api/trpc/queueSource.status",
    );
    expect(statusResponse.status).toBe(200);
    await expect(readTrpcResultData(statusResponse)).resolves.toMatchObject({
      readOnly: true,
      mutationsAllowed: false,
    });

    for (const mutation of [
      {
        path: "queues.pause",
        input: { queueKey: "email" },
      },
      {
        path: "queues.resume",
        input: { queueKey: "email" },
      },
      {
        path: "jobs.retry",
        input: { queueKey: "email", jobId: "1" },
      },
      {
        path: "jobs.remove",
        input: { queueKey: "email", jobId: "1" },
      },
    ]) {
      const response = await host.request(
        `/ops/bullstudio/api/trpc/${mutation.path}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ json: mutation.input }),
        },
      );

      expect(response.status).toBe(403);
      await expect(readTrpcError(response)).resolves.toMatchObject({
        message: "Read-only dashboards cannot mutate queues or jobs.",
      });
    }

    expect(pauseQueue).not.toHaveBeenCalled();
    expect(resumeQueue).not.toHaveBeenCalled();
    expect(retryJob).not.toHaveBeenCalled();
    expect(removeJob).not.toHaveBeenCalled();
  });

  it("reports embedded supplied queue source status instead of Redis connection details", async () => {
    const host = new Hono();

    host.route(
      "/ops/bullstudio",
      bullstudio({
        queues: [
          createQueueAdapter({ key: "email", label: "Email" }),
          createQueueAdapter({
            key: "reports",
            label: "Reports",
            provider: "bull",
            capabilities: {
              flows: false,
              jobLogs: true,
              jobRemoval: true,
              jobRetry: true,
              queuePause: true,
              queueResume: true,
              workers: true,
            },
          }),
        ],
        protection: {
          type: "disabled",
        },
      }),
    );

    const response = await host.request(
      "/ops/bullstudio/api/trpc/queueSource.status",
    );

    expect(response.status).toBe(200);
    const body = await readTrpcResultData(response);
    expect(body).toMatchObject({
      mode: "embedded",
      source: "supplied",
      status: "healthy",
      queueCount: 2,
      providers: ["bull", "bullmq"],
      capabilities: {
        flows: true,
        jobLogs: true,
      },
    });
    expect(body).not.toHaveProperty("displayUrl");
    expect(body).not.toHaveProperty("connection");
  });

  it("serves configured dashboard and document identity from the mount path", async () => {
    const host = new Hono();

    host.route(
      "/ops/bullstudio",
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
    );

    const htmlResponse = await host.request("/ops/bullstudio");
    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    expect(html).toContain("<title>Queue Ops</title>");
    expect(html).toContain('rel="icon"');
    expect(html).toContain('href="/brand/favicon.ico"');
    expect(html).toContain("Production Queues");
    expect(html).toContain('"src":"/brand/queues.svg"');
    expect(html).toContain('"alt":"Acme Queue Ops"');

    const assetResponse = await host.request(extractScriptPath(html));
    expect(assetResponse.status).toBe(200);
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
  resumeQueue?: () => Promise<void>;
  retryJob?: (jobId: string) => Promise<void>;
  removeJob?: (jobId: string) => Promise<void>;
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
    resumeQueue: options.resumeQueue ?? (async () => {}),
    getJobs: async () => [],
    getJobsSummary: async () => [],
    getJob: async () => null,
    getJobLogs: async () => ({ logs: [], count: 0 }),
    retryJob: options.retryJob ?? (async () => {}),
    removeJob: options.removeJob ?? (async () => {}),
    getWorkerCount: async () => ({ queueName, count: 0 }),
  };
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function readTrpcResultData(response: Response) {
  const body = await response.json();
  return body.result.data.json ?? body.result.data;
}

async function readTrpcError(response: Response) {
  const body = await response.json();
  return body.error.json ?? body.error;
}

function extractScriptPath(html: string): string {
  const match = html.match(/<script type="module"[^>]+src="([^"]+)"/);

  if (!match?.[1]) {
    throw new Error("Dashboard script was not found in HTML.");
  }

  return match[1];
}
