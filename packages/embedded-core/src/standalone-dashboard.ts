import { defaultProtection } from "./defaults";
import { withDashboardProtection } from "./protection";
import type {
  ResolvedStandaloneDashboardConfig,
  StandaloneDashboardConfig,
  StandaloneDashboardInstance,
} from "./types";

export function createStandaloneDashboard(
  config: StandaloneDashboardConfig,
): StandaloneDashboardInstance {
  const resolvedConfig: ResolvedStandaloneDashboardConfig = {
    protection: config.protection ?? defaultProtection,
  };
  const privateDashboardApi = config.mountPrivateDashboardApi();

  return {
    mode: "standalone",
    config: resolvedConfig,
    handle: (request) =>
      withDashboardProtection(resolvedConfig.protection, request, () =>
        config.handleDashboardAsset(request),
      ),
    mountPrivateDashboardApi: () => ({
      handle: (request) =>
        withDashboardProtection(resolvedConfig.protection, request, () =>
          privateDashboardApi.handle(request),
        ),
    }),
  };
}
