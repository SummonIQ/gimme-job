import { ResumeAnalysisStatus } from '@/generated/prisma/browser';

import { Badge } from '@/components/ui/badge';
import { ResumeAnalysisStatusAttributes } from '@/constants/resumes/analysis/attributes';
import { cn } from '@/lib/css';

const ResumeAnalysisStatusBadge = ({
  className,
  status,
  variant = 'default',
}: {
  className?: string;
  status: ResumeAnalysisStatus;
  variant?: 'default' | 'outline' | 'ghost';
}) => {
  const { variants } = ResumeAnalysisStatusAttributes;
  const { className: badgeClassName, icon, label } = variants[variant][status];

  return (
    <Badge className={cn(badgeClassName, className)} variant={variant}>
      {icon}

      <span>{label}</span>
    </Badge>
  );
};

export { ResumeAnalysisStatusBadge };
