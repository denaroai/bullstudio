# Introduction
Bullstudio is a modern Bull/BullMQ dashboard.

## General guidelines
- This repo will outlive you, try to leave it better than you found it.
- If something is unclear, stop. Name what's confusing. Ask.
- Keep it simple. Write minimal code that solves the problem.
- No abstractions for single code use. If you find repeating code, abstract it into a reusable component.
- For context and domain specific lanugage refer to CONTEXT.md

## Important commands

- `pnpm install` - install workspace dependencies.
- `pnpm dev` - run all workspace dev tasks through Turbo.
- `pnpm --filter @bullstudio/frontend dev` - run the dashboard frontend locally with Vite.
- `pnpm build` - build the workspace through Turbo.
- `pnpm lint` - run workspace lint tasks.
- `pnpm typecheck` - run TypeScript checks across the workspace.
- `pnpm test` - run the configured test suite for `@bullstudio/queue`, `@bullstudio/frontend`, and `@bullstudio/standalone`.
- `pnpm format` - format the repository with Biome.
- `pnpm check` - run Biome lint checks from the repository root.
