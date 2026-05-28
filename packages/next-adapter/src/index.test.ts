import type { QueueAdapter } from "@bullstudio/embedded-core";
import { bullstudio } from "@bullstudio/next";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

describe("bullstudio Next.js App Router adapter", () => {
  it("returns App Router-compatible route handlers for one mount path", async () => {
    const handlers = bullstudio({
      mountPath: "/ops/bullstudio",
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "disabled",
      },
    });

    expectTypeOf(handlers.GET).toMatchTypeOf<
      (request: Request) => Promise<Response>
    >();
    expectTypeOf(handlers.HEAD).toMatchTypeOf<
      (request: Request) => Promise<Response>
    >();
    expectTypeOf(handlers.POST).toMatchTypeOf<
      (request: Request) => Promise<Response>
    >();
    expect(handlers).not.toHaveProperty("handler");
    expect(handlers).not.toHaveProperty("pages");

    const htmlResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio"),
    );
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    const html = await htmlResponse.text();
    expect(html).toContain("Bullstudio");

    const assetPath = extractScriptPath(html);
    const assetResponse = await handlers.GET(
      request(`http://localhost${assetPath}`),
    );
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "application/javascript",
    );
    await expect(assetResponse.text()).resolves.toContain("createRoot");

    const apiResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio/api/trpc/queues.list"),
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

  it("protects dashboard assets and private dashboard API with Basic Auth by default", async () => {
    const handlers = bullstudio({
      mountPath: "/ops/bullstudio",
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
    });

    for (const url of [
      "http://localhost/ops/bullstudio",
      "http://localhost/ops/bullstudio/assets/app.js",
      "http://localhost/ops/bullstudio/api/trpc/queues.list",
    ]) {
      const missingCredentials = await handlers.GET(request(url));
      expect(missingCredentials.status).toBe(401);
      expect(missingCredentials.headers.get("www-authenticate")).toBe(
        'Basic realm="bullstudio"',
      );

      const invalidCredentials = await handlers.GET(
        request(url, {
          headers: {
            Authorization: basicAuth("admin", "wrong"),
          },
        }),
      );
      expect(invalidCredentials.status).toBe(401);
      expect(invalidCredentials.headers.get("www-authenticate")).toBe(
        'Basic realm="bullstudio"',
      );
    }

    const validAssetResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio", {
        headers: {
          Authorization: basicAuth("admin", "bullstudio"),
        },
      }),
    );
    expect(validAssetResponse.status).toBe(200);

    const validApiResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio/api/trpc/queues.list", {
        headers: {
          Authorization: basicAuth("admin", "bullstudio"),
        },
      }),
    );
    expect(validApiResponse.status).toBe(200);
  });

  it("serves the dashboard shell for deep client routes with the mount path base", async () => {
    const handlers = bullstudio({
      mountPath: "/ops/bullstudio",
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "disabled",
      },
    });

    const htmlResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio/jobs"),
    );
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    const html = await htmlResponse.text();
    expect(html).toContain('"basePath":"/ops/bullstudio"');

    const apiResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio/api/trpc/queues.list"),
    );
    expect(apiResponse.status).toBe(200);
  });

  it("enforces read-only dashboards at the private dashboard API layer", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>();
    const retryJob = vi.fn<() => Promise<void>>();
    const handlers = bullstudio({
      mountPath: "/ops/bullstudio",
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
    });

    const statusResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio/api/trpc/queueSource.status"),
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
        path: "jobs.retry",
        input: { queueKey: "email", jobId: "1" },
      },
    ]) {
      const response = await handlers.POST(
        request(`http://localhost/ops/bullstudio/api/trpc/${mutation.path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ json: mutation.input }),
        }),
      );

      expect(response.status).toBe(403);
      await expect(readTrpcError(response)).resolves.toMatchObject({
          message: "Read-only dashboards cannot mutate queues or jobs.",
      });
    }

    expect(pauseQueue).not.toHaveBeenCalled();
    expect(retryJob).not.toHaveBeenCalled();
  });

  it("serves configured dashboard and document identity without rebuilding assets", async () => {
    const handlers = bullstudio({
      mountPath: "/ops/bullstudio",
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
    });

    const htmlResponse = await handlers.GET(
      request("http://localhost/ops/bullstudio"),
    );
    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    expect(html).toContain("<title>Queue Ops</title>");
    expect(html).toContain('href="/brand/favicon.ico"');
    expect(html).toContain("Production Queues");
    expect(html).toContain('"src":"/brand/queues.svg"');
    expect(html).toContain('"alt":"Acme Queue Ops"');

    const assetPath = extractScriptPath(html);
    const assetResponse = await handlers.GET(
      request(`http://localhost${assetPath}`),
    );
    expect(assetResponse.status).toBe(200);
  });

  it("returns not found for requests outside the configured App Router mount path", async () => {
    const handlers = bullstudio({
      mountPath: "/ops/bullstudio",
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "disabled",
      },
    });

    const response = await handlers.GET(request("http://localhost/api/trpc"));

    expect(response.status).toBe(404);
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

function request(
  url: string,
  init: {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
  } = {},
): Request {
  return new Request(url, init);
}

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
