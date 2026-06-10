import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

// SEO "Bullstudio vs X" comparison articles. Authored as MDX in
// content/comparisons and surfaced at /comparisons. Uses the default
// frontmatter schema (title + optional description).
export const comparisons = defineDocs({
  dir: "content/comparisons",
});

export default defineConfig();
