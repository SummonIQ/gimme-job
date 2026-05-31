'use client';

import { useState } from 'react';
import { Mail, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { markNotificationAsReadAction } from '@/lib/notifications/actions';
import { ApplicationTrackingModal } from './application-tracking-modal';

interface TrackingMailboxNotificationProps {
  actionLabel?: string | null;
  actionUrl: string | null;
  id: string;
  message: string;
  title: string;
}

export function TrackingMailboxNotification({
  actionLabel,
  id,
  message,
  title,
}: TrackingMailboxNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissing, setIsDismissing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = async () => {
    try {
      setIsDismissing(true);
      await markNotificationAsReadAction(id);
      setIsVisible(false);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-linear-to-r from-primary/6 via-primary/3 to-transparent p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold">{title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <div className="mt-3.5 flex items-center gap-2.5">
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                {actionLabel || 'Set Up Tracking'}
              </Button>
              <Button
                disabled={isDismissing}
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
              >
                <X className="size-3.5" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ApplicationTrackingModal
        open={modalOpen}
        onOpenChange={open => {
          setModalOpen(open);
          if (!open) {
            void handleDismiss();
          }
        }}
      />
    </>
  );
}
