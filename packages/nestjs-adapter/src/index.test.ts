import "reflect-metadata";

import type { QueueAdapter } from "@bullstudio/embedded-core";
import {
  type DynamicModule,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test, type TestingModuleMetadata } from "@nestjs/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BullstudioModule,
  type BullstudioModuleAsyncOptions,
  type NestDashboardConfig,
} from "./index";

describe("BullstudioModule", () => {
  it("mounts the dashboard on Nest Express", async () => {
    const app = await createExpressApp(
      BullstudioModule.forRoot(createDashboardConfig()),
    );

    try {
      const baseUrl = await listen(app);
      const htmlResponse = await fetch(`${baseUrl}/ops/bullstudio`);
      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.headers.get("content-type")).toContain("text/html");

      const html = await htmlResponse.text();
      expect(html).toContain("Bullstudio");

      const apiResponse = await fetch(
        `${baseUrl}/ops/bullstudio/api/trpc/queues.list`,
      );
      expect(apiResponse.status).toBe(200);
      await expect(readTrpcResultData(apiResponse)).resolves.toMatchObject([
        {
          key: "email",
          label: "Email",
          name: "email",
        },
      ]);
    } finally {
      await app.close();
    }
  });

  it("mounts the dashboard on Nest Fastify", async () => {
    const app = await createFastifyApp(
      BullstudioModule.forRoot(createDashboardConfig()),
    );

    try {
      await app.init();
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject("/ops/bullstudio");
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("Bullstudio");

      const apiResponse = await app
        .getHttpAdapter()
        .getInstance()
        .inject("/ops/bullstudio/api/trpc/queues.list");
      expect(apiResponse.statusCode).toBe(200);
      await expect(readTrpcResultData(apiResponse)).resolves.toMatchObject([
        {
          key: "email",
          label: "Email",
          name: "email",
        },
      ]);
    } finally {
      await app.close();
    }
  });

  it("supports forRootAsync with injected queue adapters", async () => {
    const EMAIL_QUEUE = Symbol("EMAIL_QUEUE");
    const queue = createQueueAdapter({ key: "email", label: "Email" });
    @Module({
      providers: [
        {
          provide: EMAIL_QUEUE,
          useValue: queue,
        },
      ],
      exports: [EMAIL_QUEUE],
    })
    class QueueModule {}

    const app = await createExpressApp({
      imports: [
        BullstudioModule.forRootAsync({
          imports: [QueueModule],
          inject: [EMAIL_QUEUE],
          useFactory: (emailQueue) => ({
            mountPath: "/ops/bullstudio",
            queues: [emailQueue as QueueAdapter],
            protection: {
              type: "disabled",
            },
          }),
        }),
      ],
    });

    try {
      const baseUrl = await listen(app);
      const response = await fetch(
        `${baseUrl}/ops/bullstudio/api/trpc/queues.list`,
      );
      expect(response.status).toBe(200);
      await expect(readTrpcResultData(response)).resolves.toMatchObject([
        {
          key: "email",
        },
      ]);
    } finally {
      await app.close();
    }
  });

  it("serves private API and deep client routes under the mount path", async () => {
    const app = await createExpressApp(
      BullstudioModule.forRoot(createDashboardConfig()),
    );

    try {
      const baseUrl = await listen(app);
      const routeResponse = await fetch(`${baseUrl}/ops/bullstudio/jobs`);
      expect(routeResponse.status).toBe(200);
      const html = await routeResponse.text();
      expect(html).toContain('"basePath":"/ops/bullstudio"');

      const apiResponse = await fetch(
        `${baseUrl}/ops/bullstudio/api/trpc/queueSource.status`,
      );
      expect(apiResponse.status).toBe(200);
      await expect(readTrpcResultData(apiResponse)).resolves.toMatchObject({
        mode: "embedded",
        source: "supplied",
      });
    } finally {
      await app.close();
    }
  });

  it("does not apply Nest global prefixes to the dashboard mount path", async () => {
    const app = await createExpressApp(
      BullstudioModule.forRoot(createDashboardConfig()),
    );
    app.setGlobalPrefix("api");

    try {
      const baseUrl = await listen(app);
      const mountedResponse = await fetch(`${baseUrl}/ops/bullstudio`);
      expect(mountedResponse.status).toBe(200);

      const prefixedResponse = await fetch(`${baseUrl}/api/ops/bullstudio`);
      expect(prefixedResponse.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("throws a clear error for unsupported Nest platforms", async () => {
    const module = await Test.createTestingModule({
      imports: [BullstudioModule.forRoot(createDashboardConfig())],
    })
      .overrideProvider(HttpAdapterHost)
      .useValue({
        httpAdapter: {
          getType: () => "koa",
          getInstance: () => ({}),
        },
      })
      .compile();

    await expect(module.init()).rejects.toThrow(
      'BullstudioModule only supports Nest Express and Fastify platforms. Received "koa".',
    );
  });

  it("throws a clear error for duplicate module imports", async () => {
    const app = await createExpressApp({
      imports: [
        BullstudioModule.forRoot(createDashboardConfig()),
        BullstudioModule.forRoot(createDashboardConfig()),
      ],
    });

    await expect(listen(app)).rejects.toThrow(
      "BullstudioModule can only be mounted once per Nest application.",
    );
    await app.close();
  });

  it("throws a clear error for missing mountPath", async () => {
    const app = await createExpressApp(
      BullstudioModule.forRoot({
        ...createDashboardConfig(),
        mountPath: " ",
      }),
    );

    await expect(listen(app)).rejects.toThrow(
      "BullstudioModule requires a non-empty mountPath.",
    );
    await app.close();
  });

  it("exposes the public API types", () => {
    expectTypeOf({
      mountPath: "/ops/bullstudio",
      queues: [],
    }).toMatchTypeOf<NestDashboardConfig>();

    expectTypeOf({
      inject: [],
      useFactory: () => ({
        mountPath: "/ops/bullstudio",
        queues: [],
      }),
    }).toMatchTypeOf<BullstudioModuleAsyncOptions>();
  });
});

async function createExpressApp(
  module: DynamicModule | TestingModuleMetadata,
): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule(
    toTestingModuleMetadata(module),
  ).compile();

  return testingModule.createNestApplication(new ExpressAdapter());
}

async function createFastifyApp(
  module: DynamicModule | TestingModuleMetadata,
): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule(
    toTestingModuleMetadata(module),
  ).compile();

  return testingModule.createNestApplication(new FastifyAdapter());
}

function toTestingModuleMetadata(
  module: DynamicModule | TestingModuleMetadata,
): TestingModuleMetadata {
  if ("module" in module) {
    return {
      imports: [module],
    };
  }

  return module;
}

async function listen(app: INestApplication): Promise<string> {
  await app.listen(0, "127.0.0.1");

  return app.getUrl();
}

function createDashboardConfig(): NestDashboardConfig {
  return {
    mountPath: "/ops/bullstudio",
    queues: [createQueueAdapter({ key: "email", label: "Email" })],
    protection: {
      type: "disabled",
    },
  };
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

async function readTrpcResultData(response: Response | { json(): unknown }) {
  const body = (await response.json()) as TrpcResultEnvelope;
  return body.result.data.json ?? body.result.data;
}

interface TrpcResultEnvelope {
  result: {
    data: {
      json?: unknown;
    } & unknown;
  };
}
