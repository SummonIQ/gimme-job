import type { Metadata } from 'next';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { AnimatedJobTitle } from '@/components/ui/animated-job-title';
import { Logo } from '@/components/common/logo';

import { HeroInteractiveBackground } from '../(marketing)/components/landing/hero-interactive-background';

export const metadata: Metadata = {
  description: 'Marketing screenshot page',
  robots: { index: false, follow: false },
  title: 'Marketing Screenshot',
};

export default function MarketingScreenshotPage() {
  return (
    <section className="relative isolate overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40">
      <AnimatedBackground variant="gradient" className="z-0" />
      <HeroInteractiveBackground className="z-10 opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-56 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-slate-950/80 dark:to-slate-950" />
      <div className="pointer-events-none absolute bottom-0 left-0 z-[16] h-64 w-[68%] bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.96),rgba(255,255,255,0.72)_42%,rgba(255,255,255,0)_76%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(2,6,23,0.96),rgba(2,6,23,0.72)_42%,rgba(2,6,23,0)_76%)]" />

      <div className="relative z-20 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center justify-center">
            <Logo
              className="h-[2.625rem]! w-[9.75rem]!"
              size="lg"
              variant="forward-subtle-comet"
            />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-slate-50 sm:text-6xl lg:text-7xl">
            <span className="block">Land Your</span>
            <span className="mt-3 mb-1 flex justify-center">
              <AnimatedJobTitle />
            </span>
            <span className="block">
              Job{' '}
              <span className="text-gray-900 dark:text-slate-50">Faster</span>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-gray-600 dark:text-gray-400 sm:text-xl">
            Streamline your job search with AI-powered tools. Optimize your
            resume, track applications, and land interviews with companies you
            love.
          </p>
        </div>
      </div>
    </section>
  );
}
