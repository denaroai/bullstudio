type QueueSourceMode = "standalone" | "embedded";
type QueueSourceStatus = "healthy" | "degraded" | "unhealthy" | "unavailable";
type ProviderType = "bull" | "bullmq" | string;

interface QueueSourceFeature {
  visible: boolean;
  enabled: boolean;
}

interface StandaloneQueueSourceStatus {
  mode: "standalone";
  source: "redis";
  status: QueueSourceStatus;
  connection: {
    host: string;
    port: string;
    hasPassword: boolean;
    database: string;
    displayUrl: string;
  };
  providers: ProviderType[];
  prefixes: string[];
  capabilities: {
    flows: boolean;
    schedulers: boolean;
    supportedStatuses: string[];
    mutationsAllowed: boolean;
  };
}

interface EmbeddedQueueSourceStatus {
  mode: "embedded";
  source: "supplied";
  status: QueueSourceStatus;
  queueCount: number;
  providers: ProviderType[];
  readOnly: boolean;
  mutationsAllowed: boolean;
  capabilities: {
    flows: boolean;
    jobLogs: boolean;
    jobRemoval: boolean;
    jobRetry: boolean;
    queuePause: boolean;
    queueResume: boolean;
    queueDrain: boolean;
    schedulers: boolean;
    workers: boolean;
    mutationsAllowed?: boolean;
  };
}

type QueueSourceStatusInput =
  | StandaloneQueueSourceStatus
  | EmbeddedQueueSourceStatus;

interface QueueSourceViewModel {
  mode: QueueSourceMode;
  title: string;
  detail: string;
  providerLabel: string;
  prefixes: string[];
  queueCount: number | null;
  connection: StandaloneQueueSourceStatus["connection"] | null;
  status: QueueSourceStatus;
  features: {
    flows: QueueSourceFeature;
    jobLogs: QueueSourceFeature;
    jobRemoval: QueueSourceFeature;
    jobRetry: QueueSourceFeature;
    queuePause: QueueSourceFeature;
    queueResume: QueueSourceFeature;
    queueDrain: QueueSourceFeature;
    schedulers: QueueSourceFeature;
    workers: QueueSourceFeature;
    mutations: QueueSourceFeature;
  };
}

export function getQueueSourceViewModel(
  status: QueueSourceStatusInput,
): QueueSourceViewModel {
  if (status.mode === "standalone") {
    return {
      mode: "standalone",
      title: "Redis",
      detail: status.connection.displayUrl,
      providerLabel: status.providers.join(", "),
      prefixes: status.prefixes,
      queueCount: null,
      connection: status.connection,
      status: status.status,
      features: {
        flows: enabledFeature(status.capabilities.flows),
        jobLogs: enabledFeature(true),
        jobRemoval: enabledFeature(status.capabilities.mutationsAllowed),
        jobRetry: enabledFeature(status.capabilities.mutationsAllowed),
        queuePause: enabledFeature(status.capabilities.mutationsAllowed),
        queueResume: enabledFeature(status.capabilities.mutationsAllowed),
        queueDrain: enabledFeature(status.capabilities.mutationsAllowed),
        schedulers: enabledFeature(
          status.capabilities.schedulers,
          status.capabilities.mutationsAllowed,
        ),
        workers: enabledFeature(true),
        mutations: enabledFeature(status.capabilities.mutationsAllowed),
      },
    };
  }

  const mutationsEnabled = status.mutationsAllowed;

  return {
    mode: "embedded",
    title: "Supplied queues",
    detail: `${status.queueCount} supplied ${status.queueCount === 1 ? "queue" : "queues"}`,
    providerLabel: status.providers.join(", "),
    prefixes: [],
    queueCount: status.queueCount,
    connection: null,
    status: status.status,
    features: {
      flows: enabledFeature(status.capabilities.flows),
      jobLogs: enabledFeature(status.capabilities.jobLogs),
      jobRemoval: enabledFeature(
        status.capabilities.jobRemoval,
        mutationsEnabled,
      ),
      jobRetry: enabledFeature(status.capabilities.jobRetry, mutationsEnabled),
      queuePause: enabledFeature(
        status.capabilities.queuePause,
        mutationsEnabled,
      ),
      queueResume: enabledFeature(
        status.capabilities.queueResume,
        mutationsEnabled,
      ),
      queueDrain: enabledFeature(
        status.capabilities.queueDrain,
        mutationsEnabled,
      ),
      schedulers: enabledFeature(
        status.capabilities.schedulers,
        mutationsEnabled,
      ),
      workers: enabledFeature(status.capabilities.workers),
      mutations: {
        visible: true,
        enabled: mutationsEnabled,
      },
    },
  };
}

function enabledFeature(
  supported: boolean,
  allowed = supported,
): QueueSourceFeature {
  return {
    visible: supported,
    enabled: supported && allowed,
  };
}
