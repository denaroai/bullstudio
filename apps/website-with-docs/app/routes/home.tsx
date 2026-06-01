import type { Route } from './+types/home';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Modes } from '@/components/landing/modes';
import { Frameworks } from '@/components/landing/frameworks';
import { FinalCta, Footer } from '@/components/landing/footer';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Bullstudio — A modern dashboard for Bull & BullMQ' },
    {
      name: 'description',
      content:
        'An open-source queue management dashboard for Bull and BullMQ. Inspect jobs, trace flows and unstick backlogs — standalone or embedded in your app.',
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
