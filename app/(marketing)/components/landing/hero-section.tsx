'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { AnimatedJobTitle } from '@/components/ui/animated-job-title';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/client';

import { cn } from '@/lib/css';
import { HeroInteractiveBackground } from './hero-interactive-background';

export function HeroSection() {
  const { data: session } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);
  const isLoggedIn = hasMounted && Boolean(session?.user);

  return (
    <section className="relative isolate overflow-hidden pb-12 pt-32 sm:pb-16 sm:pt-40">
      <AnimatedBackground variant="gradient" className="z-0" />
      <HeroInteractiveBackground className="z-10 opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-56 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-slate-950/80 dark:to-slate-950" />
      <div className="pointer-events-none absolute bottom-0 left-0 z-[16] h-64 w-[68%] bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.96),rgba(255,255,255,0.72)_42%,rgba(255,255,255,0)_76%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(2,6,23,0.96),rgba(2,6,23,0.72)_42%,rgba(2,6,23,0)_76%)]" />

      <div className="relative z-20 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div
            className={cn(
              'relative isolate mb-8 inline-flex items-center gap-2 rounded-full border-t border-t-white/85 border-b border-b-black bg-linear-to-br from-gray-700 via-gray-900 to-black px-4 py-1.5 text-xs shadow-[0_8px_16px_rgba(0,0,0,0.6)] backdrop-blur-sm',
              'before:absolute before:-inset-5 before:-z-10 before:rounded-full before:bg-[conic-gradient(from_120deg,rgba(56,189,248,0.72),rgba(139,92,246,0.78),rgba(236,72,153,0.72),rgba(251,191,36,0.52),rgba(56,189,248,0.72))]',
              'before:opacity-60 before:blur-2xl',
              'after:absolute after:-inset-1.5 after:-z-0 after:rounded-full after:bg-[conic-gradient(from_120deg,rgba(56,189,248,0.72),rgba(139,92,246,0.78),rgba(236,72,153,0.72),rgba(251,191,36,0.54),rgba(56,189,248,0.72))]',
              'after:opacity-1 after:blur-md dark:border-t-white/40',
            )}
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-purple-400" />
            <span className="font-semibold text-gray-100">
              AI-Powered Job Search Platform
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-slate-50 sm:text-6xl lg:text-7xl">
            <span className="block">Land Your</span>
            <span className="mt-3 mb-1 flex justify-center">
              <AnimatedJobTitle />
            </span>
            <span className="block">
              Job{' '}
              <span className="text-gray-900 dark:text-slate-50">
                Faster
              </span>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-gray-600 dark:text-gray-400 sm:text-xl">
            Streamline your job search with AI-powered tools. Optimize your
            resume, track applications, and land interviews with companies you
            love.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isLoggedIn ? (
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Go to App
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-2! border-transparent! text-primary/80! shadow-none! transition-all hover:border-primary! hover:bg-transparent! hover:text-primary! hover:shadow-xs!"
            >
              <Link href="#default-experience">Learn More</Link>
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
}
