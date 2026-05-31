import { Info } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface AssistPreviewSubmitBannerProps {
  className?: string;
}

export function AssistPreviewSubmitBanner({
  className,
}: AssistPreviewSubmitBannerProps) {
  return (
    <Alert className={cn('my-0', className)} variant="warning">
      <Info />
      <AlertTitle>AI Preview only</AlertTitle>
      <AlertDescription>
        This preview cannot submit applications. Submit via the desktop runtime
        or manually.
      </AlertDescription>
    </Alert>
  );
}
