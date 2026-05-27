import type { FlowSummary } from "@bullstudio/connect-types";
import { handleDashboardAsset } from "./assets";
import {
  defaultCapabilities,
  defaultDashboardIdentity,
  defaultDocumentIdentity,
  defaultProtection,
} from "./defaults";
import { withMutationAccess } from "./mutation";
import { createPrivateDashboardApi } from "./private-api";
import { withDashboardProtection } from "./protection";
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
    getJobs: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobs(options),
    getJobsSummary: (queueKey, options) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobsSummary(options),
    getJob: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJob(jobId),
    getJobLogs: (queueKey, jobId) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getJobLogs(jobId),
    retryJob: (queueKey, jobId) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).retryJob(jobId),
      ),
    removeJob: (queueKey, jobId) =>
      withMutationAccess(resolvedConfig, () =>
        getQueueAdapter(queueAdaptersByKey, queueKey).removeJob(jobId),
      ),
    getWorkerCount: (queueKey) =>
      getQueueAdapter(queueAdaptersByKey, queueKey).getWorkerCount(),
    listFlows: (options) => listFlows(resolvedConfig.queues, options),
    getFlow: (input) => getFlow(resolvedConfig.queues, input),
    handle: (request) =>
      withDashboardProtection(resolvedConfig.protection, request, () =>
        handleDashboardAsset(request, resolvedConfig),
      ),
    mountPrivateDashboardApi: () => ({
      handle: (request) =>
        withDashboardProtection(resolvedConfig.protection, request, () =>
          privateDashboardApi.handle(request),
        ),
    }),
  };
  privateDashboardApi = createPrivateDashboardApi(dashboard);

  return dashboard;
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

async function listFlows(queues: QueueAdapter[], options?: { limit?: number }) {
  const limit = options?.limit ?? 50;
  const flows: FlowSummary[] = [];

  for (const queue of queues) {
    if (flows.length >= limit) {
      break;
    }
    if (!queue.capabilities.flows || !queue.listFlows) {
      continue;
    }

    const queueFlows = await queue.listFlows({
      limit: limit - flows.length,
    });
    flows.push(...queueFlows);
  }

  return flows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

async function getFlow(
  queues: QueueAdapter[],
  input: {
    queueName: string;
    flowId: string;
    prefix?: string;
  },
) {
  for (const queue of queues) {
    if (!queue.capabilities.flows || !queue.getFlow) {
      continue;
    }

    const suppliedQueue = await queue.getQueue();
    if (suppliedQueue.name !== input.queueName) {
      continue;
    }
    if (input.prefix && suppliedQueue.prefix !== input.prefix) {
      continue;
    }

    return queue.getFlow(input.flowId);
  }

  return null;
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
      workers: result.workers || queue.capabilities.workers,
    }),
    defaultCapabilities,
  );
}
