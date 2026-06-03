import {
  Bot,
  Check,
  Copy,
  History,
  ListChecks,
  MessageCircle,
  PanelLeftClose,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { DesktopAgentObservation } from './desktop-observations-popover';
import type { DesktopFieldRule } from '../desktop-api';
import type { SavedSubmitLeadDraft } from '../lib/submit-lead-storage';
import type {
  DesktopAssistPageContext,
  DesktopAssistPageField,
  DesktopAssistPageIssue,
  DesktopRuntimeProviderInfo,
  DesktopSubmitLeadResult,
} from '../desktop-api';

export interface DesktopFieldObservation {
  readonly action: 'fill' | 'select';
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly fieldType: string;
  readonly hostname: string;
  readonly id: string;
  readonly lastSeenAt: string;
  readonly lastValue: string;
  readonly occurrences: number;
  readonly priorAiValue: string | null;
  readonly selector: string;
}

export type DesktopDebugEvent = {
  readonly detail?: string;
  readonly id: string;
  readonly kind:
    | 'status'
    | 'submit'
    | 'random'
    | 'action'
    | 'rule'
    | 'observation'
    | 'error';
  readonly message: string;
  readonly status?: 'ok' | 'error' | 'warning';
  readonly timestamp: string;
};

export type DesktopHistoryEntry = {
  readonly aiProvider?: string;
  readonly applicationUrl: string;
  readonly errorTool?: string;
  readonly errorToolReason?: string;
  readonly errorToolMessage?: string;
  readonly id: string;
  readonly jobLeadId?: string;
  readonly message?: string;
  readonly mode: DesktopSubmitLeadResult['mode'];
  readonly status: DesktopSubmitLeadResult['status'];
  readonly timestamp: string;
  readonly title: string;
  readonly toolCallCount?: number;
  // Total attempts across retries for this applicationUrl. Always at least
  // 1 — incremented when a later run for the same URL replaces this entry.
  readonly attemptCount?: number;
  // Number of times the prior runs failed before this one. Lets us show
  // "succeeded after N retries" without keeping every prior attempt.
  readonly priorFailureCount?: number;
  // Short summary of prior failure reasons, newest first.
  readonly priorFailureSummaries?: readonly string[];
};

export type DesktopSidebarTab =
  | 'controls'
  | 'chat'
  | 'state'
  | 'debug'
  | 'history'
  | 'observations';

interface DesktopSidebarProps {
  readonly activeTab: DesktopSidebarTab;
  readonly agentChatView: ReactNode;
  readonly assistPageContext: DesktopAssistPageContext | null;
  readonly controlsView: ReactNode;
  readonly debugEvents: readonly DesktopDebugEvent[];
  readonly description?: string;
  readonly detectedRuntimeProvider?: DesktopRuntimeProviderInfo | null;
  readonly fieldObservations: readonly DesktopFieldObservation[];
  readonly history: readonly DesktopHistoryEntry[];
  readonly isAutofillPaused?: boolean;
  readonly observations: readonly DesktopAgentObservation[];
  readonly onCancelRun?: () => void;
  readonly onFocusAssistField: (field: DesktopAssistPageField) => void;
  readonly onLoadSavedJob: (draft: SavedSubmitLeadDraft) => void;
  readonly onRefreshAssistPageContext: () => void;
  readonly onTabChange: (tab: DesktopSidebarTab) => void;
  readonly onToggleAutofillPause?: () => void;
  readonly onToggleSidebar: () => void;
  readonly isRuntimeBusy?: boolean;
  readonly runtimeProviderOptions?: readonly DesktopRuntimeProviderInfo[];
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
  readonly tailorResumeView?: ReactNode;
  readonly title?: string;
}

export function DesktopSidebar({
  activeTab,
  agentChatView,
  assistPageContext,
  controlsView,
  debugEvents,
  description,
  detectedRuntimeProvider,
  fieldObservations,
  history,
  isAutofillPaused = false,
  observations,
  onCancelRun,
  onFocusAssistField,
  onLoadSavedJob,
  onRefreshAssistPageContext,
  onTabChange,
  onToggleAutofillPause,
  onToggleSidebar,
  isRuntimeBusy = false,
  runtimeProviderOptions,
  savedDrafts,
  tailorResumeView,
  title,
}: DesktopSidebarProps) {
  return (
    <aside aria-label="Desktop runtime sidebar" className="desktop-sidebar">
      <nav
        aria-label="Sidebar sections"
        className="desktop-sidebar-tablist"
        role="tablist"
      >
        <SidebarTab
          active={activeTab === 'controls'}
          icon={Play}
          label="Run"
          onClick={() => onTabChange('controls')}
        />
        <SidebarTab
          active={activeTab === 'chat'}
          icon={MessageCircle}
          label="Chat"
          onClick={() => onTabChange('chat')}
        />
        <SidebarTab
          active={activeTab === 'state'}
          icon={ListChecks}
          label="State"
          onClick={() => onTabChange('state')}
        />
        <SidebarTab
          active={activeTab === 'debug'}
          icon={SlidersHorizontal}
          label="Debug"
          onClick={() => onTabChange('debug')}
        />
        <SidebarTab
          active={activeTab === 'history'}
          icon={History}
          label="History"
          onClick={() => onTabChange('history')}
        />
        <SidebarTab
          active={activeTab === 'observations'}
          icon={Bot}
          label="Observations"
          onClick={() => onTabChange('observations')}
        />
        <button
          aria-label="Hide sidebar"
          className="desktop-sidebar-toggle"
          onClick={onToggleSidebar}
          type="button"
        >
          <PanelLeftClose aria-hidden="true" />
        </button>
      </nav>

      <div className="desktop-sidebar-tabpanel" role="tabpanel">
        {title ? (
          <header className="desktop-sidebar-page-header">
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </header>
        ) : null}
        {activeTab === 'controls' ? (
          <section className="desktop-sidebar-controls-section">
            {controlsView}
            {isRuntimeBusy ? (
              <div className="desktop-sidebar-runtime-slideup">
                <div
                  className="desktop-sidebar-runtime-actions"
                  role="group"
                  aria-label="Runtime controls"
                >
                  {onToggleAutofillPause ? (
                    <button
                      aria-pressed={isAutofillPaused}
                      className={`desktop-sidebar-runtime-action${
                        isAutofillPaused
                          ? ' desktop-sidebar-runtime-action--resume'
                          : ''
                      }`}
                      onClick={onToggleAutofillPause}
                      type="button"
                    >
                      {isAutofillPaused ? (
                        <Play aria-hidden="true" />
                      ) : (
                        <Pause aria-hidden="true" />
                      )}
                      <span>{isAutofillPaused ? 'Resume' : 'Pause'}</span>
                    </button>
                  ) : null}
                  {onCancelRun ? (
                    <button
                      className="desktop-sidebar-runtime-action desktop-sidebar-runtime-action--stop"
                      onClick={onCancelRun}
                      type="button"
                    >
                      <Square aria-hidden="true" />
                      <span>Stop</span>
                    </button>
                  ) : null}
                </div>
                <StateTab
                  context={assistPageContext}
                  detectedRuntimeProvider={detectedRuntimeProvider}
                  onFocusAssistField={onFocusAssistField}
                  onRefresh={onRefreshAssistPageContext}
                  variant="runtime"
                />
                <DebugTab events={debugEvents} variant="runtime" />
              </div>
            ) : null}
          </section>
        ) : activeTab === 'chat' ? (
          <section className="agent-chat-section">{agentChatView}</section>
        ) : activeTab === 'state' ? (
          <StateTab
            context={assistPageContext}
            detectedRuntimeProvider={detectedRuntimeProvider}
            onFocusAssistField={onFocusAssistField}
            onRefresh={onRefreshAssistPageContext}
            runtimeProviderOptions={runtimeProviderOptions}
            tailorResumeView={tailorResumeView}
          />
        ) : activeTab === 'debug' ? (
          <DebugTab events={debugEvents} />
        ) : activeTab === 'history' ? (
          <HistoryTab
            history={history}
            onLoadSavedJob={onLoadSavedJob}
            savedDrafts={savedDrafts}
          />
        ) : (
          <ObservationsTab
            fieldObservations={fieldObservations}
            observations={observations}
          />
        )}
      </div>
    </aside>
  );
}

function SidebarTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`desktop-sidebar-tab${active ? ' active' : ''}`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function StateTab({
  context,
  detectedRuntimeProvider,
  onFocusAssistField,
  onRefresh,
  runtimeProviderOptions,
  tailorResumeView,
  variant = 'default',
}: {
  readonly context: DesktopAssistPageContext | null;
  readonly detectedRuntimeProvider?: DesktopRuntimeProviderInfo | null;
  readonly onFocusAssistField: (field: DesktopAssistPageField) => void;
  readonly onRefresh: () => void;
  readonly runtimeProviderOptions?: readonly DesktopRuntimeProviderInfo[];
  readonly tailorResumeView?: ReactNode;
  readonly variant?: 'default' | 'runtime';
}) {
  const fields = context?.fields ?? [];
  const issues = context?.issues ?? [];
  const filledCount = fields.filter(isPageFieldFilled).length;
  const requiredEmptyCount = fields.filter(isPageFieldRequiredEmpty).length;

  return (
    <div
      className={`desktop-sidebar-stack${
        variant === 'runtime' ? ' desktop-sidebar-stack--runtime' : ''
      }`}
    >
      <section className="desktop-sidebar-section">
        <header className="desktop-sidebar-section-header">
          <h3>Page</h3>
          <button
            aria-label="Refresh page state"
            className="desktop-sidebar-section-icon-action"
            onClick={onRefresh}
            title="Refresh"
            type="button"
          >
            <RefreshCw size={12} strokeWidth={2.25} />
          </button>
        </header>
        {context ? (
          <div className="desktop-sidebar-page-info">
            <div className="desktop-sidebar-page-info-url-row">
              <p className="desktop-sidebar-page-info-url" title={context.url}>
                {context.url || 'No URL captured'}
              </p>
              {context.url ? <CopyUrlButton url={context.url} /> : null}
            </div>
            {detectedRuntimeProvider ? (
              <div
                className={`desktop-sidebar-detected-ats desktop-sidebar-detected-ats--${detectedRuntimeProvider.readiness}`}
              >
                <span className="desktop-sidebar-detected-ats-label">
                  Detected ATS
                </span>
                <span className="desktop-sidebar-detected-ats-name">
                  {detectedRuntimeProvider.label}
                </span>
                <span className="desktop-sidebar-detected-ats-readiness">
                  {detectedRuntimeProvider.readiness === 'manual_review'
                    ? 'manual review'
                    : detectedRuntimeProvider.readiness}
                </span>
              </div>
            ) : null}
            <div className="desktop-sidebar-page-info-stats">
              <span className="desktop-sidebar-page-info-stat">
                <strong>{fields.length}</strong>
                <em>fields</em>
              </span>
              <span className="desktop-sidebar-page-info-stat">
                <strong>{filledCount}</strong>
                <em>filled</em>
              </span>
              <span
                className={`desktop-sidebar-page-info-stat${
                  requiredEmptyCount > 0
                    ? ' desktop-sidebar-page-info-stat--warn'
                    : ''
                }`}
              >
                <strong>{requiredEmptyCount}</strong>
                <em>required empty</em>
              </span>
              <time
                className="desktop-sidebar-page-info-time"
                dateTime={context.capturedAt}
              >
                {formatTime(context.capturedAt)}
              </time>
            </div>
          </div>
        ) : (
          <p className="desktop-sidebar-empty">No page state captured yet.</p>
        )}
      </section>

      {tailorResumeView ?? null}

      {variant === 'default' && runtimeProviderOptions ? (
        <SmokeTestPanel runtimeProviderOptions={runtimeProviderOptions} />
      ) : null}

      <PageStateFieldsTable
        fields={fields}
        issues={issues}
        onFocusAssistField={onFocusAssistField}
        rulesBySelector={buildRulesBySelector(context)}
      />
    </div>
  );
}

function SmokeTestPanel({
  runtimeProviderOptions,
}: {
  readonly runtimeProviderOptions: readonly DesktopRuntimeProviderInfo[];
}) {
  const trainable = runtimeProviderOptions.filter(
    option => option.runner !== null && option.readiness === 'production',
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    () => trainable[0]?.id ?? '',
  );
  const [count, setCount] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    index: number;
    total: number;
    message?: string;
    applicationUrl?: string;
  } | null>(null);
  const [lastResult, setLastResult] = useState<DesktopSmokeTestResultLike | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProviderId && trainable[0]) {
      setSelectedProviderId(trainable[0].id);
    }
  }, [trainable, selectedProviderId]);

  useEffect(() => {
    const submit = window.gimmeJobDesktop?.submit;
    if (!submit?.onSmokeProgress) return;
    return submit.onSmokeProgress(event => {
      if (event.phase === 'complete' || event.phase === 'cancelled') {
        setProgress(null);
        return;
      }
      setProgress({
        applicationUrl: event.applicationUrl,
        index: event.index,
        message: event.message,
        total: event.total,
      });
    });
  }, []);

  const handleRun = async () => {
    if (!selectedProviderId || isRunning) return;
    setIsRunning(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await window.gimmeJobDesktop?.submit.runSmokeTest({
        count,
        runtimeProviderId: selectedProviderId,
      });
      if (result) setLastResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  const handleCancel = async () => {
    await window.gimmeJobDesktop?.submit.cancelSmokeTest().catch(() => undefined);
  };

  return (
    <section className="desktop-sidebar-section desktop-sidebar-smoke-test">
      <header className="desktop-sidebar-section-header">
        <h3>Smoke test</h3>
      </header>
      <p className="desktop-sidebar-section-hint">
        Run training mode against {count} random {selectedProviderLabel(trainable, selectedProviderId)} jobs and write a JSON report to ~/Documents/Gimme Job/smoke-tests/.
      </p>
      <div className="desktop-sidebar-smoke-test-row">
        <label className="desktop-sidebar-control-field">
          <span>ATS</span>
          <select
            className="desktop-sidebar-fields-inline-control"
            disabled={isRunning || trainable.length === 0}
            onChange={event => setSelectedProviderId(event.target.value)}
            value={selectedProviderId}
          >
            {trainable.length === 0 ? (
              <option value="">No trainable ATS</option>
            ) : (
              trainable.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="desktop-sidebar-control-field">
          <span>Count</span>
          <input
            className="desktop-sidebar-fields-inline-control"
            disabled={isRunning}
            max={20}
            min={1}
            onChange={event => {
              const value = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(value)) {
                setCount(Math.max(1, Math.min(20, value)));
              }
            }}
            type="number"
            value={count}
          />
        </label>
      </div>
      <div className="desktop-sidebar-smoke-test-actions">
        {isRunning ? (
          <button
            className="desktop-sidebar-runtime-action desktop-sidebar-runtime-action--stop"
            onClick={() => void handleCancel()}
            type="button"
          >
            Stop
          </button>
        ) : (
          <button
            className="desktop-sidebar-runtime-action"
            disabled={!selectedProviderId || trainable.length === 0}
            onClick={() => void handleRun()}
            type="button"
          >
            Run smoke test
          </button>
        )}
      </div>
      {progress ? (
        <p className="desktop-sidebar-section-hint">
          {progress.index + 1} / {progress.total} —{' '}
          {progress.applicationUrl ?? progress.message ?? 'working…'}
        </p>
      ) : null}
      {error ? (
        <p className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--error">
          {error}
        </p>
      ) : null}
      {lastResult ? (
        <div className="desktop-sidebar-smoke-test-result">
          <p>
            <strong>{lastResult.runtimeProviderLabel}</strong> · {lastResult.completed} done · {lastResult.failed} failed · {lastResult.skipped} skipped
          </p>
          <p className="desktop-sidebar-section-hint" title={lastResult.reportPath}>
            Report: <code>{lastResult.reportPath}</code>
          </p>
        </div>
      ) : null}
    </section>
  );
}

type DesktopSmokeTestResultLike = {
  readonly runtimeProviderLabel: string;
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly reportPath: string;
};

function selectedProviderLabel(
  options: readonly DesktopRuntimeProviderInfo[],
  id: string,
): string {
  return options.find(option => option.id === id)?.label ?? 'selected';
}

function CopyUrlButton({ url }: { readonly url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        // ignore — clipboard API may be unavailable in some contexts
      });
  };

  return (
    <button
      aria-label={copied ? 'Copied' : 'Copy URL'}
      className="desktop-sidebar-page-info-copy"
      onClick={handleCopy}
      title={copied ? 'Copied' : 'Copy URL'}
      type="button"
    >
      {copied ? (
        <Check size={11} strokeWidth={2.5} />
      ) : (
        <Copy size={11} strokeWidth={2.25} />
      )}
    </button>
  );
}

