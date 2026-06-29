import {
  queueTargetSchema,
  resolveQueueTarget,
} from "../../shared/queue-target";
import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import { drainQueue, pauseQueue, resumeQueue } from "./service";

export function createQueuesRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    list: authenticatedProcedure.query(() => source.listQueues()),
    prefixes: authenticatedProcedure.query(() => source.listPrefixes()),
    get: authenticatedProcedure
      .input(queueTargetSchema)
      .query(({ input }) => resolveQueueTarget(source, input)),
    pause: authenticatedProcedure
      .input(queueTargetSchema)
      .mutation(({ input }) => pauseQueue(source, input)),
    resume: authenticatedProcedure
      .input(queueTargetSchema)
      .mutation(({ input }) => resumeQueue(source, input)),
    drain: authenticatedProcedure
      .input(queueTargetSchema)
      .mutation(({ input }) => drainQueue(source, input)),
  });
}
