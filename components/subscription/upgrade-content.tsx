'use client';

import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { PRICING } from '@/lib/stripe/constants';

type Interval = 'monthly' | 'yearly';

const PRO_FEATURES = [
  { text: 'Unlimited resume optimizations', included: true },
  { text: 'Advanced AI-powered job matching', included: true },
  { text: 'Unlimited application tracking', included: true },
  { text: 'Advanced analytics & insights', included: true },
  { text: 'Application automation tools', included: true },
  { text: 'Interview preparation toolkit', included: true },
  { text: 'Company research database', included: true },
  { text: 'Priority email support', included: true },
  { text: 'Custom resume templates', included: true },
];

const FREE_LIMITS = [
  { text: 'Up to 10 resume optimizations per month', included: true },
  { text: 'Basic job search and matching', included: true },
  { text: 'Application tracking (up to 25)', included: true },
  { text: 'Basic analytics', included: true },
  { text: 'Advanced AI optimization', included: false },
  { text: 'Application automation', included: false },
  { text: 'Interview prep tools', included: false },
  { text: 'Priority support', included: false },
];

interface UpgradeContentProps {
  feature?: string;
}

const UpgradeContent = ({ feature }: UpgradeContentProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [interval, setInterval] = useState<Interval>('monthly');
  const isYearly = interval === 'yearly';

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ interval: isYearly ? 'year' : 'month' }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to start checkout');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {feature && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{feature}</span> is a
            Pro feature. Upgrade to unlock it.
          </p>
        </div>
      )}

      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setInterval('monthly')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            !isYearly
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval('yearly')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            isYearly
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          Yearly
          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Save {PRICING.yearly.savingsPercent}%
          </span>
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Free Plan */}
        <div className="flex flex-col rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold">Free</h3>
          <div className="mt-2 flex items-baseline gap-x-1">
            <span className="text-3xl font-bold tracking-tight">$0</span>
            <span className="text-sm text-muted-foreground">/forever</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Perfect for getting started
          </p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {FREE_LIMITS.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                {f.included ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={
                    f.included ? 'text-foreground' : 'text-muted-foreground/60'
                  }
                >
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-6 w-full" disabled>
            Current Plan
          </Button>
        </div>

        {/* Pro Plan */}
        <div className="relative flex flex-col rounded-xl border-2 border-primary p-6 shadow-sm">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
            Recommended
          </div>
          <h3 className="text-lg font-semibold">Pro</h3>
          <div className="mt-2 flex items-baseline gap-x-1">
            <span className="text-3xl font-bold tracking-tight">
              {isYearly ? PRICING.yearly.display : PRICING.monthly.display}
            </span>
            <span className="text-sm text-muted-foreground">
              {isYearly ? '/year' : '/month'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isYearly
              ? `Save ${PRICING.yearly.savingsPercent}% vs monthly`
              : 'Billed monthly'}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            For serious job seekers
          </p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {PRO_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-foreground">{f.text}</span>
              </li>
            ))}
          </ul>
          <Button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="mt-6 w-full"
            size="lg"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Upgrade to Pro — {isYearly
              ? `${PRICING.yearly.display}/yr`
              : `${PRICING.monthly.display}/mo`}
          </Button>
        </div>
      </div>
    </div>
  );
};
UpgradeContent.displayName = 'UpgradeContent';

export { UpgradeContent };
