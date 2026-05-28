import type { PrivateDashboardRouter } from "@bullstudio/private-router";
import { createTRPCRouter } from "./init";
import { connectionRouter } from "./routers/connection";
import { flowRouter } from "./routers/flow";
import { jobRouter } from "./routers/job";
import { overviewRouter } from "./routers/overview";
import { queueRouter } from "./routers/queue";

export const trpcRouter = createTRPCRouter({
  jobs: jobRouter,
  queues: queueRouter,
  overview: overviewRouter,
  connection: connectionRouter,
  flows: flowRouter,
});

export type TRPCRouter = PrivateDashboardRouter;
