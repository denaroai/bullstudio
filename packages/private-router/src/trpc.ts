import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export interface PrivateDashboardContext {
  authenticated: boolean;
  username?: string;
}

export const t = initTRPC.context<PrivateDashboardContext>().create({
  transformer: superjson,
});

export const authenticatedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.authenticated) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  return next({
    ctx,
  });
});
