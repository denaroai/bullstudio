import { Link } from 'react-router';
import { ArrowRight, Server, Boxes } from 'lucide-react';
import { Container, SectionHeading } from './section';

const MODES = [
  {
    Icon: Server,
    name: 'Standalone',
    tagline: 'Point it at Redis.',
    body: 'Run Bullstudio as its own process — from your laptop or a container — and let it discover every queue on the connection. No code, no integration.',
    points: ['Zero code integration', 'Auto-detects Bull or BullMQ', 'npx or Docker'],
    snippet: 'npx bullstudio -r redis://localhost:6379',
  },
  {
    Icon: Boxes,
    name: 'Embedded',
    tagline: 'Mount it where your app lives.',
    body: 'Mount a dashboard instance inside your existing Hono, Express, Fastify or Next.js app. Expose only the queues you supply — optionally read-only and behind Basic Auth.',
    points: [
      'Supply only the queues you choose',
      'Read-only & Basic Auth built in',
      'No second service to operate',
    ],
    snippet: "app.route('/ops/bullstudio', dashboard)",
  },
];

export function Modes() {
  return (
    <section className="border-b border-border py-24">
      <Container>
        <SectionHeading
          title="One tool, two adoption paths."
          description="Discover everything on a Redis connection, or mount a scoped dashboard inside the app you already ship to production."
        />

        <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
          {MODES.map((m) => (
            <article
              key={m.name}
              className="flex flex-col gap-5 bg-card p-8"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                  <m.Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {m.name}
                  </h3>
                  <p className="text-sm text-primary">{m.tagline}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {m.body}
              </p>

              <ul className="flex flex-col gap-2">
                {m.points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2.5 text-sm text-foreground"
                  >
                    <span className="size-1.5 shrink-0 bg-primary" />
                    {p}
                  </li>
                ))}
              </ul>

              <div className="mt-auto border border-border bg-background px-3.5 py-2.5 font-mono text-[12.5px] text-muted-foreground">
                <span className="text-primary">$</span> {m.snippet}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Compare standalone &amp; embedded in the docs
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
