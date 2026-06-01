import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: [
    "@bullstudio/embedded-core",
    "@bullstudio/express",
    "@bullstudio/fastify",
    "@nestjs/common",
    "@nestjs/core",
    "express",
    "fastify",
  ],
});
