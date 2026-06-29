import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import {
  schedulerListSchema,
  schedulerTargetSchema,
  schedulerUpsertSchema,
} from "./schema";
import { removeJobScheduler, upsertJobScheduler } from "./service";

export function createSchedulersRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    list: authenticatedProcedure
      .input(schedulerListSchema)
      .query(({ input }) => source.listJobSchedulers(input ?? { limit: 100 })),
    get: authenticatedProcedure
      .input(schedulerTargetSchema)
      .query(({ input }) => source.getJobScheduler(input)),
    upsert: authenticatedProcedure
      .input(schedulerUpsertSchema)
      .mutation(({ input }) => upsertJobScheduler(source, input)),
    remove: authenticatedProcedure
      .input(schedulerTargetSchema)
      .mutation(({ input }) => removeJobScheduler(source, input)),
  });
}
