import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";

export function createQueueSourceRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    status: authenticatedProcedure.query(() => source.getStatus()),
  });
}
