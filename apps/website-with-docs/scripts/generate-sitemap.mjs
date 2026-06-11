// Generates public/sitemap.xml at build time so every prerendered page
// (home, /comparisons, and all docs + comparison MDX articles) ships as a
// crawlable URL. Run before `react-router build` — see package.json.
//
// Slug logic mirrors react-router.config.ts exactly by reusing the same
// fumadocs helpers, so sitemap URLs always match the prerendered routes.
import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGetUrl, getSlugs } from "fumadocs-core/source";

const SITE_URL = "https://bullstudio.dev";

const root = fileURLToPath(new URL("..", import.meta.url));
const docsDir = join(root, "content/docs");
const comparisonsDir = join(root, "content/comparisons");
const outFile = join(root, "public/sitemap.xml");

const getDocsUrl = createGetUrl("/docs");
const getComparisonUrl = createGetUrl("/comparisons");

/** Recursively collect every `.mdx` file under a directory, with mtimes. */
async function getMdxFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await getMdxFiles(absolutePath, relativePath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".mdx")) {
      const { mtime } = await stat(absolutePath);
      files.push({ relativePath, lastmod: mtime.toISOString().slice(0, 10) });
    }
  }

  return files;
}

function urlEntry({ loc, lastmod, priority }) {
  const lines = [`    <loc>${SITE_URL}${loc}</loc>`];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (priority) lines.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${lines.join("\n")}\n  </url>`;
}

const docsFiles = await getMdxFiles(docsDir);
const comparisonFiles = await getMdxFiles(comparisonsDir);

// Use the newest content change as the lastmod for the index pages.
const newestLastmod = [...docsFiles, ...comparisonFiles]
  .map((f) => f.lastmod)
  .sort()
  .at(-1);

const urls = [
  { loc: "/", lastmod: newestLastmod, priority: "1.0" },
  { loc: "/comparisons", lastmod: newestLastmod, priority: "0.7" },
  ...docsFiles.map((f) => ({
    loc: getDocsUrl(getSlugs(f.relativePath)),
    lastmod: f.lastmod,
    priority: "0.8",
  })),
  ...comparisonFiles.map((f) => ({
    loc: getComparisonUrl(getSlugs(f.relativePath)),
    lastmod: f.lastmod,
    priority: "0.6",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlEntry).join("\n")}
</urlset>
`;

await writeFile(outFile, xml, "utf8");
console.log(`Wrote ${urls.length} URLs to public/sitemap.xml`);
