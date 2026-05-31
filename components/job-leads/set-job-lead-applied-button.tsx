'use client';

import { CheckCircleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
/*
isSaved
            ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-500 hover:shadow-yellow-500/20'
            : 'border-yellow-500/15 bg-yellow-500/5 text-yellow-500/70 shadow-yellow-500/10 hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-500 hover:shadow-yellow-500/25 dark:hover:shadow-yellow-500/20',*/

export function SetJobLeadAppliedButton({
  action,
  jobLeadId,
}: {
  action: (jobLeadId: string) => Promise<void>;
  jobLeadId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      action={formData => {
        const jobLeadId = formData.get('jobLeadId') as string;
        startTransition(async () => {
          await action(jobLeadId);
          router.refresh();
        });
      }}
      className="flex justify-end text-balance"
    >
      <input name="jobLeadId" type="hidden" value={jobLeadId} />

      <Button
        className="text-yellow-400/90 hover:text-yellow-400 border drop-shadow-sm shadow-yellow-500/10 hover:shadow-yellow-500/20 border-yellow-500/10 hover:border-yellow-400/60 font-semibold bg-yellow-400/5 py-1 px-2"
        size="sm"
        disabled={isPending}
        type="submit"
      >
        <CheckCircleIcon className="w-4 h-4" />

        <span className="text-sm font-semibold">
          {isPending ? 'Saving' : 'Mark as Applied'}
        </span>
      </Button>
    </form>
  );
}
