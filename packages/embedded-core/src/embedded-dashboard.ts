import type { FlowSummary } from "@bullstudio/connect-types";
import { handleDashboardAsset } from "./assets";
import {
  defaultCapabilities,
  defaultDashboardIdentity,
  defaultDocumentIdentity,
  defaultPollingConfig,
  defaultProtection,
} from "./defaults";
import { withMutationAccess } from "./mutation";
import { createPrivateDashboardApi } from "./private-api";
import { withDashboardProtection } from "./protection";
import { handleDashboardAuthRequest } from "./session";
import type {
  AdapterCapabilities,
  DashboardConfig,
  DashboardQueue,
  EmbeddedDashboardInstance,
  PrivateDashboardApiMount,
  QueueAdapter,
  QueueAdapterProvider,
  QueueSourceStatus,
  ResolvedDashboardConfig,
} from "./types";

export function createEmbeddedDashboard(
  config: DashboardConfig,
): EmbeddedDashboardInstance {
  const resolvedConfig = resolveDashboardConfig(config);
  const queueAdaptersByKey = indexQueueAdaptersByKey(resolvedConfig.queues);
  let privateDashboardApi: PrivateDashboardApiMount;
  const dashboard: EmbeddedDashboardInstance = {
    mode: "embedded",
    config: resolvedConfig,
    queues: resolvedConfig.queues,
    getQueueSourceStatus: () => getQueueSourceStatus(resolvedConfig),
    listQueues: async () =>
      Promise.all(
        resolvedConfig.queues.map((queue) => getDashboardQueue(queue)),
      ),
    getQueue: async (queueKey) => {
      const queue = queueAdaptersByKey.get(queueKey);
      return queue ? getDashboardQueue(queue) : null;
    },
    getJobCounts: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobCounts(),
    pauseQueue: (queueKey) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).pauseQueue(),
      ),
    resumeQueue: (queueKey) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).resumeQueue(),
      ),
    drainQueue: (queueKey) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).drainQueue(),
      ),
    addJob: (queueKey, input) =>
      withMutationAccess(resolvedConfig, () => {
        const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
        if (!adapter.addJob) {
          throw new Error(
            `Supplied queue "${queueKey}" does not support adding jobs.`,
          );
        }
        return adapter.addJob(input);
      }),
    getJobs: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobs(options),
    getJobsSummary: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobsSummary(options),
    getQueueMetrics: async (queueKey, type) => {
      const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
      return adapter.getMetrics ? adapter.getMetrics(type) : null;
    },
    getJob: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJob(jobId),
    getJobLogs: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobLogs(jobId),
    retryJob: (queueKey, jobId) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).retryJob(jobId),
      ),
    retryFailedJobs: (queueKey) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).retryFailedJobs(),
      ),
    removeJob: (queueKey, jobId) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).removeJob(jobId),
      ),
    getWorkerCount: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getWorkerCount(),
    listWorkers: async (queueKey) => {
      const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
      return adapter.listWorkers ? adapter.listWorkers() : [];
    },
    listFlows: (options) =>
      listFlows(
        options?.queueKey
          ? resolvedConfig.queues.filter(
              (queue) => queue.key === options.queueKey,
            )
          : resolvedConfig.queues,
        options,
      ),
    getFlow: async (queueKey, flowId) => {
      const getFlow = getQueueAdapter(queueAdaptersByKey, queueKey).getFlow;
      return getFlow ? getFlow(flowId) : null;
    },
    getJobFlow: async (queueKey, jobId) => {
      const getJobFlow = getQueueAdapter(
        queueAdaptersByKey,
        queueKey,
      ).getJobFlow;
      return getJobFlow ? getJobFlow(jobId) : null;
    },
    listQueueSchedulers: async (queueKey, options) => {
      const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
      return adapter.listJobSchedulers
        ? adapter.listJobSchedulers(options)
        : [];
    },
    getJobScheduler: async (queueKey, target) => {
      const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
      return adapter.getJobScheduler ? adapter.getJobScheduler(target) : null;
    },
    upsertJobScheduler: (queueKey, input) =>
      withMutationAccess(resolvedConfig, () => {
        const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
        if (!adapter.upsertJobScheduler) {
          throw new Error(
            `Supplied queue "${queueKey}" does not support job schedulers.`,
          );
        }
        return adapter.upsertJobScheduler(input);
      }),
    removeJobScheduler: (queueKey, target) =>
      withMutationAccess(resolvedConfig, () => {
        const adapter = getQueueAdapter(queueAdaptersByKey, queueKey);
        if (!adapter.removeJobScheduler) {
          throw new Error(
            `Supplied queue "${queueKey}" does not support job schedulers.`,
          );
        }
        return adapter.removeJobScheduler(target);
      }),
    handle: (request) =>
      handleEmbeddedDashboardRequest(request, resolvedConfig),
    mountPrivateDashboardApi: () => ({
      handle: (request) => privateDashboardApi.handle(request),
    }),
  };
  privateDashboardApi = createPrivateDashboardApi(dashboard);

  return dashboard;
}