interface FieldRuleEntry {
  readonly ok: boolean;
  readonly reason: string;
  readonly tool: string;
}

function buildRulesBySelector(
  context: DesktopAssistPageContext | null,
): Map<string, readonly FieldRuleEntry[]> {
  const map = new Map<string, FieldRuleEntry[]>();
  const calls = context?.lastSubmitResult?.toolCalls ?? [];
  for (const call of calls) {
    if (!call.selector || !call.reason) continue;
    const list = map.get(call.selector) ?? [];
    // Dedupe by reason — the planner re-runs the same rule across iterations
    // and the user wants a count of distinct rules, not raw attempts.
    if (!list.some(entry => entry.reason === call.reason)) {
      list.push({ ok: call.ok, reason: call.reason, tool: call.tool });
    }
    map.set(call.selector, list);
  }
  return map;
}

function PageStateFieldsTable({
  fields,
  issues,
  onFocusAssistField,
  rulesBySelector,
}: {
  readonly fields: readonly DesktopAssistPageField[];
  readonly issues: readonly DesktopAssistPageIssue[];
  readonly onFocusAssistField: (field: DesktopAssistPageField) => void;
  readonly rulesBySelector: Map<string, readonly FieldRuleEntry[]>;
}) {
  const [showHidden, setShowHidden] = useState(false);
  const hiddenCount = fields.filter(
    field => field.shouldAvoid || !field.visible,
  ).length;
  const visibleFields = showHidden
    ? fields
    : fields.filter(field => field.visible && !field.shouldAvoid);
  return (
    <section className="desktop-sidebar-section">
      <header className="desktop-sidebar-section-header">
        <h3>Fields</h3>
        <div className="desktop-sidebar-fields-header-meta">
          {hiddenCount > 0 ? (
            <label className="desktop-sidebar-switch-label">
              <span className="desktop-sidebar-switch-text">
                Show others ({hiddenCount})
              </span>
              <span
                className={`desktop-sidebar-switch${
                  showHidden ? ' desktop-sidebar-switch--on' : ''
                }`}
              >
                <input
                  checked={showHidden}
                  className="desktop-sidebar-switch-input"
                  onChange={event => setShowHidden(event.target.checked)}
                  type="checkbox"
                />
                <span className="desktop-sidebar-switch-thumb" />
              </span>
            </label>
          ) : null}
          <span>{visibleFields.length}</span>
        </div>
      </header>
      {visibleFields.length === 0 ? (
        <p className="desktop-sidebar-empty">No fields found on this page.</p>
      ) : (
        <table
          aria-label="Page fields"
          className="desktop-sidebar-fields-table"
        >
          <tbody>
            {visibleFields.map(field => {
              const matchingIssues = issues.filter(
                issue => issue.fieldSelector === field.selector,
              );
              // Prefer a real tool-error over a benign required-empty marker
              // so the status badge reflects the worst-case state.
              const issue =
                matchingIssues.find(item => item.kind === 'tool-error') ??
                matchingIssues[0];
              const rules = collectRulesForField(field, rulesBySelector);
              return (
                <PageStateFieldRow
                  field={field}
                  issue={issue}
                  key={pageFieldKey(field)}
                  onFocusField={() => onFocusAssistField(field)}
                  rules={rules}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function collectRulesForField(
  field: DesktopAssistPageField,
  rulesBySelector: Map<string, readonly FieldRuleEntry[]>,
): readonly FieldRuleEntry[] {
  // A field can match by either its primary selector or any candidate
  // selector the page-context script discovered (planner rules sometimes
  // target the id-based form, others target name= or structural form).
  const seen = new Set<string>();
  const collected: FieldRuleEntry[] = [];
  const selectors = [field.selector, ...field.candidateSelectors];
  for (const selector of selectors) {
    const entries = rulesBySelector.get(selector);
    if (!entries) continue;
    for (const entry of entries) {
      if (seen.has(entry.reason)) continue;
      seen.add(entry.reason);
      collected.push(entry);
    }
  }
  return collected;
}

function CheckboxGroupEditor({
  field,
}: {
  readonly field: DesktopAssistPageField;
}) {
  const labels = field.options;
  const selectors =
    field.optionValues && field.optionValues.length === labels.length
      ? field.optionValues
      : labels;
  // The field's `value` carries the comma-joined labels of currently-checked
  // boxes captured at the last page-state refresh. Track an optimistic
  // checked-state per option so toggles render immediately while the click
  // round-trips through CDP.
  const initialChecked = new Set(
    (field.value ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean),
  );
  const [checked, setChecked] = useState<ReadonlySet<string>>(initialChecked);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (label: string, selector: string) => {
    if (typeof window === 'undefined' || !window.gimmeJobDesktop) {
      setError('Desktop bridge unavailable.');
      return;
    }
    setBusy(label);
    setError(null);
    const result = await window.gimmeJobDesktop.shell.setAssistField({
      kind: 'click',
      selector,
      value: '',
    });
    if (result.ok) {
      setChecked(prev => {
        const next = new Set(prev);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        return next;
      });
    } else {
      setError(result.error ?? `Failed to toggle ${label}.`);
    }
    setBusy(null);
  };

  return (
    <div className="desktop-sidebar-fields-checkbox-group">
      {labels.map((label, index) => {
        const selector = selectors[index] ?? label;
        const isChecked = checked.has(label);
        const isBusy = busy === label;
        return (
          <label
            className={`desktop-sidebar-fields-checkbox-option${
              isChecked ? ' is-checked' : ''
            }`}
            key={`${selector}-${label}`}
          >
            <input
              checked={isChecked}
              disabled={isBusy}
              onChange={() => {
                void toggle(label, selector);
              }}
              type="checkbox"
            />
            <span>{label}</span>
            {isBusy ? (
              <span className="desktop-sidebar-fields-checkbox-busy">…</span>
            ) : null}
          </label>
        );
      })}
      {error ? (
        <span className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function TypeaheadEditor({
  field,
}: {
  readonly field: DesktopAssistPageField;
}) {
  const [query, setQuery] = useState(field.value ?? '');
  const [suggestions, setSuggestions] = useState<ReadonlyArray<{
    readonly label: string;
    readonly value: string;
  }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [committing, setCommitting] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Debounce live-search so we don't pound the assist view with one
  // fill+snapshot round-trip per keystroke.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.gimmeJobDesktop) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const result =
          await window.gimmeJobDesktop!.shell.getAssistFieldOptions(
            field.selector,
            { query: trimmed },
          );
        if (cancelled) return;
        if (result.ok && result.options) {
          setSuggestions(result.options);
        } else {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, field.selector]);

  const commit = async (value: string) => {
    if (typeof window === 'undefined' || !window.gimmeJobDesktop) return;
    setCommitting(value);
    setError(null);
    setStatus('idle');
    const result = await window.gimmeJobDesktop.shell.setAssistField({
      kind: 'typeahead',
      selector: field.selector,
      value,
      question: field.label ?? undefined,
      hostname: window.location.hostname || undefined,
    });
    if (result.ok) {
      setStatus('ok');
      setQuery(value);
      setSuggestions(null);
    } else {
      setStatus('error');
      setError(result.error ?? 'Failed to commit value.');
    }
    setCommitting(null);
  };

  return (
    <div className="desktop-sidebar-fields-typeahead">
      <input
        className="desktop-sidebar-fields-inline-control"
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          void commit(query);
        }}
        placeholder={field.placeholder ?? 'Type to search…'}
        type="text"
        value={query}
      />
      {searching ? (
        <span className="desktop-sidebar-fields-inline-status">Searching…</span>
      ) : null}
      {suggestions && suggestions.length > 0 ? (
        <ul className="desktop-sidebar-fields-typeahead-list">
          {suggestions.slice(0, 12).map(option => (
            <li key={`${option.value}-${option.label}`}>
              <button
                className="desktop-sidebar-fields-typeahead-option"
                disabled={committing !== null}
                onClick={() => {
                  void commit(option.label);
                }}
                type="button"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {suggestions && suggestions.length === 0 && !searching ? (
        <span className="desktop-sidebar-fields-inline-status">
          No suggestions for “{query.trim()}”.
        </span>
      ) : null}
      {status === 'ok' ? (
        <span className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--ok">
          Applied
        </span>
      ) : null}
      {status === 'error' ? (
        <span className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--error">
          {error ?? 'Failed'}
        </span>
      ) : null}
    </div>
  );
}

function FieldInlineEditor({
  field,
}: {
  readonly field: DesktopAssistPageField;
}) {
  const isCheckboxGroup =
    field.tagName === 'checkbox-group' || field.inputType === 'checkbox-group';
  const isTypeahead = !isCheckboxGroup && field.inputType === 'typeahead';
  const isSelectish =
    !isCheckboxGroup &&
    !isTypeahead &&
    (field.tagName === 'select' || field.inputType === 'select');
  const initial = field.value ?? '';
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [liveOptions, setLiveOptions] = useState<ReadonlyArray<{
    readonly label: string;
    readonly value: string;
  }> | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // The page-context script only sees options for native <select> elements
  // because custom Greenhouse / react-select dropdowns lazy-mount their
  // [role="option"] children. When this is a select-typed field with no
  // captured options, fetch them on demand by briefly opening the dropdown
  // in the assist view.
  const baseLabels = field.options;
  const baseValues =
    field.optionValues && field.optionValues.length === baseLabels.length
      ? field.optionValues
      : baseLabels;
  const labels = liveOptions
    ? liveOptions.map(option => option.label)
    : baseLabels;
  const values = liveOptions
    ? liveOptions.map(option => option.value)
    : baseValues;
  const needsLiveOptions =
    isSelectish && baseLabels.length === 0 && !liveOptions && !optionsLoading;

  const loadOptions = async () => {
    if (typeof window === 'undefined' || !window.gimmeJobDesktop) return;
    setOptionsLoading(true);
    try {
      const result = await window.gimmeJobDesktop.shell.getAssistFieldOptions(
        field.selector,
      );
      if (result.ok && result.options && result.options.length > 0) {
        setLiveOptions(result.options);
      } else {
        setLiveOptions([]);
      }
    } finally {
      setOptionsLoading(false);
    }
  };

  // The editor only mounts when the row expands, so kicking off a load on
  // mount matches the user expectation that opening a row reveals the
  // dropdown options without an extra click.
  useEffect(() => {
    if (needsLiveOptions) {
      void loadOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value: string) => {
    if (typeof window === 'undefined' || !window.gimmeJobDesktop) {
      setError('Desktop bridge unavailable.');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setError(null);
    const result = await window.gimmeJobDesktop.shell.setAssistField({
      kind: isSelectish ? 'select' : 'fill',
      selector: field.selector,
      value,
      question: field.label ?? undefined,
      hostname: window.location.hostname || undefined,
    });
    if (result.ok) {
      setStatus('ok');
    } else {
      setError(result.error ?? 'Failed to set value.');
      setStatus('error');
    }
  };

  return (
    <div className="desktop-sidebar-fields-inline-editor">
      <span className="desktop-sidebar-fields-detail-label">Set value</span>
      {isCheckboxGroup ? (
        <CheckboxGroupEditor field={field} />
      ) : isTypeahead ? (
        <TypeaheadEditor field={field} />
      ) : isSelectish && labels.length > 0 ? (
        <select
          className="desktop-sidebar-fields-inline-control"
          onChange={event => {
            const next = event.target.value;
            setDraft(next);
            void submit(next);
          }}
          value={draft}
        >
          <option value="">— select —</option>
          {labels.map((label, index) => (
            <option key={`${values[index]}-${label}`} value={values[index]}>
              {label}
            </option>
          ))}
        </select>
      ) : needsLiveOptions ? (
        <button
          className="desktop-sidebar-fields-inline-submit"
          onClick={() => {
            void loadOptions();
          }}
          type="button"
        >
          Load options
        </button>
      ) : optionsLoading ? (
        <span className="desktop-sidebar-fields-inline-status">
          Loading options…
        </span>
      ) : isSelectish && liveOptions && liveOptions.length === 0 ? (
        <span className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--error">
          No options found in dropdown.
        </span>
      ) : (
        <form
          className="desktop-sidebar-fields-inline-form"
          onSubmit={event => {
            event.preventDefault();
            void submit(draft);
          }}
        >
          <input
            className="desktop-sidebar-fields-inline-control"
            onChange={event => setDraft(event.target.value)}
            placeholder={field.placeholder ?? ''}
            type="text"
            value={draft}
          />
          <button
            className="desktop-sidebar-fields-inline-submit"
            disabled={status === 'saving'}
            type="submit"
          >
            {status === 'saving' ? 'Setting…' : 'Set'}
          </button>
        </form>
      )}
      {status === 'ok' ? (
        <span className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--ok">
          Applied
        </span>
      ) : null}
      {status === 'error' ? (
        <span className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--error">
          {error ?? 'Failed'}
        </span>
      ) : null}
    </div>
  );
}

function PageStateFieldRow({
  field,
  issue,
  onFocusField,
  rules,
}: {
  readonly field: DesktopAssistPageField;
  readonly issue?: DesktopAssistPageIssue;
  readonly onFocusField: () => void;
  readonly rules: readonly FieldRuleEntry[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = pageFieldStatus(field, issue);
  const label = pageFieldLabel(field);
  const value = pageFieldValue(field);
  const guess = field.wasAutofilled?.value?.trim() ?? '';
  const fieldType = field.inputType ?? field.tagName.toLowerCase();
  const candidates =
    field.candidateSelectors && field.candidateSelectors.length > 0
      ? field.candidateSelectors
      : [field.selector];
  const toggleField = () => {
    setIsExpanded(open => !open);
    onFocusField();
  };

  return (
    <>
      <tr
        aria-label={`Scroll to ${label}`}
        className={`desktop-sidebar-fields-row desktop-sidebar-fields-row--${status.tone}${
          isExpanded ? ' is-expanded' : ''
        }`}
        onClick={event => {
          if ((event.target as HTMLElement).closest('button')) return;
          toggleField();
        }}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          toggleField();
        }}
        tabIndex={0}
      >
        <td className="desktop-sidebar-fields-cell desktop-sidebar-fields-cell--toggle">
          <button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse field' : 'Expand field'}
            className="desktop-sidebar-fields-toggle"
            onClick={() => setIsExpanded(open => !open)}
            type="button"
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        </td>
        <td
          className="desktop-sidebar-fields-cell desktop-sidebar-fields-cell--label"
          title={label}
        >
          {label}
        </td>
        <td
          className="desktop-sidebar-fields-cell desktop-sidebar-fields-cell--value"
          title={value || '(empty)'}
        >
          {value || <span className="desktop-sidebar-fields-empty">empty</span>}
        </td>
        <td
          className="desktop-sidebar-fields-cell desktop-sidebar-fields-cell--type"
          title={fieldType}
        >
          {fieldType}
        </td>
        <td
          className={`desktop-sidebar-fields-cell desktop-sidebar-fields-cell--status desktop-sidebar-fields-cell--status-${status.tone}`}
        >
          {status.label}
        </td>
      </tr>
      {isExpanded ? (
        <tr className="desktop-sidebar-fields-detail-row">
          <td colSpan={5} className="desktop-sidebar-fields-detail-cell">
            <div className="desktop-sidebar-fields-detail">
              {guess ? (
                <p className="desktop-sidebar-fields-detail-line">
                  <span className="desktop-sidebar-fields-detail-label">
                    Agent guess
                  </span>
                  <em>{guess}</em>
                </p>
              ) : (
                <p className="desktop-sidebar-fields-detail-line">
                  <span className="desktop-sidebar-fields-detail-label">
                    Agent guess
                  </span>
                  <em>(not computed yet)</em>
                </p>
              )}
              {field.wasAutofilled?.reason ? (
                <p className="desktop-sidebar-fields-detail-line">
                  <span className="desktop-sidebar-fields-detail-label">
                    Reason
                  </span>
                  <em>{field.wasAutofilled.reason}</em>
                </p>
              ) : null}
              {issue ? (
                <p className="desktop-sidebar-state-error">{issue.message}</p>
              ) : null}
              {field.options.length > 0 ? (
                <p className="desktop-sidebar-fields-detail-line">
                  <span className="desktop-sidebar-fields-detail-label">
                    Options
                  </span>
                  <em>{field.options.slice(0, 8).join(', ')}</em>
                </p>
              ) : null}
              {rules.length > 0 ? (
                <div className="desktop-sidebar-fields-detail-rules">
                  <p className="desktop-sidebar-fields-detail-label">
                    Rules applied ({rules.length})
                  </p>
                  <ul className="desktop-sidebar-fields-rule-list">
                    {rules.map(rule => (
                      <li
                        className={`desktop-sidebar-fields-rule-item desktop-sidebar-fields-rule-item--${
                          rule.ok ? 'ok' : 'error'
                        }`}
                        key={`${rule.tool}:${rule.reason}`}
                      >
                        <span className="desktop-sidebar-fields-rule-tool">
                          {rule.tool}
                        </span>
                        <span className="desktop-sidebar-fields-rule-reason">
                          {rule.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <FieldInlineEditor field={field} />
              <div className="desktop-sidebar-fields-selectors">
                <p className="desktop-sidebar-fields-detail-label">Selectors</p>
                <ul className="desktop-sidebar-fields-selector-list">
                  {candidates.map(candidate => {
                    const isActive = candidate === field.selector;
                    return (
                      <li
                        className={`desktop-sidebar-fields-selector${
                          isActive ? ' is-active' : ''
                        }`}
                        key={candidate}
                      >
                        <code>{candidate}</code>
                        {isActive ? (
                          <span className="desktop-sidebar-fields-selector-pick">
                            In use
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DebugTab({
  events,
  variant = 'default',
}: {
  readonly events: readonly DesktopDebugEvent[];
  readonly variant?: 'default' | 'runtime';
}) {
  return (
    <div
      className={`desktop-sidebar-stack${
        variant === 'runtime' ? ' desktop-sidebar-stack--runtime' : ''
      }`}
    >
      <SidebarSection
        emptyLabel="No events yet."
        items={events}
        renderItem={event => <DebugEventItem event={event} key={event.id} />}
        title="Events"
      />
    </div>
  );
}

function ObservationsTab({
  fieldObservations,
  observations,
}: {
  readonly fieldObservations: readonly DesktopFieldObservation[];
  readonly observations: readonly DesktopAgentObservation[];
}) {
  return (
    <div className="desktop-sidebar-stack">
      <SidebarSection
        emptyLabel="Ask the agent to capture the current page, fields, and submit state."
        items={observations}
        renderItem={observation => (
          <li
            className="desktop-sidebar-observation"
            key={`${observation.capturedAt}-${observation.url}`}
          >
            <div className="desktop-sidebar-observation-title">
              <span>{observation.title || 'Untitled page'}</span>
              <time dateTime={observation.capturedAt}>
                {formatTime(observation.capturedAt)}
              </time>
            </div>
            <p className="desktop-sidebar-observation-url">
              {observation.url || 'No URL captured'}
            </p>
            <div className="desktop-sidebar-observation-meta">
              <span>{observation.fieldCount} fields</span>
              <span>{observation.requiredEmptyCount} required empty</span>
              {observation.submitStatus ? (
                <span>{observation.submitStatus}</span>
              ) : null}
            </div>
            {observation.issueMessages.length > 0 ? (
              <ul className="desktop-sidebar-observation-issues">
                {observation.issueMessages.map((issue, index) => (
                  <li key={`${observation.capturedAt}-issue-${index}`}>
                    {issue}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )}
        title="Page observations"
      />

      <SidebarSection
        emptyLabel="No observations yet. Submit a job and fix any fields the AI got wrong."
        items={fieldObservations}
        renderItem={observation => (
          <FieldObservationItem
            key={observation.id}
            observation={observation}
          />
        )}
        title="Field observations"
      />

      <RulesTab />
    </div>
  );
}

function FieldObservationItem({
  observation,
}: {
  readonly observation: DesktopFieldObservation;
}) {
  return (
    <li className="desktop-sidebar-field-observation">
      <div className="desktop-sidebar-field-observation-head">
        <strong>{observation.fieldLabel || observation.fieldId}</strong>
        <span className="desktop-sidebar-field-observation-count">
          ×{observation.occurrences}
        </span>
      </div>
      <p className="desktop-sidebar-field-observation-value">
        <span className="desktop-sidebar-field-rule-action">
          {observation.action}
        </span>
        <span>{observation.lastValue || '(empty)'}</span>
      </p>
      {observation.priorAiValue ? (
        <p className="desktop-sidebar-field-observation-prior">
          AI had: <em>{observation.priorAiValue}</em>
        </p>
      ) : null}
      <div className="desktop-sidebar-field-observation-foot">
        <span>{observation.hostname}</span>
      </div>
    </li>
  );
}

function HistoryEntryItem({ entry }: { readonly entry: DesktopHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isFailed = entry.status === 'failed';
  const attemptCount = entry.attemptCount ?? 1;
  const priorFailureCount = entry.priorFailureCount ?? 0;
  const priorFailureSummaries = entry.priorFailureSummaries ?? [];
  const hasDetails =
    !!entry.message ||
    !!entry.errorTool ||
    !!entry.errorToolMessage ||
    !!entry.jobLeadId ||
    typeof entry.toolCallCount === 'number' ||
    priorFailureSummaries.length > 0;

  const buildCopyText = (): string => {
    const lines: string[] = [];
    lines.push(`Title: ${entry.title || '(untitled)'}`);
    lines.push(`URL: ${entry.applicationUrl}`);
    lines.push(`Status: ${entry.status}`);
    lines.push(`Mode: ${entry.mode}`);
    lines.push(`When: ${new Date(entry.timestamp).toLocaleString()}`);
    if (attemptCount > 1) {
      lines.push(
        `Attempts: ${attemptCount} (${priorFailureCount} prior failure${priorFailureCount === 1 ? '' : 's'})`,
      );
    }
    if (entry.aiProvider) lines.push(`AI provider: ${entry.aiProvider}`);
    if (entry.jobLeadId) lines.push(`Job lead: ${entry.jobLeadId}`);
    if (typeof entry.toolCallCount === 'number') {
      lines.push(`Tool calls: ${entry.toolCallCount}`);
    }
    if (entry.message) {
      lines.push('');
      lines.push(`Message:\n${entry.message}`);
    }
    if (entry.errorTool || entry.errorToolMessage || entry.errorToolReason) {
      lines.push('');
      lines.push('First failing tool:');
      if (entry.errorTool) lines.push(`  tool: ${entry.errorTool}`);
      if (entry.errorToolReason)
        lines.push(`  reason: ${entry.errorToolReason}`);
      if (entry.errorToolMessage)
        lines.push(`  error: ${entry.errorToolMessage}`);
    }
    if (priorFailureSummaries.length > 0) {
      lines.push('');
      lines.push('Prior failures:');
      for (const summary of priorFailureSummaries) {
        lines.push(`  - ${summary}`);
      }
    }
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard write can fail if focus is in the assist BrowserView; fall
      // back to a hidden textarea + execCommand so the user always gets the
      // copy regardless of where focus currently is.
      const textarea = document.createElement('textarea');
      textarea.value = buildCopyText();
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        // Give up — leave the text on screen so the user can copy manually.
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <li
      className={`desktop-sidebar-history desktop-sidebar-history--${statusTone(entry.status)}`}
    >
      <div className="desktop-sidebar-history-title">
        <span>{entry.title || entry.applicationUrl}</span>
        <time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
      </div>
      <p className="desktop-sidebar-history-url">{entry.applicationUrl}</p>
      <div className="desktop-sidebar-history-meta">
        <span>{entry.mode}</span>
        <span>{entry.status.replaceAll('_', ' ')}</span>
        {attemptCount > 1 && (
          <span
            title={`${priorFailureCount} prior failure${priorFailureCount === 1 ? '' : 's'}`}
          >
            {entry.status === 'completed' && priorFailureCount > 0
              ? `succeeded after ${priorFailureCount} retr${priorFailureCount === 1 ? 'y' : 'ies'}`
              : `${attemptCount} attempts`}
          </span>
        )}
        {hasDetails && (
          <button
            className="desktop-sidebar-history-detail-toggle"
            onClick={() => setExpanded(value => !value)}
            type="button"
          >
            {expanded ? 'Hide details' : 'Details'}
          </button>
        )}
      </div>
      {expanded && hasDetails && (
        <div className="desktop-sidebar-history-detail">
          <button
            className="desktop-sidebar-history-copy-button"
            onClick={() => void handleCopy()}
            type="button"
          >
            {copied ? 'Copied' : 'Copy logs'}
          </button>
          {isFailed && entry.message && (
            <div className="desktop-sidebar-history-detail-row">
              <span className="desktop-sidebar-history-detail-label">
                Why it failed
              </span>
              <p className="desktop-sidebar-history-detail-value">
                {entry.message}
              </p>
            </div>
          )}
          {!isFailed && entry.message && (
            <div className="desktop-sidebar-history-detail-row">
              <span className="desktop-sidebar-history-detail-label">
                Result
              </span>
              <p className="desktop-sidebar-history-detail-value">
                {entry.message}
              </p>
            </div>
          )}
          {entry.errorTool && (
            <div className="desktop-sidebar-history-detail-row">
              <span className="desktop-sidebar-history-detail-label">
                First failing tool
              </span>
              <p className="desktop-sidebar-history-detail-value">
                {entry.errorTool}
                {entry.errorToolReason ? ` — ${entry.errorToolReason}` : ''}
                {entry.errorToolMessage ? ` (${entry.errorToolMessage})` : ''}
              </p>
            </div>
          )}
          <div className="desktop-sidebar-history-detail-row">
            <span className="desktop-sidebar-history-detail-label">
              Reproduce
            </span>
            <dl className="desktop-sidebar-history-detail-grid">
              <dt>URL</dt>
              <dd>
                <a
                  href={entry.applicationUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {entry.applicationUrl}
                </a>
              </dd>
              <dt>Mode</dt>
              <dd>{entry.mode}</dd>
              {entry.aiProvider && (
                <>
                  <dt>AI provider</dt>
                  <dd>{entry.aiProvider}</dd>
                </>
              )}
              {entry.jobLeadId && (
                <>
                  <dt>Job lead</dt>
                  <dd>{entry.jobLeadId}</dd>
                </>
              )}
              {typeof entry.toolCallCount === 'number' && (
                <>
                  <dt>Tool calls</dt>
                  <dd>{entry.toolCallCount}</dd>
                </>
              )}
              <dt>When</dt>
              <dd>{new Date(entry.timestamp).toLocaleString()}</dd>
            </dl>
          </div>
          {priorFailureSummaries.length > 0 && (
            <div className="desktop-sidebar-history-detail-row">
              <span className="desktop-sidebar-history-detail-label">
                Prior failures
              </span>
              <ul className="desktop-sidebar-history-failure-list">
                {priorFailureSummaries.map((summary, index) => (
                  <li key={`${summary}-${index}`}>{summary}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="desktop-sidebar-history-detail-hint">
            Full tool-call trace at <code>~/Documents/Gimme Job/run-logs/</code>
          </p>
        </div>
      )}
    </li>
  );
}

function HistoryTab({
  history,
  onLoadSavedJob,
  savedDrafts,
}: {
  readonly history: readonly DesktopHistoryEntry[];
  readonly onLoadSavedJob: (draft: SavedSubmitLeadDraft) => void;
  readonly savedDrafts: readonly SavedSubmitLeadDraft[];
}) {
  return (
    <div className="desktop-sidebar-stack">
      <SidebarSection
        emptyLabel="No submissions yet."
        items={history}
        renderItem={entry => <HistoryEntryItem entry={entry} key={entry.id} />}
        title="Submissions"
      />

      <SidebarSection
        emptyLabel="No saved jobs yet — use the ★ button in the toolbar to save one."
        items={savedDrafts}
        renderItem={draft => (
          <li className="desktop-sidebar-saved" key={draft.applicationUrl}>
            <button
              className="desktop-sidebar-saved-load"
              onClick={() => onLoadSavedJob(draft)}
              type="button"
            >
              <span>{draft.title || draft.applicationUrl}</span>
              <span className="desktop-sidebar-saved-mode">{draft.mode}</span>
            </button>
          </li>
        )}
        title="Saved jobs"
      />
    </div>
  );
}

function DebugEventItem({ event }: { readonly event: DesktopDebugEvent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const summary = compactSummary(event.message);
  const detailBody = event.detail
    ? `${event.message}\n\n${event.detail}`
    : event.message;
  const statusClass = event.status
    ? ` desktop-sidebar-event--status-${event.status}`
    : '';

  return (
    <li
      className={`desktop-sidebar-event desktop-sidebar-event--${event.kind}${statusClass}${
        isExpanded ? ' is-expanded' : ''
      }`}
    >
      <button
        aria-expanded={isExpanded}
        className="desktop-sidebar-event-row"
        onClick={() => setIsExpanded(open => !open)}
        type="button"
      >
        <time dateTime={event.timestamp}>{formatTime(event.timestamp)}</time>
        <span className="desktop-sidebar-event-kind">{event.kind}</span>
        <span className="desktop-sidebar-event-summary">{summary}</span>
        {event.status && event.status !== 'ok' ? (
          <span
            className={`desktop-sidebar-event-status desktop-sidebar-event-status--${event.status}`}
          >
            {event.status}
          </span>
        ) : null}
        <span aria-hidden="true" className="desktop-sidebar-event-chevron">
          {isExpanded ? '▾' : '▸'}
        </span>
      </button>
      {isExpanded ? (
        <pre className="desktop-sidebar-event-detail">{detailBody}</pre>
      ) : null}
    </li>
  );
}

function compactSummary(message: string): string {
  const firstLine = message.split('\n')[0] ?? '';
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77)}…`;
}

function SidebarSection<Item>({
  emptyLabel,
  items,
  renderItem,
  title,
}: {
  readonly emptyLabel: string;
  readonly items: readonly Item[];
  readonly renderItem: (item: Item) => ReactNode;
  readonly title: string;
}) {
  return (
    <section className="desktop-sidebar-section">
      <header className="desktop-sidebar-section-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="desktop-sidebar-empty">{emptyLabel}</p>
      ) : (
        <ul className="desktop-sidebar-list">{items.map(renderItem)}</ul>
      )}
    </section>
  );
}

function pageFieldKey(field: DesktopAssistPageField): string {
  return [
    field.selector,
    field.id,
    field.name,
    field.label,
    field.placeholder,
    field.tagName,
  ]
    .filter(Boolean)
    .join('|');
}

function pageFieldLabel(field: DesktopAssistPageField): string {
  return (
    field.label ??
    field.ariaLabel ??
    field.placeholder ??
    field.name ??
    field.id ??
    field.selector
  );
}

function pageFieldValue(field: DesktopAssistPageField): string {
  if (field.checked !== null) return field.checked ? 'checked' : 'unchecked';
  return field.value ?? '';
}

function isPageFieldFilled(field: DesktopAssistPageField): boolean {
  if (field.checked !== null) return field.checked;
  return Boolean(field.value?.trim());
}

function isPageFieldRequiredEmpty(field: DesktopAssistPageField): boolean {
  return (
    field.visible &&
    field.required &&
    !field.disabled &&
    !field.shouldAvoid &&
    !isPageFieldFilled(field)
  );
}

function pageFieldStatus(
  field: DesktopAssistPageField,
  issue?: DesktopAssistPageIssue,
): { readonly label: string; readonly tone: string } {
  if (issue && issue.kind === 'tool-error') {
    return { label: 'error', tone: 'error' };
  }
  if (field.shouldAvoid) return { label: 'avoid', tone: 'muted' };
  if (field.disabled) return { label: 'disabled', tone: 'muted' };
  if (!field.visible) return { label: 'hidden', tone: 'muted' };
  if (isPageFieldRequiredEmpty(field)) {
    return { label: 'required', tone: 'error' };
  }
  if (isPageFieldFilled(field)) {
    if (isPageFieldUserFilled(field)) {
      return { label: 'you', tone: 'user' };
    }
    return { label: 'filled', tone: 'success' };
  }
  return { label: 'empty', tone: 'muted' };
}

function isPageFieldUserFilled(field: DesktopAssistPageField): boolean {
  if (!isPageFieldFilled(field)) return false;
  const autofillValue = field.wasAutofilled?.value?.trim() ?? '';
  // No agent autofill record → the value can only have come from the user.
  if (!autofillValue) return true;
  // Checkbox/radio fields: the agent's autofill value carries the action
  // string ("click") rather than a comparable boolean. If the agent
  // touched it, treat as agent-filled unless the live checked-state was
  // since flipped by the user (no reliable way to distinguish here, so
  // err on the side of the agent's last action).
  if (field.checked !== null) return false;
  const current = (field.value ?? '').trim();
  if (!current) return true;
  return current.toLowerCase() !== autofillValue.toLowerCase();
}

function statusTone(status: DesktopSubmitLeadResult['status']) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'paused_for_manual_review':
      return 'warning';
    case 'blocked_by_submit_guard':
    default:
      return 'info';
  }
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

function RulesTab() {
  const [rules, setRules] = useState<readonly DesktopFieldRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [draftHostname, setDraftHostname] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (typeof window === 'undefined' || !window.gimmeJobDesktop) return;
    setLoading(true);
    setError(null);
    try {
      const list = await window.gimmeJobDesktop.shell.listFieldRules();
      setRules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleAdd = async () => {
    const q = draftQuestion.trim();
    const a = draftAnswer.trim();
    if (q.length < 3 || a.length === 0) return;
    setSaving(true);
    try {
      await window.gimmeJobDesktop?.shell.addFieldRule({
        question: q,
        answer: a,
        hostname: draftHostname.trim() || null,
      });
      setDraftQuestion('');
      setDraftAnswer('');
      setDraftHostname('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.gimmeJobDesktop?.shell.removeFieldRule(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="desktop-sidebar-stack">
      <section className="desktop-sidebar-section">
        <header className="desktop-sidebar-section-header">
          <h3>Saved field rules</h3>
          <button
            aria-label="Reload rules"
            className="desktop-sidebar-section-icon-action"
            onClick={() => void reload()}
            title="Reload"
            type="button"
          >
            <RefreshCw size={12} strokeWidth={2.25} />
          </button>
        </header>
        <p className="desktop-sidebar-section-hint">
          Rules let the agent skip the LLM and use your saved answer for
          matching questions. Created automatically when you correct a field in
          the State tab.
        </p>
        {error ? (
          <p className="desktop-sidebar-fields-inline-status desktop-sidebar-fields-inline-status--error">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="desktop-sidebar-section-hint">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="desktop-sidebar-section-hint">No rules yet.</p>
        ) : (
          <ul className="desktop-sidebar-rules-list">
            {rules.map(rule => (
              <li className="desktop-sidebar-rules-item" key={rule.id}>
                <div className="desktop-sidebar-rules-item-body">
                  <strong title={rule.question}>{rule.question}</strong>
                  <span>→ {rule.answer}</span>
                  <em>
                    {rule.hostname ?? 'global'} · {rule.source}
                  </em>
                </div>
                <button
                  aria-label={`Remove rule for ${rule.question}`}
                  className="desktop-sidebar-rules-item-remove"
                  onClick={() => void handleRemove(rule.id)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="desktop-sidebar-section">
        <header className="desktop-sidebar-section-header">
          <h3>Add rule</h3>
        </header>
        <div className="desktop-sidebar-rules-form">
          <label className="desktop-sidebar-rules-form-row">
            <span>Question contains</span>
            <input
              className="desktop-sidebar-fields-inline-control"
              onChange={event => setDraftQuestion(event.target.value)}
              placeholder="e.g. Are you authorized to work"
              type="text"
              value={draftQuestion}
            />
          </label>
          <label className="desktop-sidebar-rules-form-row">
            <span>Answer</span>
            <input
              className="desktop-sidebar-fields-inline-control"
              onChange={event => setDraftAnswer(event.target.value)}
              placeholder="e.g. Yes"
              type="text"
              value={draftAnswer}
            />
          </label>
          <label className="desktop-sidebar-rules-form-row">
            <span>Hostname (optional)</span>
            <input
              className="desktop-sidebar-fields-inline-control"
              onChange={event => setDraftHostname(event.target.value)}
              placeholder="leave blank for all sites"
              type="text"
              value={draftHostname}
            />
          </label>
          <button
            className="desktop-sidebar-rules-form-submit"
            disabled={
              saving ||
              draftQuestion.trim().length < 3 ||
              draftAnswer.trim().length === 0
            }
            onClick={() => void handleAdd()}
            type="button"
          >
            {saving ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </section>
    </div>
  );
}
