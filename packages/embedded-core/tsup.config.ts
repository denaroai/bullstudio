import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@bullstudio/connect-types", "@trpc/server", "superjson", "zod"],
  noExternal: ["@bullstudio/private-router"],
});
