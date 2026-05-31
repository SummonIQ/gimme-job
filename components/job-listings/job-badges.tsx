'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { JobType } from '@/generated/prisma/browser';

// Base badge style - subtle, clean look
const baseBadgeStyle =
  'font-medium text-xs px-1.5 pt-[4px] pb-[4px] rounded-md border-x-0 border-t border-b border-t-white/15 border-b-black/25';

// Job Type Badge
interface JobTypeBadgeProps {
  jobType: JobType | null | undefined;
  className?: string;
}

const jobTypeConfig: Record<
  JobType,
  { label: string; bgColor: string; textColor: string }
> = {
  [JobType.FULL_TIME]: {
    label: 'Full-time',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  [JobType.PART_TIME]: {
    label: 'Part-time',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  [JobType.FULL_TIME_AND_PART_TIME]: {
    label: 'Full/Part-time',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    textColor: 'text-indigo-600 dark:text-indigo-400',
  },
  [JobType.CONTRACT]: {
    label: 'Contract',
    bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  [JobType.INTERNSHIP]: {
    label: 'Internship',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  [JobType.UNKNOWN]: {
    label: 'Unknown',
    bgColor: 'bg-gray-500/10 dark:bg-gray-500/20',
    textColor: 'text-gray-600 dark:text-gray-400',
  },
};

export function JobTypeBadge({ jobType, className }: JobTypeBadgeProps) {
  if (!jobType || jobType === JobType.UNKNOWN) return null;

  const config = jobTypeConfig[jobType];
  if (!config) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        config.bgColor,
        config.textColor,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}

// Remote Badge
interface RemoteBadgeProps {
  remote: boolean | null | undefined;
  className?: string;
}

export function RemoteBadge({ remote, className }: RemoteBadgeProps) {
  if (!remote) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
        className,
      )}
    >
      Remote
    </Badge>
  );
}

// Health Insurance Badge
interface HealthInsuranceBadgeProps {
  hasHealthInsurance: boolean | null | undefined;
  className?: string;
}

export function HealthInsuranceBadge({
  hasHealthInsurance,
  className,
}: HealthInsuranceBadgeProps) {
  if (!hasHealthInsurance) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400',
        className,
      )}
    >
      Health
    </Badge>
  );
}

// Dental Coverage Badge
interface DentalCoverageBadgeProps {
  hasDentalCoverage: boolean | null | undefined;
  className?: string;
}

export function DentalCoverageBadge({
  hasDentalCoverage,
  className,
}: DentalCoverageBadgeProps) {
  if (!hasDentalCoverage) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        'bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
        className,
      )}
    >
      Dental
    </Badge>
  );
}

// PTO Badge
interface PtoBadgeProps {
  hasPto: boolean | null | undefined;
  className?: string;
}

export function PtoBadge({ hasPto, className }: PtoBadgeProps) {
  if (!hasPto) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
        className,
      )}
    >
      PTO
    </Badge>
  );
}

// Work From Home Badge
interface WorkFromHomeBadgeProps {
  workFromHome: boolean | null | undefined;
  className?: string;
}

export function WorkFromHomeBadge({
  workFromHome,
  className,
}: WorkFromHomeBadgeProps) {
  if (!workFromHome) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
        className,
      )}
    >
      WFH
    </Badge>
  );
}

// Posted Time Badge
interface PostedTimeBadgeProps {
  postedAt: Date | string | null | undefined;
  className?: string;
}

export function PostedTimeBadge({ postedAt, className }: PostedTimeBadgeProps) {
  if (!postedAt) return null;

  const date = typeof postedAt === 'string' ? new Date(postedAt) : postedAt;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  let label: string;
  let colorClasses: string;

  if (diffHours < 1) {
    label = 'Just now';
    colorClasses =
      'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  } else if (diffHours < 24) {
    label = `${diffHours}h`;
    colorClasses =
      'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
  } else if (diffDays === 1) {
    label = '1d';
    colorClasses =
      'bg-lime-500/10 dark:bg-lime-500/20 text-lime-600 dark:text-lime-400';
  } else if (diffDays < 7) {
    label = `${diffDays}d`;
    colorClasses =
      'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
  } else if (diffDays < 14) {
    label = '1w';
    colorClasses =
      'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400';
  } else if (diffDays < 30) {
    label = `${Math.floor(diffDays / 7)}w`;
    colorClasses =
      'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400';
  } else {
    label = `${Math.floor(diffDays / 30)}mo`;
    colorClasses =
      'bg-gray-500/10 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400';
  }

  return (
    <Badge className={cn(baseBadgeStyle, colorClasses, className)}>
      {label}
    </Badge>
  );
}

// Job Provider Badge
interface JobProviderBadgeProps {
  jobProvider: string | null | undefined;
  className?: string;
}

export function JobProviderBadge({
  jobProvider,
  className,
}: JobProviderBadgeProps) {
  if (!jobProvider) return null;

  return (
    <Badge
      className={cn(
        baseBadgeStyle,
        'bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
        className,
      )}
    >
      {jobProvider}
    </Badge>
  );
}
