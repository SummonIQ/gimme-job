'use client';

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';

import { restoreArchivedQueueItemAction } from '../actions';

interface RestoreArchivedButtonProps {
  jobId: string;
}

export function RestoreArchivedButton({ jobId }: RestoreArchivedButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await restoreArchivedQueueItemAction(jobId);
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? 'Restoring…' : 'Restore'}
    </Button>
  );
}
