import { useEffect, useRef } from 'react';

export interface DesktopAgentObservation {
  readonly capturedAt: string;
  readonly fieldCount: number;
  readonly issueMessages: readonly string[];
  readonly requiredEmptyCount: number;
  readonly submitStatus: string | null;
  readonly title: string;
  readonly url: string;
}

interface DesktopObservationsPopoverProps {
  readonly anchorRef: React.RefObject<HTMLButtonElement | null>;
  readonly observations: readonly DesktopAgentObservation[];
  readonly onClose: () => void;
}

export function DesktopObservationsPopover({
  anchorRef,
  observations,
  onClose,
}: DesktopObservationsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, onClose]);

  return (
    <div
      aria-label="Page observations"
      className="desktop-observations-popover"
      ref={popoverRef}
      role="dialog"
    >
      <div className="desktop-observations-popover-header">
        <span>Page observations</span>
        <strong>{observations.length}</strong>
      </div>

      {observations.length === 0 ? (
        <p className="desktop-observations-popover-empty">
          Ask the agent to capture the current page, fields, and submit state.
        </p>
      ) : (
        <ul className="desktop-observations-popover-list">
          {observations.map(observation => (
            <li
              className="desktop-observations-popover-item"
              key={`${observation.capturedAt}-${observation.url}`}
            >
              <div className="desktop-observations-popover-item-title">
                <span>{observation.title || 'Untitled page'}</span>
                <time dateTime={observation.capturedAt}>
                  {new Date(observation.capturedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="desktop-observations-popover-url">
                {observation.url || 'No URL captured'}
              </p>
              <div className="desktop-observations-popover-meta">
                <span>{observation.fieldCount} fields</span>
                <span>{observation.requiredEmptyCount} empty required</span>
                {observation.submitStatus ? (
                  <span>{observation.submitStatus}</span>
                ) : null}
              </div>
              {observation.issueMessages.length > 0 ? (
                <ul className="desktop-observations-popover-issues">
                  {observation.issueMessages.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function buildAgentObservation(context: {
  readonly capturedAt: string;
  readonly fields: readonly {
    readonly checked?: boolean | null;
    readonly disabled?: boolean;
    readonly required: boolean;
    readonly value: string | null;
    readonly visible: boolean;
  }[];
  readonly issues: readonly { readonly message: string }[];
  readonly lastSubmitResult: { readonly status?: string } | null;
  readonly title: string;
  readonly url: string;
}): DesktopAgentObservation {
  const visibleFields = context.fields.filter(field => field.visible);
  const requiredEmptyCount = visibleFields.filter(
    field =>
      field.required &&
      !field.disabled &&
      !field.value?.trim() &&
      field.checked !== false,
  ).length;

  return {
    capturedAt: context.capturedAt,
    fieldCount: visibleFields.length,
    issueMessages: context.issues.map(issue => issue.message).slice(0, 3),
    requiredEmptyCount,
    submitStatus: context.lastSubmitResult?.status ?? null,
    title: context.title,
    url: context.url,
  };
}
