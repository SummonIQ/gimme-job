'use client';

import { JobListing } from '@/generated/prisma/browser';
import { motion } from 'framer-motion';
import { Building2, Check } from 'lucide-react';
import { useMemo } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/css';
import { formatLocationLabel } from '@/lib/utils';
import {
  DentalCoverageBadge,
  HealthInsuranceBadge,
  PtoBadge,
  RemoteBadge,
} from './job-badges';
import { JobListingStatusBadge } from './job-listing-status-badge';

interface JobListingCardProps {
  isSelected: boolean;
  job: JobListing;
  onClick?: () => void;
  onSelect: () => void;
}

const DESCRIPTION_HEADING_PREFIX =
  /^(?:(?:description|descirption)\s+overview|(?:job|position|role|department)\s+(?:description|overview)|description|descirption|overview|job\s+duties|about\s+(?:the\s+)?role)\b[\s:.\-–—]*/i;

function cleanDescriptionPreview(description: string): string {
  let preview = description
    .slice(0, 1200)
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (let i = 0; i < 3; i += 1) {
    const next = preview.replace(DESCRIPTION_HEADING_PREFIX, '').trimStart();
    if (next === preview) break;
    preview = next;
  }

  return preview.trim();
}

function formatSalaryValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toLocaleString();
}

