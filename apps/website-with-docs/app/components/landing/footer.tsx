import { usePostHog } from "@posthog/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { gitConfig } from "@/lib/shared";
import { CommandBlock } from "./copy";
import { GithubGlyph } from "./dashboard-preview";
import { Logo } from "./logo";
import { Container } from "./section";

const repo = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export function FinalCta() {
  const posthog = usePostHog();

  return (
    <section className="relative overflow-hidden border-b border-border py-24">
      <div aria-hidden className="bs-grid absolute inset-0 opacity-[0.35]" />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-72 w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 24%, transparent), transparent)",
        }}
      />
      <Container className="relative flex flex-col items-center text-center">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Stop guessing what your queues are doing.
        </h2>
        <p className="mt-4 max-w-lg text-base text-muted-foreground">
          One command to a running dashboard. No account, no telemetry, no
          second service.
        </p>
        <div className="mt-8 w-full max-w-md">
          <CommandBlock
            command="npx bullstudio -r redis://localhost:6379"
            onCopied={() =>
              posthog?.capture("install_command_copied", {
                command: "npx bullstudio -r redis://localhost:6379",
                location: "final_cta",
              })
            }
          />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Link
            to="/docs"
            onClick={() => posthog?.capture("docs_cta_clicked", { location: "final_cta" })}
            className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Read the docs
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

export function Footer() {
  const posthog = usePostHog();

  return (
    <footer className="bg-background">
      <Container className="flex flex-col gap-8 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            An open-source queue management dashboard for Bull &amp; BullMQ.
          </p>
        </div>

        <nav className="flex flex-col gap-6 sm:flex-row sm:gap-12">
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Product
            </span>
            <Link
              to="/docs"
              className="text-sm text-foreground hover:text-primary"
            >
              Documentation
            </Link>
            <Link
              to="/enterprise"
              className="text-sm text-foreground hover:text-primary"
            >
              Enterprise
            </Link>
            <a
              href="https://www.npmjs.com/package/bullstudio"
              target="_blank"
              rel="noreferrer"
              onClick={() => posthog?.capture("footer_external_link_clicked", { destination: "npm" })}
              className="text-sm text-foreground hover:text-primary"
            >
              npm
            </a>
            <a
              href="https://hub.docker.com/r/emirce/bullstudio"
              target="_blank"
              rel="noreferrer"
              onClick={() => posthog?.capture("footer_external_link_clicked", { destination: "docker_hub" })}
              className="text-sm text-foreground hover:text-primary"
            >
              Docker Hub
            </a>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Source
            </span>
            <a
              href={repo}
              target="_blank"
              rel="noreferrer"
              onClick={() => posthog?.capture("footer_external_link_clicked", { destination: "github" })}
              className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary"
            >
              <GithubGlyph className="size-4" />
              GitHub
            </a>
            <a
              href={`${repo}/issues`}
              target="_blank"
              rel="noreferrer"
              onClick={() => posthog?.capture("footer_external_link_clicked", { destination: "github_issues" })}
              className="text-sm text-foreground hover:text-primary"
            >
              Issues
            </a>
          </div>
        </nav>
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono">
            © {new Date().getFullYear()} Bullstudio · MIT License
          </span>
          <span className="font-mono">
            Built for the terminal-and-editor crowd.
          </span>
        </Container>
      </div>
    </footer>
  );
}
