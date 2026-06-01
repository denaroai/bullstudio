import { useState } from 'react';
import { Terminal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Container, SectionHeading } from './section';
import { CommandBlock } from './copy';
import { CodeBlock } from './code';

type Framework = {
  key: string;
  label: string;
  install: string;
  filename?: string;
  code?: string;
  note?: string;
  docker?: string;
};

const FRAMEWORKS: Framework[] = [
  {
    key: 'standalone',
    label: 'Standalone',
    install: 'npx bullstudio -r redis://localhost:6379',
    docker:
      'docker run -p 4000:4000 emirce/bullstudio -r redis://host.docker.internal:6379',
    note: 'No code. Point it at Redis and Bullstudio discovers your queues — it auto-detects whether they are Bull or BullMQ. The dashboard opens at localhost:4000.',
  },
  {
    key: 'hono',
    label: 'Hono',
    install: 'pnpm add @bullstudio/hono @bullstudio/bullmq-adapter',
    filename: 'server.ts',
    code: `import { createBullMqQueueAdapter } from '@bullstudio/bullmq-adapter';
import { bullstudio } from '@bullstudio/hono';
import { Queue } from 'bullmq';

const emailQueue = new Queue('email', { connection });

const dashboard = bullstudio({
  queues: [
    createBullMqQueueAdapter(emailQueue, { key: 'email', label: 'Email' }),
  ],
  readOnly: true,
});

app.route('/ops/bullstudio', dashboard);`,
  },
  {
    key: 'express',
    label: 'Express',
    install: 'pnpm add @bullstudio/express @bullstudio/bullmq-adapter',
    filename: 'server.ts',
    code: `import { createBullMqQueueAdapter } from '@bullstudio/bullmq-adapter';
import { bullstudio } from '@bullstudio/express';

app.use(
  '/ops/bullstudio',
  bullstudio({
    queues: [
      createBullMqQueueAdapter(emailQueue, { key: 'email', label: 'Email' }),
    ],
    readOnly: true,
  }),
);`,
  },
  {
    key: 'fastify',
    label: 'Fastify',
    install: 'pnpm add @bullstudio/fastify @bullstudio/bullmq-adapter',
    filename: 'server.ts',
    code: `import { createBullMqQueueAdapter } from '@bullstudio/bullmq-adapter';
import { bullstudio } from '@bullstudio/fastify';

await app.register(
  bullstudio({
    queues: [
      createBullMqQueueAdapter(emailQueue, { key: 'email', label: 'Email' }),
    ],
  }),
  { prefix: '/ops/bullstudio' },
);`,
  },
  {
    key: 'next',
    label: 'Next.js',
    install: 'pnpm add @bullstudio/next @bullstudio/bullmq-adapter',
    filename: 'app/ops/bullstudio/[[...bullstudio]]/route.ts',
    code: `import { createBullMqQueueAdapter } from '@bullstudio/bullmq-adapter';
import { bullstudio } from '@bullstudio/next';
import { emailQueue } from '@/lib/queue';

export const { GET, HEAD, POST } = bullstudio({
  mountPath: '/ops/bullstudio',
  queues: [
    createBullMqQueueAdapter(emailQueue, { key: 'email', label: 'Email' }),
  ],
});`,
  },
  {
    key: 'nestjs',
    label: 'NestJS',
    install: 'pnpm add @bullstudio/nestjs @bullstudio/bullmq-adapter',
    filename: 'app.module.ts',
    code: `import { createBullMqQueueAdapter } from '@bullstudio/bullmq-adapter';
import { BullstudioModule } from '@bullstudio/nestjs';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    BullstudioModule.forRoot({
      mountPath: '/ops/bullstudio',
      queues: [
        createBullMqQueueAdapter(emailQueue, { key: 'email', label: 'Email' }),
      ],
      readOnly: true,
    }),
  ],
})
export class AppModule {}`,
  },
];

export function Frameworks() {
  const [active, setActive] = useState('standalone');
  const fw = FRAMEWORKS.find((f) => f.key === active) ?? FRAMEWORKS[0];

  if (!fw) return null;

  return (
    <section className="border-b border-border py-24">
      <Container>
        <SectionHeading
          title="Embed it in the stack you already run."
          description="Bullstudio ships native adapters for the major Node frameworks. Pick yours — the snippet is copy-and-run."
        />

        <div className="mt-12 overflow-hidden border border-border bg-card">
          {/* framework tabs */}
          <div
            role="tablist"
            aria-label="Framework"
            className="flex flex-wrap border-b border-border bg-muted/30"
          >
            {FRAMEWORKS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={f.key === active}
                type="button"
                onClick={() => setActive(f.key)}
                className={cn(
                  'border-r border-border px-5 py-3 text-sm font-medium transition-colors',
                  f.key === active
                    ? 'bs-tab-active bg-card text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  1 · Install
                </span>
                <CommandBlock command={fw.install} />
              </div>

              {fw.docker ? (
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Or with Docker
                  </span>
                  <CommandBlock command={fw.docker} />
                </div>
              ) : null}

              {fw.note ? (
                <p className="flex items-start gap-2.5 border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
                  <Terminal className="mt-0.5 size-4 shrink-0 text-primary" />
                  {fw.note}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              {fw.code ? (
                <>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    2 · Mount it
                  </span>
                  <CodeBlock code={fw.code} filename={fw.filename} />
                </>
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 border border-dashed border-border bg-background p-6 text-center">
                  <Terminal className="size-7 text-primary" />
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Nothing to wire up. The standalone CLI is the whole
                    integration.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