async function handleEmbeddedDashboardRequest(
  request: Parameters<EmbeddedDashboardInstance["handle"]>[0],
  config: ResolvedDashboardConfig,
) {
  const authResponse = await handleDashboardAuthRequest(
    config.protection,
    request,
  );

  if (authResponse) {
    return authResponse;
  }

  return withDashboardProtection(config.protection, request, () =>
    handleDashboardAsset(request, config),
  );
}

function indexQueueAdaptersByKey(
  queues: QueueAdapter[],
): Map<string, QueueAdapter> {
  const queuesByKey = new Map<string, QueueAdapter>();

  for (const queue of queues) {
    if (queuesByKey.has(queue.key)) {
      throw new Error(
        `Duplicate supplied queue key "${queue.key}". Queue keys must be unique.`,
      );
    }
    queuesByKey.set(queue.key, queue);
  }

  return queuesByKey;
}

function getQueueAdapter(
  queueAdaptersByKey: Map<string, QueueAdapter>,
  queueKey: string,
): QueueAdapter {
  const queue = queueAdaptersByKey.get(queueKey);

  if (!queue) {
    throw new Error(`Supplied queue "${queueKey}" was not found.`);
  }

  return queue;
}

async function getDashboardQueue(queue: QueueAdapter): Promise<DashboardQueue> {
  return {
    key: queue.key,
    label: queue.label,
    provider: queue.provider,
    capabilities: queue.capabilities,
    ...(await queue.getQueue()),
  };
}

type PrivateFlowSummary = FlowSummary & { queueKey?: string };

async function listFlows(
  queues: QueueAdapter[],
  options?: { limit?: number },
): Promise<PrivateFlowSummary[]> {
  const limit = options?.limit ?? 50;
  const flows: PrivateFlowSummary[] = [];

  for (const queue of queues) {
    if (!queue.capabilities.flows || !queue.listFlows) {
      continue;
    }

    const queueFlows = await queue.listFlows({
      limit,
    });
    flows.push(
      ...queueFlows.map((flow) => ({
        ...flow,
        queueKey: queue.key,
      })),
    );
  }

  return flows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function resolveDashboardConfig(
  config: DashboardConfig,
): ResolvedDashboardConfig {
  return {
    queues: config.queues,
    readOnly: config.readOnly ?? false,
    protection: config.protection ?? defaultProtection,
    dashboardIdentity: config.dashboardIdentity ?? defaultDashboardIdentity,
    documentIdentity: config.documentIdentity ?? defaultDocumentIdentity,
    basePath: normalizeBasePath(config.basePath),
    polling: resolvePollingConfig(config.polling),
  };
}

function resolvePollingConfig(
  polling: DashboardConfig["polling"],
): ResolvedDashboardConfig["polling"] {
  return {
    enabled: polling?.enabled ?? defaultPollingConfig.enabled,
    interval: polling?.interval ?? defaultPollingConfig.interval,
    minInterval: polling?.minInterval,
    allowUserOverride:
      polling?.allowUserOverride ?? defaultPollingConfig.allowUserOverride,
  };
}

function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) {
    return "";
  }

  const trimmed = basePath.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function getQueueSourceStatus(
  config: ResolvedDashboardConfig,
): QueueSourceStatus {
  return {
    mode: "embedded",
    source: "supplied",
    status: "healthy",
    queueCount: config.queues.length,
    providers: getProviders(config.queues),
    capabilities: aggregateCapabilities(config.queues),
    readOnly: config.readOnly,
    mutationsAllowed: !config.readOnly,
  };
}

function getProviders(queues: QueueAdapter[]): QueueAdapterProvider[] {
  return [...new Set(queues.map((queue) => queue.provider))].sort();
}

function aggregateCapabilities(queues: QueueAdapter[]): AdapterCapabilities {
  return queues.reduce<AdapterCapabilities>(
    (result, queue) => ({
      flows: result.flows || queue.capabilities.flows,
      jobLogs: result.jobLogs || queue.capabilities.jobLogs,
      jobRemoval: result.jobRemoval || queue.capabilities.jobRemoval,
      jobRetry: result.jobRetry || queue.capabilities.jobRetry,
      queuePause: result.queuePause || queue.capabilities.queuePause,
      queueResume: result.queueResume || queue.capabilities.queueResume,
      queueDrain: result.queueDrain || queue.capabilities.queueDrain,
      queueAddJob: result.queueAddJob || queue.capabilities.queueAddJob,
      schedulers: result.schedulers || queue.capabilities.schedulers,
      workers: result.workers || queue.capabilities.workers,
    }),
    defaultCapabilities,
  );
}
