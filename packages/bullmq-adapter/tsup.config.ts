import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@bullstudio/connect-types", "bullmq"],
  noExternal: ["@bullstudio/adapter-utils"],
});
