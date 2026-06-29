import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Features } from "@/components/landing/features";
import { FinalCta, Footer } from "@/components/landing/footer";
import { Frameworks } from "@/components/landing/frameworks";
import { Hero } from "@/components/landing/hero";
import { Modes } from "@/components/landing/modes";
import { baseOptions } from "@/lib/layout.shared";

export function meta() {
  return [
    { title: "Bullstudio — A modern dashboard for Bull & BullMQ" },
    {
      name: "description",
      content:
        "An open-source queue management dashboard for Bull and BullMQ. Inspect jobs, trace flows and unstick backlogs — standalone or embedded in your app.",
    },
  ];
}

export default function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <Hero />
      <Features />
      <Modes />
      <Frameworks />
      <FinalCta />
      <Footer />
    </HomeLayout>
  );
}
