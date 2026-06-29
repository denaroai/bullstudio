import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const frontendClientDir = join(repoRoot, "apps/frontend/dist/client");
const embeddedClientDir = join(repoRoot, "packages/embedded-core/dist/client");

await rm(embeddedClientDir, { force: true, recursive: true });
await cp(frontendClientDir, embeddedClientDir, { recursive: true });
