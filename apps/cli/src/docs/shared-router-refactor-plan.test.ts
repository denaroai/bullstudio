import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

describe("shared private dashboard router refactor plan", () => {
  it("defines the shared router contract and migration strategy", async () => {
    const plan = await readRepoFile(
      "docs/prd/shared-private-dashboard-router-refactor.md",
    );

    for (const procedure of [
      "connection.info",
      "queueSource.status",
      "overview.metrics",
      "queues.list",
      "queues.prefixes",
      "queues.get",
      "queues.pause",
      "queues.resume",
      "jobs.list",
      "jobs.listSummary",
      "jobs.get",
      "jobs.logs",
      "jobs.retry",
      "jobs.remove",
      "flows.list",
      "flows.get",
    ]) {
      expect(plan).toContain(procedure);
    }

    for (const section of [
      "Shared Router Contract",
      "Mode-Specific Queue Sources",
      "Compatibility Shims to Remove",
      "Package Boundaries",
      "Standalone Preservation",
      "Migration Order",
      "Test Strategy",
      "Maintainer Review Gate",
      "Review Request",
    ]) {
      expect(plan).toContain(section);
    }

    expect(plan).toContain("StandaloneQueueSource");
    expect(plan).toContain("EmbeddedQueueSource");
    expect(plan).toContain("queueKey");
    expect(plan).toContain("queue name and prefix");
    expect(plan).toContain("apps/cli");
    expect(plan).toContain("@bullstudio/embedded-core");
    expect(plan).toContain("@bullstudio/private-router");
    expect(plan).toContain("Reviewer decision");
    expect(plan).toContain("Approved to implement");
  });
});

async function readRepoFile(path: string): Promise<string> {
  return readFile(resolve(repoRoot, path), "utf8");
}
