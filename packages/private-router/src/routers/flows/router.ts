import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import { jobTargetSchema } from "../jobs/schema";
import { flowListSchema, flowTargetSchema } from "./schema";
import { getFlow, getJobFlow } from "./service";

export function createFlowsRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    list: authenticatedProcedure
      .input(flowListSchema)
      .query(({ input }) => source.listFlows(input)),
    get: authenticatedProcedure
      .input(flowTargetSchema)
      .query(({ input }) => getFlow(source, input)),
    forJob: authenticatedProcedure
      .input(jobTargetSchema)
      .query(({ input }) => getJobFlow(source, input)),
  });
}