export function JobListingCard({
  isSelected,
  job,
  onClick,
  onSelect,
}: JobListingCardProps) {
  // Clean description for display
  const cleanDescription = useMemo(() => {
    if (!job.description) return undefined;
    return cleanDescriptionPreview(job.description);
  }, [job.description]);
  const showRemoteBadge = Boolean(
    job.remote &&
    !/remote|anywhere|work\s*from\s*home/i.test(job.location ?? ''),
  );
  const hasFooterBadges = Boolean(
    showRemoteBadge ||
    job.healthInsurance ||
    job.dentalCoverage ||
    job.paidTimeOff,
  );

  return (
    <Card
      className={cn(
        'group relative cursor-pointer active:bg-muted/20 transition-all border-0 border-b border-border/30 dark:border-b-white/5 shadow-none drop-shadow-none rounded-none bg-transparent p-4 md:p-6',
        'hover:bg-muted/10',
        isSelected && 'bg-primary/5',
      )}
      onClick={onClick}
      role="article"
      aria-label={`Job listing: ${job.title}${job.company ? ` at ${job.company}` : ''}`}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-0 top-0 h-28 w-32 origin-top-left -translate-x-5 -translate-y-5 scale-90 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.16),transparent_68%)] opacity-0 transition-[opacity,transform] duration-300 ease-out dark:bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18),transparent_68%)]',
          'group-hover:translate-x-0 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
          isSelected && 'translate-x-0 translate-y-0 scale-100 opacity-100',
        )}
      />
      <div className="absolute right-5 top-5 z-20 md:right-7 md:top-7">
        <JobListingStatusBadge status={job.status} />
      </div>

      <div className="flex gap-3">
        <motion.button
          animate={
            isSelected
              ? {
                  rotate: [0, -4, 3, -1, 0],
                  scale: [1, 1.08, 0.97, 1.02, 1],
                }
              : { rotate: 0, scale: 1 }
          }
          aria-checked={isSelected}
          aria-label={`Select ${job.title} job listing`}
          className={cn(
            'group/logo relative size-12 shrink-0 overflow-hidden rounded-xl outline-none transition-colors duration-200 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isSelected
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : job.companyLogoUrl
                ? 'bg-white/95 text-primary-foreground dark:bg-white/95'
                : 'bg-foreground/15 text-foreground/60 dark:bg-white/[0.08] dark:text-white/65',
            !isSelected &&
              'hover:bg-primary hover:text-primary-foreground hover:shadow-sm hover:shadow-primary/20',
          )}
          onClick={e => {
            e.stopPropagation();
            onSelect();
          }}
          role="checkbox"
          transition={{
            duration: 0.46,
            ease: [0.22, 1, 0.36, 1],
            times: [0, 0.28, 0.55, 0.78, 1],
          }}
          type="button"
          whileTap={{ rotate: -3, scale: 0.94 }}
        >
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-200 ease-out',
              isSelected
                ? 'scale-90 opacity-0'
                : 'scale-100 opacity-100 group-hover/logo:scale-90 group-hover/logo:opacity-0',
            )}
          >
            {job.companyLogoUrl ? (
              <img
                alt=""
                className="size-full max-h-12 max-w-12 rounded-lg object-contain"
                loading="lazy"
                src={job.companyLogoUrl}
              />
            ) : (
              <Building2 className="size-5 text-current" />
            )}
          </span>
          <span
            className={cn(
              'absolute inset-0 flex translate-y-0.5 scale-75 items-center justify-center text-primary-foreground opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/logo:translate-y-0 group-hover/logo:scale-100 group-hover/logo:opacity-100',
              isSelected && 'translate-y-0 scale-100 opacity-100',
            )}
          >
            <Check
              className="size-5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]"
              strokeWidth={3}
            />
          </span>
        </motion.button>
        <div className="flex -translate-y-px flex-col">
          {/* Title */}
          <div className="mt-1 flex flex-wrap items-center pr-16">
            <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {job.title}
            </h3>
            {job.saved ? (
              <span className="inline-flex items-center text-xs font-semibold text-amber-500 ml-2">
                Saved
              </span>
            ) : null}
          </div>

          {/* Company, Location & Salary */}
          <div className="flex flex-wrap items-center gap-y-2 pb-3 pt-0.5 text-sm text-muted-foreground">
            {[
              job.company && (
                <div className="flex items-center" key="company">
                  <span className="truncate">{job.company}</span>
                </div>
              ),
              job.location && (
                <div className="flex items-center" key="location">
                  <span className="truncate">
                    {formatLocationLabel(job.location)}
                  </span>
                </div>
              ),
              job.salary && !/^[\s$€£¥0.,]*$/.test(job.salary) && (
                <span className="font-medium" key="salary">
                  {(() => {
                    // Parse JSON salary objects
                    let salaryStr = job.salary;
                    if (salaryStr.startsWith('{')) {
                      try {
                        const parsed = JSON.parse(salaryStr);
                        const currency =
                          parsed.currency === '$' || parsed.currency === 'USD'
                            ? '$'
                            : (parsed.currency ?? '$');
                        const min = parsed.minValue ?? parsed.value;
                        const max = parsed.maxValue;
                        const unit = parsed.unitText
                          ? `/${parsed.unitText.toLowerCase().replace('year', 'yr').replace('hour', 'hr').replace('month', 'mo')}`
                          : '';
                        const minValue = formatSalaryValue(min);
                        const maxValue = formatSalaryValue(max);
                        if (minValue && maxValue && minValue !== maxValue) {
                          salaryStr = `${currency}${minValue} – ${currency}${maxValue}${unit}`;
                        } else if (minValue) {
                          salaryStr = `${currency}${minValue}${unit}`;
                        } else {
                          return null;
                        }
                      } catch {
                        // Not valid JSON, continue with string normalization
                      }
                    }

                    // Normalize salary display
                    let trimmed = salaryStr
                      .trim()
                      .replace(/\bUSD\s*/gi, '$')
                      .replace(/\bEUR\s*/gi, '€')
                      .replace(/\bGBP\s*/gi, '£')
                      .replace(/\bJPY\s*/gi, '¥')
                      .replace(/\bCAD\s*/gi, 'CA$')
                      .replace(/\bAUD\s*/gi, 'AU$')
                      .replace(/một giờ/gi, '/hr')
                      .replace(/mỗi giờ/gi, '/hr')
                      .replace(/một năm/gi, '/yr')
                      .replace(/mỗi năm/gi, '/yr')
                      .replace(/một tháng/gi, '/mo')
                      .replace(/mỗi tháng/gi, '/mo')
                      .replace(/\s*US\$\s*/g, '$')
                      .replace(/\$\s*\$/g, '$') // Fix duplicate $ signs
                      .replace(/\s+/g, ' ') // Normalize whitespace
                      .trim();
                    const currencyPrefixRegex = /^(?:[A-Za-z]{2,3}\$|\$|€|£|¥)/;
                    const hasCurrencyPrefix = currencyPrefixRegex.test(trimmed);
                    const normalizedSalary =
                      !hasCurrencyPrefix && /^\d/.test(trimmed)
                        ? `$${trimmed}`
                        : trimmed;

                    if (/\bNaN\b/i.test(normalizedSalary)) return null;

                    // Range formatting: if first value has a currency prefix but the second doesn't,
                    // add the same prefix to the second value.
                    const rangeMatch = normalizedSalary.match(
                      /^(.+?)\s*[-–]\s*(.+?)(\s.*)?$/,
                    );
                    if (rangeMatch) {
                      const [, rawFirst, rawSecond, rawSuffix] = rangeMatch;
                      const first = rawFirst.trim();
                      let second = rawSecond.trim();
                      const suffix = rawSuffix ?? '';

                      const prefix =
                        first.match(currencyPrefixRegex)?.[0] ?? '';
                      const secondHasPrefix = currencyPrefixRegex.test(second);
                      if (prefix && !secondHasPrefix) {
                        second = `${prefix}${second}`;
                      }

                      return (
                        <>
                          {first}
                          <span className="text-muted-foreground mx-1.5">
                            –
                          </span>
                          {second}
                          {suffix && (
                            <span className="text-muted-foreground">
                              {suffix}
                            </span>
                          )}
                        </>
                      );
                    }

                    return normalizedSalary;
                  })()}
                </span>
              ),
            ]
              .filter(Boolean)
              .map((item, index, arr) => (
                <div className="flex items-center" key={index}>
                  {item}
                  {index < arr.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="inline-block px-4 text-muted-foreground/70 select-none leading-none"
                    >
                      &bull;
                    </span>
                  )}
                </div>
              ))}
          </div>

          {/* Description - clamped to 3 lines */}
          {cleanDescription && cleanDescription !== job.jobType && (
            <div className="border-t border-border/30 pt-3 dark:border-white/10">
              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {cleanDescription}
              </p>
            </div>
          )}

          {/* Badges Row */}
          {hasFooterBadges && (
            <div className="flex items-center gap-4 pt-5">
              <div className="flex flex-wrap gap-2 items-center min-w-0">
                <RemoteBadge remote={showRemoteBadge} />
                <HealthInsuranceBadge
                  hasHealthInsurance={job.healthInsurance}
                />
                <DentalCoverageBadge hasDentalCoverage={job.dentalCoverage} />
                <PtoBadge hasPto={job.paidTimeOff} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
