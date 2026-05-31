'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { startGuidedApplication } from '@/lib/guided-applications';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface ApplyOptionLinkProps {
  link: string;
  title?: string;
  buttonText?: string;
  jobLeadId?: string;
  atsName?: string | null;
  difficulty?: string | null;
  isRecommended?: boolean;
  score?: number;
  showGuidedOption?: boolean;
  className?: string;
}

export function ApplyOptionLink({
  link,
  title,
  buttonText,
  jobLeadId,
  atsName,
  difficulty,
  isRecommended = false,
  score,
  showGuidedOption = true,
  className,
}: ApplyOptionLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const displayTitle = title || buttonText || getDomainFromUrl(link);

  const handleGuidedApply = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startGuidedApplication({
          applicationUrl: link,
          jobLeadId: jobLeadId,
        });

        if (result.success && result.applicationId) {
          router.push(`/apply/${result.applicationId}`);
        } else {
          setError(result.error || 'Failed to start guided application');
        }
      } catch (err) {
        setError('An unexpected error occurred');
        console.error('Guided application error:', err);
      }
    });
  };

  const getDifficultyColor = (diff: string | null) => {
    switch (diff) {
      case 'Easy':
        return 'bg-green-100 text-green-800';
      case 'Medium':
        return 'bg-orange-100 text-orange-800';
      case 'Hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3',
        isRecommended && 'border-primary/50 bg-primary/5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">{displayTitle}</h4>
            {isRecommended && (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary text-xs"
              >
                <Zap className="h-3 w-3" />
                Recommended
              </Badge>
            )}
            {atsName && (
              <Badge variant="outline" className="text-xs">
                {atsName}
              </Badge>
            )}
            {difficulty && (
              <Badge className={cn('text-xs', getDifficultyColor(difficulty))}>
                {difficulty}
              </Badge>
            )}
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-muted-foreground hover:text-primary mt-1"
          >
            {link}
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        {showGuidedOption && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleGuidedApply}
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Open AI Preview
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Preview the application form and field suggestions. This
                  preview cannot submit applications.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {showGuidedOption ? '' : 'Open'}
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Open application in new tab (manual)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {score !== undefined && score > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>Compatibility score: {score.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return url;
  }
}
