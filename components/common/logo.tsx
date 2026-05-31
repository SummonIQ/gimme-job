'use client';

import { usePathname } from 'next/navigation';

import { cn } from '@/lib/css';
import GimmeJobLogo from '@/public/gimme-job.svg';
import GimmeJobForwardCometLogo from '@/public/gimme-job-forward-comet.svg';
import GimmeJobForwardLogo from '@/public/gimme-job-forward.svg';
import GimmeJobForwardMoreLogo from '@/public/gimme-job-forward-more.svg';
import GimmeJobForwardNoisyCometLogo from '@/public/gimme-job-forward-noisy-comet.svg';
import GimmeJobForwardRichCometLogo from '@/public/gimme-job-forward-rich-comet.svg';
import GimmeJobForwardSubtleCometLogo from '@/public/gimme-job-forward-subtle-comet.svg';

const LIGHT_MARKETING_LOGO_PATHS = [
  '/',
  '/api',
  '/features',
  '/rapidapi',
  '/pricing',
  '/about',
  '/faq',
  '/login',
  '/signup',
] as const;

interface LogoProps {
  betaClassName?: string;
  borderColor?: string;
  briefcaseClassName?: string;
  briefcaseStyle?: 'default' | 'stylized';
  className?: string;
  gimmeMonochrome?: boolean;
  iconClassName?: string;
  iconVariant?: 'briefcase' | 'target';
  shadowOpacity?: number;
  showBorder?: boolean;
  size?: 'sm' | 'md' | 'lg';
  textClassName?: string;
  variant?:
    | 'default'
    | 'forward'
    | 'forward-more'
    | 'forward-comet'
    | 'forward-noisy-comet'
    | 'forward-rich-comet'
    | 'forward-subtle-comet';
}

export function Logo({
  className,
  gimmeMonochrome = false,
  size = 'md',
  variant = 'default',
}: LogoProps) {
  const pathname = usePathname();
  const isLightMarketingLogo = LIGHT_MARKETING_LOGO_PATHS.includes(
    pathname as (typeof LIGHT_MARKETING_LOGO_PATHS)[number],
  );
  const LogoMark =
    variant === 'forward-subtle-comet'
      ? GimmeJobForwardSubtleCometLogo
      : variant === 'forward-rich-comet'
      ? GimmeJobForwardRichCometLogo
      : variant === 'forward-noisy-comet'
      ? GimmeJobForwardNoisyCometLogo
      : variant === 'forward-comet'
      ? GimmeJobForwardCometLogo
      : variant === 'forward-more'
        ? GimmeJobForwardMoreLogo
      : variant === 'forward'
        ? GimmeJobForwardLogo
        : GimmeJobLogo;
  const sizeClasses = {
    lg: 'h-[2.625rem] w-[9.75rem]',
    md: 'h-[2.275rem] w-[8.35rem]',
    sm: 'h-[1.7rem] w-[6.8rem]',
  };
  const paletteClasses = isLightMarketingLogo
    ? '[--logo-ink:#0f172a] dark:[--logo-ink:#f8fafc]'
    : '[--logo-ink:#f8fafc]';

  const inkColor = 'var(--logo-ink)';
  const jobAccentColor = 'hsl(238.7 83.5% 71%)';

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center',
        sizeClasses[size],
        paletteClasses,
        className,
      )}
    >
      {/* #ec4899 - pink */}
      <LogoMark
        className={cn(
          'text-[var(--logo-ink)] [--gj-accent:#8b5cf6]',
          gimmeMonochrome
            ? '[--gj-gimme-a:hsl(238.7_83.5%_71%)] [--gj-gimme-b:hsl(238.7_83.5%_71%)] [--gj-gimme-c:hsl(238.7_83.5%_71%)] [--gj-gimme-glint:hsl(238.7_83.5%_71%)]'
            : '[--gj-gimme-a:#e874aa] [--gj-gimme-b:#e874aa] [--gj-gimme-c:#e874aa] [--gj-gimme-glint:#7c3aed] dark:[--gj-gimme-a:#e874aa] dark:[--gj-gimme-b:#e874aa] dark:[--gj-gimme-c:#e874aa] dark:[--gj-gimme-glint:#c4b5fd]',
        )}
      />
    </div>
  );
}
