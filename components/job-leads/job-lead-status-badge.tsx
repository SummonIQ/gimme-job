import type { JobLeadStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { JobLeadStatusAttributes } from '@/constants/job-leads/attributes';
import { cn } from '@/lib/css';

const JobLeadStatusBadge = ({
  className,
  muted = false,
  status,
  variant = 'default',
}: {
  className?: string;
  muted?: boolean;
  status: JobLeadStatus;
  variant?: 'default' | 'outline' | 'ghost';
}) => {
  const { variants } = JobLeadStatusAttributes;
  const { className: badgeClassName, icon, label } = variants[variant][status];

  return (
    <Badge className={cn(badgeClassName, className)} variant={variant}>
      {icon}

      <span>{label}</span>
    </Badge>
  );
};

export { JobLeadStatusBadge };
