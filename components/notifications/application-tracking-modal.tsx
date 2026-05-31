'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import {
  Mail,
  Shield,
  CheckCircle2,
  Copy,
  Loader2,
  AlertTriangle,
  Inbox,
  KeyRound,
} from 'lucide-react';
import {
  createTrackingMailbox,
  setupApplicationTracking,
  toggleTrackingEmailForwarding,
} from '@/lib/email/setup-tracking';

interface ApplicationTrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplicationTrackingModal({
  open,
  onOpenChange,
}: ApplicationTrackingModalProps) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isTogglingForward, setIsTogglingForward] = useState(false);
  const [isCreatingMailbox, setIsCreatingMailbox] = useState(false);
  const [trackingAlias, setTrackingAlias] = useState('');
  const [trackingEmail, setTrackingEmail] = useState<string | null>(null);
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [isSetUp, setIsSetUp] = useState(false);
  const [canManageMailbox, setCanManageMailbox] = useState(false);
  const [mailboxConfigured, setMailboxConfigured] = useState(false);
  const [mailboxCheckFailed, setMailboxCheckFailed] = useState(false);
  const [mailboxPassword, setMailboxPassword] = useState<string | null>(null);
  const [smtpHost, setSmtpHost] = useState<string | null>(null);
  const [smtpPort, setSmtpPort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const savedTrackingAlias = trackingEmail?.split('@')[0] ?? '';
  const hasTrackingAliasChange =
    isSetUp && trackingAlias.trim() !== savedTrackingAlias;

  useEffect(() => {
    if (!open) return;
    async function fetchStatus() {
      try {
        const res = await fetch('/api/application-tracking/status');
        if (res.ok) {
          const data = await res.json();
          setTrackingAlias(data.trackingAlias ?? data.suggestedAlias ?? '');
          setTrackingEmail(data.trackingEmail ?? null);
          setForwardingEnabled(Boolean(data.forwardingEnabled));
          setIsSetUp(Boolean(data.isSetUp));
          setCanManageMailbox(Boolean(data.canManageMailbox));
          setMailboxConfigured(Boolean(data.mailboxConfigured));
          setMailboxCheckFailed(Boolean(data.mailboxCheckFailed));
        }
      } catch {
        // Silently fail - user just hasn't set up yet
      }
    }
    fetchStatus();
  }, [open]);

  const handleSetup = async (enableForwarding: boolean) => {
    setIsSettingUp(true);
    setError(null);
    try {
      const result = await setupApplicationTracking({
        alias: trackingAlias,
        enableForwarding,
      });
      if (result.success && result.trackingEmail) {
        setTrackingEmail(result.trackingEmail);
        setTrackingAlias(result.alias ?? trackingAlias);
        setForwardingEnabled(enableForwarding);
        setIsSetUp(true);
        setCanManageMailbox(Boolean(result.canManageMailbox));
      } else {
        setError(result.error || 'Failed to set up tracking');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleToggleForwarding = async (enabled: boolean) => {
    setIsTogglingForward(true);
    setError(null);
    try {
      const result = await toggleTrackingEmailForwarding(enabled);
      if (result.success) {
        setForwardingEnabled(enabled);
      } else {
        setError(result.error || 'Failed to update forwarding');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsTogglingForward(false);
    }
  };

  const handleCreateMailbox = async () => {
    setIsCreatingMailbox(true);
    setError(null);
    setMailboxPassword(null);

    try {
      const result = await createTrackingMailbox();
      if (!result.success || !result.mailboxAddress || !result.password) {
        if (result.error?.includes('already exist')) {
          setMailboxConfigured(true);
          setMailboxPassword(null);
          return;
        }
        setError(result.error || 'Failed to create mailbox credentials');
        return;
      }

      setTrackingEmail(result.mailboxAddress);
      setMailboxConfigured(true);
      setMailboxPassword(result.password);
      setSmtpHost(result.smtpHost ?? null);
      setSmtpPort(result.smtpPort ?? null);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsCreatingMailbox(false);
    }
  };

  const handleCopy = () => {
    if (trackingEmail) {
      void navigator.clipboard.writeText(trackingEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPassword = () => {
    if (mailboxPassword) {
      void navigator.clipboard.writeText(mailboxPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="w-[calc(100vw-2rem)] max-w-2xl" size="full">
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isSetUp ? (
                <CheckCircle2 className="size-5 text-green-500" />
              ) : (
                <Mail className="size-5" />
              )}
            </div>
            <div>
              <ModalTitle>
                {isSetUp
                  ? 'Application Tracking Active'
                  : 'Set Up Application Tracking'}
              </ModalTitle>
              <ModalDescription>
                {isSetUp
                  ? 'Your tracking email is ready to use'
                  : 'Automatically track your job application responses'}
              </ModalDescription>
            </div>
          </div>
          {isSetUp && (
            <Badge
              variant="outline"
              className="absolute right-16 top-7 border-green-500/30 bg-green-500/10 text-green-500"
            >
              Active
            </Badge>
          )}
        </ModalHeader>

        <ModalBody className="space-y-5">
          {!isSetUp ? (
            <>
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">How it works</p>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll create a custom <strong>@gimmejob.com</strong>{' '}
                      email address for you. When you apply to jobs using this
                      email, we&apos;ll automatically detect and track responses
                      like rejections, interview invitations, and offers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">What we&apos;ll do:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Inbox className="mt-0.5 size-4 text-primary" />
                    Create a personalized email address for your applications
                  </li>
                  <li className="flex items-start gap-2">
                    <Mail className="mt-0.5 size-4 text-primary" />
                    Analyze incoming emails with AI to detect application status
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                    Automatically update your job lead statuses
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracking-alias" className="text-sm font-medium">
                  Choose your application email
                </Label>
                <div className="flex items-center rounded-lg border border-border/60 bg-background">
                  <Input
                    id="tracking-alias"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isSettingUp}
                    onChange={event => setTrackingAlias(event.target.value)}
                    placeholder="your-name"
                    spellCheck={false}
                    value={trackingAlias}
                  />
                  <span className="border-l border-border/60 px-3 text-sm text-muted-foreground">
                    @gimmejob.com
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This address will be used for ATS signups and job application
                  email fields.
                </p>
              </div>

              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-orange-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-orange-500">
                      Please note
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emails sent to this address will be processed by our
                      system to analyze job application status. You can
                      optionally forward copies to your personal inbox. This
                      email should only be used for job applications.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Forward copies to my email
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive a copy of every application email in your personal
                    inbox
                  </p>
                </div>
                <Switch
                  checked={forwardingEnabled}
                  onCheckedChange={setForwardingEnabled}
                  disabled={isSettingUp}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => handleSetup(forwardingEnabled)}
                disabled={isSettingUp}
              >
                {isSettingUp ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Create My Tracking Email
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <Label
                  htmlFor="tracking-alias-active"
                  className="text-xs text-muted-foreground"
                >
                  Your tracking email
                </Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-md border border-border/60 bg-background">
                    <Input
                      id="tracking-alias-active"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="h-9 border-0 font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      disabled={isSettingUp}
                      onChange={event => setTrackingAlias(event.target.value)}
                      spellCheck={false}
                      value={trackingAlias}
                    />
                    <span className="shrink-0 border-l border-border/60 px-3 text-sm text-muted-foreground">
                      @gimmejob.com
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetup(forwardingEnabled)}
                    disabled={isSettingUp || !hasTrackingAliasChange}
                  >
                    {isSettingUp ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="size-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use this email address when applying to jobs. We&apos;ll
                  automatically track responses and update your leads.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Forward copies to my email
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive a copy of every application email in your personal
                    inbox
                  </p>
                </div>
                <Switch
                  checked={forwardingEnabled}
                  onCheckedChange={handleToggleForwarding}
                  disabled={isTogglingForward}
                />
              </div>

              {canManageMailbox ? (
                mailboxConfigured ? (
                  <Alert variant="info" className="my-0">
                    <KeyRound className="size-4" />
                    <AlertTitle>Mailbox credentials active</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>
                        Use <strong>{trackingEmail}</strong> with{' '}
                        <strong>{smtpHost ?? 'smtp.improvmx.com'}</strong> on
                        port <strong>{smtpPort ?? 587}</strong> to send or reply
                        from this address in your mail client.
                      </p>
                      {mailboxPassword ? (
                        <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Password
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-medium">
                              {mailboxPassword}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyPassword}
                            >
                              <Copy className="size-3.5" />
                              {copiedPassword ? 'Copied!' : 'Copy'}
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            This password is only shown once here.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          The password is not shown again after setup.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="my-0">
                    <Inbox className="size-4" />
                    <AlertTitle>
                      Optional: create mailbox credentials
                    </AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>
                        Your forwarding email already tracks incoming responses.
                        Create mailbox credentials if you want to send or reply
                        as <strong>{trackingEmail}</strong> from Gmail, Apple
                        Mail, or another client.
                      </p>
                      {mailboxCheckFailed ? (
                        <p className="text-xs text-muted-foreground">
                          We couldn&apos;t confirm your mailbox status from
                          ImprovMX, but you can still try creating credentials
                          here.
                        </p>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={handleCreateMailbox}
                        disabled={isCreatingMailbox}
                      >
                        {isCreatingMailbox ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Creating credentials...
                          </>
                        ) : (
                          <>
                            <KeyRound className="size-4" />
                            Create Mailbox Credentials
                          </>
                        )}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-medium">Tracking is active</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Incoming mail forwarding is active. Mailbox credential
                    management is not available in this environment.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
