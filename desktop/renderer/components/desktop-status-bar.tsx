import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DesktopStatusBarProps {
  readonly activeUrl: string;
  readonly authMessage?: string;
  readonly authStatus: 'unpaired' | 'paired' | 'invalid';
  readonly fieldObservationCount: number;
  readonly historyCount: number;
  readonly isAutopilotActive: boolean;
  readonly isAuthPopoverOpen: boolean;
  readonly isPairing: boolean;
  readonly isRunning: boolean;
  readonly onAuthPopoverOpenChange: (open: boolean) => void;
  readonly onClearToken: () => void;
  readonly onPair: () => void;
  readonly onPairingCodeChange: (value: string) => void;
  readonly pairingCode: string;
  readonly statusMessage: string;
}

export function DesktopStatusBar({
  activeUrl,
  authMessage,
  authStatus,
  fieldObservationCount,
  historyCount,
  isAutopilotActive,
  isAuthPopoverOpen,
  isPairing,
  isRunning,
  onAuthPopoverOpenChange,
  onClearToken,
  onPair,
  onPairingCodeChange,
  pairingCode,
  statusMessage,
}: DesktopStatusBarProps) {
  const runtimeLabel = isAutopilotActive
    ? 'Autopilot'
    : isRunning
      ? 'Running'
      : 'Idle';
  const runtimeTone = isAutopilotActive || isRunning ? 'active' : 'idle';
  const pageLabel = formatHostname(activeUrl);
  const fieldsLabel =
    fieldObservationCount === 1
      ? '1 field'
      : `${fieldObservationCount} fields`;
  const historyLabel =
    historyCount === 1 ? '1 recent' : `${historyCount} recent`;

  return (
    <footer
      className="desktop-status-bar"
      role="status"
      aria-live="polite"
    >
      <div className="desktop-status-bar-section desktop-status-bar-section--start">
        <StatusPairingControl
          authMessage={authMessage}
          authStatus={authStatus}
          isOpen={isAuthPopoverOpen}
          isPairing={isPairing}
          onClearToken={onClearToken}
          onOpenChange={onAuthPopoverOpenChange}
          onPair={onPair}
          onPairingCodeChange={onPairingCodeChange}
          pairingCode={pairingCode}
        />
        <span className="desktop-status-bar-message">{statusMessage}</span>
      </div>

      <div className="desktop-status-bar-section desktop-status-bar-section--end">
        <div className="desktop-status-bar-group">
          <StatusItem label="Runtime" value={runtimeLabel} tone={runtimeTone} />
          <StatusItem label="Page" value={pageLabel} />
        </div>

        <span className="desktop-status-bar-divider" aria-hidden="true" />

        <div className="desktop-status-bar-group">
          <StatusItem label="Fields" value={fieldsLabel} />
          <StatusItem label="Runs" value={historyLabel} />
        </div>
      </div>
    </footer>
  );
}

function StatusItem({
  label,
  tone,
  value,
}: {
  readonly label: string;
  readonly tone?: 'active' | 'idle';
  readonly value: string;
}) {
  return (
    <span
      className={
        tone
          ? `desktop-status-bar-cluster desktop-status-bar-cluster--${tone}`
          : 'desktop-status-bar-cluster'
      }
    >
      <span className="desktop-status-bar-key">{label}</span>
      <span className="desktop-status-bar-label">{value}</span>
    </span>
  );
}

function formatHostname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'No page';
  try {
    return new URL(trimmed).hostname.replace(/^www\./, '') || 'Current page';
  } catch {
    return 'Current page';
  }
}

function StatusPairingControl({
  authMessage,
  authStatus,
  isOpen,
  isPairing,
  onClearToken,
  onOpenChange,
  onPair,
  onPairingCodeChange,
  pairingCode,
}: {
  readonly authMessage?: string;
  readonly authStatus: 'unpaired' | 'paired' | 'invalid';
  readonly isOpen: boolean;
  readonly isPairing: boolean;
  readonly onClearToken: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPair: () => void;
  readonly onPairingCodeChange: (value: string) => void;
  readonly pairingCode: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onOpenChange]);

  const label =
    authStatus === 'paired'
      ? 'Paired'
      : authStatus === 'invalid'
        ? 'Auth error'
        : 'Unpaired';

  return (
    <div className="desktop-status-bar-pairing" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Open desktop auth settings"
        className="desktop-status-bar-pairing-button"
        onClick={() => onOpenChange(!isOpen)}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`desktop-status-bar-dot ${authStatus}`}
        />
        <span className="desktop-status-bar-label">{label}</span>
      </button>
      {isOpen ? (
        <section
          aria-labelledby="status-auth-heading"
          className="desktop-status-bar-pairing-popover"
          role="dialog"
        >
          <div className="auth-popover-header">
            <div>
              <h2 id="status-auth-heading">Desktop auth</h2>
              <p>Pair this app with your Gimme Job account.</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close auth settings"
              className="auth-popover-close size-6"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              ×
            </Button>
          </div>

          {authStatus === 'paired' ? (
            <div className="auth-stack">
              <div className="state-row">
                <span>Token</span>
                <strong>Paired</strong>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={isPairing}
                onClick={onClearToken}
                type="button"
                className="w-fit"
              >
                Clear token
              </Button>
            </div>
          ) : (
            <form
              className="pairing-form"
              onSubmit={event => {
                event.preventDefault();
                onPair();
              }}
            >
              <Label htmlFor="status-pairing-code">Pairing code</Label>
              <div className="pairing-row">
                <Input
                  size="sm"
                  autoComplete="one-time-code"
                  id="status-pairing-code"
                  inputMode="numeric"
                  onChange={event => onPairingCodeChange(event.target.value)}
                  pattern="[0-9]*"
                  placeholder="123456"
                  value={pairingCode}
                />
                <Button
                  size="sm"
                  disabled={isPairing}
                  type="submit"
                  className="w-fit"
                >
                  {isPairing ? 'Pairing' : 'Pair'}
                </Button>
              </div>
            </form>
          )}
          {authMessage ? <p className="auth-message">{authMessage}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
