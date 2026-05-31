import { JobSearchStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { JobSearchStatusAttributes } from '@/constants/job-searches/attributes';
import { cn } from '@/lib/css';

const JobSearchStatusBadge = ({
  className,
  errorMessage,
  status,
  variant = 'default',
}: {
  className?: string;
  errorMessage?: string | null;
  status: JobSearchStatus;
  variant?: 'default' | 'outline' | 'ghost';
}) => {
  console.log('status', status);
  if (!status || status === JobSearchStatus.FAILED) return null;

  const attributes = JobSearchStatusAttributes?.variants?.[variant]?.[status];
  const { className: badgeClassName, icon, label } = attributes;

  const badge = (
    <Badge className={cn(badgeClassName, className)} variant={variant}>
      {icon}

      <span>{label}</span>
    </Badge>
  );

  return badge;
};

export { JobSearchStatusBadge };
