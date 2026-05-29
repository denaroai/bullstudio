import { defaultProtection } from "./defaults";
import { withDashboardProtection } from "./protection";
import { handleDashboardAuthRequest } from "./session";
import type {
  FrameworkRequest,
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
      handleStandaloneDashboardRequest(request, resolvedConfig, config),
    mountPrivateDashboardApi: () => ({
      handle: (request) => privateDashboardApi.handle(request),
    }),
  };
}

async function handleStandaloneDashboardRequest(
  request: FrameworkRequest,
  resolvedConfig: ResolvedStandaloneDashboardConfig,
  config: StandaloneDashboardConfig,
) {
  const authResponse = await handleDashboardAuthRequest(
    resolvedConfig.protection,
    request,
  );

  if (authResponse) {
    return authResponse;
  }

  return withDashboardProtection(resolvedConfig.protection, request, () =>
    config.handleDashboardAsset(request),
  );
}
