'use client';

import { JobListing } from '@/generated/prisma/browser';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { TbCancel } from 'react-icons/tb';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DismissJobListingButtonProps {
  dismiss: (id: string) => Promise<JobListing>;
  isDismissed?: boolean;
  jobListingId: string;
  saved?: boolean;
}

const DismissJobListingButton = ({
  dismiss,
  jobListingId,
  saved,
  isDismissed,
}: DismissJobListingButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      action={formData => {
        const jobListingId = formData.get('jobListingId') as string;
        startTransition(async () => {
          await dismiss(jobListingId);

          router.refresh();
        });
      }}
    >
      <input name="jobListingId" type="hidden" value={jobListingId} />

      <Button
        className={cn(
          'space-x-0 border-input/75 text-muted-foreground shadow-sm ring ring-transparent ring-offset-0 drop-shadow-sm transition-all duration-300 hover:shadow-lg dark:border-input/85 dark:hover:shadow-background',
          isDismissed
            ? 'pointer-events-none cursor-default'
            : 'hover:border-red-400/25 hover:bg-background hover:text-red-400 hover:shadow-red-400/20 dark:hover:border-red-400/30',
        )}
        disabled={isPending || isDismissed}
        size="sm"
        type="submit"
        variant="outline"
        aria-label={isDismissed ? 'Job dismissed' : 'Dismiss job'}
        aria-pressed={isDismissed}
      >
        <TbCancel className="size-4" aria-hidden="true" />
        <span className="text-sm font-semibold">
          {' '}
          {isPending ? 'Saving...' : isDismissed ? 'Dismissed' : 'Dismiss'}
        </span>
      </Button>
      {/* 
        className={cn(
          'space-x-0 border-blue-500/10 bg-primary/80 text-primary-foreground shadow-sm shadow-transparent drop-shadow-sm transition-all duration-300 hover:border-blue-500/30 hover:bg-blue-600 hover:text-primary-foreground hover:shadow-lg hover:shadow-blue-500/20',
          isDismissed
            ? 'pointer-events-none cursor-default border-blue-500/10 bg-primary/10 text-primary shadow-transparent hover:border-blue-500/20 hover:bg-primary/10 hover:text-primary hover:shadow-none'
            : '', */}
    </form>
  );
};
DismissJobListingButton.displayName = 'DismissJobListingButton';

export { DismissJobListingButton };
