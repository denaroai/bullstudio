import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { TRPCRouter } from "@/integrations/trpc/router";

export type RouterInput = inferRouterInputs<TRPCRouter>;
export type RouterOutput = inferRouterOutputs<TRPCRouter>;
