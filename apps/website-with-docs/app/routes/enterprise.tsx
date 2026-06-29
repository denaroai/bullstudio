import { HomeLayout } from "fumadocs-ui/layouts/home";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Database,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  Send,
  Settings,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType, FormEvent } from "react";
import { Footer } from "@/components/landing/footer";
import { Container, SectionHeading } from "@/components/landing/section";
import { baseOptions } from "@/lib/layout.shared";

type EnterpriseFeature = {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const ENTERPRISE_FEATURES: EnterpriseFeature[] = [
  {
    Icon: KeyRound,
    title: "Single Sign-On (SSO)",
    description:
      "Plug in your existing identity provider — SAML, OIDC, Okta, Azure AD. One login across every tool, one place to offboard employees.",
  },
  {
    Icon: Database,
    title: "Job ingestion & retention",
    description:
      "Long-term job history ingested into your own data store. Query, audit and replay jobs weeks or months after they ran — not just minutes.",
  },
  {
    Icon: LayoutGrid,
    title: "Workspaces",
    description:
      "Segment queues, connections and dashboards by team or environment. Each workspace gets its own access policy so staging never bleeds into production.",
  },
  {
    Icon: Lock,
    title: "Role-based access control",
    description:
      "Viewer, operator, admin — or any custom role you design. Grant the narrowest permission that gets the job done and audit who changed what.",
  },
  {
    Icon: BarChart3,
    title: "Advanced analytics",
    description:
      "Trend throughput, latency and failure rates over custom windows. Export to your BI stack or query directly — the data is yours.",
  },
  {
    Icon: Bell,
    title: "Advanced alerts",
    description:
      "PagerDuty, Slack, webhooks, or email — fire alerts on any metric threshold, anomaly or queue state. No more discovering outages from a downstream team.",
  },
];

type FormState = "idle" | "loading" | "success" | "error";

export function meta() {
  return [
    { title: "Enterprise — Bullstudio" },
    {
      name: "description",
      content:
        "SSO, workspaces, RBAC, advanced analytics and more. Bullstudio Enterprise is built for teams that need control, compliance and visibility at scale.",
    },
  ];
}

export default function Enterprise() {
  return (
    <HomeLayout {...baseOptions()}>
      <EnterprisePage />
    </HomeLayout>
  );
}

function EnterprisePage() {
  return (
    <>
      <EnterpriseHero />
      <EnterpriseFeaturesSection />
      <ContactFormSection />
      <Footer />
    </>
  );
}

function EnterpriseHero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="bs-grid absolute inset-0 opacity-[0.35]" />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 22%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background"
      />

      <Container className="relative py-24 sm:py-32">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            <Building2 className="size-3.5" />
            Enterprise
          </span>

          <h1 className="bs-rise mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            Queue visibility built for{" "}
            <span className="text-primary">teams</span> that can't afford gaps.
          </h1>

          <p className="bs-rise mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
            Bullstudio Enterprise adds the controls, compliance and depth that
            self-service plans can't provide — SSO, workspaces, RBAC, long-term
            retention and more.
          </p>

          <div className="bs-rise mt-9">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 border border-primary bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get in touch
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

function EnterpriseFeaturesSection() {
  return (
    <section className="border-b border-border py-24">
      <Container>
        <SectionHeading
          title="Everything an enterprise deployment needs."
          description="Built for organisations that operate at scale and need control over who can see and change what."
        />

        <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {ENTERPRISE_FEATURES.map((f) => (
            <article key={f.title} className="flex flex-col gap-4 bg-card p-7">
              <span className="flex size-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                <f.Icon className="size-5" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </article>
          ))}
        </div>

        {/* Custom features — full-width highlighted card */}
        <div className="mt-px overflow-hidden border border-border border-t-0 bg-card">
          <div className="flex flex-col gap-4 p-7 sm:flex-row sm:items-start sm:gap-8">
            <span className="flex size-10 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
              <Settings className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                Custom features
              </h3>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Need something not on this list? Enterprise plans include
                dedicated engineering time to build integrations, custom views
                or workflow automations that fit your stack. Tell us what you
                need and we'll scope it.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ContactFormSection() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("loading");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement)
        .value,
    };

    try {
      const res = await fetch("https://formcarry.com/s/FfDHmfDPS1S", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (res.ok && json.code === 200) {
        setFormState("success");
      } else {
        setErrorMessage(
          json.message ?? "Something went wrong. Please try again.",
        );
        setFormState("error");
      }
    } catch {
      setErrorMessage("Network error. Check your connection and try again.");
      setFormState("error");
    }
  }

  return (
    <section id="contact" className="relative overflow-hidden border-b border-border py-24">
      <div aria-hidden className="bs-grid absolute inset-0 opacity-[0.2]" />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-72 w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 20%, transparent), transparent)",
        }}
      />

      <Container className="relative">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            title="Ready to talk?"
            description="Tell us about your setup and what you need. We'll get back to you within one business day."
          />

          {formState === "success" ? (
            <div className="mt-12 flex flex-col items-center gap-4 border border-border bg-card px-8 py-12 text-center">
              <span className="flex size-12 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                <Send className="size-5" />
              </span>
              <h3 className="text-xl font-semibold text-foreground">
                Message received.
              </h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Thanks for reaching out. We'll be in touch within one business
                day.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-12 flex flex-col gap-6"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="name"
                  className="font-mono text-xs uppercase tracking-[0.15em] text-foreground"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  disabled={formState === "loading"}
                  placeholder="Jane Smith"
                  className="border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="company"
                  className="font-mono text-xs uppercase tracking-[0.15em] text-foreground"
                >
                  Company{" "}
                  <span className="normal-case tracking-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  disabled={formState === "loading"}
                  placeholder="Acme Corp"
                  className="border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="message"
                  className="font-mono text-xs uppercase tracking-[0.15em] text-foreground"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  disabled={formState === "loading"}
                  placeholder="Tell us about your setup — how many queues, your team size, and what you're looking for."
                  className="resize-y border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {formState === "error" && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  {errorMessage}
                </p>
              )}

              <div className="flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={formState === "loading"}
                  className="inline-flex items-center gap-2 border border-primary bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formState === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Send message
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
