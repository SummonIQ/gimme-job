import { GuidedApplicationPanel } from '@/components/guided-application';
import { UpgradePrompt } from '@/components/subscription/upgrade-prompt';
import { hasActiveSubscription } from '@/lib/stripe/subscription';
import { getCurrentUser } from '@/lib/user/query';
import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

interface GuidedApplicationPageProps {
  params: Promise<{ id: string }>;
}

export default async function GuidedApplicationPage({
  params,
}: GuidedApplicationPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const user = await getCurrentUser();
  const isProSubscriber = user ? await hasActiveSubscription(user.id) : false;

  if (!isProSubscriber) {
    return (
      <div className="container max-w-md py-12">
        <UpgradePrompt
          feature="AI Application Preview"
          description="Let AI Preview analyze job application forms and help you fill them out with your profile information. It will not submit applications. Upgrade to Pro to unlock."
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[600px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <div className="h-[calc(100vh-120px)]">
          <GuidedApplicationPanel applicationId={id} />
        </div>
      </Suspense>
    </div>
  );
}
