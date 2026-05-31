import { CheckCircle2 } from 'lucide-react';

import { BillingClient } from '@/components/subscription/billing-client';
import { getUserSubscription } from '@/lib/stripe/subscription';
import { SUBSCRIPTION_STATUS } from '@/lib/stripe/constants';
import { getCurrentUser } from '@/lib/user/query';

interface BillingPageProps {
  searchParams: Promise<{
    canceled?: string;
    session_id?: string;
  }>;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const subscription = await getUserSubscription(user.id);
  const isActive =
    !!subscription &&
    (subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
      subscription.status === SUBSCRIPTION_STATUS.TRIALING) &&
    subscription.currentPeriodEnd > new Date();

  const justCheckedOut = !!params.session_id;
  const canceled = params.canceled === 'true';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing</h3>
        <p className="text-sm text-muted-foreground">
          Manage your Gimme Job subscription and billing details.
        </p>
      </div>

      {justCheckedOut && isActive && (
        <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
          <div className="text-sm">
            <p className="font-medium text-foreground">You're on Pro now.</p>
            <p className="mt-1 text-muted-foreground">
              Welcome aboard. All Pro features are unlocked on your account.
            </p>
          </div>
        </div>
      )}

      {canceled && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Checkout was canceled. You can try again anytime.
        </div>
      )}

      <BillingClient
        isActive={isActive}
        subscription={
          subscription
            ? {
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
                plan: subscription.plan,
                status: subscription.status,
              }
            : null
        }
      />
    </div>
  );
}
