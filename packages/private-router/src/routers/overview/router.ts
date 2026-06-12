import type { PrivateDashboardQueueSource } from "../../source";
import { authenticatedProcedure, t } from "../../trpc";
import { overviewMetricsSchema } from "./schema";
import { getOverviewMetrics } from "./service";

export function createOverviewRouter(source: PrivateDashboardQueueSource) {
  return t.router({
    metrics: authenticatedProcedure
      .input(overviewMetricsSchema)
      .query(({ input }) =>
        getOverviewMetrics(source, input ?? { timeRangeHours: 24 }),
      ),
  });
}
