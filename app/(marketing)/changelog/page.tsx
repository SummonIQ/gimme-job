import type { Metadata } from 'next';
import type { ComponentType } from 'react';

import changelog from '@/data/changelog.json';
import { getEntryCategory } from '@/lib/changelog-categories';

export const metadata: Metadata = {
  title: 'Changelog | Gimme Job',
  description:
    "What's new in Gimme Job — AI training, assist, auto-submit, and the platform updates landing every day.",
};

type ChangelogDay = {
  date: string;
  entries: { title: string; description: string }[];
};

function EntryIllustration({
  Icon,
  iconClass,
}: {
  Icon: ComponentType<{
    className?: string;
    strokeWidth?: number;
    'aria-hidden'?: boolean;
  }>;
  iconClass: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
      <div className="absolute inset-0 rounded-[inherit] bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:bg-white/[0.015] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]" />
      <div className="absolute left-1/2 top-1/2 h-[1.5rem] w-[1.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 blur-[12px] dark:bg-white/[0.035]" />
      <Icon
        aria-hidden
        strokeWidth={1.95}
        className={`absolute left-1/2 top-1/2 h-[0.9rem] w-[0.9rem] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_10px_24px_rgba(15,23,42,0.38)] ${iconClass}`}
      />
    </div>
  );
}

export default function ChangelogPage() {
  const days = changelog as ChangelogDay[];

  return (
    <div className="bg-white pb-24 pt-32 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-3xl pt-12 sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Product updates
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            Changelog
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
            New features, improvements, and fixes across job search, assist
            mode, automation, APIs, and the public product experience.
          </p>
        </div>

        <div className="mt-14 space-y-8">
          {days.map(day => (
            <section
              className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]"
              key={day.date}
            >
              <div className="lg:pt-2">
                <time className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_30px_80px_-42px_rgba(0,0,0,0.82)]">
                {day.entries.map((entry, i) => {
                  const category = getEntryCategory(entry);

                  return (
                    <article
                      className={
                        i === 0
                          ? 'relative overflow-hidden px-5 py-5 sm:px-6'
                          : 'relative overflow-hidden border-t border-slate-200 px-5 py-5 sm:px-6 dark:border-white/10'
                      }
                      key={`${day.date}-${entry.title}`}
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 top-0 h-36 w-64"
                        style={{
                          background: `radial-gradient(ellipse at top left, ${category.glow} 0%, transparent 78%)`,
                        }}
                      />
                      <div className="relative flex items-start gap-4">
                        <div
                          className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_14px_28px_rgba(15,23,42,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_24px_rgba(2,6,23,0.18)] ${category.iconTileClass}`}
                        >
                          <EntryIllustration
                            Icon={category.icon}
                            iconClass={category.iconClass}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                              {entry.title}
                            </h2>
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-[0.22rem] text-[8px] font-semibold uppercase tracking-[0.17em] text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                              {category.label}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {entry.description}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
