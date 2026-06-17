import { usePostHog } from "@posthog/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { gitConfig } from "@/lib/shared";
import { BrowserFrame } from "./browser-frame";
import { CommandBlock } from "./copy";
import { GithubGlyph } from "./dashboard-preview";
import { ImagePlaceholder } from "./image-text";
import { Container } from "./section";

// Base path of the hero screenshot (no theme suffix / extension). BrowserFrame
// loads the matching `-light.png` / `-dark.png` for the active theme.
const HERO_SCREENSHOT: string | undefined = "/demo/bullstudio-dashboard-demo";

export function Hero() {
  const posthog = usePostHog();

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* atmosphere: engineered grid + a single terracotta glow */}
      <div aria-hidden className="bs-grid absolute inset-0 opacity-[0.4]" />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 28%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background"
      />

      {/* the charging bull — a faint terracotta watermark emerging from the
       * right edge, masked so its body dissolves into the hero. */}
      <img
        src="/bull-silhouette.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-[-5%] top-16 hidden w-[34rem] select-none opacity-[0.12] md:block lg:top-10 lg:w-[44rem]"
        style={{
          WebkitMaskImage:
            "linear-gradient(to left, #000 30%, transparent 90%)",
          maskImage: "linear-gradient(to left, #000 30%, transparent 90%)",
        }}
      />

      <Container className="relative pb-20 pt-20 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <h1
            className="bs-rise mt-7 max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl"
            style={{ animationDelay: "70ms" }}
          >
            See everything your queues are{" "}
            <span className="text-primary">actually</span> doing.
          </h1>

          <p
            className="bs-rise mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "140ms" }}
          >
            A modern, performant dashboard for Bull and BullMQ. Inspect and
            manage queues, jobs and flows directly from your app. Proudly
            open-source.
          </p>

          <div
            className="bs-rise mt-9 w-full max-w-md"
            style={{ animationDelay: "210ms" }}
          >
            <CommandBlock
              command="npx bullstudio -r redis://localhost:6379"
              onCopied={() =>
                posthog?.capture("install_command_copied", {
                  command: "npx bullstudio -r redis://localhost:6379",
                  location: "hero",
                })
              }
            />
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                to="/docs"
                onClick={() => posthog?.capture("docs_cta_clicked", { location: "hero" })}
                className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Read the docs
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => posthog?.capture("github_star_clicked", { location: "hero" })}
                className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60"
              >
                <GithubGlyph className="size-4" />
                Star on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* product shot */}
        <div
          className="bs-rise mt-16 [perspective:2000px]"
          style={{ animationDelay: "320ms" }}
        >
          {HERO_SCREENSHOT ? (
            <BrowserFrame
              src={HERO_SCREENSHOT}
              alt="The Bullstudio dashboard"
            />
          ) : (
            <ImagePlaceholder className="aspect-[16/9] shadow-xl" />
          )}
        </div>
      </Container>
    </section>
  );
}
