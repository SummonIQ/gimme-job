import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { ReactNode, Suspense } from 'react';

import { JobLeadProcessingFloatServer } from '@/components/job-leads/job-lead-processing-float-server';
import { UserAnalyticsIdentify } from '@/components/analytics/user-analytics-identify';
import { InboxRealtimeNotifier } from '@/components/inbox/inbox-realtime-notifier';
import { AppHeader } from '@/components/navigation/app-header';
import { NotificationListener } from '@/components/notifications/notification-listener';
import { TrackingMailboxNotification } from '@/components/notifications/tracking-mailbox-notification';
import { InteractiveOnboardingModal } from '@/components/onboarding/interactive-onboarding-modal';
import { OnboardingProvider } from '@/components/onboarding/onboarding-context';
import { PusherProvider } from '@/components/providers/pusher-provider';
import { Toaster } from '@/components/ui/toaster';
import { ensureTrackingMailboxNotification } from '@/lib/email/tracking';
import { hasActiveSubscription } from '@/lib/stripe/subscription';
import { getCurrentUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description: 'Tools for job seekers to help them find their dream job',
  title: 'Gimme Job',
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 5, // Allow zooming up to 5x for accessibility
  viewportFit: 'cover',
  width: 'device-width',
};

async function AuthenticatedLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const isProSubscriber = await hasActiveSubscription(user.id);
  const trackingMailboxNotification = await ensureTrackingMailboxNotification({
    email: user.email,
    firstName: user.firstName,
    id: user.id,
    trackingEmailAlias: user.trackingEmailAlias,
    trackingEmailForwardingEnabled: user.trackingEmailForwardingEnabled,
  });

  const pusherConfig = {
    channelAuthorization: {
      endpoint: '/api/events/channel-auth',
      transport: 'ajax' as const,
    },
    clientKey: process.env.NEXT_PUBLIC_PUSHER_KEY as string,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
    forceTLS: true,
  };

  return (
    <PusherProvider {...pusherConfig}>
      <OnboardingProvider>
        <UserAnalyticsIdentify
          email={user.email}
          firstName={user.firstName}
          lastName={user.lastName}
          userId={user.id}
        />
        <AppHeader user={user} isProSubscriber={isProSubscriber} />

        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className="pt-17 relative isolate flex flex-1 flex-col overflow-x-hidden overflow-y-auto bg-white pb-28 outline-none focus:outline-none dark:bg-[#101014]"
        >
          <div className="pointer-events-none absolute inset-x-0 -top-[240px] bottom-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(236,72,153,0.07),transparent_30%),radial-gradient(circle_at_45%_85%,rgba(56,189,248,0.055),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_36%),radial-gradient(circle_at_84%_12%,rgba(236,72,153,0.055),transparent_31%),radial-gradient(circle_at_46%_86%,rgba(56,189,248,0.04),transparent_36%)]" />
          <div className="relative z-10 flex grow flex-col">
            {children}
          </div>
        </main>
        {modal}
        {trackingMailboxNotification ? (
          <div className="px-4 pt-4 md:px-6">
            <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-8xl">
              <TrackingMailboxNotification
                actionLabel={trackingMailboxNotification.actionLabel}
                actionUrl={trackingMailboxNotification.actionUrl}
                id={trackingMailboxNotification.id}
                message={trackingMailboxNotification.message}
                title={trackingMailboxNotification.title}
              />
            </div>
          </div>
        ) : null}
        <InteractiveOnboardingModal />
        <NotificationListener userId={user.id} />
        <InboxRealtimeNotifier />
        <Suspense fallback={null}>
          <JobLeadProcessingFloatServer userId={user.id} />
        </Suspense>
        <Toaster />
      </OnboardingProvider>
    </PusherProvider>
  );
}

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: ReactNode;
  modal: ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedLayout modal={modal}>{children}</AuthenticatedLayout>
    </Suspense>
  );
}
