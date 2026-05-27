import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { ReadOnlyDashboardError } from "./errors";
import { assertCanMutate } from "./mutation";
import type {
  EmbeddedDashboardInstance,
  FrameworkRequest,
  FrameworkResponse,
  PrivateDashboardApiMount,
} from "./types";
import { getPathname, toAbsoluteUrl } from "./url";

export function createPrivateDashboardApi(
  dashboard: EmbeddedDashboardInstance,
): PrivateDashboardApiMount {
  const router = createPrivateDashboardApiRouter(dashboard);

  return {
    handle: (request) => handlePrivateDashboardApi(router, request),
  };
}

async function handlePrivateDashboardApi(
  router: ReturnType<typeof createPrivateDashboardApiRouter>,
  request: FrameworkRequest,
): Promise<FrameworkResponse> {
  const response = await fetchRequestHandler({
    endpoint: getPrivateDashboardApiEndpoint(request.url),
    req: toFetchRequest(request),
    router,
    createContext: () => ({}),
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
}

function createPrivateDashboardApiRouter(dashboard: EmbeddedDashboardInstance) {
  const t = initTRPC.create();

  return t.router({
    queueSource: t.router({
      status: t.procedure.query(() => dashboard.getQueueSourceStatus()),
    }),
    queues: t.router({
      list: t.procedure.query(() => dashboard.listQueues()),
      pause: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          dashboard.pauseQueue(getQueueKeyInput(input).queueKey),
        ),
      ),
      resume: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () =>
          dashboard.resumeQueue(getQueueKeyInput(input).queueKey),
        ),
      ),
    }),
    jobs: t.router({
      retry: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () => {
          const { jobId, queueKey } = getJobMutationInput(input);
          return dashboard.retryJob(queueKey, jobId);
        }),
      ),
      remove: t.procedure.mutation(({ input }) =>
        runPrivateDashboardMutation(dashboard, () => {
          const { jobId, queueKey } = getJobMutationInput(input);
          return dashboard.removeJob(queueKey, jobId);
        }),
      ),
    }),
  });
}

async function runPrivateDashboardMutation(
  dashboard: EmbeddedDashboardInstance,
  operation: () => Promise<void>,
): Promise<{ success: true }> {
  try {
    assertCanMutate(dashboard.config);
    await operation();
    return { success: true };
  } catch (error) {
    if (error instanceof ReadOnlyDashboardError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: error.message,
      });
    }

    throw error;
  }
}

function getQueueKeyInput(input: unknown): { queueKey: string } {
  const value = unwrapJsonInput(input);

  if (
    value &&
    typeof value === "object" &&
    "queueKey" in value &&
    typeof value.queueKey === "string"
  ) {
    return {
      queueKey: value.queueKey,
    };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A queueKey string is required.",
  });
}

function getJobMutationInput(input: unknown): {
  jobId: string;
  queueKey: string;
} {
  const value = unwrapJsonInput(input);
  const { queueKey } = getQueueKeyInput(value);

  if (
    value &&
    typeof value === "object" &&
    "jobId" in value &&
    typeof value.jobId === "string"
  ) {
    return {
      jobId: value.jobId,
      queueKey,
    };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "A jobId string is required.",
  });
}

function unwrapJsonInput(input: unknown): unknown {
  if (input && typeof input === "object" && "json" in input) {
    return input.json;
  }

  return input;
}

function toFetchRequest(request: FrameworkRequest): Request {
  return new Request(toAbsoluteUrl(request.url), {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : (request.body as BodyInit | null | undefined),
  });
}

function toFetchHeaders(
  headers: FrameworkRequest["headers"],
): HeadersInit | undefined {
  if (!headers || headers instanceof Headers) {
    return headers;
  }

  const fetchHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        fetchHeaders.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      fetchHeaders.set(name, value);
    }
  }

  return fetchHeaders;
}

function getPrivateDashboardApiEndpoint(url: string): string {
  const pathname = getPathname(url);
  const apiPathIndex = pathname.indexOf("/api/trpc");

  if (apiPathIndex === -1) {
    return "/api/trpc";
  }

  return pathname.slice(0, apiPathIndex + "/api/trpc".length);
}
