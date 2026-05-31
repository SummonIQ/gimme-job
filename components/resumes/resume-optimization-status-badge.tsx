import { ResumeOptimizationStatus } from '@/generated/prisma/browser';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { ResumeOptimizationStatusAttributes } from '@/constants/resumes/optimization';
import { cn } from '@/lib/css';

const ResumeOptimizationStatusBadge = ({
  className,
  status,
  variant = 'default',
}: {
  className?: string;
  status: ResumeOptimizationStatus;
  variant?: 'default' | 'outline' | 'ghost';
}) => {
  const { variants } = ResumeOptimizationStatusAttributes;
  const variantAttributes = variants[variant] as Record<
    ResumeOptimizationStatus,
    {
      className: string;
      icon: ReactNode;
      label: string;
    }
  >;
  const { className: badgeClassName, icon, label } = variantAttributes[status];
  const isOptimized = status === ResumeOptimizationStatus.COMPLETED;

  return (
    <Badge className={cn(badgeClassName, className)} variant={variant}>
      {icon}

      <span
        className={cn(
          'text-current',
          isOptimized &&
            'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.55)]',
        )}
      >
        {label}
      </span>
    </Badge>
  );
};

export { ResumeOptimizationStatusBadge };
