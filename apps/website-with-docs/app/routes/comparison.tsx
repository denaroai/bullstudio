import browserCollections from "collections/browser";
import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Footer } from "@/components/landing/footer";
import { Container } from "@/components/landing/section";
import { useMDXComponents } from "@/components/mdx";
import { comparisonsSource } from "@/lib/comparisons";
import { baseOptions } from "@/lib/layout.shared";
import type { Route } from "./+types/comparison";

export async function loader({ params }: Route.LoaderArgs) {
  const page = comparisonsSource.getPage([params.slug]);
  if (!page) throw new Response("Not found", { status: 404 });

  return { path: page.path };
}

const clientLoader = browserCollections.comparisons.createClientLoader({
  component({ frontmatter, default: Mdx }) {
    return (
      <Container className="max-w-3xl py-16">
        <title>{`${frontmatter.title} — Bullstudio`}</title>
        <meta name="description" content={frontmatter.description} />

        <Link
          to="/comparisons"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          All comparisons
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {frontmatter.title}
        </h1>
        {frontmatter.description ? (
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            {frontmatter.description}
          </p>
        ) : null}

        <DocsBody className="mt-10">
          <Mdx components={useMDXComponents()} />
        </DocsBody>
      </Container>
    );
  },
});

export default function ComparisonArticle({ loaderData }: Route.ComponentProps) {
  return (
    <HomeLayout {...baseOptions()}>
      {clientLoader.useContent(loaderData.path)}
      <Footer />
    </HomeLayout>
  );
}
