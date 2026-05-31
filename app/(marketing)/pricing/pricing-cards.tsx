'use client';

import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { PRICING } from '@/lib/stripe/constants';

type Interval = 'monthly' | 'yearly';

const freeFeatures = [
  { text: 'Up to 10 resume optimizations per month', included: true },
  { text: 'Basic job search and matching', included: true },
  { text: 'Application tracking (up to 25)', included: true },
  { text: 'Basic analytics', included: true },
  { text: 'Email support', included: true },
  { text: 'Advanced AI optimization', included: false },
  { text: 'Application automation', included: false },
  { text: 'Interview prep tools', included: false },
  { text: 'Priority support', included: false },
];

const proFeatures = [
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

const PricingCards = () => {
  const [interval, setInterval] = useState<Interval>('monthly');
  const isYearly = interval === 'yearly';

  return (
    <>
      <div className="mx-auto mb-12 flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setInterval('monthly')}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            !isYearly
              ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-white'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval('yearly')}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            isYearly
              ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-white'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Yearly
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Save {PRICING.yearly.savingsPercent}%
          </span>
        </button>
      </div>

      <div className="mx-auto grid max-w-lg gap-8 lg:max-w-4xl lg:grid-cols-2">
        {/* Free */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900 p-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Free
            </h3>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Perfect for getting started with your job search
            </p>

            <div className="mt-6 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                $0
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                /forever
              </span>
            </div>

            <ul className="mt-8 space-y-3">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  {feature.included ? (
                    <Check className="size-5 shrink-0 text-green-600" />
                  ) : (
                    <X className="size-5 shrink-0 text-gray-300" />
                  )}
                  <span
                    className={`text-sm ${
                      feature.included
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            asChild
            className="mt-8 w-fit bg-gray-900 hover:bg-gray-800"
            size="lg"
          >
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-blue-600 shadow-xl ring-2 ring-blue-600 bg-white dark:bg-slate-900 p-8">
          <div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
            Most Popular
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pro
            </h3>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              For serious job seekers who want to land roles faster
            </p>

            <div className="mt-6 flex items-baseline gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                {isYearly ? PRICING.yearly.display : PRICING.monthly.display}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isYearly ? '/year' : '/month'}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              {isYearly
                ? `Save ${PRICING.yearly.savingsPercent}% vs monthly`
                : 'Billed monthly'}
            </p>

            <ul className="mt-8 space-y-3">
              {proFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="size-5 shrink-0 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            asChild
            className="mt-8 w-fit bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Link
              href={`/signup?plan=pro&interval=${isYearly ? 'year' : 'month'}`}
            >
              Get Started
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
};
PricingCards.displayName = 'PricingCards';

export { PricingCards };
