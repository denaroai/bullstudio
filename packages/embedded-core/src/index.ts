export { createEmbeddedDashboard } from "./embedded-dashboard";
export { ReadOnlyDashboardError } from "./errors";
export { getAuthenticatedSession } from "./session";
export { createStandaloneDashboard } from "./standalone-dashboard";
export type {
  AdapterCapabilities,
  BasicAuthProtection,
  CustomDashboardProtection,
  DashboardConfig,
  DashboardIdentity,
  DashboardLogo,
  DashboardMode,
  DashboardProtection,
  DashboardQueue,
  DisabledDashboardProtection,
  DocumentIdentity,
  EmbeddedDashboardInstance,
  FrameworkRequest,
  FrameworkResponse,
  PrivateDashboardApiMount,
  QueueAdapter,
  QueueAdapterProvider,
  QueueSourceStatus,
  ResolvedDashboardConfig,
  ResolvedStandaloneDashboardConfig,
  SessionDashboardProtection,
  StandaloneDashboardConfig,
  StandaloneDashboardInstance,
} from "./types";
