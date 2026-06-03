import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';

import type {
  DesktopAssistPageContext,
  DesktopAssistPageField,
} from '../desktop-api';

interface TailorResumePanelProps {
  readonly context: DesktopAssistPageContext | null;
  readonly jobLeadId: string | null;
  readonly onTailor: (leadId: string) => Promise<TailoredResumeRecord>;
  readonly onUseInAssist: (record: TailoredResumeRecord) => Promise<{
    readonly injected: boolean;
    readonly reason?: string;
  }>;
}

export interface TailoredResumeRecord {
  readonly emphasizedKeywords: readonly string[];
  readonly formats: {
    readonly docx: string;
    readonly pdf: string;
  };
  readonly revisionId: string;
  readonly summary: string;
}

type TailorPhase = 'idle' | 'analyzing' | 'tailoring' | 'ready' | 'failed';

export function isGreenhouseApplicationForm(
  context: DesktopAssistPageContext | null,
): boolean {
  if (!context) return false;
  const url = context.url.toLowerCase();
  if (!url.includes('greenhouse.io')) return false;
  return hasResumeFileInput(context.fields) && hasSubmitButton(context.fields);
}

function hasResumeFileInput(
  fields: readonly DesktopAssistPageField[],
): boolean {
  return fields.some(field => {
    if ((field.inputType ?? '').toLowerCase() !== 'file') return false;
    const haystack = `${field.name ?? ''} ${field.id ?? ''} ${
      field.ariaLabel ?? ''
    } ${field.label ?? ''}`.toLowerCase();
    return /resume|cv/.test(haystack);
  });
}

function hasSubmitButton(
  fields: readonly DesktopAssistPageField[],
): boolean {
  return fields.some(field => {
    if (field.tagName.toLowerCase() !== 'button') return false;
    const label = (field.label ?? field.value ?? '').toLowerCase();
    return /submit\s*application|submit/.test(label);
  });
}

export function TailorResumePanel({
  context,
  jobLeadId,
  onTailor,
  onUseInAssist,
}: TailorResumePanelProps) {
  const [phase, setPhase] = useState<TailorPhase>('idle');
  const [tailored, setTailored] = useState<TailoredResumeRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [injectionMessage, setInjectionMessage] = useState<string | null>(null);

  const isGreenhouse = useMemo(
    () => isGreenhouseApplicationForm(context),
    [context],
  );

  if (!isGreenhouse) {
    return null;
  }

  const canTailor = Boolean(jobLeadId) && phase !== 'analyzing' && phase !== 'tailoring';

  const handleTailor = async () => {
    if (!jobLeadId) return;
    setErrorMessage(null);
    setInjectionMessage(null);
    setPhase('analyzing');
    try {
      setPhase('tailoring');
      const record = await onTailor(jobLeadId);
      setTailored(record);
      setPhase('ready');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Tailoring failed.');
      setPhase('failed');
    }
  };

  const handleUseInAssist = async () => {
    if (!tailored) return;
    setInjectionMessage(null);
    try {
      const result = await onUseInAssist(tailored);
      if (result.injected) {
        setInjectionMessage('Tailored resume injected. Filename should update in the form.');
      } else {
        setInjectionMessage(
          result.reason ??
            'Could not inject the file. Use the Download link and attach manually.',
        );
      }
    } catch (error) {
      setInjectionMessage(
        error instanceof Error
          ? error.message
          : 'Use-in-assist failed; download and attach manually.',
      );
    }
  };

  return (
    <section
      aria-label="Tailor resume"
      className="desktop-sidebar-section tailor-resume-panel"
    >
      <header className="desktop-sidebar-section-header">
        <h2>Tailor resume</h2>
      </header>
      {phase === 'idle' || phase === 'failed' ? (
        <div className="tailor-resume-panel-actions">
          <Button
            variant="outline"
            size="sm"
            className="desktop-sidebar-section-action w-fit"
            disabled={!canTailor}
            onClick={handleTailor}
            type="button"
          >
            Tailor resume?
          </Button>
          {!jobLeadId ? (
            <p className="desktop-sidebar-empty">
              Open a saved lead to tailor a resume for it.
            </p>
          ) : null}
          {errorMessage ? (
            <p className="desktop-sidebar-empty">{errorMessage}</p>
          ) : null}
        </div>
      ) : null}

      {phase === 'analyzing' || phase === 'tailoring' ? (
        <p className="desktop-sidebar-empty">
          {phase === 'analyzing' ? 'Analyzing…' : 'Tailoring…'}
        </p>
      ) : null}

      {phase === 'ready' && tailored ? (
        <div className="tailor-resume-panel-result">
          <p className="desktop-sidebar-observation-url">{tailored.summary}</p>
          {tailored.emphasizedKeywords.length > 0 ? (
            <p className="desktop-sidebar-observation-meta">
              Emphasized: {tailored.emphasizedKeywords.slice(0, 6).join(', ')}
            </p>
          ) : null}
          <div className="tailor-resume-panel-actions">
            <Button
              variant="outline"
              size="sm"
              className="desktop-sidebar-section-action w-fit"
              onClick={handleUseInAssist}
              type="button"
            >
              Use this resume
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="desktop-sidebar-section-action w-fit"
            >
              <a
                href={tailored.formats.pdf}
                rel="noopener noreferrer"
                target="_blank"
              >
                Download
              </a>
            </Button>
          </div>
          {injectionMessage ? (
            <p className="desktop-sidebar-empty">{injectionMessage}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
