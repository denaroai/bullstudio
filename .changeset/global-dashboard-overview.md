---
"bullstudio": minor
---

Add a global dashboard overview page that aggregates job state, throughput, and the slowest jobs across every configured queue, with per-queue status cards.

To support this across varied Redis deployments, `REDIS_PREFIX` now also accepts a `*` wildcard for full auto-discovery and glob patterns (e.g. `local:{*}`) that resolve to the concrete prefixes present in Redis, including Redis Cluster hash-tag and multi-segment tenant prefixes. Discovered prefixes are re-evaluated on every Redis connect/reconnect so the dashboard picks up new queues without a restart.
