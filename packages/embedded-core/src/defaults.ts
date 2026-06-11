import type {
  AdapterCapabilities,
  DashboardIdentity,
  DashboardProtection,
  DocumentIdentity,
  ResolvedPollingConfig,
} from "./types";

export const defaultCapabilities: AdapterCapabilities = {
  flows: false,
  jobLogs: false,
  jobRemoval: false,
  jobRetry: false,
  queuePause: false,
  queueResume: false,
  queueDrain: false,
  schedulers: false,
  workers: false,
};

export const defaultProtection: DashboardProtection = {
  type: "session",
  username: "admin",
  password: "bullstudio",
};

export const defaultDashboardIdentity: DashboardIdentity = {
  title: "Bullstudio",
};

export const defaultDocumentIdentity: DocumentIdentity = {
  title: "Bullstudio",
};

export const defaultPollingConfig: ResolvedPollingConfig = {
  enabled: true,
  interval: 2000,
  allowUserOverride: true,
};
