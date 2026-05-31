import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileSearch,
  LineChart,
  Sparkles,
  Target,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

const pillars = [
  {
    description:
      'Start from live job discovery, keep filters sharp, and stop rebuilding the same search from scratch.',
    icon: BriefcaseBusiness,
    title: 'Search once, refine continuously',
  },
  {
    description:
      'Move strong roles into leads, keep the weak ones out, and make every next step visible to the user.',
    icon: Target,
    title: 'Triage before you waste effort',
  },
  {
    description:
      'Keep resumes, applications, and outcomes tied together so the product compounds instead of fragmenting.',
    icon: LineChart,
    title: 'Operate from one system',
  },
];

const workflow = [
  {
    eyebrow: '01',
    title: 'Find signal fast',
    description:
      'Live search, saved searches, and clean filtering give the user a shortlist worth acting on.',
  },
  {
    eyebrow: '02',
    title: 'Convert listings into an actual pipeline',
    description:
      'Jobs move into leads, resumes stay attached to the opportunity, and the next action is always clear.',
  },
  {
    eyebrow: '03',
    title: 'Track momentum instead of guessing',
    description:
      'The system keeps a running picture of activity, interviews, and outcomes so the user can course-correct.',
  },
];

const outcomes = [
  'No more spreadsheet-plus-notes-plus-browser-tab workflow',
  'No more stale job searches with no follow-through',
  'No more buried resume versions without context',
  'No more ambiguity about what to do next',
];

const replacements = [
  'A command center for searches, leads, resumes, and outcomes',
  'A tighter default loop from discovery to application',
  'A sharper first-run experience that teaches the product by using it',
  'A calmer interface with clear hierarchy and fewer dead sections',
];

export function DefaultExperienceSections() {
  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-950">
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
            Built as the default
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 dark:text-slate-50 sm:text-4xl">
            The product should feel opinionated before the user clicks
            anything.
          </h2>
          <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-400 sm:text-lg">
            Instead of stacking more sections and more controls, the new
            interface frames the product around one loop: find roles, qualify
            them quickly, tailor materials, and keep the pipeline moving.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {pillars.map(item => (
            <div
              key={item.title}
              className="rounded-[1.75rem] border border-white/70 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-gray-950 dark:text-slate-50">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-black/5 bg-white dark:border-white/5 dark:bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Product loop
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950 dark:text-slate-50 sm:text-4xl">
              One operating model across search, resumes, and applications.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-400 sm:text-lg">
              The interface now explains the product with structure instead of
              marketing sprawl. Each section earns its place by clarifying what
              the user does next.
            </p>
          </div>

          <div className="space-y-4">
            {workflow.map(item => (
              <div
                key={item.eyebrow}
                className="rounded-[1.5rem] border border-black/5 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
                  {item.eyebrow}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-gray-950 dark:text-slate-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[1.75rem] border border-rose-200/70 bg-white p-7 shadow-[0_24px_60px_rgba(190,24,93,0.08)] dark:border-rose-400/20 dark:bg-rose-950/20">
            <div className="flex items-center gap-3 text-rose-900 dark:text-rose-300">
              <FileSearch className="size-5" />
              <h3 className="text-xl font-semibold">What the user stops doing</h3>
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-rose-950/80 dark:text-rose-200/80">
              {outcomes.map(item => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 size-1.5 rounded-full bg-rose-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-200/70 bg-emerald-50/80 p-7 shadow-[0_24px_60px_rgba(6,78,59,0.08)] dark:border-emerald-500/20 dark:bg-emerald-950/30">
            <div className="flex items-center gap-3 text-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="size-5" />
              <h3 className="text-xl font-semibold">What the user gets instead</h3>
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-emerald-950/80 dark:text-emerald-200/80">
              {replacements.map(item => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 size-1.5 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-900/10 bg-slate-950 px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/80">
                <Sparkles className="size-3.5" />
                New default experience
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                The first impression now matches the ambition of the product.
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
                Users hit a cleaner landing page publicly and a more actionable
                command center once they are inside the app.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">See the app</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
