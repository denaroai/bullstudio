import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@bullstudio/connect-types", "bull"],
  noExternal: ["@bullstudio/adapter-utils"],
});
