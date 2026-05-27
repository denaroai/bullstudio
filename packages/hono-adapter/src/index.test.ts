import type { QueueAdapter } from "@bullstudio/embedded-core";
import { bullstudio } from "@bullstudio/hono";
import { Hono } from "hono";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("bullstudio Hono adapter", () => {
  it("mounts dashboard assets and the private dashboard API at one non-root path", async () => {
    const host = new Hono();
    const dashboard = bullstudio({
      queues: [createQueueAdapter({ key: "email", label: "Email" })],
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
    pauseQueue: async () => {},
    resumeQueue: async () => {},
    getJobs: async () => [],
    getJobsSummary: async () => [],
    getJob: async () => null,
    getJobLogs: async () => ({ logs: [], count: 0 }),
    retryJob: async () => {},
    removeJob: async () => {},
    getWorkerCount: async () => ({ queueName, count: 0 }),
  };
}
