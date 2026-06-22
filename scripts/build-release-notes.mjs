import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".changeset",
  "dist",
  "build",
]);

const SECTION_TYPES = {
  "Major Changes": "major",
  "Minor Changes": "minor",
  "Patch Changes": "patch",
};

function findChangelogs(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      findChangelogs(fullPath, results);
    } else if (entry === "CHANGELOG.md") {
      results.push(fullPath);
    }
  }
  return results;
}

function isDependencyBoilerplate(block) {
  return /^- Updated dependencies\b/.test(block) || /^- @bullstudio\//.test(block);
}

function collectEntries(version, changelogPaths) {
  const entries = { major: new Set(), minor: new Set(), patch: new Set() };

  for (const path of changelogPaths) {
    const lines = readFileSync(path, "utf8").split("\n");
    const start = lines.findIndex((line) => line.trim() === `## ${version}`);
    if (start === -1) continue;

    let currentType = null;
    let buffer = [];

    const flush = () => {
      if (currentType && buffer.length) {
        const block = buffer.join("\n").trim();
        if (block && !isDependencyBoilerplate(block)) {
          entries[currentType].add(block);
        }
      }
      buffer = [];
    };

    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^## /.test(line)) break;

      const heading = line.match(/^### (.+)/);
      if (heading) {
        flush();
        currentType = SECTION_TYPES[heading[1].trim()] ?? null;
        continue;
      }

      if (!currentType) continue;

      if (/^- /.test(line)) {
        flush();
        buffer.push(line);
      } else if (buffer.length) {
        buffer.push(line);
      }
    }
    flush();
  }

  return entries;
}

function renderNotes(entries) {
  const sections = [
    ["major", "Major Changes"],
    ["minor", "Minor Changes"],
    ["patch", "Patch Changes"],
  ];

  const rendered = sections
    .filter(([key]) => entries[key].size > 0)
    .map(([key, title]) => `### ${title}\n\n${[...entries[key]].join("\n\n")}`);

  return rendered.join("\n\n");
}

const version = process.argv[2];
if (!version) {
  console.error("Usage: build-release-notes.mjs <version>");
  process.exit(1);
}

const changelogPaths = findChangelogs(process.cwd());
const entries = collectEntries(version, changelogPaths);
const notes = renderNotes(entries);

process.stdout.write(notes ? `${notes}\n` : "Maintenance release.\n");
