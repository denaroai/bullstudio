import type {
  AdapterCapabilities,
  DashboardIdentity,
  DashboardProtection,
  DocumentIdentity,
} from "./types";

export const defaultCapabilities: AdapterCapabilities = {
  flows: false,
  jobLogs: false,
  jobRemoval: false,
  jobRetry: false,
  queuePause: false,
  queueResume: false,
  workers: false,
};

export const defaultProtection: DashboardProtection = {
  type: "basic",
  username: "admin",
  password: "bullstudio",
};

export const defaultDashboardIdentity: DashboardIdentity = {
  title: "Bullstudio",
};

export const defaultDocumentIdentity: DocumentIdentity = {
  title: "Bullstudio",
};
