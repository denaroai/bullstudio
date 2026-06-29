import { usePostHog } from "@posthog/react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Footer } from "@/components/landing/footer";
import { Container, SectionHeading } from "@/components/landing/section";
import { baseOptions } from "@/lib/layout.shared";
import { comparisonsSource } from "@/lib/comparisons";
import type { Route } from "./+types/comparisons";

export function meta() {
  return [
    { title: "Bullstudio compared — alternatives for Bull & BullMQ" },
    {
      name: "description",
      content:
        "How Bullstudio stacks up against other Bull and BullMQ dashboards. Honest, side-by-side comparisons to help you pick the right queue tool.",
    },
  ];
}

export async function loader(_: Route.LoaderArgs) {
  const articles = comparisonsSource.getPages().map((page) => ({
    url: page.url,
    title: page.data.title,
    description: page.data.description ?? "",
  }));

  // Stable alphabetical order so the list doesn't shuffle between builds.
  articles.sort((a, b) => a.title.localeCompare(b.title));

  return { articles };
}

export default function ComparisonsIndex({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;
  const posthog = usePostHog();

  return (
    <HomeLayout {...baseOptions()}>
      <div className="relative border-b border-border">
        <div aria-hidden className="bs-grid absolute inset-0 opacity-[0.25]" />
        <Container className="relative py-20">
          <SectionHeading
            title="Bullstudio vs the alternatives"
            description="Choosing a dashboard for your Bull or BullMQ queues? These side-by-side comparisons lay out the trade-offs so you can pick with confidence."
          />
        </Container>
      </div>

      <Container className="py-16">
        {articles.length === 0 ? (
          <p className="text-muted-foreground">No comparisons published yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {articles.map((article) => (
              <li key={article.url}>
                <Link
                  to={article.url}
                  onClick={() =>
                    posthog?.capture("comparison_article_opened", {
                      title: article.title,
                      url: article.url,
                    })
                  }
                  className="group flex h-full flex-col border border-border bg-card p-6 transition-colors hover:border-primary"
                >
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {article.title}
                  </h2>
                  {article.description ? (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {article.description}
                    </p>
                  ) : null}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Read comparison
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>

      <Footer />
    </HomeLayout>
  );
}
