---
"bullstudio": patch
---

Fix the queue page so its content can scroll horizontally. The page-level scroll area only mounted a vertical scrollbar, which locked `overflow-x` to hidden and could clip the expanded job detail view on narrower screens.
