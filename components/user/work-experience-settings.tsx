'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Control, UseFormGetValues } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';

import type { UserDetailsFormValues } from '@/components/user/user-details-form-schema';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { MONTHS } from '@/constants/dates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface WorkExperienceSettingsProps {
  readonly control: Control<UserDetailsFormValues>;
  readonly disabled?: boolean;
  readonly getValues: UseFormGetValues<UserDetailsFormValues>;
  readonly hasDefaultResume: boolean;
  readonly isUpdatingResume: boolean;
  readonly onParseWorkExperience?: () => Promise<
    UserDetailsFormValues['workExperience']
  >;
  readonly onUpdateDefaultResume: (
    values: UserDetailsFormValues,
  ) => Promise<void>;
}

export function WorkExperienceSettings({
  control,
  disabled = false,
  getValues,
  hasDefaultResume,
  isUpdatingResume,
  onParseWorkExperience,
  onUpdateDefaultResume,
}: WorkExperienceSettingsProps) {
  const [isParsingExperience, setIsParsingExperience] = useState(false);
  const { append, fields, remove, replace } = useFieldArray({
    control,
    name: 'workExperience',
  });

  const handleParseWorkExperience = async () => {
    if (!onParseWorkExperience) {
      return;
    }

    setIsParsingExperience(true);
    try {
      replace(await onParseWorkExperience());
      toast.success('Work experience parsed from default resume.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to parse work experience.',
      );
    } finally {
      setIsParsingExperience(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Work Experience</h3>
          <p className="text-sm text-muted-foreground">
            Edit the roles that should appear in your default resume.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled}
            onClick={() =>
              append({
                bulletItems: [{ text: '' }],
                company: '',
                description: '',
                endDate: '',
                startDate: '',
                title: '',
              })
            }
            type="button"
            variant="outline"
          >
            Add role
          </Button>
          {onParseWorkExperience ? (
            <Button
              disabled={disabled || isParsingExperience || !hasDefaultResume}
              inProgress={isParsingExperience}
              onClick={handleParseWorkExperience}
              type="button"
              variant="outline"
            >
              {isParsingExperience ? 'Parsing...' : 'Parse from resume'}
            </Button>
          ) : null}
          <Button
            disabled={disabled || isUpdatingResume || !hasDefaultResume}
            inProgress={isUpdatingResume}
            onClick={() => onUpdateDefaultResume(getValues())}
            type="button"
            variant="secondary"
          >
            {isUpdatingResume ? 'Updating resume...' : 'Update default resume'}
          </Button>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
          No work experience found yet. Add a role or update your default resume
          after you fill this out.
        </div>
      ) : null}

      <div className="space-y-5">
        {fields.map((field, index) => (
          <RoleFields
            control={control}
            disabled={disabled}
            index={index}
            isLast={index === fields.length - 1}
            key={field.id}
            onRemove={() => remove(index)}
          />
        ))}
      </div>
    </div>
  );
}

function RoleFields({
  control,
  disabled,
  index,
  isLast,
  onRemove,
}: {
  control: Control<UserDetailsFormValues>;
  disabled: boolean;
  index: number;
  isLast: boolean;
  onRemove: () => void;
}) {
  const {
    append: appendBullet,
    fields: bulletFields,
    remove: removeBullet,
  } = useFieldArray({
    control,
    name: `workExperience.${index}.bulletItems`,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">Role {index + 1}</h4>
        <Button
          aria-label={`Remove role ${index + 1}`}
          disabled={disabled}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,14rem)]">
        <FormField
          control={control}
          name={`workExperience.${index}.title`}
          render={({ field: itemField }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input disabled={disabled} {...itemField} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`workExperience.${index}.company`}
          render={({ field: itemField }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <FormControl>
                <Input disabled={disabled} {...itemField} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,9rem))]">
        <MonthField
          control={control}
          disabled={disabled}
          label="Start Month"
          name={`workExperience.${index}.startMonth`}
        />
        <YearField
          control={control}
          disabled={disabled}
          label="Start Year"
          name={`workExperience.${index}.startYear`}
        />
        <MonthField
          control={control}
          disabled={disabled}
          label="End Month"
          name={`workExperience.${index}.endMonth`}
        />
        <YearField
          control={control}
          disabled={disabled}
          label="End Year"
          name={`workExperience.${index}.endYear`}
        />
      </div>

      <FormField
        control={control}
        name={`workExperience.${index}.description`}
        render={({ field: itemField }) => (
          <FormItem className="max-w-2xl">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                className="min-h-20"
                disabled={disabled}
                placeholder="Short role summary."
                {...itemField}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="max-w-2xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <FormLabel>Bullet Items</FormLabel>
          <Button
            disabled={disabled}
            onClick={() => appendBullet({ text: '' })}
            size="sm"
            type="button"
            variant="outline"
          >
            Add bullet
          </Button>
        </div>

        {bulletFields.map((bullet, bulletIndex) => (
          <div className="flex items-start gap-2" key={bullet.id}>
            <FormField
              control={control}
              name={`workExperience.${index}.bulletItems.${bulletIndex}.text`}
              render={({ field: bulletField }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input disabled={disabled} {...bulletField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              aria-label={`Remove bullet ${bulletIndex + 1}`}
              disabled={disabled}
              onClick={() => removeBullet(bulletIndex)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {!isLast ? <Separator /> : null}
    </div>
  );
}

function MonthField({
  control,
  disabled,
  label,
  name,
}: {
  control: Control<UserDetailsFormValues>;
  disabled: boolean;
  label: string;
  name: `workExperience.${number}.${'startMonth' | 'endMonth'}`;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select
              disabled={disabled}
              onValueChange={value => field.onChange(Number.parseInt(value))}
              value={field.value?.toString()}
            >
              <SelectTrigger className="w-36 [&>span]:text-left">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, monthIndex) => (
                  <SelectItem key={month} value={monthIndex.toString()}>
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
  );
}

function YearField({
  control,
  disabled,
  label,
  name,
}: {
  control: Control<UserDetailsFormValues>;
  disabled: boolean;
  label: string;
  name: `workExperience.${number}.${'startYear' | 'endYear'}`;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Select
              disabled={disabled}
              onValueChange={value => field.onChange(Number.parseInt(value))}
              value={field.value?.toString()}
            >
              <SelectTrigger className="w-36 [&>span]:text-left">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(
                  { length: new Date().getFullYear() - 1920 + 21 },
                  (_, i) => {
                    const year = new Date().getFullYear() + 20 - i;
                    return (
                      <SelectItem key={year.toString()} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  },
                )}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
