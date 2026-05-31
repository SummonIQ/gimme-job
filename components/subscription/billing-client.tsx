'use client';

import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface BillingClientProps {
  isActive: boolean;
  subscription: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
    plan: string;
    status: string;
  } | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  past_due: 'Past due',
  paused: 'Paused',
  trialing: 'In trial',
  unpaid: 'Unpaid',
};

const BillingClient = ({ isActive, subscription }: BillingClientProps) => {
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const openPortal = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data.error || 'Could not open the billing portal.');
    } catch {
      toast.error('Could not open the billing portal.');
    } finally {
      setIsPortalLoading(false);
    }
  };

  if (!subscription) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
        <div>
          <p className="text-sm font-medium text-foreground">No subscription</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You're on the Free plan. Upgrade to unlock Autopilot, unlimited
            optimizations, and more.
          </p>
        </div>
        <Button asChild className="w-fit" size="lg">
          <Link href="/upgrade">
            <Sparkles className="size-4" />
            Upgrade to Pro
          </Link>
        </Button>
      </div>
    );
  }

  const statusLabel =
    STATUS_LABEL[subscription.status] ?? subscription.status;
  const renewalLabel = subscription.cancelAtPeriodEnd
    ? `Ends on ${formatDate(subscription.currentPeriodEnd)}`
    : `Renews on ${formatDate(subscription.currentPeriodEnd)}`;

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-1 text-xl font-semibold">{subscription.plan}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive
              ? 'bg-green-500/15 text-green-700 dark:text-green-300'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="text-sm text-muted-foreground">{renewalLabel}</div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={openPortal} disabled={isPortalLoading} variant="outline">
          {isPortalLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ExternalLink className="size-4" />
          )}
          Manage billing
        </Button>
        {!isActive && (
          <Button asChild>
            <Link href="/upgrade">
              <Sparkles className="size-4" />
              Reactivate Pro
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
BillingClient.displayName = 'BillingClient';

export { BillingClient };
