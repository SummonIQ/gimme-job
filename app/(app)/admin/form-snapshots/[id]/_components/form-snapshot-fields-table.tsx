'use client';

import { Check, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/css';

const REJECT_REASON_OPTIONS = [
  { label: 'Wrong value (e.g. typo, wrong number)', value: 'WRONG_VALUE' },
  { label: 'Wrong dropdown option', value: 'WRONG_OPTION' },
  { label: 'Wrong format (right info, bad shape)', value: 'WRONG_FORMAT' },
  { label: 'Missed — should have been filled', value: 'MISSED_FIELD' },
  {
    label: 'Hidden field — ignore unless explicitly needed',
    value: 'HIDDEN_FIELD',
  },
  { label: 'Unrelated field — skip this input', value: 'UNRELATED_FIELD' },
  { label: 'Captcha / bot check — do not auto-fill', value: 'CAPTCHA_FIELD' },
  {
    label: 'Duplicate — re-used info from another field',
    value: 'DUPLICATE_INFO',
  },
  {
    label: 'Wrong interpretation of the question',
    value: 'WRONG_INTERPRETATION',
  },
  { label: 'Other', value: 'OTHER' },
] as const;

type RejectReason = (typeof REJECT_REASON_OPTIONS)[number]['value'];
type Status = 'approved' | 'rejected' | null;

interface FormSnapshotOption {
  readonly label: string;
  readonly value: string;
}

interface FormSnapshotField {
  readonly existingFeedback: string;
  readonly existingFilledValue: string | null;
  readonly existingRejectReason: string | null;
  readonly existingStatus: string | null;
  readonly fieldType: string;
  readonly label: string;
  readonly options: readonly FormSnapshotOption[];
  readonly placeholder: string | null;
  readonly required: boolean;
  readonly selector: string;
  readonly value: string;
}

interface FormSnapshotFieldsTableProps {
  readonly applicationUrl: string;
  readonly fields: readonly FormSnapshotField[];
  readonly hostname: string;
  readonly snapshotId: string;
}

interface RowState {
  readonly feedback: string;
  readonly rejectReason: RejectReason | null;
  readonly selectedValue: string;
  readonly status: Status;
}

export function FormSnapshotFieldsTable({
  applicationUrl,
  fields,
  hostname,
  snapshotId,
}: FormSnapshotFieldsTableProps) {
  const [rowState, setRowState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      fields.map(field => [
        field.label,
        {
          feedback: field.existingFeedback,
          rejectReason:
            (field.existingRejectReason as RejectReason | null) ?? null,
          selectedValue: field.existingFilledValue ?? field.value,
          status: (field.existingStatus as Status) ?? null,
        },
      ]),
    ),
  );
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [rejectingLabel, setRejectingLabel] = useState<string | null>(null);

  const updateRow = (label: string, patch: Partial<RowState>) => {
    setRowState(prev => ({
      ...prev,
      [label]: { ...prev[label], ...patch },
    }));
  };

  const persist = async (
    field: FormSnapshotField,
    overrides: Partial<RowState>,
  ): Promise<boolean> => {
    const current = rowState[field.label] ?? {
      feedback: '',
      rejectReason: null,
      selectedValue: field.value,
      status: null,
    };
    const next: RowState = { ...current, ...overrides };
    setSavingLabel(field.label);
    try {
      const response = await fetch('/api/admin/form-feedback', {
        body: JSON.stringify({
          applicationUrl,
          feedback: next.feedback,
          fieldLabel: field.label,
          fieldSelector: field.selector,
          fieldType: field.fieldType,
          filledValue:
            next.status === 'rejected' ? field.value : next.selectedValue,
          hostname,
          rejectReason: next.rejectReason,
          snapshotId,
          status: next.status,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      setRowState(prev => ({ ...prev, [field.label]: next }));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save feedback.',
      );
      return false;
    } finally {
      setSavingLabel(null);
    }
  };

  const handleApprove = async (field: FormSnapshotField) => {
    const ok = await persist(field, {
      rejectReason: null,
      status: 'approved',
    });
    if (ok) {
      toast.success('Marked as correct.');
      setRejectingLabel(null);
    }
  };

  const handleStartReject = (field: FormSnapshotField) => {
    setRejectingLabel(field.label);
    const current = rowState[field.label];
    if (current?.status !== 'rejected') {
      updateRow(field.label, {
        rejectReason: current?.rejectReason ?? 'WRONG_VALUE',
      });
    }
  };

  const handleSubmitReject = async (field: FormSnapshotField) => {
    const current = rowState[field.label];
    if (!current?.rejectReason) {
      toast.error('Pick a reason before saving.');
      return;
    }
    const correctionNote =
      current.selectedValue !== field.value
        ? `Correct value should be "${current.selectedValue}".`
        : '';
    const feedback =
      correctionNote && !current.feedback.includes(correctionNote)
        ? [current.feedback.trim(), correctionNote].filter(Boolean).join(' ')
        : current.feedback;
    const ok = await persist(field, { feedback, status: 'rejected' });
    if (ok) {
      toast.success('Rejection recorded — next run will adjust.');
      setRejectingLabel(null);
    }
  };

  const handleClearReview = async (field: FormSnapshotField) => {
    const ok = await persist(field, {
      feedback: '',
      rejectReason: null,
      selectedValue: field.value,
      status: null,
    });
    if (ok) {
      toast.success('Review cleared.');
      setRejectingLabel(null);
    }
  };

  const handleSaveNote = async (field: FormSnapshotField) => {
    const current = rowState[field.label];
    const suggestedValueNote =
      current &&
      current.selectedValue !== field.value &&
      !current.feedback.trim()
        ? `Suggested value: "${current.selectedValue}".`
        : '';
    const ok = await persist(field, {
      feedback: suggestedValueNote || current?.feedback || '',
    });
    if (ok) {
      toast.success('Note saved.');
      setRejectingLabel(null);
    }
  };

  if (fields.length === 0) {
    return (
      <p className="px-4 pb-4 text-sm text-muted-foreground">
        No form fields were detected in this snapshot.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <Table>
        <TableHeader className="bg-muted/45">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[30%] px-4 py-3 text-xs uppercase tracking-wide">
              Field
            </TableHead>
            <TableHead className="w-[25%] px-4 py-3 text-xs uppercase tracking-wide">
              Agent filled
            </TableHead>
            <TableHead className="w-[25%] px-4 py-3 text-xs uppercase tracking-wide">
              Correct value
            </TableHead>
            <TableHead className="w-[20%] px-4 py-3 text-right text-xs uppercase tracking-wide">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map(field => {
            const state = rowState[field.label] ?? {
              feedback: '',
              rejectReason: null,
              selectedValue: field.value,
              status: null,
            };
            const isOpen = rejectingLabel === field.label;
            const saving = savingLabel === field.label;
            const filled = field.value.trim();
            return (
              <FieldRow
                key={`${field.label}__${field.selector}`}
                field={field}
                filled={filled}
                isOpen={isOpen}
                onApprove={() => handleApprove(field)}
                onChangeFeedback={value =>
                  updateRow(field.label, { feedback: value })
                }
                onChangeReason={value =>
                  updateRow(field.label, { rejectReason: value })
                }
                onChangeSelectedValue={value =>
                  updateRow(field.label, { selectedValue: value })
                }
                onClear={() => handleClearReview(field)}
                onCloseReject={() => setRejectingLabel(null)}
                onOpenNote={() => setRejectingLabel(field.label)}
                onSaveNote={() => handleSaveNote(field)}
                onStartReject={() => handleStartReject(field)}
                onSubmitReject={() => handleSubmitReject(field)}
                saving={saving}
                state={state}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface FieldRowProps {
  readonly field: FormSnapshotField;
  readonly filled: string;
  readonly isOpen: boolean;
  readonly saving: boolean;
  readonly state: RowState;
  readonly onApprove: () => void;
  readonly onChangeFeedback: (value: string) => void;
  readonly onChangeReason: (value: RejectReason) => void;
  readonly onChangeSelectedValue: (value: string) => void;
  readonly onClear: () => void;
  readonly onCloseReject: () => void;
  readonly onOpenNote: () => void;
  readonly onSaveNote: () => void;
  readonly onStartReject: () => void;
  readonly onSubmitReject: () => void;
}

function FieldRow({
  field,
  filled,
  isOpen,
  saving,
  state,
  onApprove,
  onChangeFeedback,
  onChangeReason,
  onChangeSelectedValue,
  onClear,
  onCloseReject,
  onOpenNote,
  onSaveNote,
  onStartReject,
  onSubmitReject,
}: FieldRowProps) {
  const hasChangedValue = state.selectedValue !== field.value;
  return (
    <>
      <TableRow
        className={cn(
          'bg-background/40 hover:bg-muted/35',
          hasChangedValue && 'border-l-4 border-l-amber-500 bg-amber-500/5',
          state.status === 'rejected' &&
            'border-l-4 border-l-rose-500 bg-rose-500/5',
          state.status === 'approved' &&
            'border-l-4 border-l-emerald-500 bg-emerald-500/10',
        )}
      >
        <TableCell className="px-4 py-4 align-top">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{field.label}</span>
              <Badge
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px]',
                  field.required
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-border/50 bg-muted/40 text-muted-foreground',
                )}
                variant="outline"
              >
                {field.required ? 'Required' : 'Optional'}
              </Badge>
              <Badge
                className="rounded-md border-border/50 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                variant="outline"
              >
                {field.fieldType}
              </Badge>
            </div>
            {field.selector ? (
              <span className="break-all font-mono text-[11px] text-muted-foreground">
                {field.selector}
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="px-4 py-4 align-top">
          <div className="flex flex-col gap-1.5">
            {filled ? (
              <span className="break-words rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 font-mono text-xs">
                {filled}
              </span>
            ) : (
              <span className="rounded-md border border-dashed border-border/60 bg-muted/20 px-2.5 py-2 text-xs italic text-muted-foreground">
                not filled
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="px-4 py-4 align-top">
          <ValueEditor
            changed={hasChangedValue}
            field={field}
            onChange={onChangeSelectedValue}
            value={state.selectedValue}
          />
        </TableCell>
        <TableCell className="px-4 py-4 align-top text-right">
          <div className="flex justify-end gap-1.5">
            <Button
              aria-label="Add note or flag field"
              className={cn(
                state.feedback &&
                  'border-primary/30 bg-primary/10 text-primary',
              )}
              disabled={saving}
              onClick={onOpenNote}
              size="icon"
              type="button"
              variant="outline"
            >
              <MessageSquare />
            </Button>
            <Button
              aria-label="Approve fill"
              className={cn(
                state.status === 'approved' &&
                  'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              )}
              disabled={saving}
              onClick={onApprove}
              size="icon"
              type="button"
              variant="outline"
            >
              <Check />
            </Button>
            <Button
              aria-label="Reject or flag field"
              className={cn(
                state.status === 'rejected' &&
                  'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
              )}
              disabled={saving}
              onClick={onStartReject}
              size="icon"
              type="button"
              variant="outline"
            >
              <X />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {isOpen ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={4} className="px-4 py-4">
            <div className="rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Flag reason
                  </label>
                  <Select
                    onValueChange={value =>
                      onChangeReason(value as RejectReason)
                    }
                    value={state.rejectReason ?? undefined}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Pick a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {REJECT_REASON_OPTIONS.map(option => (
                          <SelectItem
                            className="text-xs"
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Note / association for future runs
                  </label>
                  <Textarea
                    className="min-h-24 text-xs"
                    onChange={event => onChangeFeedback(event.target.value)}
                    placeholder='Examples: "input[id=\"country\"] is the country select; use United States." "This is a captcha, skip it and let the user handle it." "This hidden token is unrelated."'
                    value={state.feedback}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                {state.status ? (
                  <Button
                    disabled={saving}
                    onClick={onClear}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Clear review
                  </Button>
                ) : null}
                <Button
                  disabled={saving}
                  onClick={onCloseReject}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  disabled={saving}
                  onClick={onSaveNote}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {saving ? 'Saving...' : 'Save note'}
                </Button>
                <Button
                  disabled={saving}
                  onClick={onSubmitReject}
                  size="sm"
                  type="button"
                  variant="default"
                >
                  {saving ? 'Saving...' : 'Save flag'}
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

interface ValueEditorProps {
  readonly changed: boolean;
  readonly field: FormSnapshotField;
  readonly onChange: (value: string) => void;
  readonly value: string;
}

function ValueEditor({ changed, field, onChange, value }: ValueEditorProps) {
  const shouldUseSelect = field.fieldType.toLowerCase().includes('select');
  const reviewOptions =
    shouldUseSelect && field.options.length === 0
      ? inferFallbackSelectOptions(field)
      : field.options;
  const selectedOption = reviewOptions.find(option => option.value === value);
  const placeholder =
    field.placeholder?.trim() ||
    (field.options.length > 0
      ? `Select one of ${field.options.length} options`
      : 'Choose or type the correct value');

  return (
    <div className="flex flex-col gap-2">
      {shouldUseSelect ? (
        <>
          {reviewOptions.length > 0 ? (
            <Select
              onValueChange={onChange}
              value={selectedOption?.value ?? ''}
            >
              <SelectTrigger
                className={cn(
                  'justify-start gap-2 text-left [&>span]:flex-1 [&>span]:text-left',
                  changed &&
                    'border-amber-500/70 bg-amber-500/10 focus:ring-amber-500/40',
                )}
                size="sm"
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {field.options.length > 0
                      ? 'Received options'
                      : 'Suggested values'}
                  </SelectLabel>
                  {reviewOptions.map(option => (
                    <SelectItem
                      key={`${option.label}__${option.value}`}
                      value={option.value}
                    >
                      <span className="flex items-baseline gap-2">
                        <span>{option.label}</span>
                        {option.value !== option.label ? (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {option.value}
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <div
              className={cn(
                'flex h-8 items-center justify-start rounded-md border border-dashed border-border bg-background px-2.5 text-left text-xs text-muted-foreground',
                changed && 'border-amber-500/70 bg-amber-500/10',
              )}
            >
              No options captured for this select
            </div>
          )}
          <Input
            className={cn(
              'font-mono text-xs',
              changed &&
                'border-amber-500/70 bg-amber-500/10 focus-visible:ring-amber-500/40',
            )}
            onChange={event => onChange(event.target.value)}
            placeholder={
              reviewOptions.length > 0
                ? 'Selected value'
                : 'Type correct select value'
            }
            size="sm"
            value={value}
          />
        </>
      ) : (
        <Input
          className={cn(
            'font-mono text-xs',
            changed &&
              'border-amber-500/70 bg-amber-500/10 focus-visible:ring-amber-500/40',
          )}
          onChange={event => onChange(event.target.value)}
          placeholder="Correct value"
          size="sm"
          value={value}
        />
      )}
    </div>
  );
}

function inferFallbackSelectOptions(
  field: FormSnapshotField,
): readonly FormSnapshotOption[] {
  const text = `${field.label} ${field.selector}`.toLowerCase();
  if (/\bcountry\b/.test(text)) {
    return [
      { label: 'United States', value: 'United States' },
      { label: 'Canada', value: 'Canada' },
      { label: 'United Kingdom', value: 'United Kingdom' },
      { label: 'Australia', value: 'Australia' },
      { label: 'Germany', value: 'Germany' },
      { label: 'India', value: 'India' },
    ];
  }
  if (
    /\?/.test(field.label) ||
    /\b(yes|no|authorized|authorization|citizenship|resident|sponsor|visa)\b/.test(
      text,
    )
  ) {
    return [
      { label: 'Yes', value: 'Yes' },
      { label: 'No', value: 'No' },
      { label: 'Prefer not to answer', value: 'Prefer not to answer' },
    ];
  }
  return [
    { label: 'Yes', value: 'Yes' },
    { label: 'No', value: 'No' },
  ];
}
