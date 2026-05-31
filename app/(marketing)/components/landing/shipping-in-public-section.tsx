import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import changelog from '@/data/changelog.json';
import { getEntryCategory } from '@/lib/changelog-categories';

type ChangelogDay = {
  date: string;
  entries: { title: string; description: string }[];
};

export function ShippingInPublicSection() {
  const days = changelog as ChangelogDay[];
  const latestChangelogDays = days.slice(0, 3);

  if (latestChangelogDays.length === 0) {
    return null;
  }

  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border-x-0 border-t border-t-indigo-500/20 border-b border-b-indigo-500/5 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-400">
                <Sparkles className="h-3.5 w-3.5" />
                Product updates
              </div>
              <h2 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Shipping in public
              </h2>
              <p className="max-w-2xl text-lg text-foreground/60">
                Follow the newest AI training improvements, assist-mode fixes,
                and the steady march toward fully automated application
                submission as they land.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="relative pl-8">
              <div className="absolute bottom-2 left-2 top-2 w-px bg-gradient-to-b from-indigo-400/35 via-violet-400/18 to-transparent" />
              <div className="space-y-10">
                {latestChangelogDays.map(day => (
                  <div key={day.date} className="relative">
                    <div className="absolute left-[-2.05rem] top-1.5 h-3 w-3 rounded-full border border-indigo-300/40 bg-indigo-400/70 shadow-[0_0_0_6px_rgba(129,140,248,0.08)]" />
                    <time className="mb-4 block text-xs font-medium uppercase tracking-[0.24em] text-foreground/45">
                      {new Date(`${day.date}T00:00:00`).toLocaleDateString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        },
                      )}
                    </time>
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/28 via-violet-500/16 to-fuchsia-500/22 p-px">
                      <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-background/80 backdrop-blur-sm">
                        {day.entries.slice(0, 4).map((entry, index) => {
                          const category = getEntryCategory(entry);
                          return (
                            <div
                              key={`${day.date}-${entry.title}`}
                              className={
                                index === 0
                                  ? 'relative overflow-hidden px-5 py-4'
                                  : 'relative overflow-hidden border-t border-border/35 px-5 py-4'
                              }
                            >
                              <div
                                aria-hidden
                                className="pointer-events-none absolute left-0 top-0 h-24 w-40"
                                style={{
                                  background: `radial-gradient(ellipse at top left, ${category.glow} 0%, transparent 78%)`,
                                }}
                              />
                              <div className="relative">
                                <div className="text-sm font-semibold text-foreground">
                                  {entry.title}
                                </div>
                                <div className="mt-1.5 text-sm leading-relaxed text-foreground/58">
                                  {entry.description}
                                </div>
                                <div className="mt-2">
                                  <span
                                    className={`inline-flex rounded-full border px-2 py-[0.22rem] text-[8px] font-semibold uppercase tracking-[0.17em] backdrop-blur-sm ${category.badgeClass}`}
                                  >
                                    {category.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-10 flex justify-center">
              <Button
                variant="outline"
                asChild
                className="h-11 rounded-xl border-white/10 bg-white/5 px-5 text-sm hover:bg-white/8"
              >
                <Link href="/changelog">
                  View full changelog
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
