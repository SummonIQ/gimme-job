'use client';

import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  GripVertical,
  MousePointerClick,
  ShieldCheck,
  SkipForward,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Observation {
  id: string;
  hostname: string;
  pathname: string | null;
  selector: string;
  stableSelector: string | null;
  tagName: string;
  inputType: string | null;
  fieldName: string | null;
  fieldId: string | null;
  fieldLabel: string | null;
  ariaLabel: string | null;
  role: string | null;
  action: string;
  actionType: string;
  aiReason: string | null;
  valueFilled: string | null;
  success: boolean;
  observationCount: number;
  stepIndex: number;
  createdAt: string;
  updatedAt: string;
  atsSystem: { name: string } | null;
}

interface Rule {
  id: string;
  hostname: string;
  stableSelector: string;
  action: string;
  actionType: string;
  tagName: string;
  fieldName: string | null;
  fieldLabel: string | null;
  ariaLabel: string | null;
  role: string | null;
  stepIndex: number;
  reason: string | null;
  observationCount: number;
  confidence: number;
  consecutiveFailures: number;
  enabled: boolean;
  atsSystem: { name: string } | null;
}

interface ObservationsClientProps {
  observations: Observation[];
  rules: Rule[];
  hostnameBreakdown: { hostname: string; _count: { id: number } }[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const actionTypeIcon = (actionType: string) => {
  switch (actionType) {
    case 'fill':
      return <Type className="h-3.5 w-3.5" />;
    case 'click':
      return <MousePointerClick className="h-3.5 w-3.5" />;
    case 'upload':
      return <Upload className="h-3.5 w-3.5" />;
    case 'ignore':
      return <SkipForward className="h-3.5 w-3.5" />;
    default:
      return <ArrowRight className="h-3.5 w-3.5" />;
  }
};

function ElementBadge({
  tagName,
  inputType,
  role,
}: {
  tagName: string;
  inputType?: string | null;
  role?: string | null;
}) {
  const tag = tagName.toLowerCase();
  let label = tag;
  if (inputType) label = `${tag}[${inputType}]`;
  else if (role) label = `${tag}[${role}]`;
  return (
    <code className="rounded bg-muted/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
      &lt;{label}&gt;
    </code>
  );
}

function SelectorDisplay({
  selector,
  stableSelector,
}: {
  selector: string;
  stableSelector: string | null;
}) {
  const primary = stableSelector || selector;
  const isStable = Boolean(stableSelector);
  return (
    <div className="flex items-center gap-1.5">
      {isStable && (
        <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
      )}
      <code className="truncate text-[11px] text-muted-foreground/70">
        {primary}
      </code>
    </div>
  );
}

function AttributeChips({
  obs,
}: {
  obs: Pick<
    Observation,
    'fieldName' | 'fieldLabel' | 'ariaLabel' | 'fieldId' | 'role'
  >;
}) {
  const chips: { label: string; value: string }[] = [];
  if (obs.fieldLabel) chips.push({ label: 'label', value: obs.fieldLabel });
  if (obs.ariaLabel) chips.push({ label: 'aria', value: obs.ariaLabel });
  if (obs.role) chips.push({ label: 'role', value: obs.role });
  if (obs.fieldName) chips.push({ label: 'name', value: obs.fieldName });
  if (obs.fieldId) chips.push({ label: 'id', value: obs.fieldId });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(chip => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-0.5 rounded border border-border/40 bg-muted/30 px-1.5 py-px text-[11px]"
        >
          <span className="text-muted-foreground/60">{chip.label}:</span>
          <span className="truncate max-w-40">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
      {step}
    </span>
  );
}

const formatHostnameLabel = (hostname: string) => {
  return hostname.replace(/^www\./i, '');
};

function EditableStepNumber({
  stepIndex,
  onSave,
}: {
  stepIndex: number;
  onSave: (newStep: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(stepIndex + 1));
  const inputRef = useRef<HTMLInputElement>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          setValue(String(stepIndex + 1));
          setTimeout(() => inputRef.current?.select(), 0);
        }}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary hover:bg-primary/20 transition-colors cursor-pointer"
        title="Click to edit step number"
      >
        {stepIndex + 1}
      </button>
    );
  }

  const save = () => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      onSave(num - 1);
    }
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      type="number"
      min={1}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={save}
      className="h-6 w-8 shrink-0 rounded border border-primary/40 bg-background px-1 text-center text-xs font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

// ---------------------------------------------------------------------------
// ObservationCard — improved visual
// ---------------------------------------------------------------------------

