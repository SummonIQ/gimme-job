'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { TbCancel } from 'react-icons/tb';

import { Button } from '../ui/button';

const DeleteResumeButton = ({
  deleteResume,
  redirectTo = '/profile',
  resumeId,
}: {
  deleteResume: (resumeId: string) => Promise<void>;
  redirectTo: string;
  resumeId: string;
}) => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      action={formData => {
        const resumeId = formData.get('resumeId') as string;
        startTransition(async () => {
          await deleteResume(resumeId);

          router.push(redirectTo);
        });
      }}
      className="inline"
    >
      <input name="resumeId" type="hidden" value={resumeId} />

      <Button
        className="gap-2 font-semibold text-red-500/70 transition-all duration-300 hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-500/90 hover:shadow-lg hover:shadow-red-500/20"
        size="sm"
        type="submit"
        variant="outline"
      >
        <TbCancel className="size-4" />
        <span className="text-sm font-semibold">
          {isPending ? 'Deleting...' : 'Delete'}
        </span>
      </Button>
    </form>
  );
};

export { DeleteResumeButton };
