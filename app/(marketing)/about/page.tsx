import { Heart, Lightbulb, Target, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About Us - Gimme Job',
  description:
    "Learn about Gimme Job's mission to help job seekers land their dream roles faster with AI-powered tools.",
};

const values = [
  {
    name: 'Job Seeker First',
    description:
      'Every product decision starts with reducing busywork and giving applicants clearer control of their search.',
    icon: Heart,
  },
  {
    name: 'Practical Automation',
    description:
      'Automation should handle repetitive work, surface uncertainty, and step aside when a human needs to decide.',
    icon: Lightbulb,
  },
  {
    name: 'Useful Data',
    description:
      'Fresh listings, clean filters, and application history matter more than vanity dashboards or vague scores.',
    icon: Target,
  },
  {
    name: 'Respect for Trust',
    description:
      'Job search data is personal, so the product is built around explicit action, review, and visibility.',
    icon: Users,
  },
];

export default function AboutPage() {
  return (
    <>
      <div className="bg-white pb-20 pt-32 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pb-28 sm:pt-40">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Header */}
          <div className="mx-auto mb-20 max-w-3xl pt-12 text-center sm:mb-24 sm:pt-16">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              We are making job search less chaotic
            </h1>
            <p className="mt-8 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Gimme Job combines fresh job data, application tracking, resume
              tools, and guided automation so job seekers can spend less time
              fighting forms and more time making good decisions.
            </p>
          </div>

          {/* Story Section */}
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Why we are building
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                The job search stack should work like one system.
              </h2>
            </div>
            <div className="space-y-5 text-base leading-8 text-slate-600 dark:text-slate-300">
              <p>
                Job seekers are expected to search across scattered boards,
                rewrite resumes, fill the same fields repeatedly, track every
                application, and guess which listings are still worth their
                time. That workflow is fragmented by default.
              </p>
              <p>
                Gimme Job is built around the opposite approach: normalize the
                job data, keep the pipeline visible, automate the repetitive
                steps, and ask for review when the system is not certain. The
                goal is a product that saves time without hiding what it is
                doing.
              </p>
              <p>
                We are focused on practical improvements: better listings,
                better application context, safer autofill, clearer resume
                feedback, and sync-ready job data for teams building on top of
                the platform.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-slate-200 bg-white py-24 dark:border-white/10 dark:bg-slate-900/60 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Values */}
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-slate-950 dark:text-white">
              Our Values
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              {values.map(value => (
                <div
                  key={value.name}
                  className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 dark:bg-primary/15">
                    <value.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-slate-950 dark:text-white">
                    {value.name}
                  </h3>
                  <p className="leading-7 text-slate-600 dark:text-slate-300">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Team Section */}
          <div className="mx-auto mt-20 max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              Built for repeat use, not a one-time demo
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              The product is designed for the real rhythm of a search: checking
              new listings, updating materials, deciding where to apply,
              confirming submissions, and keeping the pipeline current.
            </p>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              That means we care about the unglamorous details: stale postings,
              dropdowns that do not autofill correctly, confusing status
              changes, duplicate work, and the small failures that make job
              search feel harder than it should.
            </p>
          </div>

          {/* CTA */}
          <div className="mx-auto mt-20 max-w-2xl rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 px-6 py-12 text-center shadow-xl shadow-slate-900/15 sm:px-12">
            <h2 className="text-3xl font-bold text-white">Have feedback?</h2>
            <p className="mt-4 text-lg text-slate-300">
              Tell us what is slow, confusing, or repetitive in your job search
              workflow. That is where the product should get better next.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/35 text-white hover:bg-white/10"
              >
                <Link href="/contact">Get in Touch</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
