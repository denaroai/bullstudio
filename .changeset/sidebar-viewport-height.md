---
"bullstudio": patch
---

Fix the dashboard sidebar so the queue list scrolls internally instead of the whole page. The sidebar is now pinned to the viewport height, so it fills the height when there are few queues (footer stays at the bottom) and keeps the header/footer fixed while the queue list scrolls when there are many.
