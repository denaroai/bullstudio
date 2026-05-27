import { ReadOnlyDashboardError } from "./errors";
import type { ResolvedDashboardConfig } from "./types";

export async function withMutationAccess<T>(
  config: ResolvedDashboardConfig,
  operation: () => Promise<T>,
): Promise<T> {
  assertCanMutate(config);
  return operation();
}

export function assertCanMutate(config: ResolvedDashboardConfig): void {
  if (config.readOnly) {
    throw new ReadOnlyDashboardError();
  }
}
