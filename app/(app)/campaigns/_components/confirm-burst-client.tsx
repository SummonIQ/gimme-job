'use client';

import { useMemo, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SubmissionTier } from '@/generated/prisma/browser';

type Mode = 'TARGETED' | 'GENERIC' | 'FIRE_AND_FORGET';

export interface CampaignLeadRow {
  readonly id: string;
  readonly jobTitle: string;
  readonly company: string | null;
  readonly tier: SubmissionTier;
  readonly hostname: string;
}

interface BurstResponse {
  readonly enqueued: Array<{
    readonly leadId: string;
    readonly queueItemId: string;
    readonly effectiveMode: Mode;
    readonly trustLevel: string;
  }>;
  readonly skipped: Array<{
    readonly leadId: string;
    readonly reason: string;
    readonly detail?: string;
  }>;
}

export function ConfirmBurstClient({
  leads,
}: {
  leads: readonly CampaignLeadRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('TARGETED');
  const [result, setResult] = useState<BurstResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const leadsById = useMemo(() => {
    return new Map(leads.map(l => [l.id, l] as const));
  }, [leads]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === leads.length ? new Set() : new Set(leads.map(l => l.id)),
    );
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/campaigns/confirm-burst', {
          body: JSON.stringify({ leadIds: [...selected], mode }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`Burst failed: ${res.status} ${detail}`);
        }
        const body = (await res.json()) as BurstResponse;
        setResult(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Burst failed');
      }
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Confirm burst</h1>
        <p className="text-muted-foreground text-sm">
          Pick the leads you want in this burst. Each selection is gated by
          ATS posture, lead tier, trust level, and per-host rate budget. The
          desktop runner will consume the resulting queue items.
        </p>
      </header>

      <div className="flex w-fit items-center gap-3">
        <span className="text-sm font-medium">Mode:</span>
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          onChange={event => setMode(event.target.value as Mode)}
          value={mode}
        >
          <option value="TARGETED">TARGETED (human review)</option>
          <option value="GENERIC">GENERIC (guarded auto)</option>
          <option value="FIRE_AND_FORGET">FIRE_AND_FORGET (full auto)</option>
        </select>
        <Button
          disabled={isPending || selected.size === 0}
          onClick={handleSubmit}
          size="sm"
        >
          {isPending
            ? 'Dispatching...'
            : `Dispatch ${selected.size} lead${selected.size === 1 ? '' : 's'}`}
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
          <Checkbox
            checked={selected.size === leads.length && leads.length > 0}
            onCheckedChange={toggleAll}
          />
          <span>
            {selected.size}/{leads.length} selected
          </span>
        </div>
        <ul className="divide-y">
          {leads.map(lead => {
            const isSelected = selected.has(lead.id);
            return (
              <li key={lead.id} className="flex items-center gap-3 px-4 py-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOne(lead.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{lead.jobTitle}</div>
                  <div className="text-muted-foreground text-xs">
                    {lead.company ?? 'Unknown'} / {lead.hostname || 'no host'}
                  </div>
                </div>
                <Badge variant="outline">{lead.tier}</Badge>
              </li>
            );
          })}
          {leads.length === 0 ? (
            <li className="text-muted-foreground p-6 text-center text-sm">
              No eligible leads. Add leads with a submittable URL first.
            </li>
          ) : null}
        </ul>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-md border p-4 text-sm">
          <div className="font-medium">
            Enqueued {result.enqueued.length} / skipped {result.skipped.length}
          </div>
          {result.skipped.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {result.skipped.map(s => {
                const lead = leadsById.get(s.leadId);
                return (
                  <li key={s.leadId}>
                    <strong>{lead?.jobTitle ?? s.leadId}</strong> - {s.reason}
                    {s.detail ? ` (${s.detail})` : ''}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
