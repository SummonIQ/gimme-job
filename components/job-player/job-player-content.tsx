import type { JobListing } from '@/generated/prisma/browser';
import {
  Briefcase,
  Building2,
  Check,
  Clock3,
  DollarSign,
  ExternalLink,
  FileText,
  ListChecks,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

import { JobDescription } from '@/components/job-listings/job-description';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/css';
import { formatLocationLabel } from '@/lib/utils';

interface JobPlayerContentProps {
  job: JobListing;
}

export function JobPlayerContent({ job }: JobPlayerContentProps) {
  const sections = [
    {
      accent: 'text-primary',
      id: 'job-player-requirements',
      items: readTextList(job.requirements),
      title: 'Requirements',
    },
    {
      accent: 'text-primary',
      id: 'job-player-qualifications',
      items: readTextList(job.qualifications),
      title: 'Qualifications',
    },
    {
      accent: 'text-primary',
      id: 'job-player-responsibilities',
      items: readTextList(job.responsibilities),
      title: 'Responsibilities',
    },
    {
      accent: 'text-emerald-500',
      icon: Check,
      id: 'job-player-benefits',
      items: readTextList(job.benefits),
      title: 'Benefits',
    },
  ];
  const visibleSections = sections.filter(section => section.items.length > 0);
  const postedAt = job.postedAt ? formatDate(job.postedAt) : null;
  const companyName = job.company || 'Company unavailable';

  return (
    <div className="grid h-full min-h-0 bg-background dark:bg-[#0d0d11] lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-h-0 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-5 sm:px-7">
          <section className="flex flex-col gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {job.companyLogoUrl ? (
                <img
                  alt={`${companyName} logo`}
                  className="size-14 shrink-0 rounded-2xl border border-border/60 bg-muted/40 object-contain p-2 shadow-xs dark:border-white/10 dark:bg-white/[0.04]"
                  loading="lazy"
                  src={job.companyLogoUrl}
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/50 text-muted-foreground shadow-xs dark:border-white/10 dark:bg-white/[0.04]">
                  <Building2 className="size-6" aria-hidden="true" />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Company
                </div>
                <h3 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                  {companyName}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {job.remote ? (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-primary/10 text-xs text-primary"
                >
                  Remote
                </Badge>
              ) : null}
              {job.jobType && job.jobType !== 'UNKNOWN' ? (
                <Badge variant="outline" className="rounded-full text-xs">
                  {formatJobType(job.jobType)}
                </Badge>
              ) : null}
              <Badge variant="outline" className="rounded-full text-xs">
                {formatJobType(job.status)}
              </Badge>
            </div>

            <div className="grid gap-3 border-y border-border/60 py-4 text-sm text-muted-foreground dark:border-white/10 sm:grid-cols-2">
              {job.location ? (
                <InfoItem
                  label="Location"
                  value={formatLocationLabel(job.location)}
                />
              ) : null}
              {job.salary && !/^[\s$€£¥0.,]*$/.test(job.salary) ? (
                <InfoItem label="Salary" value={job.salary} />
              ) : null}
              {postedAt ? (
                <InfoItem label="Posted" value={postedAt} />
              ) : null}
              {job.jobProvider ? (
                <InfoItem
                  label="Source"
                  value={formatJobType(job.jobProvider)}
                />
              ) : null}
            </div>
          </section>

          {job.description ? (
            <section
              className="flex flex-col gap-3 border-t border-border/60 pt-5 dark:border-white/10"
              id="job-player-description"
            >
              <SectionHeading title="Description" />
              <JobDescription
                description={job.description}
                className="flex flex-col gap-3 text-[0.95rem] leading-7 text-foreground/78 dark:text-slate-300/90"
              />
            </section>
          ) : null}

          {visibleSections.map(section => (
            <ListSection
              accent={section.accent}
              id={section.id}
              icon={section.icon}
              items={section.items}
              key={section.title}
              title={section.title}
            />
          ))}
        </div>
      </div>

      <aside className="hidden min-h-0 overflow-y-auto border-l border-border/60 bg-background dark:border-white/10 dark:bg-[#101014] lg:block">
        <div className="flex flex-col gap-6 px-5 py-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quick Navigation
            </h3>
            <div className="grid gap-1">
              {job.description ? (
                <JumpLink href="#job-player-description" label="Description" />
              ) : null}
              {visibleSections.map(section => (
                <JumpLink
                  href={`#${section.id}`}
                  key={section.id}
                  label={section.title}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Job Snapshot
            </h3>
            <div className="divide-y divide-border/60 border-y border-border/60 dark:divide-white/10 dark:border-white/10">
              <SnapshotItem label="Status" value={formatJobType(job.status)} />
              {job.remote ? (
                <SnapshotItem label="Work mode" value="Remote" />
              ) : null}
              {job.jobType && job.jobType !== 'UNKNOWN' ? (
                <SnapshotItem label="Type" value={formatJobType(job.jobType)} />
              ) : null}
              {postedAt ? (
                <SnapshotItem label="Posted" value={postedAt} />
              ) : null}
              {job.jobProviderUrl ? (
                <a
                  className="group mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm font-medium text-foreground/85 transition-colors hover:border-primary/35 hover:text-primary dark:border-white/10 dark:bg-white/[0.035]"
                  href={job.jobProviderUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source
                  <ExternalLink
                    className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden="true"
                  />
                </a>
              ) : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
        {label}
      </div>
      <div className="truncate text-sm font-medium text-foreground/85">
        {value}
      </div>
    </div>
  );
}

function ListSection({
  accent,
  id,
  icon: Icon,
  items,
  title,
}: {
  accent: string;
  id: string;
  icon?: LucideIcon;
  items: readonly string[];
  title: string;
}) {
  return (
    <section
      className="flex flex-col gap-3 border-t border-border/60 pt-5 dark:border-white/10"
      id={id}
    >
      <SectionHeading icon={Icon ?? ListChecks} title={title} />
      <ul className="flex flex-col gap-2.5 text-[0.95rem] leading-7 text-foreground/78 dark:text-slate-300/90">
        {items.map(item => (
          <li className="flex gap-2.5" key={item}>
            {Icon ? (
              <Icon
                className={cn('mt-1 size-3.5 shrink-0', accent)}
                aria-hidden="true"
              />
            ) : (
              <span
                className={cn(
                  'mt-2 size-1.5 shrink-0 rounded-full bg-current',
                  accent,
                )}
              />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {Icon ? (
        <span className="flex size-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-xs dark:border-primary/30 dark:bg-primary/15">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

function JumpLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted/60 hover:text-foreground dark:hover:bg-white/[0.04]"
      href={href}
    >
      {label}
    </a>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">
        {label}
      </div>
      <div className="text-right text-sm font-medium text-foreground/85">
        {value}
      </div>
    </div>
  );
}

function readTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function formatJobType(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
