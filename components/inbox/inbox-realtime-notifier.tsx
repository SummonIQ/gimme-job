'use client';

import { KeyRound, Mail } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import {
  DataEventType,
  EventType,
  type InboxEmailReceivedPayload,
  type InboxVerificationCodePayload,
} from '@/types/events';

const STATUS_LABELS: Record<string, string> = {
  APPLICATION_RECEIVED: 'Application confirmed',
  APPLICATION_REJECTED: 'Application rejected',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEW_FOLLOWUP: 'Interview follow-up',
  ASSESSMENT_REQUEST: 'Assessment request',
  OFFER_MADE: 'Offer received',
  OFFER_REJECTED: 'Offer declined',
  GENERAL_UPDATE: 'Application update',
};

/**
 * Global subscriber that fires a sonner toast every time the inbox
 * webhook pushes a new email — independent of the inbox page's own
 * subscription, so the user is notified even when they're not on
 * /inbox. The inbox page subscribes separately and updates its list.
 */
export function InboxRealtimeNotifier() {
  const userChannel = useUserChannel();
  const router = useRouter();
  const pathname = usePathname();

  // Ask the OS for notification permission once on mount so the
  // browser/Electron shell can surface system notifications when an
  // email arrives. Safe no-op in unsupported environments.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  const handleInboxEmailReceived = useCallback(
    (payload?: {
      readonly data: InboxEmailReceivedPayload;
      readonly type: DataEventType.INBOX_EMAIL_RECEIVED;
    }) => {
      if (!payload) return;
      if (payload.type !== DataEventType.INBOX_EMAIL_RECEIVED) return;
      const email = payload.data.email;
      const sender = email.fromName ?? email.fromEmail;
      const detected = email.detectedStatus
        ? (STATUS_LABELS[email.detectedStatus] ?? null)
        : null;
      const description = [detected, email.detectedCompany].filter(Boolean).join(' · ');

      toast(`New email from ${sender}`, {
        description: description || email.subject,
        icon: <Mail className="size-4" />,
        action:
          pathname === '/inbox'
            ? undefined
            : {
                label: 'Open inbox',
                onClick: () => router.push('/inbox'),
              },
      });

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const notification = new Notification(`New email from ${sender}`, {
            body: description || email.subject,
            tag: `inbox-email-${email.id}`,
          });
          notification.onclick = () => {
            window.focus();
            if (pathname !== '/inbox') router.push('/inbox');
            notification.close();
          };
        } catch {
          // Notification constructor can throw in restricted contexts; the
          // sonner toast already covers the in-app surface.
        }
      }
    },
    [pathname, router],
  );

  useEvent<{
    readonly data: InboxEmailReceivedPayload;
    readonly type: DataEventType.INBOX_EMAIL_RECEIVED;
  }>(userChannel, EventType.DataUpdate, handleInboxEmailReceived);

  const handleVerificationCode = useCallback(
    (payload?: {
      readonly data: InboxVerificationCodePayload;
      readonly type: DataEventType.INBOX_VERIFICATION_CODE;
    }) => {
      if (!payload) return;
      if (payload.type !== DataEventType.INBOX_VERIFICATION_CODE) return;
      const { code, fromEmail, fromName, subject } = payload.data;
      const sender = fromName ?? fromEmail;

      toast(`${code}`, {
        description: `Verification code from ${sender} — ${subject}`,
        icon: <KeyRound className="size-4" />,
        duration: 30000,
        action: {
          label: 'Copy',
          onClick: () => {
            void navigator.clipboard?.writeText(code).then(
              () => toast.success('Code copied'),
              () => toast.error('Could not copy code'),
            );
          },
        },
      });
    },
    [],
  );

  useEvent<{
    readonly data: InboxVerificationCodePayload;
    readonly type: DataEventType.INBOX_VERIFICATION_CODE;
  }>(userChannel, EventType.DataUpdate, handleVerificationCode);

  return null;
}

InboxRealtimeNotifier.displayName = 'InboxRealtimeNotifier';
