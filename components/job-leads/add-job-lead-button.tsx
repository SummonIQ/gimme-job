'use client';

import type { JobLead } from '@/generated/prisma/browser';
import { JobListingStatus } from '@/generated/prisma/browser';
import { Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TbTargetArrow } from 'react-icons/tb';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/css';

import { Button } from '../ui/button';
interface AddJobListingToLeadsButtonProps {
  addToLeads: (jobListingId: string) => Promise<JobLead | undefined>;
  hasDefaultResume: boolean;
  isLead: boolean;
  jobListingId: string;
}

const AddJobListingToLeadsButton = ({
  addToLeads,
  hasDefaultResume,
  jobListingId,
  isLead,
}: AddJobListingToLeadsButtonProps) => {
  const [isPending, startTransition] = useTransition();
  const [noResumeDialogOpen, setNoResumeDialogOpen] = useState(false);

  const router = useRouter();

  return (
    <form
      action={formData => {
        const jobListingId = formData.get('jobListingId') as string;
        startTransition(async () => {
          await addToLeads(jobListingId);

          window.dispatchEvent(
            new CustomEvent('job-listing-updated', {
              detail: { id: jobListingId, status: JobListingStatus.ADDED_TO_LEADS },
            }),
          );
          router.refresh();
        });
      }}
    >
      <input name="jobListingId" type="hidden" value={jobListingId} />

      <AlertDialog
        onOpenChange={setNoResumeDialogOpen}
        open={noResumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Default Resume</AlertDialogTitle>
            <AlertDialogDescription>
              In order to generate a revised resume, you need to have a default
              resume.
              <br />
              <br />
              Are you sure you want to add this job listing to your leads
              without a default resume?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type={hasDefaultResume ? 'submit' : 'button'}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        className={cn(
          'space-x-0 border-primary/10 bg-primary/80 text-primary-foreground',
          'shadow-sm shadow-primary/40 drop-shadow-sm transition-all duration-300',
          'hover:border-primary/30 hover:bg-primary hover:text-primary-foreground',
          'hover:shadow-lg hover:shadow-primary/25 dark:bg-primary/80',
          'dark:hover:bg-primary dark:hover:text-primary-foreground',
          isLead && 'text-green-500-foreground bg-primary/10 text-primary ',
        )}
        disabled={isPending || isLead}
        onClick={e => {
          if (!hasDefaultResume) {
            e.preventDefault();
            setNoResumeDialogOpen(true);
          }
        }}
        size="sm"
        type={hasDefaultResume ? 'submit' : 'button'}
        variant="outline"
      >
        {isLead ? (
          <TbTargetArrow className="!size-[19px]" />
        ) : (
          <Target className="!size-[19px]" />
        )}
        <span className="text-sm font-semibold">
          {isLead
            ? 'Added to Leads'
            : isPending
              ? 'Adding lead...'
              : 'Add to Leads'}
        </span>
      </Button>
    </form>
  );
};
AddJobListingToLeadsButton.displayName = 'AddJobListingToLeadsButton';

export { AddJobListingToLeadsButton };
