# bullstudio

## 2.0.0

### Major Changes

- Bullstudio 2.0 introduces embedded mode alongside the existing standalone dashboard, and moves every published Bullstudio package onto a single, lockstep version.

  The standalone dashboard adds scheduler management for repeatable/scheduled jobs, a worker overview screen, flow tree and delay details in job detail, native queue metrics (throughput rendered as a line plot), prefix-qualified queue routing with per-prefix navigation (plus queue items and a drain action in the sidebar), configurable polling via operator config and a settings dialog, optional session-based authentication (`--username` / `--password`, `BULLSTUDIO_USERNAME`), and more graceful handling of Redis connection losses.

  The `npx bullstudio` standalone workflow is unchanged.

## 1.5.0

### Minor Changes

- b37f179: Streamline CLI npm publishing and Docker image publishing through the shared release workflow.
