import { ArrowRight, FileText, Rss } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog - Gimme Job',
  description:
    'Notes from the Gimme Job team on job search automation, product updates, and job listings data.',
};

const topics = [
  {
    title: 'Product notes',
    description:
      'Short writeups on new job search, application tracking, and resume workflow improvements.',
  },
  {
    title: 'Automation reliability',
    description:
      'What we are learning from form snapshots, field detection, review flows, and safer autofill.',
  },
  {
    title: 'Job data and APIs',
    description:
      'Updates on normalized listings, filters, sync feeds, and how teams can build on job data.',
  },
] as const;

export default function BlogPage() {
  return (
    <div className="bg-white pb-24 pt-32 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pt-12 text-center sm:pt-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary dark:border-primary/25 dark:bg-primary/15">
            <Rss className="size-3.5" />
            Blog
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Notes from building Gimme Job
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
            A lightweight place for product notes, implementation lessons, and
            job data updates. For the newest shipped changes, use the changelog.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
          {topics.map(topic => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
              key={topic.title}
            >
              <div className="mb-5 inline-flex size-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {topic.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {topic.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-3xl justify-center">
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:hover:bg-white/[0.08]"
            href="/changelog"
          >
            View shipped updates
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
