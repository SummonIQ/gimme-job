'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/client';

const proofPoints = [
  'Live search instead of stale lists',
  'Resume tailoring tied to the opportunity',
  'A visible pipeline from role to outcome',
];

const workflow = [
  {
    icon: Search,
    label: 'Search live roles',
    note: 'Run targeted searches and keep strong filters close.',
  },
  {
    icon: Target,
    label: 'Promote the right jobs',
    note: 'Turn promising listings into leads without losing context.',
  },
  {
    icon: FileText,
    label: 'Tailor and apply',
    note: 'Keep resumes, application state, and next actions connected.',
  },
];

const stats = [
  { label: 'Core loop', value: 'Search -> Lead -> Resume -> Apply' },
  { label: 'Default intent', value: 'Clarity first, then automation' },
  { label: 'For users', value: 'Less thrash, faster momentum' },
];

export function DefaultExperienceHeroSection() {
  const reduceMotion = useReducedMotion();
  const { data: session } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);
  const isLoggedIn = hasMounted && Boolean(session?.user);

  return (
    <section
      id="default-experience"
      className="relative isolate overflow-hidden bg-white pb-18 pt-20 dark:bg-slate-950 sm:pb-24 sm:pt-24"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(68,72,238,0.18),rgba(68,72,238,0)_68%)]" />
        <div className="absolute right-[-8rem] top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.16),rgba(245,158,11,0)_70%)]" />
        <div className="absolute left-[-6rem] bottom-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.12),rgba(15,23,42,0)_70%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              How it works
            </p>

            <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-gray-950 dark:text-slate-50 sm:text-4xl">
              Run your job search like a system, not a pile of tabs.
            </h2>

            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-gray-600 dark:text-gray-400">
              Discover live roles with real-time data from across the web,
              promote the right ones into your pipeline, auto-tailor your
              resume with AI, and keep momentum visible from day one.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href={isLoggedIn ? '/dashboard' : '/signup'}>
                  {isLoggedIn ? 'Open command center' : 'Start free'}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={isLoggedIn ? '/jobs' : '/features'}>
                  {isLoggedIn ? 'Jump into job search' : 'See how it works'}
                </Link>
              </Button>
            </div>

            <ul className="mt-8 grid gap-3 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
              {proofPoints.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-black/5 dark:bg-white/10 sm:grid-cols-3">
              {stats.map(item => (
                <div
                  key={item.label}
                  className="bg-white px-5 py-4 dark:bg-slate-950"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-gray-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              delay: 0.08,
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(68,72,238,0.18),rgba(68,72,238,0)_55%)] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                    End-user default
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-gray-950 dark:text-slate-50">
                    A clearer command surface
                  </h3>
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BriefcaseBusiness className="size-5" />
                </div>
              </div>

              <div className="border-y border-black/5 bg-slate-950 px-6 py-6 text-white dark:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                  Default workflow
                </p>
                <ul className="mt-4 space-y-4">
                  {workflow.map(item => (
                    <li key={item.label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white">
                        <item.icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-white/65">
                          {item.note}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-px bg-black/5 dark:bg-white/10 sm:grid-cols-2">
                <div className="bg-white px-6 py-5 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    What changed
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                    The experience now opens with direction, sharper hierarchy,
                    and fewer competing calls to action.
                  </p>
                </div>
                <div className="bg-white px-6 py-5 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                    Why it matters
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                    Users understand the loop immediately, which makes the rest
                    of the app easier to trust and adopt.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
