# Product

## Register

brand

## Users

Backend and full-stack developers who run Bull or BullMQ job queues on Redis and
need to see and control what those queues are doing. They arrive from npm, Docker
Hub, GitHub, or a search for "BullMQ dashboard" while in the middle of a real
problem: a stuck job, a backlog, a queue they can't observe in production. Their
context is a terminal and an editor open in the background; they want to know in
under a minute whether Bullstudio fits, how to run it, and whether it's safe to
mount in a production app.

Two distinct adoption paths share the site:
- **Standalone**: point it at Redis from a laptop or a container and discover queues.
- **Embedded**: mount it inside an existing Hono / Express / Fastify / Next.js app
  and expose only supplied queues, optionally read-only and behind Basic Auth.

## Product Purpose

This is the public marketing + documentation site for Bullstudio, an open-source
queue management dashboard for Bull and BullMQ. The site has four jobs, in order
of how a visitor moves through them: **establish credibility** (this is a serious,
production-grade tool), **showcase the product** (show the actual dashboard so
developers see what they get), **convert to install** (npx / Docker / embedded
snippet, copy and run), and **teach via docs** (search, framework adapters,
embedded vs standalone, configuration). Success is a developer going from landing
to a running dashboard, or a confident `pnpm add`, without leaving the site to
figure out the next step.

## Brand Personality

Developer-friendly, direct, value-driven. The voice talks to engineers as peers:
it states plainly what the tool does and why it helps, leads with the value to the
person reading (less time blind to your queues, no second service to run), and
skips marketing hedging. Approachable but not soft. The visual identity is the
inherited Bullstudio dashboard look: industrial and engineered. Oxanium (a squared,
technical display sans), zero border-radius, a terracotta-orange primary, cool-gray
neutrals, restrained shadows. The site should feel like it was built by the same
people who built the tool, because it was.

## Anti-references

- **Generic SaaS cream**: soft warm gradients, pastel hero washes, pill-rounded
  cards, the default AI-startup landing look. Bullstudio is sharp-cornered and cool-toned; never round it off or warm it up.
- **Stock Fumadocs default**: the out-of-the-box Inter + neutral-gray docs theme
  the project currently ships. Every surface must carry the Bullstudio identity
  (Oxanium, terracotta, zero radius), not the framework's defaults.
- **Hero-metric template**: big number + tiny label + gradient accent + supporting
  stat row. The SaaS dashboard-marketing cliche. Show the real product instead.
- **Overdesigned / animated**: scroll-jacking, heavy parallax, glassmorphism,
  decorative motion for its own sake. Motion is purposeful and quiet or absent.

## Design Principles

- **Practice what you preach.** A tool for observing systems must itself feel
  precisely engineered. The craft of the site is evidence for the quality of the
  product.
- **Show the product, don't describe it.** Real dashboard screenshots and concrete,
  copyable commands beat adjectives. A developer should see Bullstudio working
  before reading a sentence about it.
- **Value before feature.** Lead with what the developer gets (visibility into
  stuck jobs, no extra service, mount it where your app already lives), then name
  the feature that delivers it.
- **One identity across surfaces.** Landing, docs, and the dashboard itself share
  one visual language. The site is not a separate brand; it's the product's front door.
- **Respect the reader's time.** Fast to scan, fast to copy, fast to load. The
  primary actions (run it, read the docs) are never more than one obvious step away.

## Accessibility & Inclusion

- **Dark mode is first-class**, not an afterthought. Developers default to dark;
  both themes must be fully designed, on-brand, and contrast-correct, not one
  derived carelessly from the other.
- Target WCAG AA as a baseline: body text >=4.5:1, large text >=3:1, visible
  keyboard focus states, semantic landmarks, and accessible names on icon-only
  controls (the GitHub link, theme toggle, search).
- All motion ships with a `prefers-reduced-motion: reduce` fallback.
