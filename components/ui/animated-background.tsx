'use client';

import { cn } from '@/lib/css';

interface AnimatedBackgroundProps {
  variant?: 'hero' | 'header' | 'gradient';
  className?: string;
}

export function AnimatedBackground({ variant = 'hero', className }: AnimatedBackgroundProps) {
  if (variant === 'gradient') {
    return (
      <div className={cn('absolute inset-0 -z-10 overflow-hidden', className)}>
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-950 dark:via-background dark:to-slate-950" />

        {/* Large animated gradient orbs */}
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-400/30 to-purple-400/30 blur-3xl animate-blob dark:from-blue-500/15 dark:to-purple-500/15" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 blur-3xl animate-blob animation-delay-2000 dark:from-purple-500/15 dark:to-pink-500/15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-indigo-400/30 to-blue-400/30 blur-3xl animate-blob animation-delay-4000 dark:from-indigo-500/15 dark:to-blue-500/15" />

        {/* Smaller floating orbs for extra movement */}
        <div className="absolute top-1/4 right-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-400/25 to-blue-400/25 blur-2xl animate-float dark:from-cyan-500/10 dark:to-blue-500/10" />
        <div className="absolute bottom-1/3 left-1/4 h-64 w-64 rounded-full bg-gradient-to-br from-violet-400/25 to-fuchsia-400/25 blur-2xl animate-float animation-delay-3000 dark:from-violet-500/10 dark:to-fuchsia-500/10" />

        {/* Subtle moving gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-purple-100/10 to-transparent animate-pulse dark:via-purple-500/5" style={{ animationDuration: '8s' }} />
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 -z-10 overflow-hidden', className)}>
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />
      
      {/* Animated grid */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem',
          animation: 'gridMove 20s linear infinite',
        }}
      />
      
      {/* Large floating orbs */}
      <div className="absolute -top-48 -right-48 h-96 w-96 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 blur-3xl animate-blob" />
      <div className="absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-500/30 to-blue-500/30 blur-3xl animate-blob animation-delay-4000" />
      
      {/* Smaller accent orbs */}
      <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 blur-2xl animate-float" />
      <div className="absolute bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl animate-float animation-delay-3000" />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
    </div>
  );
}
