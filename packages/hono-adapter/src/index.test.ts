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
    await expect(htmlResponse.text()).resolves.toContain("Bullstudio");

    const assetResponse = await host.request("/ops/bullstudio/assets/app.js");
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain(
      "application/javascript",
    );
    await expect(assetResponse.text()).resolves.toContain("Bullstudio");

    const apiResponse = await host.request(
      "/ops/bullstudio/api/trpc/queues.list",
    );
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.headers.get("content-type")).toContain(
      "application/json",
    );
    await expect(apiResponse.json()).resolves.toMatchObject({
      result: {
        data: [
          {
            key: "email",
            label: "Email",
            name: "email",
          },
        ],
      },
    });
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
    await expect(validApiResponse.json()).resolves.toMatchObject({
      result: {
        data: [
          {
            key: "email",
            label: "Email",
          },
        ],
      },
    });
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
    await expect(statusResponse.json()).resolves.toMatchObject({
      result: {
        data: {
          readOnly: true,
          mutationsAllowed: false,
        },
      },
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
      await expect(response.json()).resolves.toMatchObject({
        error: {
          message: "Read-only dashboards cannot mutate queues or jobs.",
        },
      });
    }

    expect(pauseQueue).not.toHaveBeenCalled();
    expect(resumeQueue).not.toHaveBeenCalled();
    expect(retryJob).not.toHaveBeenCalled();
    expect(removeJob).not.toHaveBeenCalled();
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
  pauseQueue?: () => Promise<void>;
  resumeQueue?: () => Promise<void>;
  retryJob?: (jobId: string) => Promise<void>;
  removeJob?: (jobId: string) => Promise<void>;
}): QueueAdapter {
  const queueName = options.queueName ?? options.key;

  return {
    key: options.key,
    label: options.label,
    provider: "bullmq",
    capabilities: {
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
