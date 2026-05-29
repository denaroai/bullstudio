# Bullstudio

Bullstudio is a dashboard for inspecting and managing Bull and BullMQ queues.

## Language

**Standalone mode**:
Bullstudio runs as its own process and connects directly to Redis to discover and manage queues.
_Avoid_: CLI mode, Redis mode

**Embedded mode**:
Bullstudio is mounted inside a host application and works with queues supplied by that application.
_Avoid_: Hosted mode, integrated mode

**Dashboard instance**:
The configured Bullstudio runtime created by user code in embedded mode.
_Avoid_: Server handler, middleware instance

**Dashboard factory**:
The `bullstudio()` function exported by framework adapter packages to create the native mountable dashboard value for that framework.
_Avoid_: createBullstudio, setupBullstudio

**Dashboard identity**:
The configured title and logo that identify a dashboard instance to users.
_Avoid_: Branding, theme

**Document identity**:
The configured browser-level identity for a dashboard instance, such as favicon and document title.
_Avoid_: Metadata, head tags

**Queue adapter**:
A per-queue value created from a Bull or BullMQ queue instance that exposes that queue to a dashboard instance.
_Avoid_: Raw queue, queue provider

**Adapter capabilities**:
The features and operations a queue adapter exposes for its supplied queue.
_Avoid_: Feature flags, supported methods

**Capability enforcement**:
The server-side rejection of queue operations that a supplied queue's adapter capabilities do not support.
_Avoid_: UI-only capability checks, disabled buttons

**Aggregate capabilities**:
The union of capabilities across all supplied queues, used to decide whether a dashboard-level screen or navigation item is relevant.
_Avoid_: Per-queue permissions, selected queue capabilities

**Per-queue capabilities**:
The capabilities of a specific supplied queue, used to decide whether an operation can run against that queue.
_Avoid_: Global capabilities, dashboard capabilities

**Supplied queue**:
A queue made visible to Bullstudio because the host application passed a queue adapter for it.
_Avoid_: Discovered queue, registered queue

**Host-owned queue**:
A supplied queue whose lifecycle and connection are owned by the host application, not Bullstudio.
_Avoid_: Managed queue, dashboard-owned queue

**Queue key**:
Bullstudio's unique identifier for a supplied queue. Queue keys are inferred by default and supplied explicitly only when inference would be ambiguous or collide.
_Avoid_: Queue id, slug

**Queue name and prefix**:
The Redis/Bull identity shape used by standalone mode and accepted by embedded mode only as a private API compatibility lookup for supplied queues.
_Avoid_: Embedded queue identity, queue key

**Supplied queue prefix**:
A prefix reported by a supplied queue's metadata, not a prefix discovered by scanning Redis.
_Avoid_: Discovered prefix, Redis prefix scan

**Queue label**:
The human-facing display name for a supplied queue in the dashboard.
_Avoid_: Queue title, display name

**Read-only dashboard**:
A dashboard instance that exposes queue and job information while blocking operations that change queues or jobs.
_Avoid_: Observer mode, viewer mode

**Dashboard protection**:
Bullstudio-owned access control that protects a dashboard instance from unauthenticated access.
_Avoid_: Host auth, app auth

**Basic Auth protection**:
Dashboard protection based on an HTTP Basic Auth username and password.
_Avoid_: Password mode, built-in auth

**Framework adapter**:
A package that mounts a dashboard instance into a specific host framework such as Hono, Express, Fastify, or Next.js.
_Avoid_: Server adapter, web adapter

**Mount path**:
The single URL path where a dashboard instance is exposed inside a host application, including its UI and API.
_Avoid_: API path, UI path

**Dashboard assets**:
The built Bullstudio frontend files served by a dashboard instance.
_Avoid_: Static files, client bundle

**Private dashboard API**:
The internal HTTP API used by Bullstudio's dashboard assets to communicate with a dashboard instance.
_Avoid_: Public API, integration API

**Private job source key**:
An optional private dashboard API field that identifies the supplied queue a job came from when an aggregated embedded-mode job list would otherwise be ambiguous.
_Avoid_: Public job field, connect-types job property

**Embedded core**:
The shared Bullstudio package that defines dashboard instances and the common embedded-mode behavior used by framework adapters.
_Avoid_: Shared server, common middleware

**Queue source**:
The origin of the queues visible to a dashboard instance: supplied queues in embedded mode or discovered queues in standalone mode.
_Avoid_: Backend, connector

