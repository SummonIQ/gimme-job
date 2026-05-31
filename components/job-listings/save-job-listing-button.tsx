'use client';

import type { JobListing } from '@/generated/prisma/browser';
import { StarFilledIcon, StarIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '../ui/button';

interface SaveJobListingButtonProps {
  jobListingId: string;
  save: (jobListingId: string) => Promise<JobListing>;
  saved?: boolean;
  unsave: (savedJobListingId: string) => Promise<JobListing>;
}

const SaveJobListingButton = ({
  jobListingId,
  saved,
  save,
  unsave,
}: SaveJobListingButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(saved);
  const router = useRouter();

  return (
    <form
      action={formData => {
        const jobListingId = formData.get('jobListingId') as string;
        startTransition(async () => {
          if (isSaved) {
            await unsave(jobListingId);
            setIsSaved(false);
          } else {
            await save(jobListingId);
            setIsSaved(true);
          }

          router.refresh();
        });
      }}
      className="flex justify-end text-balance"
    >
      <input name="jobListingId" type="hidden" value={jobListingId} />

      <Button
        className={cn(
          'space-x-0 place-self-start shadow-sm drop-shadow-sm transition-all duration-300 hover:shadow-lg',
          isSaved
            ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-500 hover:shadow-yellow-500/20'
            : 'border-yellow-500/15 bg-yellow-500/5 text-yellow-500/70 shadow-yellow-500/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-500 hover:shadow-yellow-500/25 dark:hover:shadow-yellow-500/20',
        )}
        disabled={isPending}
        size="sm"
        type="submit"
        variant="outline"
        aria-label={isSaved ? 'Remove from saved jobs' : 'Save job'}
        aria-pressed={isSaved}
      >
        {isSaved ? (
          <StarFilledIcon className="!size-4" aria-hidden="true" />
        ) : (
          <StarIcon className="!size-4" aria-hidden="true" />
        )}

        <span className="text-sm font-semibold">
          {isPending ? 'Saving' : isSaved ? 'Saved' : 'Save'}
        </span>
      </Button>
    </form>
  );
};
SaveJobListingButton.displayName = 'SaveJobListingButton';

export { SaveJobListingButton };
