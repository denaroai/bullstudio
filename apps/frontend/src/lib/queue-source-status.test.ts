import { describe, expect, it } from "vitest";
import { getQueueSourceViewModel } from "./queue-source-status";

describe("getQueueSourceViewModel", () => {
  it("keeps standalone Redis connection information visible to the UI", () => {
    const status = getQueueSourceViewModel({
      mode: "standalone",
      source: "redis",
      status: "healthy",
      connection: {
        host: "cache.internal",
        port: "6380",
        hasPassword: true,
        database: "2",
        displayUrl: "cache.internal:6380",
      },
      providers: ["bullmq"],
      prefixes: ["bull", "mail"],
      capabilities: {
        flows: true,
        schedulers: true,
        supportedStatuses: ["waiting", "waiting-children"],
        mutationsAllowed: true,
      },
    });

    expect(status).toMatchObject({
      mode: "standalone",
      title: "Redis",
      detail: "cache.internal:6380",
      providerLabel: "bullmq",
      prefixes: ["bull", "mail"],
      queueCount: null,
      connection: {
        displayUrl: "cache.internal:6380",
        database: "2",
        hasPassword: true,
      },
      features: {
        flows: {
          visible: true,
          enabled: true,
        },
        mutations: {
          visible: true,
          enabled: true,
        },
      },
    });
  });

  it("formats embedded supplied queue status without Redis connection details", () => {
    const status = getQueueSourceViewModel({
      mode: "embedded",
      source: "supplied",
      status: "healthy",
      queueCount: 2,
      providers: ["bull", "bullmq"],
      readOnly: false,
      mutationsAllowed: true,
      capabilities: {
        flows: false,
        jobLogs: true,
        jobRemoval: true,
        jobRetry: true,
        queuePause: true,
        queueResume: true,
        queueDrain: true,
        schedulers: true,
        workers: true,
      },
    });

    expect(status).toMatchObject({
      mode: "embedded",
      title: "Supplied queues",
      detail: "2 supplied queues",
      providerLabel: "bull, bullmq",
      prefixes: [],
      queueCount: 2,
      connection: null,
      features: {
        flows: {
          visible: false,
          enabled: false,
        },
        jobRetry: {
          visible: true,
          enabled: true,
        },
      },
    });
  });

  it("disables unsupported or read-only features from adapter capabilities", () => {
    const status = getQueueSourceViewModel({
      mode: "embedded",
      source: "supplied",
      status: "healthy",
      queueCount: 1,
      providers: ["bull"],
      readOnly: true,
      mutationsAllowed: false,
      capabilities: {
        flows: false,
        jobLogs: true,
        jobRemoval: false,
        jobRetry: false,
        queuePause: false,
        queueResume: false,
        queueDrain: false,
        schedulers: false,
        workers: true,
      },
    });

    expect(status.features).toMatchObject({
      flows: {
        visible: false,
        enabled: false,
      },
      jobRetry: {
        visible: false,
        enabled: false,
      },
      jobRemoval: {
        visible: false,
        enabled: false,
      },
      queuePause: {
        visible: false,
        enabled: false,
      },
      mutations: {
        visible: true,
        enabled: false,
      },
    });
  });
});
