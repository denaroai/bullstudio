import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import { bullstudio } from "@bullstudio/next";
import { emailQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, HEAD, POST } = bullstudio({
  mountPath: "/ops/bullstudio",
  queues: [
    createBullMqQueueAdapter(emailQueue, {
      key: "email",
      label: "Email",
    }),
  ],
  protection: {
    type: "basic",
    username: process.env.BULLSTUDIO_USERNAME ?? "operator",
    password: process.env.BULLSTUDIO_PASSWORD ?? "change-me",
  },
  dashboardIdentity: {
    title: "Example Queues",
    logo: {
      src: "/assets/queue-logo.svg",
      alt: "Example queue operations",
    },
  },
  documentIdentity: {
    title: "Bullstudio Embedded",
    favicon: "/assets/queue-logo.svg",
  },
  // Poll Redis every 5s instead of the 2s default to ease load on
  // pay-per-command Redis. Operators can change this from the sidebar.
  polling: {
    interval: 5000,
  },
});
