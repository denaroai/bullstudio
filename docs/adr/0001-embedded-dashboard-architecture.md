# Embedded dashboard architecture

Bullstudio will support embedded mode through a shared embedded core, with separate framework adapter packages for Hono, Express, Fastify, and Next.js, and separate queue adapter packages for BullMQ and Bull. The framework adapters expose native `bullstudio()` factories, queue adapters use the host application's Bull or BullMQ peer dependency, and the existing tRPC dashboard API remains private for v1 so standalone mode and embedded mode can share one dashboard runtime without prematurely committing to a public HTTP API.
