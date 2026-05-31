'use client';

import type { Resume } from '@/generated/prisma/browser';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FilePlus } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';

import { Button } from '../ui/button';
import { Form } from '../ui/form';
import { ResumeForm, resumeFormSchema } from './resume-form';

interface ResumeEditorProps {
  action: (data: z.infer<typeof resumeFormSchema>) => Promise<Resume>;
  isOpen?: boolean;
  label?: string;
  onDelete?: (jobId: string) => void;
  setIsOpen?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function ResumeEditor({
  action,
  label,
  isOpen,
  setIsOpen,
  showTrigger = true,
}: ResumeEditorProps) {
  const router = useRouter();
  const form = useForm<z.infer<typeof resumeFormSchema>>({
    defaultValues: {
      description: '',
      name: '',
      setDefault: false,
      url: undefined,
    },
    resolver: zodResolver(resumeFormSchema),
  });
  const [open, setOpen] = useState(isOpen);
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { track } = useAnalytics();

  const onSubmit = async (values: z.infer<typeof resumeFormSchema>) => {
    setError(undefined);
    setInProgress(true);

    const { description, name, url, setDefault } = values;

    try {
      const resume = await action({
        description,
        name,
        setDefault,
        url,
      });
      track('resume_uploaded', {
        resume_id: resume.id,
        set_default: Boolean(setDefault),
      });

      setInProgress(false);
      setOpen(false);
      setIsOpen?.(false);
      form.reset();
      router.refresh();
    } catch (caughtError) {
      setInProgress(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Resume upload failed. Please try again.',
      );
    }
  };

  return (
    <Modal onOpenChange={setIsOpen ? setIsOpen : setOpen} open={isOpen ?? open}>
      {showTrigger && (
        <ModalTrigger asChild>
          <Button size="sm">
            <FilePlus className="size-4" />
            {label ?? 'New Resume'}
          </Button>
        </ModalTrigger>
      )}

      <ModalContent size="2xl" className="w-[calc(100vw-1rem)] max-w-[35.2rem]">
        <Form {...form}>
          <form
            className="flex h-full min-h-0 flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <ModalHeader>
              <ModalTitle>New Resume</ModalTitle>
              <ModalDescription>
                Upload a new resume for analysis.
              </ModalDescription>
            </ModalHeader>

            <ModalBody>
              {error && (
                <Alert className="mb-4" variant="destructive">
                  <AlertTitle>Upload failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <ResumeForm form={form} />
            </ModalBody>

            <ModalFooter className="justify-between sm:justify-between">
              <Button
                disabled={inProgress}
                onClick={() => {
                  setOpen(false);
                }}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>

              <Button inProgress={inProgress} type="submit">
                {inProgress ? 'Saving...' : 'Save'}
              </Button>
            </ModalFooter>
          </form>
        </Form>
      </ModalContent>
    </Modal>
  );
}
