import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/db/client';
import { formatRelativeTime } from '@/lib/time/format';

import { AdminPageShell } from '../../_components/admin-page-shell';
import { AdminStatCard } from '../../_components/admin-stat-card';
import { requireAdminUser } from '../../require-admin-user';

import { FormSnapshotFieldsTable } from './_components/form-snapshot-fields-table';

interface SnapshotOptionRecord {
  label?: string;
  value?: string;
}

interface SnapshotFieldRecord {
  fieldType?: string;
  label?: string;
  options?: ReadonlyArray<string | SnapshotOptionRecord>;
  placeholder?: string | null;
  required?: boolean;
  selector?: string;
  value?: string;
}

function normalizeOptions(
  options: ReadonlyArray<string | SnapshotOptionRecord> | undefined,
): ReadonlyArray<{ label: string; value: string }> {
  if (!options) return [];
  return options
    .map(option => {
      if (typeof option === 'string') {
        const trimmed = option.trim();
        return trimmed ? { label: trimmed, value: trimmed } : null;
      }
      const label = (option.label ?? '').trim();
      const value = (option.value ?? label).trim();
      if (!label && !value) return null;
      return { label: label || value, value: value || label };
    })
    .filter((option): option is { label: string; value: string } =>
      option !== null,
    );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFormSnapshotDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const user = await requireAdminUser();

  const snapshot = await db.localFormSnapshot.findFirst({
    where: { id },
  });
  if (!snapshot) {
    notFound();
  }

  const feedbackRows = await db.formFieldFeedback.findMany({
    orderBy: { updatedAt: 'desc' },
    where: {
      OR: [
        { snapshotId: snapshot.id },
        {
          hostname: snapshot.hostname,
          fieldLabel: {
            in: ((snapshot.fields ?? []) as readonly SnapshotFieldRecord[])
              .map(field => field.label ?? '')
              .filter(Boolean),
          },
        },
      ],
      userId: snapshot.userId,
    },
  });
  void user;

  const feedbackByLabel = new Map<
    string,
    {
      feedback: string;
      filledValue: string | null;
      rejectReason: string | null;
      status: string | null;
    }
  >();
  for (const row of feedbackRows) {
    if (!feedbackByLabel.has(row.fieldLabel)) {
      feedbackByLabel.set(row.fieldLabel, {
        feedback: row.feedback,
        filledValue: row.filledValue,
        rejectReason: row.rejectReason,
        status: row.status,
      });
    }
  }

  const rawFields = (snapshot.fields ?? []) as readonly SnapshotFieldRecord[];
  const hasCapturedValue = rawFields.some(field =>
    Object.prototype.hasOwnProperty.call(field, 'value'),
  );
  const fields = rawFields
    .filter(field => field.label)
    .map(field => {
      const existing = feedbackByLabel.get(field.label ?? '');
      return {
        existingFeedback: existing?.feedback ?? '',
        existingFilledValue: existing?.filledValue ?? null,
        existingRejectReason: existing?.rejectReason ?? null,
        existingStatus: existing?.status ?? null,
        fieldType: field.fieldType ?? 'unknown',
        label: field.label ?? '',
        options: normalizeOptions(field.options),
        placeholder: field.placeholder ?? null,
        required: Boolean(field.required),
        selector: field.selector ?? '',
        value: field.value ?? '',
      };
    });

  const requiredCount = fields.filter(field => field.required).length;
  const filledCount = fields.filter(field => field.value.trim()).length;
  const feedbackCount = fields.filter(
    field => field.existingFeedback || field.existingStatus,
  ).length;
  const approvedCount = fields.filter(
    field => field.existingStatus === 'approved',
  ).length;
  const rejectedCount = fields.filter(
    field => field.existingStatus === 'rejected',
  ).length;
  const fillRate =
    fields.length > 0
      ? `${Math.round((filledCount / fields.length) * 100)}%`
      : '—';

  return (
    <AdminPageShell
      title={`Snapshot · ${formatRelativeTime(snapshot.capturedAt)}`}
      description={`${snapshot.hostname} · ${snapshot.capturedAt.toLocaleString()}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          className="block max-w-full truncate text-muted-foreground underline-offset-2 hover:underline"
          href={snapshot.applicationUrl}
          rel="noreferrer"
          target="_blank"
          title={snapshot.applicationUrl}
        >
          {snapshot.applicationUrl}
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link
            href={snapshot.applicationUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Open form
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <AdminStatCard
          title="Fields"
          value={fields.length.toLocaleString()}
        />
        <AdminStatCard
          title="Required"
          value={requiredCount.toLocaleString()}
          helperText={
            fields.length > 0
              ? `${Math.round((requiredCount / fields.length) * 100)}% of fields`
              : undefined
          }
        />
        <AdminStatCard
          title="Filled"
          value={hasCapturedValue ? filledCount.toLocaleString() : '—'}
          helperText={hasCapturedValue ? fillRate : 'pre-fix snapshot'}
        />
        <AdminStatCard
          title="Approved"
          value={approvedCount.toLocaleString()}
        />
        <AdminStatCard
          title="Rejected"
          value={rejectedCount.toLocaleString()}
          helperText={feedbackCount ? `${feedbackCount} reviewed` : undefined}
        />
      </div>

      <div className="grid gap-3 rounded-md border bg-muted/30 px-4 py-3 text-xs sm:grid-cols-2 md:grid-cols-4">
        <MetaItem label="Hostname" value={snapshot.hostname} mono />
        {snapshot.jobLeadId ? (
          <MetaItem label="Lead" value={snapshot.jobLeadId} mono />
        ) : null}
        <MetaItem
          label="Size"
          value={`${(snapshot.byteSize / 1024).toFixed(1)} KB`}
        />
        <MetaItem label="HTML on disk" value={snapshot.filePath} mono />
      </div>

      {!hasCapturedValue ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          This snapshot was captured before per-field value tracking landed.
          Submit a new application to see the actual values the assistant
          filled for each field.
        </div>
      ) : null}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-foreground/80">
              Fields
            </h4>
            <p className="text-sm text-muted-foreground/70">
              The assistant filled these inputs. Click Edit to leave feedback
              and adjust the next run.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {fields.length} total
          </Badge>
        </div>
        <Separator className="my-3 bg-border/60" />
        <FormSnapshotFieldsTable
          applicationUrl={snapshot.applicationUrl}
          fields={fields}
          hostname={snapshot.hostname}
          snapshotId={snapshot.id}
        />
      </div>
    </AdminPageShell>
  );
}

interface MetaItemProps {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string;
}

function MetaItem({ label, mono, value }: MetaItemProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`truncate ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
