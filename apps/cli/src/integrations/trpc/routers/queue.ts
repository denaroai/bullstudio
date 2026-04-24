import { type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
import type { Queue } from "@bullstudio/connect-types";

export const queueRouter = {
  list: publicProcedure.query(
    async (): Promise<Queue[]> => {
      const provider = await getQueueProvider();
      return provider.getQueues();
    },
  ),

  prefixes: publicProcedure.query(
    async (): Promise<string[]> => {
      const provider = await getQueueProvider();
      return provider.getPrefixes();
    },
  ),

  get: publicProcedure
    .input(
      z.object({
        name: z.string(),
        prefix: z.string().optional(),
      }),
    )
    .query(
      async ({ input }): Promise<Queue | null> => {
        const provider =
          await getQueueProvider();
        return provider.getQueue(
          input.name,
          input.prefix,
        );
      },
    ),

  pause: publicProcedure
    .input(
      z.object({
        name: z.string(),
        prefix: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();
      await provider.pauseQueue(
        input.name,
        input.prefix,
      );
      return { success: true };
    }),

  resume: publicProcedure
    .input(
      z.object({
        name: z.string(),
        prefix: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();
      await provider.resumeQueue(
        input.name,
        input.prefix,
      );
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
