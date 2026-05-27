import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

describe("embedded mode documentation", () => {
  it("documents the first embedded Hono and BullMQ slice", async () => {
    const docs = await readRepoFile("docs/embedded-mode.md");
    const example = await readRepoFile(
      "examples/hono-bullmq-embedded/src/server.ts",
    );

    expect(docs).toContain("Standalone mode");
    expect(docs).toContain("Embedded mode");
    expect(docs).toContain("queue source");
    expect(docs).toContain("supplied queues");
    expect(docs).toContain("host-owned queues");
    expect(docs).toContain("mount path");
    expect(docs).toContain("Basic Auth protection");
    expect(docs).toContain("host-owned access control");
    expect(docs).toContain("read-only dashboard");
    expect(docs).toContain("dashboard identity");
    expect(docs).toContain("document identity");
    expect(docs).toContain("private dashboard API");
    expect(docs).toContain("tRPC");
    expect(docs).toContain("@bullstudio/hono");
    expect(docs).toContain("@bullstudio/bullmq-adapter");
    expect(docs).toContain("createBullMqQueueAdapter");

    expect(example).toContain('import { bullstudio } from "@bullstudio/hono"');
    expect(example).toContain(
      'import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter"',
    );
    expect(example).toContain("new Queue(");
    expect(example).toContain('host.route("/ops/bullstudio", dashboard)');
    expect(example).toContain("readOnly: true");
    expect(example).toContain("dashboardIdentity");
    expect(example).toContain("documentIdentity");
  });
});

async function readRepoFile(path: string): Promise<string> {
  return readFile(resolve(repoRoot, path), "utf8");
}
