import { Readable } from "node:stream";
import type { QueueAdapter } from "@bullstudio/embedded-core";
import { bullstudio } from "@bullstudio/express";
import express, { type RequestHandler } from "express";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

describe("bullstudio Express adapter", () => {
  it("mounts dashboard assets and the private dashboard API at one non-root path", async () => {
    const app = express();
    const dashboard = bullstudio({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
      protection: {
        type: "disabled",
      },
    });

    expectTypeOf(dashboard).toMatchTypeOf<RequestHandler>();

    app.use("/ops/bullstudio", dashboard);

    const htmlResponse = await requestExpress(app, "/ops/bullstudio");
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    const html = await htmlResponse.text();
    expect(html).toContain("Bullstudio");

    const assetPath = extractScriptPath(html);
    const assetResponse = await requestExpress(app, assetPath);
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "application/javascript",
    );
    await expect(assetResponse.text()).resolves.toContain("createRoot");

    const apiResponse = await requestExpress(
      app,
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

  it("protects dashboard assets and private dashboard API with Basic Auth by default", async () => {
    const app = express();

    app.use(
      "/ops/bullstudio",
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
      }),
    );

    for (const path of [
      "/ops/bullstudio",
      "/ops/bullstudio/assets/app.js",
      "/ops/bullstudio/api/trpc/queues.list",
    ]) {
      const missingCredentials = await requestExpress(app, path);
      expect(missingCredentials.status).toBe(401);
      expect(missingCredentials.headers.get("www-authenticate")).toBe(
        'Basic realm="bullstudio"',
      );

      const invalidCredentials = await requestExpress(app, path, {
        headers: {
          Authorization: basicAuth("admin", "wrong"),
        },
      });
      expect(invalidCredentials.status).toBe(401);
      expect(invalidCredentials.headers.get("www-authenticate")).toBe(
        'Basic realm="bullstudio"',
      );
    }

    const validAssetResponse = await requestExpress(app, "/ops/bullstudio", {
      headers: {
        Authorization: basicAuth("admin", "bullstudio"),
      },
    });
    expect(validAssetResponse.status).toBe(200);

    const validApiResponse = await requestExpress(
      app,
      "/ops/bullstudio/api/trpc/queues.list",
      {
        headers: {
          Authorization: basicAuth("admin", "bullstudio"),
        },
      },
    );
    expect(validApiResponse.status).toBe(200);
  });

  it("serves the dashboard shell for deep client routes with the mount path base", async () => {
    const app = express();

    app.use(
      "/ops/bullstudio",
      bullstudio({
        queues: [createQueueAdapter({ key: "email", label: "Email" })],
        protection: {
          type: "disabled",
        },
      }),
    );

    const htmlResponse = await requestExpress(app, "/ops/bullstudio/jobs");
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
    const html = await htmlResponse.text();
    expect(html).toContain('"basePath":"/ops/bullstudio"');
    expect(html).not.toContain('"basePath":"/ops/bullstudio/jobs"');

    const apiResponse = await requestExpress(
      app,
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(apiResponse.status).toBe(200);
  });

  it("enforces read-only dashboards at the private dashboard API layer", async () => {
    const pauseQueue = vi.fn<() => Promise<void>>();
    const retryJob = vi.fn<() => Promise<void>>();
    const app = express();

    app.use(
      "/ops/bullstudio",
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
    );

    const statusResponse = await requestExpress(
      app,
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
        path: "jobs.retry",
        input: { queueKey: "email", jobId: "1" },
      },
    ]) {
      const response = await requestExpress(
        app,
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
    expect(retryJob).not.toHaveBeenCalled();
  });

  it("serves configured dashboard and document identity without rebuilding assets", async () => {
    const app = express();

    app.use(
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

    const htmlResponse = await requestExpress(app, "/ops/bullstudio");
    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    expect(html).toContain("<title>Queue Ops</title>");
    expect(html).toContain('href="/brand/favicon.ico"');
    expect(html).toContain("Production Queues");
    expect(html).toContain('"src":"/brand/queues.svg"');
    expect(html).toContain('"alt":"Acme Queue Ops"');

    const assetPath = extractScriptPath(html);
    const assetResponse = await requestExpress(app, assetPath);
    expect(assetResponse.status).toBe(200);
    await expect(assetResponse.text()).resolves.toContain("createRoot");
  });
});

interface ExpressRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface ExpressTestResponse {
  status: number;
  headers: Headers;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

async function requestExpress(
  app: express.Express,
  url: string,
  options: ExpressRequestOptions = {},
): Promise<ExpressTestResponse> {
  const request = createMockRequest(url, options);
  const response = createMockResponse();

  await new Promise<void>((resolve, reject) => {
    app.handle(request, response, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
    response.finished.then(resolve, reject);
  });

  return response.toTestResponse();
}

function createMockRequest(
  url: string,
  options: ExpressRequestOptions,
): express.Request {
  let bodyRead = false;
  const request = new Readable({
    read() {
      if (bodyRead) {
        return;
      }

      bodyRead = true;
      if (options.body) {
        this.push(options.body);
      }
      this.push(null);
    },
  }) as express.Request;

  request.method = options.method ?? "GET";
  request.url = url;
  request.headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      value,
    ]),
  );

  return request;
}

function createMockResponse(): express.Response & {
  finished: Promise<void>;
  toTestResponse(): ExpressTestResponse;
} {
  const headers = new Headers();
  const chunks: Buffer[] = [];
  let resolveFinished: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const response = {
    statusCode: 200,
    headersSent: false,
    finished,
    setHeader(name: string, value: number | string | readonly string[]) {
      headers.set(
        name,
        Array.isArray(value) ? value.join(", ") : String(value),
      );
      return this;
    },
    getHeader(name: string) {
      return headers.get(name) ?? undefined;
    },
    getHeaders() {
      return Object.fromEntries(headers.entries());
    },
    removeHeader(name: string) {
      headers.delete(name);
    },
    write(chunk: string | Buffer) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      this.headersSent = true;
      resolveFinished();
      return this;
    },
    toTestResponse() {
      const body = Buffer.concat(chunks).toString("utf8");

      return {
        status: this.statusCode,
        headers,
        text: async () => body,
        json: async () => JSON.parse(body),
      };
    },
  } as express.Response & {
    finished: Promise<void>;
    toTestResponse(): ExpressTestResponse;
  };

  return response;
}

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

async function readTrpcResultData(response: ExpressTestResponse) {
  const body = (await response.json()) as TrpcResultEnvelope;
  return body.result.data.json ?? body.result.data;
}

async function readTrpcError(response: ExpressTestResponse) {
  const body = (await response.json()) as TrpcErrorEnvelope;
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
