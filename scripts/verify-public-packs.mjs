import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const publicPackages = [
  "packages/cli",
  "packages/express-adapter",
  "packages/fastify-adapter",
  "packages/hono-adapter",
  "packages/next-adapter",
  "packages/bullmq-adapter",
  "packages/bull-adapter",
  "packages/embedded-core",
  "packages/connect-types",
  "packages/logger",
  "packages/dayjs",
];
const sourceOnlyPackages = new Set(["packages/logger", "packages/dayjs"]);

const forbiddenPatterns = [
  "/src/",
  "/.turbo/",
  "/tsconfig.json",
  "/vitest.config.ts",
  ".test.ts",
  ".map",
];
const packDir = mkdtempSync(join(tmpdir(), "bullstudio-pack-"));

for (const packageDir of publicPackages) {
  execFileSync("pnpm", ["--dir", packageDir, "pack", "--pack-destination", packDir], {
    encoding: "utf8",
  });
  const tarball = readdirSync(packDir).find((file) => file.endsWith(".tgz"));

  if (!tarball) {
    throw new Error(`${packageDir} did not create a package tarball`);
  }

  const tarballPath = join(packDir, tarball);
  const files = execFileSync("tar", ["-tf", tarballPath], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((file) => file.replace(/^package\//, ""));
  const forbiddenFiles = files.filter((file) =>
    forbiddenPatterns.some((pattern) => file.includes(pattern)),
  );

  if (forbiddenFiles.length > 0) {
    throw new Error(
      `${packageDir} includes unexpected files:\n${forbiddenFiles.join("\n")}`,
    );
  }

  const manifest = execFileSync("tar", [
    "-xOf",
    tarballPath,
    "package/package.json",
  ], {
    encoding: "utf8",
  });

  if (manifest.includes("workspace:")) {
    throw new Error(`${packageDir} packed a workspace: dependency`);
  }

  const requiredFiles = sourceOnlyPackages.has(packageDir)
    ? ["package.json", "index.ts"]
    : packageDir === "packages/cli"
      ? [
          "package.json",
          "README.md",
          "LICENSE",
          "dist/bin/cli.js",
          "dist/server/production.js",
        ]
      : [
          "package.json",
          "README.md",
          "LICENSE",
          "dist/index.js",
        ];

  for (const requiredFile of requiredFiles) {
    if (!files.includes(requiredFile)) {
      throw new Error(`${packageDir} is missing ${requiredFile}`);
    }
  }

  if (
    packageDir !== "packages/cli" &&
    !sourceOnlyPackages.has(packageDir) &&
    !files.includes("dist/index.d.ts")
  ) {
    throw new Error(`${packageDir} is missing dist/index.d.ts`);
  }

  if (packageDir === "packages/embedded-core" || packageDir === "packages/cli") {
    const hasClientAssets = files.some((file) => file.startsWith("dist/client/"));

    if (!hasClientAssets) {
      throw new Error(`${packageDir} is missing dist/client assets`);
    }
  }

  rmSync(tarballPath);
}
