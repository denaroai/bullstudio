import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import { createConnectionInfo } from "./service";

export function createConnectionRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    info: authenticatedProcedure.query(() => createConnectionInfo(source)),
  });
}
