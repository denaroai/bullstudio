import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import { workerListSchema, workerTargetSchema } from "./schema";
import { getWorker, listWorkers } from "./service";

export function createWorkersRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    list: authenticatedProcedure
      .input(workerListSchema)
      .query(({ input }) => listWorkers(source, input)),
    get: authenticatedProcedure
      .input(workerTargetSchema)
      .query(({ input }) => getWorker(source, input)),
  });
}
