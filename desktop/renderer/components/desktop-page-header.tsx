import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface DesktopPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export const DesktopPageHeader = ({
  title,
  description,
  actions,
  className,
}: DesktopPageHeaderProps) => {
  return (
    <div
      role="region"
      aria-label="Page header"
      className={cn(
        'desktop-page-header flex shrink-0 flex-col gap-1 px-6 pb-3 pt-5 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-y-0.5">
        <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-[12px] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
};
DesktopPageHeader.displayName = 'DesktopPageHeader';
