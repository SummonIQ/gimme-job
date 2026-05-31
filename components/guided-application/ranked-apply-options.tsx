'use client';

import {
  rankApplyOptions,
  type RankedApplyOption,
} from '@/lib/guided-applications';
import { cn } from '@/lib/utils';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApplyOptionLink } from './apply-option-link';

interface ApplyOptionInput {
  link: string;
  method?: string;
  buttonText?: string;
  title?: string;
}

interface RankedApplyOptionsProps {
  applyOptions: ApplyOptionInput[];
  jobLeadId?: string;
  className?: string;
}

export function RankedApplyOptions({
  applyOptions,
  jobLeadId,
  className,
}: RankedApplyOptionsProps) {
  const [rankedOptions, setRankedOptions] = useState<RankedApplyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasKnownATS, setHasKnownATS] = useState(false);

  useEffect(() => {
    async function loadRankings() {
      if (!applyOptions || applyOptions.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await rankApplyOptions(applyOptions);
        setRankedOptions(result.rankedOptions);
        setHasKnownATS(result.hasKnownATS);
      } catch (error) {
        console.error('Failed to rank apply options:', error);
        // Fallback to unranked options
        setRankedOptions(
          applyOptions.map((opt, i) => ({
            ...opt,
            rank: i + 1,
            score: 0,
            atsName: null,
            difficulty: null,
            successRate: null,
            isRecommended: i === 0,
            reasoning: [],
          })),
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadRankings();
  }, [applyOptions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Analyzing application sites...
        </span>
      </div>
    );
  }

  if (rankedOptions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No application links available
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {hasKnownATS && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-blue-800 dark:text-blue-200">
            We&apos;ve analyzed these application sites and ranked them by
            compatibility. The recommended option is the best fit for AI Preview
            field guidance.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rankedOptions.map((option, index) => (
          <ApplyOptionLink
            key={`${option.link}-${index}`}
            link={option.link}
            title={option.title}
            buttonText={option.buttonText}
            jobLeadId={jobLeadId}
            atsName={option.atsName}
            difficulty={option.difficulty}
            isRecommended={option.isRecommended}
            score={option.score}
            showGuidedOption={true}
          />
        ))}
      </div>
    </div>
  );
}
