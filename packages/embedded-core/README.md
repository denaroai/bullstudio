# @bullstudio/embedded-core

Shared embedded-mode runtime for Bullstudio framework adapters.

This package owns the framework-neutral dashboard instance, private dashboard API
mount, dashboard protection, and packaged dashboard assets used by
`@bullstudio/express`, `@bullstudio/fastify`, `@bullstudio/hono`, and
`@bullstudio/next`.

Most applications should install a framework adapter instead of importing this
package directly.

## Install

```bash
pnpm add @bullstudio/embedded-core
```

## Asset Resolution

Published packages include Bullstudio dashboard assets in `dist/client`.
Advanced deployments can override the asset directory with
`BULLSTUDIO_CLIENT_DIR` when serving a custom-built dashboard bundle.
