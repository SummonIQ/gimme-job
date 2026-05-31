'use client';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { startGuidedApplication } from '@/lib/guided-applications/session';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Loader2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const formSchema = z.object({
  applicationUrl: z.string().url('Please enter a valid URL'),
});

type FormValues = z.infer<typeof formSchema>;

interface StartGuidedApplicationDialogProps {
  jobLeadId?: string;
  defaultUrl?: string;
  trigger?: React.ReactNode;
}

const StartGuidedApplicationDialog = ({
  jobLeadId,
  defaultUrl,
  trigger,
}: StartGuidedApplicationDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicationUrl: defaultUrl ?? '',
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await startGuidedApplication({
        applicationUrl: values.applicationUrl,
        jobLeadId,
      });

      if (result.success && result.applicationId) {
        setOpen(false);
        router.push(`/apply/${result.applicationId}`);
      } else {
        form.setError('applicationUrl', {
          message: result.error ?? 'Failed to start preview',
        });
      }
    });
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        {trigger ?? (
          <Button>
            <Wand2 className="h-4 w-4" />
            Start Application Preview
          </Button>
        )}
      </ModalTrigger>
      <ModalContent className="sm:max-w-[500px]">
        <ModalHeader>
          <ModalTitle>Start Application Preview</ModalTitle>
          <ModalDescription>
            Enter the URL of the job application page. AI Preview will analyze
            the form and help you fill it out with your profile information. It
            will not submit the application.
          </ModalDescription>
        </ModalHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="applicationUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Application URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://company.com/jobs/apply/..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Paste the direct link to the job application form
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Open Preview
              </Button>
            </ModalFooter>
          </form>
        </Form>
      </ModalContent>
    </Modal>
  );
};
StartGuidedApplicationDialog.displayName = 'StartGuidedApplicationDialog';

export { StartGuidedApplicationDialog };
