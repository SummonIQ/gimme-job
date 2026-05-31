'use client';

import { JobProvider, type JobListing } from '@/generated/prisma/browser';
import { Briefcase, Building2, Globe, Link2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface JobSourceIconProps {
  job: JobListing;
  className?: string;
}

const getSourceMeta = (
  job: Pick<JobListing, 'jobProvider' | 'source'>,
): { label: string; Icon: typeof Briefcase; className?: string } | null => {
  const normalizedSource = job.source?.toLowerCase();

  if (
    job.jobProvider === JobProvider.SERPAPI ||
    normalizedSource?.includes('google')
  ) {
    return { label: 'Google', Icon: Search, className: 'text-red-500/80' };
  }

  if (
    job.jobProvider === JobProvider.INDEED ||
    normalizedSource?.includes('indeed')
  ) {
    return { label: 'Indeed', Icon: Briefcase, className: 'text-blue-500/80' };
  }

  if (
    job.jobProvider === JobProvider.LINKEDIN ||
    normalizedSource?.includes('linkedin')
  ) {
    return { label: 'LinkedIn', Icon: Link2, className: 'text-sky-500/80' };
  }

  if (
    job.jobProvider === JobProvider.COMPANY_DIRECT ||
    normalizedSource?.includes('company')
  ) {
    return {
      label: 'Company',
      Icon: Building2,
      className: 'text-emerald-500/80',
    };
  }

  if (normalizedSource?.includes('coresignal')) {
    return {
      label: 'CoreSignal',
      Icon: Globe,
      className: 'text-indigo-500/80',
    };
  }

  if (
    job.jobProvider === JobProvider.THEIRSTACK ||
    normalizedSource?.includes('theirstack')
  ) {
    return {
      label: 'TheirStack',
      Icon: Globe,
      className: 'text-violet-500/80',
    };
  }

  if (job.jobProvider === JobProvider.OTHER && job.source) {
    return { label: job.source, Icon: Globe, className: 'text-slate-500/80' };
  }

  return null;
};

const pruneValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : undefined;
  }
  if (Array.isArray(value)) {
    const cleaned = value
      .map(item => pruneValue(item))
      .filter(item => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => [key, pruneValue(val)] as const)
      .filter(([, val]) => val !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return value;
};

const buildCleanedJobJson = (job: JobListing) => {
  const cleaned = pruneValue(job) as Record<string, unknown> | undefined;
  return cleaned ? JSON.stringify(cleaned, null, 2) : '{}';
};

export function JobSourceIcon({ job, className }: JobSourceIconProps) {
  const meta = getSourceMeta(job);
  if (!meta) return null;

  const { Icon, label, className: colorClass } = meta;
  const [open, setOpen] = useState(false);
  const json = useMemo(() => buildCleanedJobJson(job), [job]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn('inline-flex items-center', className)}
          title={label}
          aria-label={`Source: ${label}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <Icon className={cn('h-3.5 w-3.5', colorClass)} aria-hidden="true" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[360px] max-w-[80vw] border-border/60 bg-popover/95 p-3 shadow-lg"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="text-xs font-semibold text-muted-foreground mb-2">
          {label} payload
        </div>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-4 text-foreground">
          {json}
        </pre>
      </PopoverContent>
    </Popover>
  );
}