function ObservationCard({
  obs,
  onDismiss,
  onPromote,
  showHostname = true,
  onUpdateStep,
}: {
  obs: Observation;
  onDismiss: (id: string) => void;
  onPromote: (id: string) => void;
  showHostname?: boolean;
  onUpdateStep: (id: string, stepIndex: number) => void;
}) {
  return (
    <div className="group flex items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/30">
      <EditableStepNumber
        stepIndex={obs.stepIndex}
        onSave={newStep => onUpdateStep(obs.id, newStep)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {showHostname && (
            <span className="text-sm font-medium">{obs.hostname}</span>
          )}
          {obs.atsSystem?.name && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {obs.atsSystem.name}
            </Badge>
          )}
          <ElementBadge
            tagName={obs.tagName}
            inputType={obs.inputType}
            role={obs.role}
          />
          <Badge
            variant={obs.action === 'continue' ? 'default' : 'secondary'}
            className="gap-1 text-[10px] px-1.5 py-0"
          >
            {actionTypeIcon(obs.action === 'ignore' ? 'ignore' : obs.actionType)}
            {obs.actionType}
          </Badge>
          {obs.observationCount > 1 && (
            <span className="text-[10px] tabular-nums text-muted-foreground/60">
              {obs.observationCount}x
            </span>
          )}
        </div>

        {obs.aiReason && (
          <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">
            {obs.aiReason}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <AttributeChips obs={obs} />
          <SelectorDisplay
            selector={obs.selector}
            stableSelector={obs.stableSelector}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        <span className="text-[10px] text-muted-foreground/40 tabular-nums mr-1">
          {new Date(obs.updatedAt).toLocaleDateString()}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px] text-emerald-600 border-emerald-200/60 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-800/60 dark:hover:bg-emerald-950"
          onClick={() => onPromote(obs.id)}
          title="Promote to rule"
        >
          <ShieldCheck className="h-3 w-3" />
          Promote
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDismiss(obs.id)}
          title="Dismiss observation"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DraggableRuleCard — draggable rule with grip handle
// ---------------------------------------------------------------------------

function DraggableRuleCard({
  rule,
  position,
  isDragging,
  onDisable,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  rule: Rule;
  position: number;
  isDragging: boolean;
  onDisable: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, ruleId: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, rule.id)}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 p-3 transition-all duration-200 ${
        isDragging ? 'opacity-30 scale-[0.98]' : 'opacity-100'
      } cursor-grab active:cursor-grabbing`}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold tabular-nums text-primary">
        {position}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {rule.fieldLabel && (
            <span className="text-sm font-medium">{rule.fieldLabel}</span>
          )}
          <ElementBadge tagName={rule.tagName} role={rule.role} />
          <Badge
            variant={rule.action === 'continue' ? 'default' : 'secondary'}
            className="gap-1 text-[10px] px-1.5 py-0"
          >
            {actionTypeIcon(
              rule.action === 'ignore' ? 'ignore' : rule.actionType,
            )}
            {rule.actionType}
          </Badge>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {rule.observationCount}x &middot;{' '}
            {Math.round(rule.confidence * 100)}%
          </span>
          {rule.consecutiveFailures > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              {rule.consecutiveFailures} fail{rule.consecutiveFailures !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500/70" />
          <code className="truncate text-[11px] text-muted-foreground/60">
            {rule.stableSelector}
          </code>
        </div>
        {rule.reason && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/50">
            {rule.reason}
          </p>
        )}
      </div>

      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => onDisable(rule.id)}
          title="Disable rule"
        >
          Disable
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive"
          onClick={() => onDelete(rule.id)}
          title="Delete rule"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop indicator line between draggable items
// ---------------------------------------------------------------------------

function DropIndicator({
  isActive,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  isActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative"
    >
      <div
        className={`transition-all duration-200 ease-out ${
          isActive
            ? 'h-1 my-1 rounded-full bg-primary/50'
            : 'h-0 my-0'
        }`}
      />
      {/* Invisible wider hit area */}
      <div className="absolute inset-x-0 -top-2 -bottom-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableRuleList — rules with drag-and-drop reordering
// ---------------------------------------------------------------------------

function SortableRuleList({
  rules,
  onReorder,
  onDisable,
  onDelete,
}: {
  rules: Rule[];
  onReorder: (orderedIds: string[]) => void;
  onDisable: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...rules].sort((a, b) => a.stepIndex - b.stepIndex),
    [rules],
  );

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, ruleId: string) => {
    setDraggedId(ruleId);
    e.dataTransfer.effectAllowed = 'move';
    // Use a tiny transparent image as drag ghost
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  };

  const handleDragEnd = () => {
    if (draggedId !== null && dropIndex !== null) {
      const draggedIndex = sorted.findIndex(r => r.id === draggedId);
      if (draggedIndex !== -1) {
        const reordered = [...sorted];
        const [moved] = reordered.splice(draggedIndex, 1);
        const insertAt =
          dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
        reordered.splice(insertAt, 0, moved);
        onReorder(reordered.map(r => r.id));
      }
    }
    setDraggedId(null);
    setDropIndex(null);
  };

  const makeDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  };

  const makeDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropIndex(index);
    // handleDragEnd is called by the browser after drop
  };

  const handleDragLeave = () => {
    // Only clear if we're leaving the entire list
  };

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-0" onDragLeave={() => setDropIndex(null)}>
      {/* Top drop zone */}
      <DropIndicator
        isActive={dropIndex === 0 && draggedId !== sorted[0]?.id}
        onDragOver={makeDragOver(0)}
        onDragLeave={handleDragLeave}
        onDrop={makeDrop(0)}
      />

      {sorted.map((rule, i) => (
        <div key={rule.id}>
          <DraggableRuleCard
            rule={rule}
            position={i + 1}
            isDragging={draggedId === rule.id}
            onDisable={onDisable}
            onDelete={onDelete}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
          {/* Drop zone after each card */}
          <DropIndicator
            isActive={
              dropIndex === i + 1 &&
              draggedId !== rule.id &&
              draggedId !== sorted[i + 1]?.id
            }
            onDragOver={makeDragOver(i + 1)}
            onDragLeave={handleDragLeave}
            onDrop={makeDrop(i + 1)}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressionView — timeline per hostname (read-only overview)
// ---------------------------------------------------------------------------

function ProgressionView({
  rules,
  showHostnameHeading = true,
}: {
  rules: Rule[];
  showHostnameHeading?: boolean;
}) {
  const rulesByHostname = useMemo(() => {
    const map = new Map<string, Rule[]>();
    for (const rule of rules) {
      if (rule.action !== 'continue') continue;
      const existing = map.get(rule.hostname) || [];
      existing.push(rule);
      map.set(rule.hostname, existing);
    }
    for (const [hostname, group] of map) {
      map.set(
        hostname,
        group.sort((a, b) => a.stepIndex - b.stepIndex),
      );
    }
    return map;
  }, [rules]);

  const ignoreRules = useMemo(
    () => rules.filter(r => r.action === 'ignore'),
    [rules],
  );

  if (rules.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No learned rules yet. Rules are created when observations are
        confirmed 4+ times or manually promoted.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {rulesByHostname.size === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-foreground">
            No continue-step sequence yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This site currently only has ignore rules, so there is no ordered
            application flow to render yet.
          </p>
        </div>
      ) : (
        Array.from(rulesByHostname.entries()).map(([hostname, steps]) => (
          <div key={hostname}>
            {showHostnameHeading && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold">{hostname}</span>
                {steps[0]?.atsSystem?.name && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {steps[0].atsSystem.name}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="tabular-nums text-[10px] px-1.5 py-0"
                >
                  {steps.length} steps
                </Badge>
              </div>
            )}

            <div className="relative ml-4 space-y-0 border-l-2 border-border/50 pl-6">
              {steps.map((step, i) => (
                <div key={step.id} className="relative pb-5 last:pb-0">
                  <div className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 text-[11px] font-bold tabular-nums text-primary">
                    {i + 1}
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
                      {actionTypeIcon(step.actionType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium capitalize">
                          {step.actionType}
                        </span>
                        {step.fieldLabel && (
                          <span className="text-sm text-muted-foreground">
                            &ldquo;{step.fieldLabel}&rdquo;
                          </span>
                        )}
                        <ElementBadge tagName={step.tagName} role={step.role} />
                      </div>
                      <code className="mt-0.5 block truncate text-[11px] text-muted-foreground/50">
                        {step.stableSelector}
                      </code>
                      {step.reason && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                          {step.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {step.consecutiveFailures > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-amber-500"
                          title={`${step.consecutiveFailures} consecutive failure(s)`}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {step.consecutiveFailures}
                        </span>
                      )}
                      <span className="text-[10px] tabular-nums text-muted-foreground/50">
                        {step.observationCount}x &middot;{' '}
                        {Math.round(step.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  {i < steps.length - 1 && (
                    <div className="ml-3 mt-1 text-muted-foreground/30">
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {ignoreRules.length > 0 && (
        <div className="rounded-md border border-dashed border-amber-400/30 bg-amber-500/5 p-3">
          <p className="mb-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Ignore rules
          </p>
          <div className="space-y-1">
            {ignoreRules.map(rule => (
              <div
                key={rule.id}
                className="flex items-center gap-2 text-[11px] text-muted-foreground"
              >
                <SkipForward className="h-3 w-3 text-amber-500/70" />
                <code className="truncate">{rule.stableSelector}</code>
                {rule.fieldLabel && (
                  <span className="text-muted-foreground/60">
                    ({rule.fieldLabel})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ObservationsClient = ({
  observations: initialObservations,
  rules: initialRules,
  hostnameBreakdown,
}: ObservationsClientProps) => {
  const router = useRouter();
  const [observations, setObservations] = useState(initialObservations);
  const [rules, setRules] = useState(initialRules);
  const [activeTab, setActiveTab] = useState<
    'progression' | 'observations' | 'rules'
  >('progression');
  const [selectedHostname, setSelectedHostname] = useState<string | null>(null);

  const siteSummaries = useMemo(() => {
    const hostnameOrder = new Map(
      hostnameBreakdown.map((row, index) => [row.hostname, index]),
    );
    const observationCounts = new Map(
      hostnameBreakdown.map(row => [row.hostname, row._count.id]),
    );
    const ruleCounts = new Map<string, number>();

    rules.forEach(rule => {
      ruleCounts.set(rule.hostname, (ruleCounts.get(rule.hostname) ?? 0) + 1);
    });

    const hostnames = Array.from(
      new Set([
        ...hostnameBreakdown.map(row => row.hostname),
        ...rules.map(rule => rule.hostname),
      ]),
    );

    return hostnames
      .map(hostname => ({
        hostname,
        label: formatHostnameLabel(hostname),
        observations: observationCounts.get(hostname) ?? 0,
        rules: ruleCounts.get(hostname) ?? 0,
        total:
          (observationCounts.get(hostname) ?? 0) + (ruleCounts.get(hostname) ?? 0),
      }))
      .sort((left, right) => {
        const leftOrder = hostnameOrder.get(left.hostname) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder =
          hostnameOrder.get(right.hostname) ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        if (left.total !== right.total) {
          return right.total - left.total;
        }

        return left.hostname.localeCompare(right.hostname);
      });
  }, [hostnameBreakdown, rules]);

  useEffect(() => {
    if (siteSummaries.length === 0) {
      setSelectedHostname(null);
      return;
    }

    setSelectedHostname(current =>
      current && siteSummaries.some(site => site.hostname === current)
        ? current
        : siteSummaries[0].hostname,
    );
  }, [siteSummaries]);

  const selectedSite = useMemo(
    () =>
      siteSummaries.find(site => site.hostname === selectedHostname) ?? null,
    [selectedHostname, siteSummaries],
  );

  const filteredObservations = useMemo(() => {
    const filtered = selectedHostname
      ? observations.filter(o => o.hostname === selectedHostname)
      : [];
    return [...filtered].sort((a, b) => a.stepIndex - b.stepIndex);
  }, [observations, selectedHostname]);

  const observationsByStep = useMemo(() => {
    const map = new Map<number, Observation[]>();
    for (const obs of filteredObservations) {
      const step = obs.stepIndex;
      const group = map.get(step) || [];
      group.push(obs);
      map.set(step, group);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a - b));
  }, [filteredObservations]);

  const filteredRules = useMemo(
    () =>
      selectedHostname
        ? rules.filter(r => r.hostname === selectedHostname)
        : [],
    [rules, selectedHostname],
  );

  // --- Observation handlers ---

  const handleDismissObservation = async (id: string) => {
    setObservations(prev => prev.filter(o => o.id !== id));
    await fetch(`/api/admin/observations?id=${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  const handlePromoteObservation = async (id: string) => {
    const res = await fetch('/api/admin/observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promote', observationId: id }),
    });
    if (res.ok) {
      router.refresh();
    }
  };

  const handleUpdateStep = async (id: string, stepIndex: number) => {
    setObservations(prev =>
      prev.map(o => (o.id === id ? { ...o, stepIndex } : o)),
    );
    await fetch('/api/admin/observations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stepIndex }),
    }).catch(() => {});
  };

  // --- Rule handlers ---

  const handleDisableRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    await fetch('/api/admin/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: false }),
    }).catch(() => {});
  };

  const handleDeleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/admin/rules?id=${id}`, { method: 'DELETE' }).catch(
      () => {},
    );
  };

  const handleReorderRules = useCallback(
    async (orderedIds: string[]) => {
      // Build new step assignments
      const updates = orderedIds.map((id, i) => ({ id, stepIndex: i }));

      // Optimistically update local state
      setRules(prev =>
        prev.map(r => {
          const update = updates.find(u => u.id === r.id);
          return update ? { ...r, stepIndex: update.stepIndex } : r;
        }),
      );

      // Batch persist
      await fetch('/api/admin/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: updates }),
      }).catch(() => {});
    },
    [],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/30">
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
              Sites
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a hostname to review its application flow, observations,
              and rules.
            </p>
          </div>

          <div className="max-h-[65vh] space-y-1 overflow-y-auto p-2">
            {siteSummaries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 px-3 py-6 text-center text-sm text-muted-foreground">
                No sites yet.
              </div>
            ) : (
              siteSummaries.map(site => (
                <button
                  key={site.hostname}
                  type="button"
                  onClick={() => setSelectedHostname(site.hostname)}
                  className={`flex w-full flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left transition-colors ${
                    selectedHostname === site.hostname
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/30 hover:text-foreground'
                  }`}
                  title={site.hostname}
                >
                  <div className="min-w-0 w-full">
                    <div className="truncate text-sm font-medium">
                      {site.label}
                    </div>
                    {site.label !== site.hostname && (
                      <div className="truncate text-xs text-muted-foreground/70">
                        {site.hostname}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={
                        selectedHostname === site.hostname ? 'default' : 'outline'
                      }
                      className="px-1.5 py-0 text-[10px] tabular-nums"
                    >
                      {site.observations} obs
                    </Badge>
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[10px] tabular-nums"
                    >
                      {site.rules} rules
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {selectedSite ? (
          <>
            <div className="rounded-xl border border-border/50 bg-card/30 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
                Selected Site
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="max-w-full truncate text-xl font-semibold">
                  {selectedSite.label}
                </h2>
                {selectedSite.label !== selectedSite.hostname && (
                  <code className="max-w-full truncate rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                    {selectedSite.hostname}
                  </code>
                )}
                <Badge variant="outline" className="tabular-nums">
                  {filteredObservations.length} observations
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  {filteredRules.length} rules
                </Badge>
              </div>
            </div>

            <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
              {(['progression', 'observations', 'rules'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'progression'
                    ? 'Application Flow'
                    : tab === 'observations'
                      ? `Observations (${filteredObservations.length})`
                      : `Rules (${filteredRules.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'progression' && (
              <div>
                <h2 className="text-lg font-semibold">Application Flow</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Linear progression of validated steps for{' '}
                  {selectedSite.label}. This sequence drives AI-assisted and
                  fully automated application submission.
                </p>
                <ProgressionView
                  rules={filteredRules}
                  showHostnameHeading={false}
                />
              </div>
            )}

            {activeTab === 'observations' && (
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Observations</h2>
                  <p className="text-sm text-muted-foreground">
                    Deduplicated field interactions for {selectedSite.label},
                    grouped by step. Click the step number to edit it.
                  </p>
                </div>

                {filteredObservations.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No observations for {selectedSite.label} yet.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {Array.from(observationsByStep.entries()).map(
                      ([step, group]) => (
                        <div key={step}>
                          <div className="mb-2 flex items-center gap-2">
                            <StepBadge step={step + 1} />
                            <span className="text-sm font-medium">
                              Step {step + 1}
                            </span>
                            <span className="text-[11px] text-muted-foreground/50">
                              {group.length} observation
                              {group.length !== 1 ? 's' : ''}
                            </span>
                            <div className="flex-1 border-t border-border/30" />
                          </div>
                          <div className="divide-y divide-border/30">
                            {group.map(obs => (
                              <ObservationCard
                                key={obs.id}
                                obs={obs}
                                onDismiss={handleDismissObservation}
                                onPromote={handlePromoteObservation}
                                showHostname={false}
                                onUpdateStep={handleUpdateStep}
                              />
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rules' && (
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Learned Rules</h2>
                  <p className="text-sm text-muted-foreground">
                    One rule per step for {selectedSite.label}. Drag to reorder
                    the step sequence.
                  </p>
                </div>

                {filteredRules.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No rules for {selectedSite.label} yet.
                  </p>
                ) : (
                  <SortableRuleList
                    rules={filteredRules}
                    onReorder={handleReorderRules}
                    onDisable={handleDisableRule}
                    onDelete={handleDeleteRule}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 px-6 py-12 text-center text-sm text-muted-foreground">
            No hostname data is available yet.
          </div>
        )}
      </div>
    </div>
  );
};

export { ObservationsClient };
