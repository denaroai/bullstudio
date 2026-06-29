import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { standaloneApiPlugin } from "./dev/standalone-api-plugin";

export default defineConfig(({ mode }) => {
  // The dev-only standalone API (see standalone-api-plugin) reads connection
  // config from process.env. Vite does not put non-VITE_ vars from .env into
  // process.env on its own, so load every key here and fill in the gaps —
  // real shell env vars still win, keeping CI/overrides authoritative.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    build: {
      outDir: "dist/client",
    },
    plugins: [
      standaloneApiPlugin(),
      devtools(),
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
      tailwindcss(),
      tanstackRouter({
        target: "react",
      }),
      viteReact(),
    ],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      esbuildOptions: {
        // Handle CommonJS modules
        format: "esm",
      },
    },
  };
});
