'use client';

import { AssistModeModal } from '@/components/job-applications/assist-mode-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ExternalLink, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface ApplyButtonProps {
  jobId: string;
  jobLeadId?: string;
  jobProvider?: string;
  applyUrl?: string;
  applyOptions?: Array<{ link: string; title?: string; buttonText?: string }>;
  userName?: string | null;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
}

export function ApplyButton({
  jobId,
  jobLeadId,
  jobProvider,
  applyUrl,
  applyOptions,
  userName,
  size = 'default',
  variant = 'default',
}: ApplyButtonProps) {
  const [assistOpen, setAssistOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [resolvedAssistApplyUrl, setResolvedAssistApplyUrl] = useState<
    string | null
  >(null);

  const applyOptionLinks = useMemo(
    () =>
      Array.isArray(applyOptions)
        ? applyOptions.map(option => option.link).filter(Boolean)
        : [],
    [applyOptions],
  );

  const isGoogleApplyLink = (link: string) => {
    try {
      const hostname = new URL(link).hostname;
      return (
        hostname === 'google.com' ||
        hostname.endsWith('.google.com') ||
        hostname.endsWith('.googleapis.com') ||
        hostname.endsWith('.gstatic.com')
      );
    } catch {
      return false;
    }
  };

  const fallbackAssistApplyUrl =
    applyOptionLinks.find(link => !isGoogleApplyLink(link)) ||
    applyOptionLinks[0] ||
    applyUrl;
  const assistApplyUrl = resolvedAssistApplyUrl ?? fallbackAssistApplyUrl;

  const resolveBestAssistApplyUrl = async (): Promise<string | null> => {
    const optionsForRanking =
      Array.isArray(applyOptions) && applyOptions.length > 0
        ? applyOptions
        : applyUrl
          ? [{ link: applyUrl }]
          : [];
    if (optionsForRanking.length === 0) {
      return null;
    }

    try {
      const response = await fetch(
        '/api/guided-applications/best-apply-option',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applyOptions: optionsForRanking,
            fallbackApplyUrl: applyUrl ?? null,
            jobProvider: jobProvider ?? null,
          }),
        },
      );
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as {
        bestApplyUrl?: string | null;
      };
      return data.bestApplyUrl ?? null;
    } catch {
      return null;
    }
  };

  const handleAssistSelect = async () => {
    const bestUrl = await resolveBestAssistApplyUrl();
    if (bestUrl) {
      setResolvedAssistApplyUrl(bestUrl);
    }
    setDropdownOpen(false);
    requestAnimationFrame(() => setAssistOpen(true));
  };

  // If there's no job provider or apply URL, just show a disabled button
  if (
    !jobProvider &&
    !applyUrl &&
    (!applyOptions || applyOptions.length === 0)
  ) {
    return (
      <Button size={size} variant={variant} disabled>
        <Send className="h-4 w-4" />
        Apply
      </Button>
    );
  }

  // Determine the best URL for guided application
  const guidedApplyUrl = applyUrl || applyOptions?.[0]?.link;

  // If there's only a direct apply URL and no integrated application system
  if (
    !jobProvider &&
    applyUrl &&
    (!applyOptions || applyOptions.length === 0)
  ) {
    return (
      <>
        <AssistModeModal
          applyUrl={assistApplyUrl ?? null}
          jobLeadId={jobLeadId ?? null}
          onClose={() => setAssistOpen(false)}
          open={assistOpen}
          userName={userName}
        />
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size={size}
              variant={variant}
              className="inline-flex items-center"
            >
              <Send className="h-4 w-4" />
              Apply
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              disabled={!assistApplyUrl}
              onSelect={event => {
                event.preventDefault();
                void handleAssistSelect();
              }}
            >
              <Sparkles className="h-4 w-4" />
              Open AI Preview
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open in Browser
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  // If we have an integrated application system or multiple options, show dropdown
  return (
    <>
      <AssistModeModal
        applyUrl={assistApplyUrl ?? null}
        jobLeadId={jobLeadId ?? null}
        onClose={() => setAssistOpen(false)}
        open={assistOpen}
        userName={userName}
      />
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            variant={variant}
            className="inline-flex items-center"
          >
            <Send className="h-4 w-4" />
            Apply
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          {guidedApplyUrl && (
            <>
              <DropdownMenuItem
                disabled={!assistApplyUrl}
                onSelect={event => {
                  event.preventDefault();
                  void handleAssistSelect();
                }}
              >
                <Sparkles className="h-4 w-4" />
                Open AI Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {jobProvider === 'INDEED' && (
            <DropdownMenuItem asChild>
              <Link href={`/jobs/${jobId}/apply/indeed` as never}>
                <Send className="h-4 w-4" />
                Indeed Quick Apply
              </Link>
            </DropdownMenuItem>
          )}

          {jobProvider === 'LINKEDIN' && (
            <DropdownMenuItem asChild>
              <Link href={`/jobs/${jobId}/apply/linkedin` as never}>
                <Send className="h-4 w-4" />
                LinkedIn Easy Apply
              </Link>
            </DropdownMenuItem>
          )}

          {applyUrl && (
            <DropdownMenuItem asChild>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open in Browser
              </a>
            </DropdownMenuItem>
          )}

          {applyOptions && applyOptions.length > 1 && (
            <>
              <DropdownMenuSeparator />
              {applyOptions.slice(1).map((option, index) => (
                <DropdownMenuItem key={index} asChild>
                  <a
                    href={option.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {option.title || option.buttonText || `Option ${index + 2}`}
                  </a>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