**Queue source status**:
The dashboard's summary of the queue source it is using, such as supplied queue count, adapter types, capabilities, and source health.
_Avoid_: Redis connection info, connection page

**Queue management parity**:
Embedded mode offering the same operator-facing inspection and mutation capabilities as standalone mode for supplied queues, without adopting standalone Redis connection or queue discovery behavior.
_Avoid_: API parity, Redis parity, discovery parity

## Example Dialogue

Developer: "I want to use Bullstudio in production without running another service."

Maintainer: "Use embedded mode: create a dashboard instance, mount it in your existing application, and provide queue adapters for the queues the dashboard should manage."

Developer: "Which function creates the embedded dashboard?"

Maintainer: "Use the dashboard factory exported by your framework adapter package."

Developer: "Can the embedded dashboard show which product or environment it belongs to?"

Maintainer: "Yes. Configure the dashboard identity with a title and logo."

Developer: "Can the browser tab use my app's favicon?"

Maintainer: "Yes. Configure the document identity for browser-level details."

Developer: "Will embedded mode show every queue in my Redis instance?"

Maintainer: "No. Embedded mode only shows supplied queues; standalone mode is the mode that discovers queues from Redis."

Developer: "Will Bullstudio close my queues when the dashboard shuts down?"

Maintainer: "No. Supplied queues are host-owned queues; the host application owns their lifecycle."

Developer: "Why does one supplied queue show flows while another does not?"

Maintainer: "The dashboard follows each queue adapter's capabilities."

Developer: "Is hiding an unsupported action in the UI enough?"

Maintainer: "No. Capability enforcement happens server-side so private dashboard API calls cannot perform unsupported operations."

Developer: "Why does the Flows page show when only one supplied queue supports flows?"

Maintainer: "Navigation follows aggregate capabilities, while actions against a selected queue follow that queue's per-queue capabilities."

Developer: "Do I need to name every supplied queue twice?"

Maintainer: "No. Bullstudio infers a queue key and queue label unless you need to disambiguate queues."

Developer: "Can embedded mode target jobs by queue name and prefix?"

Maintainer: "Only as a compatibility lookup. Embedded mode's canonical queue identity is the queue key because multiple supplied queues may share the same queue name and prefix."

Developer: "Can embedded mode show prefixes?"

Maintainer: "Only supplied queue prefixes. Embedded mode must not discover prefixes from Redis."

Developer: "Can I mount Bullstudio in production without allowing people to retry or remove jobs?"

Maintainer: "Yes. Configure a read-only dashboard when you want visibility without mutating operations."

Developer: "Does embedded mode rely on my app to protect the dashboard?"

Maintainer: "No. Bullstudio provides dashboard protection out of the box, and the host application can add its own access control around the mount path."

Developer: "What protection does Bullstudio provide by default?"

Maintainer: "Use Basic Auth protection when you want Bullstudio to protect the dashboard with a username and password."

Developer: "How do I mount Bullstudio into my existing server?"

Maintainer: "Use the framework adapter for your host framework."

Developer: "Do I need separate paths for the dashboard UI and API?"

Maintainer: "No. A dashboard instance uses one mount path for both."

Developer: "Do I need to copy frontend files into my app?"

Maintainer: "No. The dashboard instance serves Bullstudio's dashboard assets from the mount path."

Developer: "Can other tools rely on the dashboard HTTP API?"

Maintainer: "No. The private dashboard API exists for Bullstudio's own dashboard assets."

Developer: "Why does an embedded job list response include a queue source key?"

Maintainer: "That private job source key lets dashboard assets navigate from aggregated job lists back to the correct supplied queue when queue name and prefix are ambiguous."

Developer: "Do all framework adapters implement Bullstudio behavior themselves?"

Maintainer: "No. Framework adapters mount the embedded core into each host framework."

Developer: "Why do standalone mode and embedded mode show different queues?"

Maintainer: "They use different queue sources: standalone mode discovers queues from Redis, while embedded mode uses supplied queues."

Developer: "What should embedded mode show instead of Redis connection details?"

Maintainer: "Embedded mode shows queue source status because Bullstudio does not own the host application's Redis connections."

Developer: "What if I just want to point it at Redis from my laptop?"

Maintainer: "Use standalone mode: run Bullstudio as its own process and let it discover queues from Redis."

Developer: "Should embedded mode have the same queue management features as standalone mode?"

Maintainer: "Yes, embedded mode should provide queue management parity for supplied queues, while Redis connection details and queue discovery remain standalone-mode concerns."
