import type { JobListingStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { JobListingStatusAttributes } from '@/constants/job-listings/attributes';
import { cn } from '@/lib/utils';

const JobListingStatusBadge = ({
  className,
  status,
  variant = 'default',
}: {
  className?: string;
  status: JobListingStatus;
  variant?: 'default' | 'outline' | 'ghost';
}) => {
  const { variants } = JobListingStatusAttributes;
  const { className: badgeClassName, icon, label } = variants[variant][status];

  return (
    <Badge className={cn('[&_svg]:text-current', badgeClassName, className)} variant={variant}>
      {icon}

      <span>{label}</span>
    </Badge>
  );
};

export { JobListingStatusBadge };
