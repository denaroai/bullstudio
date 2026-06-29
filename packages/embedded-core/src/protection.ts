import {
  getAuthenticatedSession,
  getLoginRedirectResponse,
  isCredentialProtection,
  isPublicDashboardRequest,
} from "./session";
import type {
  DashboardProtection,
  FrameworkRequest,
  FrameworkResponse,
} from "./types";

export async function withDashboardProtection(
  protection: DashboardProtection,
  request: FrameworkRequest,
  next: () => Promise<FrameworkResponse>,
): Promise<FrameworkResponse> {
  if (
    !isCredentialProtection(protection) ||
    isPublicDashboardRequest(request)
  ) {
    return next();
  }

  if (getAuthenticatedSession(protection, request).authenticated) {
    return next();
  }

  return getLoginRedirectResponse(request);
}
