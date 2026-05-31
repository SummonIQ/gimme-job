'use client';

import { BarChart3, Database, Filter, Search, Zap } from 'lucide-react';
import type { CSSProperties, PointerEvent } from 'react';
import { useRef } from 'react';

import { Logo } from '@/components/common/logo';

interface RapidApiPreviewCardProps {
  filters: readonly string[];
}

const metricCards = [
  {
    label: 'Results',
    value: '100',
    detail: 'normalized jobs',
    icon: BarChart3,
    delta: 'max page',
    glow: 'bg-sky-400/20',
    gradient: 'from-sky-300/[0.18] via-sky-300/[0.07] to-transparent',
    iconSurface:
      'text-violet-500 drop-shadow-[0_0_10px_rgba(139,92,246,0.52)] dark:text-sky-200 dark:drop-shadow-[0_0_13px_rgba(125,211,252,0.72)]',
    meter: 'w-[92%] bg-gradient-to-r from-sky-300 to-cyan-100',
  },
  {
    label: 'Cursor',
    value: 'Ready',
    detail: 'next page token',
    icon: Database,
    delta: 'paged',
    glow: 'bg-violet-400/20',
    gradient: 'from-violet-300/[0.18] via-violet-300/[0.07] to-transparent',
    iconSurface:
      'text-rose-500 drop-shadow-[0_0_10px_rgba(232,116,170,0.5)] dark:text-violet-200 dark:drop-shadow-[0_0_13px_rgba(167,139,250,0.68)]',
    meter: 'w-[68%] bg-gradient-to-r from-violet-300 to-fuchsia-100',
  },
  {
    label: 'Latency',
    value: '18ms',
    detail: 'query time',
    icon: Zap,
    delta: 'fast',
    glow: 'bg-emerald-400/20',
    gradient: 'from-emerald-300/[0.18] via-emerald-300/[0.07] to-transparent',
    iconSurface:
      'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)] dark:text-emerald-200 dark:drop-shadow-[0_0_13px_rgba(52,211,153,0.68)]',
    meter: 'w-[84%] bg-gradient-to-r from-emerald-300 to-lime-100',
  },
  {
    label: 'Plan',
    value: 'Pro',
    detail: '2 req / sec',
    icon: Search,
    delta: 'live',
    glow: 'bg-pink-400/20',
    gradient: 'from-pink-300/[0.18] via-pink-300/[0.07] to-transparent',
    iconSurface:
      'text-fuchsia-500 drop-shadow-[0_0_10px_rgba(217,70,239,0.48)] dark:text-pink-200 dark:drop-shadow-[0_0_13px_rgba(244,114,182,0.66)]',
    meter: 'w-[56%] bg-gradient-to-r from-pink-300 to-rose-100',
  },
] as const;

const filterChipClasses = [
  'border-violet-200/70 bg-violet-50/80 text-violet-700 shadow-violet-950/10 hover:border-violet-300 hover:bg-violet-100/80 dark:border-sky-300/15 dark:bg-sky-300/[0.075] dark:text-sky-100 dark:shadow-sky-950/30 dark:hover:border-sky-200/35 dark:hover:bg-sky-300/[0.13]',
  'border-rose-200/70 bg-rose-50/80 text-rose-700 shadow-rose-950/10 hover:border-rose-300 hover:bg-rose-100/80 dark:border-violet-300/15 dark:bg-violet-300/[0.075] dark:text-violet-100 dark:shadow-violet-950/30 dark:hover:border-violet-200/35 dark:hover:bg-violet-300/[0.13]',
  'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 shadow-emerald-950/10 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-300/15 dark:bg-emerald-300/[0.075] dark:text-emerald-100 dark:shadow-emerald-950/30 dark:hover:border-emerald-200/35 dark:hover:bg-emerald-300/[0.13]',
  'border-fuchsia-200/70 bg-fuchsia-50/80 text-fuchsia-700 shadow-fuchsia-950/10 hover:border-fuchsia-300 hover:bg-fuchsia-100/80 dark:border-pink-300/15 dark:bg-pink-300/[0.075] dark:text-pink-100 dark:shadow-pink-950/30 dark:hover:border-pink-200/35 dark:hover:bg-pink-300/[0.13]',
] as const;

