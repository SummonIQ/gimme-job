'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useSession } from '@/lib/auth/client';
import { Checkbox } from '../ui/checkbox';
import { FileUploadInput } from '../ui/file-upload-input';
import { Textarea } from '../ui/textarea';

export const resumeFormSchema = z.object({
  description: z.string().optional(),
  name: z.string().min(2, {
    message: 'You must enter a name.',
  }),
  setDefault: z.boolean().optional(),
  url: z.string().url({
    message: 'You must upload a resume.',
  }),
});

export function ResumeForm({
  form,
}: {
  form: UseFormReturn<z.infer<typeof resumeFormSchema>, any, any>;
}) {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col space-y-4">
      <input autoFocus className="hidden" type="text" />

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} autoComplete="off" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Resume</FormLabel>
            <FormControl>
              <FileUploadInput
                {...field}
                contentTypes="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={url => field.onChange(url)}
                uploadUrlPath={`users/${session?.user.id}/resumes/`}
              />
            </FormControl>
            <FormDescription className="text-xs text-muted-foreground/70">
              Select a PDF or Word document to upload.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="setDefault"
        render={({ field }) => {
          return (
            <FormItem className="mt-4 flex flex-row items-center gap-1.5 space-y-0">
              <FormControl>
                <Checkbox
                  checked={!!field.value}
                  className="shrink-0"
                  onCheckedChange={e => {
                    field.onChange(e);
                  }}
                  size="size-5"
                />
              </FormControl>
              <FormLabel
                className="my-0 cursor-pointer py-0 text-sm leading-none font-normal"
                onClick={event => {
                  event.preventDefault();
                  field.onChange(!field.value);
                }}
              >
                Set as default
              </FormLabel>
            </FormItem>
          );
        }}
      />
    </div>
  );
}
