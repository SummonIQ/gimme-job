'use client';

import Markdown from 'react-markdown';

import { cn } from '@/lib/css';

export function MarkdownPreview({
  className,
  markdown,
  paged = false,
}: {
  className?: string;
  markdown: string;
  paged?: boolean;
}) {
  const pages = paged
    ? markdown
        .split(/\n\s*---\s*\n/g)
        .map(page => page.trim())
        .filter(Boolean)
    : [];

  if (paged && pages.length > 1) {
    return (
      <div className="space-y-6">
        {pages.map((page, index) => (
          <div
            className={cn(
              'prose prose-slate relative h-full max-w-none grow text-sm text-foreground dark:prose-invert',
              className,
            )}
            key={`resume-page-${index}`}
          >
            <Markdown>{page}</Markdown>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'prose prose-slate relative h-full max-w-none grow text-sm text-foreground dark:prose-invert',
        className,
      )}
    >
      <Markdown>{markdown}</Markdown>
    </div>
  );
}
