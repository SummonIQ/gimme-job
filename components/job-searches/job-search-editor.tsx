'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import { type JobSearch } from '@/generated/prisma/browser';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Plus } from 'lucide-react';

import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  ResponsiveDialog,
  ResponsiveDialogContainer,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import { useFormErrorHandling } from '@/lib/a11y/form-utils';

import { JobSearchForm, jobSearchFormSchema } from './job-search-form';

interface JobSearchEditorProps {
  action: (data: z.infer<typeof jobSearchFormSchema>) => Promise<void>;
  job?: JobSearch;
  label?: string;
  onDelete?: (jobId: string) => void;
  showTrigger?: boolean;
}

const JobSearchEditor = ({
  action,
  label,
  showTrigger = true,
}: JobSearchEditorProps) => {
  // const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof jobSearchFormSchema>>({
    defaultValues: {
      location: '',
      remote: false,
      searchTerm: '',
    },
    resolver: zodResolver(jobSearchFormSchema),
  });
  const [inProgress, setInProgress] = useState(false);
  const router = useRouter();
  const { track } = useAnalytics();
  const {
    errorEntries,
    errorSummaryRef,
    focusField,
    handleInvalid,
    showSummary,
  } = useFormErrorHandling(form);

  const onSubmit = async (values: z.infer<typeof jobSearchFormSchema>) => {
    setInProgress(true);

    const { searchTerm, location, remote } = values;

    await action({
      location,
      remote,
      searchTerm,
    });
    track('job_search_created', {
      location: location || '',
      remote,
      search_term: searchTerm,
      surface: 'job_search_editor',
    });

    setInProgress(false);
    setOpen(false);
    form.reset();
    router.refresh();
  };

  return (
    <ResponsiveDialog onOpenChange={setOpen} open={open}>
      {showTrigger && (
        <ResponsiveDialogTrigger>
          <Button size="sm">
            <Plus className="size-4" />
            {label ?? 'New Job Search'}
          </Button>
        </ResponsiveDialogTrigger>
      )}

      <ResponsiveDialogContainer>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
          >
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>New Job Search</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Search for job listings by job title, location, or company.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <ResponsiveDialogContent>
              <FormErrorSummary
                errors={errorEntries}
                heading="We need a bit more information before saving this search:"
                onSelect={focusField}
                ref={errorSummaryRef}
                visible={showSummary}
              />
              <JobSearchForm form={form} />
            </ResponsiveDialogContent>

            <ResponsiveDialogFooter>
              <Button
                disabled={inProgress}
                onClick={e => {
                  e.preventDefault();
                  setOpen(false);
                }}
                variant="outline"
              >
                Cancel
              </Button>

              <Button type="submit">{inProgress ? 'Saving...' : 'Save'}</Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContainer>
    </ResponsiveDialog>
  );
};
JobSearchEditor.displayName = 'JobSearchEditor';

export { JobSearchEditor };
