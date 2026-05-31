'use client';

import { ApplicationTrackingModal } from '@/components/notifications/application-tracking-modal';
import { useRouter } from 'next/navigation';

export default function ApplicationTrackingPage() {
  const router = useRouter();

  return (
    <ApplicationTrackingModal
      open
      onOpenChange={open => {
        if (!open) {
          router.back();
        }
      }}
    />
  );
}
