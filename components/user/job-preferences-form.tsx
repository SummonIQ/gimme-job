'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CompanySize,
  ExperienceLevel,
  type UserJobPreferences,
} from '@/generated/prisma/browser';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { COMPANY_SIZE } from '@/constants/companies';
import { EXPERIENCE_LEVEL } from '@/constants/jobs';
import { US_STATES } from '@/constants/locales';

import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';

export const jobPreferencesFormSchema = z.object({
  city: z.string().optional().or(z.literal('')),
  companySize: z
    .enum([CompanySize.SMALL, CompanySize.MID_SIZE, CompanySize.ENTERPRISE])
    .optional(),
  companyType: z.string().optional().or(z.literal('')),
  experienceLevel: z
    .enum([
      ExperienceLevel.ENTRY_LEVEL,
      ExperienceLevel.MID_LEVEL,
      ExperienceLevel.SENIOR_LEVEL,
    ])
    .optional(),
  // jobTitles: z.array(z.string()).optional().or(z.literal([])),
  preferRemote: z.boolean().optional(),
  remoteOnly: z.boolean().optional(),
  state: z.string().optional().or(z.literal('')),
});

export function JobPreferencesForm({
  action,
  jobPreferences,
}: {
  action: (values: z.infer<typeof jobPreferencesFormSchema>) => Promise<void>;
  jobPreferences: Omit<
    UserJobPreferences,
    'id' | 'createdAt' | 'jobTitles' | 'updatedAt' | 'userId'
  >;
}) {
  const [remoteOnly, setRemoteOnly] = useState(
    jobPreferences?.remoteOnly ?? false,
  );
  const router = useRouter();
  const form = useForm<z.infer<typeof jobPreferencesFormSchema>>({
    defaultValues: {
      city: jobPreferences.city ?? '',
      companySize: jobPreferences.companySize ?? undefined,
      companyType: jobPreferences.companyType ?? '',
      experienceLevel: jobPreferences.experienceLevel ?? undefined,
      // jobTitles: jobPreferences.jobTitles ?? [],
      preferRemote: jobPreferences.preferRemote ?? false,
      remoteOnly: jobPreferences.remoteOnly ?? false,
      state: jobPreferences.state ?? '',
    },
    resolver: zodResolver(jobPreferencesFormSchema),
  });
  const [isSaving, setIsSaving] = useState(false);
  const onSubmit = async (values: z.infer<typeof jobPreferencesFormSchema>) => {
    setIsSaving(true);
    await action(values);
    setIsSaving(false);
    router.refresh();
    window.scrollTo(0, 0);
  };

  return (
    <Form {...form}>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <h3 className="text-base font-semibold">Location Preferences</h3>

        <div className="flex flex-row gap-12">
          <FormField
            control={form.control}
            name="remoteOnly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Remote Only</FormLabel>
                <FormControl className="block">
                  <Switch
                    defaultChecked={field.value}
                    onCheckedChange={e => {
                      const value = e.valueOf();
                      form.setValue('remoteOnly', value);
                      if (value) {
                        form.setValue('preferRemote', false);
                      }
                      field.onChange(value);
                      setRemoteOnly(value);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferRemote"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={remoteOnly ? 'text-muted-foreground' : ''}
                >
                  Prefer Remote
                </FormLabel>
                <FormControl className="block">
                  <Switch
                    checked={field.value}
                    defaultChecked={field.value}
                    disabled={remoteOnly}
                    onCheckedChange={e => {
                      const value = e.valueOf();
                      form.setValue('preferRemote', value);
                      if (value) {
                        form.setValue('remoteOnly', false);
                      }
                      field.onChange(value);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={remoteOnly ? 'text-muted-foreground' : ''}
                >
                  City
                </FormLabel>
                <FormControl>
                  <Input
                    className="max-w-64"
                    disabled={remoteOnly}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel
                  className={remoteOnly ? 'text-muted-foreground' : ''}
                >
                  State
                </FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    disabled={remoteOnly}
                    onValueChange={val => field.onChange(val)}
                  >
                    <SelectTrigger className="min-w-40">
                      <SelectValue placeholder="Select a state" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(US_STATES).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <h3 className="text-base font-semibold">Company Preferences</h3>

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="companySize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Size</FormLabel>
                <FormControl>
                  <Select {...field}>
                    <SelectTrigger className="min-w-52">
                      <SelectValue placeholder="Select a company size" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZE.map(({ label, value }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Separator />
        <h3 className="text-base font-semibold">Experience</h3>

        <FormField
          control={form.control}
          name="experienceLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Experience Level</FormLabel>
              <FormControl>
                <Select {...field}>
                  <SelectTrigger className="min-w-56 max-w-56">
                    <SelectValue placeholder="Select a experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVEL.map(({ label, value }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />

        <Separator />

        <div className="flex">
          <Button disabled={isSaving} inProgress={isSaving} type="submit">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}