const previewCardStyle = {
  '--preview-rotate-x': '0deg',
  '--preview-rotate-y': '0deg',
  '--preview-shine-x': '50%',
  '--preview-shine-y': '18%',
} as CSSProperties;

export function RapidApiPreviewCard({ filters }: RapidApiPreviewCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const rotateY = (x - 0.5) * 8;
    const rotateX = (0.5 - y) * 6;

    card.style.setProperty('--preview-rotate-x', `${rotateX.toFixed(2)}deg`);
    card.style.setProperty('--preview-rotate-y', `${rotateY.toFixed(2)}deg`);
    card.style.setProperty('--preview-shine-x', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--preview-shine-y', `${(y * 100).toFixed(1)}%`);
  };

  const handlePointerLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    card.style.setProperty('--preview-rotate-x', '0deg');
    card.style.setProperty('--preview-rotate-y', '0deg');
    card.style.setProperty('--preview-shine-x', '50%');
    card.style.setProperty('--preview-shine-y', '18%');
  };

  return (
    <div
      className="group/preview relative self-start [perspective:1200px] lg:ml-4 lg:origin-top-right lg:scale-[0.97]"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <div className="animate-preview-card-gradient pointer-events-none absolute -inset-5 rounded-[1.7rem] bg-[conic-gradient(from_var(--preview-card-angle),#8b5cf6,#e874aa,#22c55e,#f472b6,#8b5cf6)] opacity-25 blur-2xl dark:opacity-40" />
      <div
        className="relative isolate overflow-hidden rounded-[1.5rem] p-px shadow-[0_28px_68px_rgba(15,23,42,0.12),0_10px_30px_rgba(139,92,246,0.1)] transition-transform duration-300 ease-out [transform:rotateX(var(--preview-rotate-x))_rotateY(var(--preview-rotate-y))_translateY(-4px)] [transform-style:preserve-3d] dark:shadow-[0_30px_72px_rgba(2,6,23,0.24),0_10px_32px_rgba(49,46,129,0.14)]"
        ref={cardRef}
        style={previewCardStyle}
      >
        <div className="animate-preview-card-gradient pointer-events-none absolute inset-0 z-0 bg-[conic-gradient(from_var(--preview-card-angle),#8b5cf6,#e874aa,#22c55e,#f472b6,#8b5cf6)] opacity-70 dark:opacity-90" />
        <div className="relative z-10 overflow-hidden rounded-[1.45rem] bg-[radial-gradient(circle_at_var(--preview-shine-x)_var(--preview-shine-y),rgba(139,92,246,0.12),transparent_30%),radial-gradient(circle_at_top_left,rgba(232,116,170,0.16),transparent_34%),linear-gradient(145deg,#ffffff,#f8fafc_72%)] [transform-style:preserve-3d] dark:bg-[radial-gradient(circle_at_var(--preview-shine-x)_var(--preview-shine-y),rgba(255,255,255,0.055),transparent_30%),radial-gradient(circle_at_top_left,rgba(139,92,246,0.22),transparent_34%),linear-gradient(145deg,#0f172a,#020617_72%)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <Logo
              className="h-[1.25rem]! w-[4.6rem]! opacity-[0.85] [--logo-ink:#0f172a] dark:[--logo-ink:#f8fafc]"
              size="sm"
              variant="forward-subtle-comet"
            />
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 shadow-[0_12px_24px_rgba(16,185,129,0.16)] transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-100/70 hover:text-emerald-800 hover:[transform:translate3d(0,-2px,28px)] dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200 dark:shadow-[0_0_18px_rgba(16,185,129,0.45),0_0_32px_rgba(56,189,248,0.28),0_0_46px_rgba(244,114,182,0.22)] dark:hover:border-emerald-300/50 dark:hover:bg-emerald-300/15 dark:hover:text-emerald-100">
              200 OK
            </div>
          </div>
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-20px_40px_rgba(139,92,246,0.06),0_18px_42px_rgba(15,23,42,0.12)] transition-all duration-300 [transform-style:preserve-3d] hover:border-violet-200 hover:bg-white hover:text-slate-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-20px_40px_rgba(232,116,170,0.08),0_28px_64px_rgba(139,92,246,0.22)] hover:[transform:translateZ(64px)_scale(1.018)] dark:border-white/10 dark:bg-black/40 dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-20px_40px_rgba(2,6,23,0.38),0_18px_42px_rgba(2,6,23,0.28)] dark:hover:border-sky-200/20 dark:hover:bg-white/[0.07] dark:hover:text-white dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-20px_40px_rgba(2,6,23,0.32),0_28px_64px_rgba(30,64,175,0.36)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Search request
                </div>
                <div className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100">
                  18ms
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
                  GET
                </span>
                <span className="text-[13px] font-semibold text-violet-700 dark:text-sky-200">/v1/jobs</span>
              </div>
              <div className="mt-4 grid gap-2 text-[11px]">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.045]">
                  <span className="text-slate-500 dark:text-slate-400">search</span>
                  <span className="text-slate-900 dark:text-slate-100">engineer</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.045]">
                  <span className="text-slate-500 dark:text-slate-400">remote</span>
                  <span className="text-emerald-700 dark:text-emerald-100">true</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.045]">
                  <span className="text-slate-500 dark:text-slate-400">has_salary</span>
                  <span className="text-rose-700 dark:text-pink-100">true</span>
                </div>
              </div>
            </div>
            <div className="grid gap-3 rounded-[0.9rem] bg-slate-950/[0.025] p-px dark:bg-white/[0.03] sm:grid-cols-2">
              {metricCards.map(
                ({ delta, detail, glow, gradient, icon: Icon, iconSurface, label, meter, value }) => (
                <div
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-24px_42px_rgba(139,92,246,0.05),0_18px_36px_rgba(15,23,42,0.1)] transition-all duration-300 [transform-style:preserve-3d] hover:border-rose-200 hover:bg-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-24px_42px_rgba(232,116,170,0.07),0_30px_62px_rgba(139,92,246,0.2)] hover:[transform:translateZ(56px)_scale(1.035)] dark:border-white/10 dark:bg-slate-950/35 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-24px_42px_rgba(2,6,23,0.22),0_18px_36px_rgba(2,6,23,0.24)] dark:hover:border-white/20 dark:hover:bg-white/[0.075] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-24px_42px_rgba(2,6,23,0.18),0_30px_62px_rgba(49,46,129,0.34)]"
                  key={label}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient}`} />
                  <div className={`pointer-events-none absolute -right-8 -top-10 size-28 rounded-full ${glow} blur-2xl`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {label}
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-semibold leading-none text-slate-950 dark:text-white">{value}</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
                            {delta}
                          </span>
                        </div>
                      </div>
                      <div className={`shrink-0 ${iconSurface}`}>
                        <Icon className="size-5" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{detail}</div>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)] dark:bg-white/[0.08] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
                        <div className={`h-full rounded-full ${meter}`} />
                      </div>
                    </div>
                  </div>
                </div>
                ),
              )}
            </div>
            <div className="rounded-xl bg-[linear-gradient(135deg,rgba(232,116,170,0.34),rgba(139,92,246,0.28),rgba(56,189,248,0.22))] p-px shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-all duration-300 [transform-style:preserve-3d] hover:shadow-[0_24px_50px_rgba(139,92,246,0.16)] hover:[transform:translateZ(58px)_scale(1.02)] dark:shadow-[0_16px_36px_rgba(2,6,23,0.18)] dark:hover:shadow-[0_28px_58px_rgba(49,46,129,0.28)]">
              <div className="rounded-[calc(0.75rem-1px)] border border-white/70 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-18px_36px_rgba(139,92,246,0.045)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-18px_36px_rgba(2,6,23,0.22)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-950 dark:text-white">
                    <Filter className="size-4 text-rose-500 drop-shadow-[0_0_9px_rgba(232,116,170,0.4)] dark:text-pink-300 dark:drop-shadow-[0_0_11px_rgba(244,114,182,0.55)]" />
                    Filter parameters
                  </div>
                  <span className="rounded-full border border-violet-200/70 bg-violet-50/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-100">
                    {filters.length} shown
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter, index) => (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_8px_18px_rgba(15,23,42,0.08)] transition-all duration-200 hover:text-slate-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.68),0_12px_24px_rgba(15,23,42,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_18px_rgba(2,6,23,0.16)] dark:hover:text-white dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_24px_rgba(15,23,42,0.22)] ${filterChipClasses[index % filterChipClasses.length]}`}
                      key={filter}
                    >
                      <span className="size-1.5 rounded-full bg-current opacity-55" />
                      {filter}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
