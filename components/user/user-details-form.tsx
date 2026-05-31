'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import type { User, UserProfile } from '@/generated/prisma/browser';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import type { UserDetailsFormValues } from '@/components/user/user-details-form-schema';
import { userDetailsFormSchema } from '@/components/user/user-details-form-schema';
import { WorkExperienceSettings } from '@/components/user/work-experience-settings';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MONTHS } from '@/constants/dates';
import { US_STATES } from '@/constants/locales';

import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const PRONOUN_PRESETS = [
  'He/him/his',
  'She/her/hers',
  'They/them/theirs',
  'My pronouns are not listed',
  'I prefer not to say',
  'I prefer to self describe',
] as const;
const PRONOUN_CUSTOM_SENTINEL = '__custom__';

function formatPhoneNumberInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '').slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatSalaryExpectationInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';

  return `$${Number.parseInt(digits, 10).toLocaleString('en-US')}`;
}

export function UserDetailsForm({
  action,
  applicationTrackingEmail,
  applicationTrackingEmailEnabled = false,
  hasDefaultResume,
  initialCountry = 'US',
  initialHispanicLatino = '',
  initialReferralSource = 'Gimme Job',
  initialProfessionalSummary = '',
  initialSkills = [],
  initialWorkExperience,
  parseWorkExperienceAction,
  resumeOptions = [],
  updateDefaultResumeAction,
  user,
  userProfile,
}: {
  action: (values: UserDetailsFormValues) => Promise<void>;
  applicationTrackingEmail?: string | null;
  applicationTrackingEmailEnabled?: boolean;
  hasDefaultResume: boolean;
  initialCountry?: UserDetailsFormValues['country'];
  initialHispanicLatino?: string;
  initialReferralSource?: string;
  initialProfessionalSummary?: string;
  initialSkills?: UserDetailsFormValues['skills'];
  initialWorkExperience: UserDetailsFormValues['workExperience'];
  parseWorkExperienceAction?: () => Promise<
    UserDetailsFormValues['workExperience']
  >;
  resumeOptions?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly url: string | null;
  }>;
  updateDefaultResumeAction: (values: UserDetailsFormValues) => Promise<void>;
  user: User;
  userProfile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
}) {
  const router = useRouter();
  const { track } = useAnalytics();
  const usesApplicationTrackingEmail = Boolean(
    applicationTrackingEmailEnabled && applicationTrackingEmail?.trim(),
  );
  const defaultEmailAddress = usesApplicationTrackingEmail
    ? (applicationTrackingEmail?.trim() ?? '')
    : (userProfile.emailAddress ?? user?.email ?? '');
  const form = useForm<UserDetailsFormValues>({
    defaultValues: {
      city: userProfile.city ?? '',
      country: initialCountry || 'US',
      defaultResumeId: user.defaultResumeId ?? resumeOptions[0]?.id ?? '',
      disabilityStatus: userProfile.disabilityStatus ?? '',
      earliestStartDate: userProfile.earliestStartDate ?? '',
      educationDegree: userProfile.educationDegree ?? '',
      educationEndMonth: userProfile.educationEndMonth ?? undefined,
      educationEndYear: userProfile.educationEndYear ?? undefined,
      educationInstitution: userProfile.educationInstitution ?? '',
      educationInstitutionLocation:
        userProfile.educationInstitutionLocation ?? '',
      educationStartMonth: userProfile.educationStartMonth ?? undefined,
      educationStartYear: userProfile.educationStartYear ?? undefined,
      emailAddress: defaultEmailAddress,
      firstName: userProfile.firstName ?? user?.firstName ?? '',
      gender: userProfile.gender ?? '',
      githubUrl: userProfile.githubUrl ?? '',
      hispanicLatino: initialHispanicLatino,
      lastName: userProfile.lastName ?? user?.lastName ?? '',
      linkedinUrl: userProfile.linkedinUrl ?? '',
      personalWebsiteUrl: userProfile.personalWebsiteUrl ?? '',
      phoneNumber: formatPhoneNumberInput(userProfile.phoneNumber ?? ''),
      preferredName: userProfile.preferredName ?? '',
      professionalSummary: initialProfessionalSummary,
      pronouns: userProfile.pronouns ?? '',
      race: userProfile.race ?? '',
      referralSource: initialReferralSource || 'Gimme Job',
      requiresSponsorship: userProfile.requiresSponsorship ?? undefined,
      salaryExpectation: userProfile.salaryExpectation ?? '',
      state: userProfile.state ?? '',
      streetAddress: userProfile.streetAddress ?? '',
      transgenderIdentity: userProfile.transgenderIdentity ?? '',
      useOptimizedResumeOnSubmit: user.useOptimizedResumeOnSubmit ?? false,
      veteranStatus: userProfile.veteranStatus ?? '',
      websiteUrl: userProfile.websiteUrl ?? '',
      workAuthorization:
        userProfile.workAuthorization || 'Authorized to work in the US',
      workExperience: initialWorkExperience,
      skills: initialSkills,
      yearsOfExperience: userProfile.yearsOfExperience ?? '',
      zipCode: userProfile.zipCode ?? '',
    },
    resolver: zodResolver(userDetailsFormSchema),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingResume, setIsUpdatingResume] = useState(false);
  const selectedResumeId = form.watch('defaultResumeId');
  const selectedResume =
    resumeOptions.find(option => option.id === selectedResumeId) ?? null;
  const {
    append: appendSkill,
    fields: skillFields,
    remove: removeSkill,
  } = useFieldArray({
    control: form.control,
    name: 'skills',
  });

  const onSubmit = async (values: UserDetailsFormValues) => {
    setIsSaving(true);
    try {
      await action(values);
      track('profile_updated', {
        has_default_resume: Boolean(values.defaultResumeId),
        has_work_experience: values.workExperience.length > 0,
        skill_count: values.skills.length,
      });
      router.refresh();
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to save account settings.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDefaultResume = async (values: UserDetailsFormValues) => {
    setIsUpdatingResume(true);
    try {
      await updateDefaultResumeAction(values);
      router.refresh();
      toast.success('Default resume updated.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to update the default resume.',
      );
    } finally {
      setIsUpdatingResume(false);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="rounded-lg border bg-card/40 p-5 space-y-4">
        <h3 className="text-base font-semibold">Personal Information</h3>

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input className="w-44" disabled={isSaving} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input className="w-44" disabled={isSaving} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="preferredName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred Name</FormLabel>
              <FormControl>
                <Input
                  className="w-44"
                  disabled={isSaving}
                  placeholder="e.g. Steve"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="emailAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input
                  className="w-[22rem] max-w-full"
                  disabled={isSaving}
                  readOnly={usesApplicationTrackingEmail}
                  type="email"
                  {...field}
                />
              </FormControl>
              {usesApplicationTrackingEmail ? (
                <p className="max-w-md text-xs leading-5 text-muted-foreground">
                  Application tracking is enabled, so job applications use this
                  tracking inbox email.
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input
                  className="max-w-64"
                  disabled={isSaving}
                  type="tel"
                  {...field}
                  onChange={event =>
                    field.onChange(formatPhoneNumberInput(event.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="streetAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <Input
                  className="w-96 max-w-full"
                  disabled={isSaving}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input className="max-w-64" disabled={isSaving} {...field} />
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
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <SelectTrigger className="min-w-36">
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

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={field.onChange}
                    value={field.value || 'US'}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="zipCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zip Code</FormLabel>
              <FormControl>
                <Input className="max-w-28" disabled={isSaving} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <h3 className="text-base font-semibold">Social Media</h3>

        <FormField
          control={form.control}
          name="linkedinUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn URL</FormLabel>
              <FormControl>
                <Input
                  className="max-w-lg"
                  disabled={isSaving}
                  type="url"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="websiteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website URL</FormLabel>
              <FormControl>
                <Input
                  className="max-w-lg"
                  disabled={isSaving}
                  type="url"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="personalWebsiteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Website</FormLabel>
              <FormControl>
                <Input
                  className="max-w-lg"
                  disabled={isSaving}
                  type="url"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="githubUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GitHub URL</FormLabel>
              <FormControl>
                <Input
                  className="max-w-lg"
                  disabled={isSaving}
                  type="url"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <h3 className="text-base font-semibold">Professional Summary</h3>
        <FormField
          control={form.control}
          name="professionalSummary"
          render={({ field }) => (
            <FormItem className="max-w-2xl">
              <FormLabel>Summary</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-24"
                  disabled={isSaving}
                  placeholder="Short professional summary from the top of your resume."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">
                Skills and Proficiencies
              </h3>
              <p className="text-sm text-muted-foreground">
                Keep each skill or proficiency as its own item.
              </p>
            </div>
            <Button
              disabled={isSaving}
              onClick={() => appendSkill({ text: '' })}
              type="button"
              variant="outline"
            >
              Add skill
            </Button>
          </div>

          <div className="max-w-2xl space-y-3">
            {skillFields.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                No skills found yet.
              </div>
            ) : null}
            {skillFields.map((skill, index) => (
              <div className="flex items-start gap-2" key={skill.id}>
                <FormField
                  control={form.control}
                  name={`skills.${index}.text`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input disabled={isSaving} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  disabled={isSaving}
                  onClick={() => removeSkill(index)}
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <WorkExperienceSettings
          control={form.control}
          disabled={isSaving}
          getValues={form.getValues}
          hasDefaultResume={hasDefaultResume}
          isUpdatingResume={isUpdatingResume}
          onParseWorkExperience={parseWorkExperienceAction}
          onUpdateDefaultResume={handleUpdateDefaultResume}
        />

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <h3 className="text-base font-semibold">Education</h3>
        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,14rem)]">
          <FormField
            control={form.control}
            name="educationInstitution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>College / University</FormLabel>
                <FormControl>
                  <Input className="max-w-64" disabled={isSaving} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="educationDegree"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Degree</FormLabel>
                <FormControl>
                  <Input className="max-w-64" disabled={isSaving} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="educationStartMonth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Month</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={value => {
                      field.onChange(Number.parseInt(value));
                    }}
                    value={field.value?.toString()}
                  >
                    <SelectTrigger className="w-44 [&>span]:text-left">
                      <SelectValue placeholder="Select a month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="educationStartYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Year</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={value => {
                      field.onChange(Number.parseInt(value));
                    }}
                    value={field.value?.toString()}
                  >
                    <SelectTrigger className="w-44 [&>span]:text-left">
                      <SelectValue placeholder="Select a year" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show years in reverse order from current year to 1920 */}
                      {Array.from(
                        { length: new Date().getFullYear() - 1920 },
                        (_, i) => (
                          <SelectItem
                            key={(new Date().getFullYear() - i).toString()}
                            value={(new Date().getFullYear() - i).toString()}
                          >
                            {new Date().getFullYear() - i}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-row gap-4">
          <FormField
            control={form.control}
            name="educationEndMonth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Month</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={value => {
                      field.onChange(Number.parseInt(value));
                    }}
                    value={field.value?.toString()}
                  >
                    <SelectTrigger className="w-44 [&>span]:text-left">
                      <SelectValue placeholder="Select a month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="educationEndYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Year</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={value => {
                      field.onChange(Number.parseInt(value));
                    }}
                    value={field.value?.toString()}
                  >
                    <SelectTrigger className="w-44 [&>span]:text-left">
                      <SelectValue placeholder="Select a year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: new Date().getFullYear() - 1920 },
                        (_, i) => (
                          <SelectItem
                            key={(new Date().getFullYear() - i).toString()}
                            value={(new Date().getFullYear() - i).toString()}
                          >
                            {new Date().getFullYear() - i}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <h3 className="text-base font-semibold">Application Defaults</h3>

        <FormField
          control={form.control}
          name="defaultResumeId"
          render={({ field }) => (
            <FormItem className="max-w-md">
              <FormLabel>Default Resume</FormLabel>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a resume" />
                    </SelectTrigger>
                    <SelectContent>
                      {resumeOptions.map(option => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                {selectedResume?.url ? (
                  <Button asChild className="h-9" variant="outline">
                    <Link href={selectedResume.url} target="_blank">
                      View
                    </Link>
                  </Button>
                ) : null}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/profile/resumes">Manage resumes</Link>
          </Button>
        </div>

        <FormField
          control={form.control}
          name="useOptimizedResumeOnSubmit"
          render={({ field }) => (
            <FormItem className="max-w-2xl flex flex-row items-start gap-3 space-y-0 rounded-md border border-border p-4">
              <FormControl>
                <input
                  checked={field.value}
                  className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                  disabled={isSaving}
                  onChange={event => field.onChange(event.target.checked)}
                  type="checkbox"
                />
              </FormControl>
              <div className="flex flex-col gap-1">
                <FormLabel className="cursor-pointer font-medium">
                  Use optimized resume for desktop submissions
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  When on, the desktop app waits for a job-tailored copy of
                  your default resume before uploading. When off, every
                  submission uses the default resume above. Tailored copies
                  are still saved to each job lead for reference.
                </p>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="workAuthorization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work Authorization</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-[16rem]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Authorized to work in the US">
                      Authorized to work in the US
                    </SelectItem>
                    <SelectItem value="US Citizen">US Citizen</SelectItem>
                    <SelectItem value="Permanent Resident">
                      Permanent Resident
                    </SelectItem>
                    <SelectItem value="Visa holder">Visa holder</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requiresSponsorship"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value ?? false}
                  disabled={isSaving}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel className="font-normal">
                Requires visa sponsorship
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="yearsOfExperience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Years of Experience</FormLabel>
              <FormControl>
                <Input
                  className="max-w-28"
                  disabled={isSaving}
                  placeholder="e.g. 5"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="salaryExpectation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Salary Expectation</FormLabel>
              <FormControl>
                <Input
                  className="max-w-48"
                  disabled={isSaving}
                  onChange={event => {
                    field.onChange(
                      formatSalaryExpectationInput(event.target.value),
                    );
                  }}
                  placeholder="e.g. $120,000"
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="earliestStartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Earliest Start Date</FormLabel>
              <FormControl>
                <Input
                  className="max-w-64"
                  disabled={isSaving}
                  placeholder="e.g. Immediately, 2 weeks"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="referralSource"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Referral / Source Answer</FormLabel>
              <FormControl>
                <Input className="max-w-md" disabled={isSaving} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        </div>

        <div className="rounded-lg border bg-card/40 p-5 space-y-4">

        <h3 className="text-base font-semibold">
          Equal Employment Opportunity (Optional)
        </h3>
        <p className="text-sm text-muted-foreground">
          These optional fields are used to auto-fill EEO questions on
          applications. Select a decline option when you do not want to answer.
        </p>

        <FormField
          control={form.control}
          name="pronouns"
          render={({ field }) => {
            const isCustom = Boolean(
              field.value &&
                !(PRONOUN_PRESETS as readonly string[]).includes(field.value),
            );
            const selectValue = !field.value
              ? ''
              : isCustom
                ? PRONOUN_CUSTOM_SENTINEL
                : field.value;

            return (
              <FormItem>
                <FormLabel>Pronouns</FormLabel>
                <FormControl>
                  <Select
                    disabled={isSaving}
                    onValueChange={value => {
                      if (value === PRONOUN_CUSTOM_SENTINEL) {
                        field.onChange(isCustom ? field.value : ' ');
                      } else {
                        field.onChange(value);
                      }
                    }}
                    value={selectValue}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRONOUN_PRESETS.map(preset => (
                        <SelectItem key={preset} value={preset}>
                          {preset}
                        </SelectItem>
                      ))}
                      <SelectItem value={PRONOUN_CUSTOM_SENTINEL}>
                        Custom
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                {selectValue === PRONOUN_CUSTOM_SENTINEL ? (
                  <Input
                    className="mt-2 w-64"
                    disabled={isSaving}
                    onChange={event => field.onChange(event.target.value)}
                    placeholder="Enter your pronouns"
                    value={field.value === ' ' ? '' : (field.value ?? '')}
                  />
                ) : null}
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Non-binary or Genderqueer">
                      Non-binary or Genderqueer
                    </SelectItem>
                    <SelectItem value="I identify as Trans">
                      I identify as Trans
                    </SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Decline To Self Identify">
                      Decline To Self Identify
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transgenderIdentity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Do you identify as transgender?</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="I prefer to self-describe">
                      I prefer to self-describe
                    </SelectItem>
                    <SelectItem value="Decline To Self Identify">
                      Decline To Self Identify
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hispanicLatino"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hispanic / Latino</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Decline To Self Identify">
                      Decline To Self Identify
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="veteranStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Veteran Status</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-[28rem]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I am not a protected veteran">
                      I am not a protected veteran
                    </SelectItem>
                    <SelectItem value="I identify as one or more of the classifications of a protected veteran">
                      I identify as one or more of the classifications of a
                      protected veteran
                    </SelectItem>
                    <SelectItem value="I don't wish to answer">
                      I don&apos;t wish to answer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="disabilityStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Disability Status</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-[30rem]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes, I have a disability, or have had one in the past">
                      Yes, I have a disability, or have had one in the past
                    </SelectItem>
                    <SelectItem value="No, I do not have a disability and have not had one in the past">
                      No, I do not have a disability and have not had one in the
                      past
                    </SelectItem>
                    <SelectItem value="I do not want to answer">
                      I do not want to answer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="race"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Race / Ethnicity</FormLabel>
              <FormControl>
                <Select
                  disabled={isSaving}
                  onValueChange={field.onChange}
                  value={field.value || ''}
                >
                  <SelectTrigger className="w-[22rem]">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="American Indian or Alaska Native">
                      American Indian or Alaska Native
                    </SelectItem>
                    <SelectItem value="Asian">Asian</SelectItem>
                    <SelectItem value="Black or African American">
                      Black or African American
                    </SelectItem>
                    <SelectItem value="Hispanic or Latino">
                      Hispanic or Latino
                    </SelectItem>
                    <SelectItem value="Native Hawaiian or Other Pacific Islander">
                      Native Hawaiian or Other Pacific Islander
                    </SelectItem>
                    <SelectItem value="White">White</SelectItem>
                    <SelectItem value="Two or More Races">
                      Two or More Races
                    </SelectItem>
                    <SelectItem value="Decline To Self Identify">
                      Decline To Self Identify
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        </div>

        <div className="flex">
          <Button disabled={isSaving} inProgress={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
