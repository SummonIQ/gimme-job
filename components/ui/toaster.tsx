'use client';

import Link from 'next/link';

import { useEvent } from '@/hooks/use-event';
import { useToast } from '@/hooks/use-toast';
import { useUserChannel } from '@/hooks/use-user-channel';
import { cn } from '@/lib/utils';
import type { NotificationEventPayload } from '@/types/events';
import { EventType } from '@/types/events';

import { buttonVariants } from './button';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

export function Toaster() {
  const { toasts, toast } = useToast();
  const userChannel = useUserChannel();

  useEvent<NotificationEventPayload | undefined>(
    userChannel,
    EventType.Notification,
    payload => {
      if (!payload) return;

      const {
        actionText,
        actionUrl,
        description,
        duration,
        hideCloseButton,
        title,
        type,
      } = payload;

      toast({
        action:
          actionText && actionUrl ? (
            <Link
              className={cn(buttonVariants({ variant: 'outline' }))}
              href={actionUrl}
            >
              {actionText}
            </Link>
          ) : undefined,
        description,
        duration,
        hideCloseButton,
        title,
        type,
      });
    },
  );

  return (
    <ToastProvider>
      {toasts.map(
        ({
          id,
          title,
          duration,
          description,
          action,
          hideCloseButton,
          ...props
        }) => {
          const key = `${id}-${title}-${description}-${action}`;
          return (
            <Toast duration={duration} key={key} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>

              {action}

              {!hideCloseButton && <ToastClose />}
            </Toast>
          );
        },
      )}
      <ToastViewport />
    </ToastProvider>
  );
}
