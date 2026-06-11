import { ImageText } from "./image-text";
import { Container, SectionHeading } from "./section";

const FEATURES = [
  {
    key: "overview",
    eyebrow: "Queue overview",
    title: "Read the whole system at a glance.",
    description:
      "Throughput, failure rate, processing time and backlog across every queue — so you spot trouble before someone files a ticket.",
    // imageSrc: "/screenshots/overview.png",
    imageAlt: "Bullstudio queue overview dashboard",
  },
  {
    key: "jobs",
    eyebrow: "Jobs explorer",
    title: "Drill into any job in one click.",
    description:
      "Filter by state, search by name or id, and open any job to read its data, logs, return value and stack trace. Retry or remove in one click.",
    // imageSrc: "/screenshots/jobs.png",
    imageAlt: "Bullstudio jobs explorer",
  },
  {
    key: "flows",
    eyebrow: "Flow graph",
    title: "Trace exactly where a flow stalled.",
    description:
      "Visualise BullMQ parent/child flows as a live dependency graph, color-coded by state, so you can trace exactly where a flow stalled.",
    // imageSrc: "/screenshots/flows.png",
    imageAlt: "Bullstudio flow dependency graph",
    imageSrc: "/flows-demo.png"
  },
] as const;

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
              imageAlt={f.imageAlt}
              imageSrc={f.imageSrc}
              // alternate: even rows show text first, odd rows show image first
              layout={i % 2 === 0 ? "text" : "image"}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
