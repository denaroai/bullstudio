import {
  CalendarClock,
  Cpu,
  Gauge,
  Layers,
  ListTodo,
  Workflow,
} from "lucide-react";
import type { ComponentType } from "react";
import { ImageText } from "./image-text";
import { Container, SectionHeading } from "./section";

const FEATURES = [
  {
    key: "overview",
    eyebrow: "Queue overview",
    title: "Read the whole system at a glance.",
    description:
      "Throughput, failure rate, processing time and backlog across every queue — so you spot trouble before someone files a ticket.",
    imageAlt: "Bullstudio queue overview dashboard",
    imageSrc: "/demo/bullstudio-overview-demo",
  },
  {
    key: "jobs",
    eyebrow: "Jobs explorer",
    title: "Drill into any job in one click.",
    description:
      "Filter by state, search by name or id, and open any job to read its data, logs, return value and stack trace. Retry or remove in one click.",
    imageAlt: "Bullstudio jobs explorer",
    imageSrc: "/demo/bullstudio-jobs-demo",
  },
  {
    key: "flows",
    eyebrow: "Flow graph",
    title: "Trace exactly where a flow stalled.",
    description:
      "Visualise BullMQ parent/child flows as a live dependency graph, color-coded by state, so you can trace exactly where a flow stalled.",
    imageAlt: "Bullstudio flow dependency graph",
    imageSrc: "/demo/bullstudio-flows-demo",
  },
] as const;

type Surface = {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const SURFACES: Surface[] = [
  {
    Icon: ListTodo,
    title: "Jobs",
    description:
      "Browse every job by state, search by name or id, and open one to inspect its payload, logs, return value and stack trace. Retry, promote or remove without a Redis CLI.",
  },
  {
    Icon: Cpu,
    title: "Workers",
    description:
      "See every connected worker live — what it's processing right now, its concurrency and last heartbeat — so you know whether work is moving or stuck.",
  },
  {
    Icon: CalendarClock,
    title: "Schedulers",
    description:
      "Read every repeatable and cron-scheduled job in one place, with the pattern and next run time spelled out. Add or remove a schedule on the spot.",
  },
  {
    Icon: Workflow,
    title: "Flows",
    description:
      "Follow BullMQ parent/child flows as a live dependency graph, color-coded by state, so you can trace exactly where a multi-step job stalled.",
  },
  {
    Icon: Layers,
    title: "Queues",
    description:
      "Pause, resume, drain or clean any queue, and watch waiting, active, delayed and failed counts update in real time across the whole connection. Supports multi-prefix setups.",
  },
  {
    Icon: Gauge,
    title: "Metrics",
    description:
      "Throughput, failure rate, processing time and backlog trended over time — the at-a-glance health read that turns guesswork into a number.",
  },
];

export function Features() {
  return (
    <section className="border-b border-border py-24">
      <Container>
        <SectionHeading
          title="Everything you need to read a queue at a glance."
          description="Every surface in Bullstudio is built to answer one question fast: what is happening in this queue right now?"
        />

        <div className="mt-16 flex flex-col gap-20 lg:gap-28">
          {FEATURES.map((f, i) => (
            <ImageText
              key={f.key}
              eyebrow={f.eyebrow}
              title={f.title}
              description={f.description}
              imageAlt={f.imageAlt} // alternate: even rows show text first, odd rows show image first
              imageSrc={f.imageSrc}
              layout={i % 2 === 0 ? "text" : "image"}
            />
          ))}
        </div>

        {/* every surface, at a glance — the detailed feature card grid */}
        <div className="mt-24 lg:mt-32">
          <SectionHeading
            title="A dedicated view for every part of the queue."
            description="Jobs, workers, schedulers, flows — each gets a purpose-built screen instead of a wall of raw Redis keys."
          />

          <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {SURFACES.map((s) => (
              <article
                key={s.title}
                className="flex flex-col gap-4 bg-card p-7"
              >
                <span className="flex size-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                  <s.Icon className="size-5" />
                </span>
                <h3 className="text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
