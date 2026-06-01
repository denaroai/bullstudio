import { useState } from 'react';
import { LayoutDashboard, ListTodo, Workflow } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Container, SectionHeading } from './section';
import {
  DashboardFrame,
  FlowsPanel,
  JobsPanel,
  OverviewPanel,
} from './dashboard-preview';

const FEATURES = [
  {
    key: 'overview' as const,
    Icon: LayoutDashboard,
    title: 'Queue overview',
    blurb:
      'Throughput, failure rate, processing time and backlog across every queue — so you spot trouble before someone files a ticket.',
    Panel: OverviewPanel,
  },
  {
    key: 'jobs' as const,
    Icon: ListTodo,
    title: 'Jobs explorer',
    blurb:
      'Filter by state, search by name or id, and open any job to read its data, logs, return value and stack trace. Retry or remove in one click.',
    Panel: JobsPanel,
  },
  {
    key: 'flows' as const,
    Icon: Workflow,
    title: 'Flow graph',
    blurb:
      'Visualise BullMQ parent/child flows as a live dependency graph, color-coded by state, so you can trace exactly where a flow stalled.',
    Panel: FlowsPanel,
  },
];

export function Features() {
  const [active, setActive] = useState<(typeof FEATURES)[number]['key']>(
    'overview',
  );
  const current = FEATURES.find((f) => f.key === active)!;
  const Panel = current.Panel;

  return (
    <section className="border-b border-border py-24">
      <Container>
        <SectionHeading
          title="Everything you need to read a queue at a glance."
          description="Pick a surface — the preview is the real thing, built from the same components that ship in the product."
        />

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {/* selectable feature list */}
          <div className="flex flex-col">
            {FEATURES.map((f) => {
              const selected = f.key === active;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActive(f.key)}
                  aria-pressed={selected}
                  className={cn(
                    'group flex gap-4 border-l-2 px-5 py-5 text-left transition-colors',
                    selected
                      ? 'border-l-primary bg-card'
                      : 'border-l-border hover:bg-card/50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-9 shrink-0 items-center justify-center border transition-colors',
                      selected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    <f.Icon className="size-[18px]" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span
                      className={cn(
                        'text-base font-semibold',
                        selected ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {f.title}
                    </span>
                    <span
                      className={cn(
                        'text-sm leading-relaxed',
                        selected
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/0 group-hover:text-muted-foreground/70',
                        // keep blurb visible on small screens where there is no hover
                        'max-lg:text-muted-foreground/80',
                      )}
                    >
                      {f.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* live preview */}
          <div className="lg:sticky lg:top-24">
            <DashboardFrame active={active}>
              <Panel />
            </DashboardFrame>
          </div>
        </div>
      </Container>
    </section>
  );
}
