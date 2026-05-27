import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { disconnectProvider } from "../src/integrations/trpc/connection";
import { createStandaloneApp } from "./standalone";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// After bundling, this file is at dist/server/production.js,
// so __dirname is dist/server and the SPA is in dist/client.
const clientDir = join(__dirname, "..", "client");
const port = Number.parseInt(process.env.PORT || "4000", 10);
const host = process.env.HOST || "localhost";

const app = createStandaloneApp({
  clientDir,
});

const server = serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  () => {
    console.log(`Server running at http://${host}:${port}`);
  },
);

const shutdown = (signal: string) => {
  console.log(`Process received ${signal}, attempting to shut down gracefully`);

  server.close(async () => {
    await disconnectProvider();
    console.log("Server stopped successfully");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Server stop timeout occurred, forcing shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
