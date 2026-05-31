import { JobFitAnalysisStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { JobFitAnalysisStatusAttributes } from '@/constants/job-leads/job-fit/attributes';
import { cn } from '@/lib/css';

const JobFitAnalysisStatusBadge = ({
  className,
  status,
  variant = 'default',
}: {
  className?: string;
  status: JobFitAnalysisStatus;
  variant?: 'default' | 'outline' | 'ghost';
}) => {
  const attributes =
    JobFitAnalysisStatusAttributes?.variants?.[variant]?.[status];
  const { className: badgeClassName, icon, label } = attributes;

  return (
    <Badge className={cn(badgeClassName, className)} variant={variant}>
      {icon}

      <span>{label}</span>
    </Badge>
  );
};

export { JobFitAnalysisStatusBadge };
