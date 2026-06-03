import {
  Ban,
  CheckCircle2,
  CircleSlash,
  PauseCircle,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

import type {
  DesktopAiProvider,
  DesktopSubmitLeadRequest,
  DesktopSubmitLeadResult,
} from '../desktop-api';
import { createLeadKey } from '../lib/submit-lead-storage';

interface SubmitLeadViewProps {
  readonly aiProvider: DesktopAiProvider;
  readonly applicationUrl: string;
  readonly authStatus: 'unpaired' | 'paired' | 'invalid';
  readonly isPickingRandom: boolean;
  readonly jobLeadId: string;
  readonly mode: DesktopSubmitLeadRequest['mode'];
  readonly onSubmitLead: (
    request: DesktopSubmitLeadRequest,
  ) => Promise<DesktopSubmitLeadResult>;
  readonly selectionMessage: string | null;
}

export function SubmitLeadView({
  aiProvider,
  applicationUrl,
  authStatus,
  isPickingRandom,
  jobLeadId,
  mode,
  onSubmitLead,
  selectionMessage,
}: SubmitLeadViewProps) {
  const [result, setResult] = useState<DesktopSubmitLeadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSubmittedLeadKey, setLastSubmittedLeadKey] = useState<
    string | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const isPaired = authStatus === 'paired';
  const currentLeadKey = createLeadKey(applicationUrl, jobLeadId);
  const isPausedForCurrentLead =
    result?.status === 'paused_for_manual_review' &&
    createLeadKey(result.applicationUrl, result.jobLeadId ?? '') ===
      currentLeadKey;
  const hasCurrentApplication = Boolean(applicationUrl.trim());
  const hasSubmittedCurrentLead = lastSubmittedLeadKey === currentLeadKey;
  const canSubmitLead =
    isPaired &&
    hasCurrentApplication &&
    !isPending &&
    !isPickingRandom &&
    !hasSubmittedCurrentLead;

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [applicationUrl, jobLeadId]);

  return (
    <form
      className="submit-lead-form"
      onSubmit={event => {
        event.preventDefault();
        if (!canSubmitLead) return;

        const submittedLeadKey = currentLeadKey;
        const continueFromCurrentPage = isPausedForCurrentLead;
        setError(null);
        setResult(null);
        startTransition(async () => {
          try {
            const nextResult = await onSubmitLead({
              aiProvider,
              applicationUrl,
              continueFromCurrentPage,
              jobLeadId: jobLeadId.trim() || undefined,
              mode,
            });
            setResult(nextResult);
            if (
              nextResult.status === 'blocked_by_submit_guard' ||
              nextResult.status === 'completed' ||
              nextResult.status === 'unavailable'
            ) {
              setLastSubmittedLeadKey(submittedLeadKey);
            }
          } catch (submitError) {
            setError(
              submitError instanceof Error
                ? submitError.message
                : 'Submit run failed',
            );
          }
        });
      }}
    >
      <fieldset className="submit-lead-group submit-lead-run-group">
        <legend>Run</legend>
        <Button
          size="sm"
          disabled={!canSubmitLead}
          type="submit"
          className="w-fit"
        >
          {isPending ? (
            <>
              <span className="inline-spinner" aria-hidden="true" />
              Running
            </>
          ) : isPausedForCurrentLead ? (
            'Continue from page'
          ) : (
            'Submit this lead'
          )}
        </Button>
        <div className="submit-lead-feedback" aria-live="polite">
          {!isPaired ? (
            <p className="submit-lead-message">
              Pair this desktop before submit.
            </p>
          ) : null}
          {isPaired && !hasCurrentApplication ? (
            <p className="submit-lead-message">
              Load a Greenhouse lead before submitting.
            </p>
          ) : null}
          {hasSubmittedCurrentLead && !isPending ? (
            <p className="submit-lead-message">
              Load a different lead before submitting again.
            </p>
          ) : null}
          {isPending ? (
            <p className="submit-lead-progress">
              Running the desktop submission flow.
            </p>
          ) : null}
          {selectionMessage ? (
            <p className="submit-lead-message">{selectionMessage}</p>
          ) : null}
          {error ? <p className="submit-lead-message error">{error}</p> : null}
          {result ? <SubmitLeadResultBanner result={result} /> : null}
        </div>
      </fieldset>
    </form>
  );
}

type SubmitLeadStatusTone = 'success' | 'error' | 'warning' | 'info';

interface SubmitLeadStatusDescriptor {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly message: (raw: string) => string;
  readonly tone: SubmitLeadStatusTone;
}

const SUBMIT_LEAD_STATUS_DESCRIPTORS: Record<
  DesktopSubmitLeadResult['status'],
  SubmitLeadStatusDescriptor
> = {
  blocked_by_submit_guard: {
    icon: ShieldAlert,
    label: 'Submit guard held',
    message: () =>
      'Training run reached the submit button without firing it.',
    tone: 'info',
  },
  cancelled: {
    icon: CircleSlash,
    label: 'Run cancelled',
    message: () => 'You stopped the run before it finished.',
    tone: 'info',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Application submitted',
    message: () => 'Submitted through the desktop runtime.',
    tone: 'success',
  },
  failed: {
    icon: XCircle,
    label: 'Submission failed',
    message: raw => raw || 'The desktop runtime could not finish the submit.',
    tone: 'error',
  },
  paused_for_manual_review: {
    icon: PauseCircle,
    label: 'Manual review needed',
    message: raw =>
      raw || 'The runtime paused — review the page and continue when ready.',
    tone: 'warning',
  },
  unavailable: {
    icon: Ban,
    label: 'Posting no longer available',
    message: raw =>
      raw ||
      'Greenhouse rendered a closed-posting page; the lead has been marked unavailable.',
    tone: 'warning',
  },
};

function SubmitLeadResultBanner({
  result,
}: {
  readonly result: DesktopSubmitLeadResult;
}) {
  const descriptor = SUBMIT_LEAD_STATUS_DESCRIPTORS[result.status];
  const Icon = descriptor.icon;
  return (
    <div
      className={`submit-lead-result submit-lead-result--${descriptor.tone}`}
      role="status"
    >
      <Icon aria-hidden="true" className="submit-lead-result-icon" />
      <div className="submit-lead-result-text">
        <strong>{descriptor.label}</strong>
        <span>{descriptor.message(result.message)}</span>
      </div>
    </div>
  );
}
