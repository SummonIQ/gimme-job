import type { Metadata } from 'next';

import { PricingCards } from './pricing-cards';

export const metadata: Metadata = {
  title: 'Pricing - Gimme Job',
  description:
    'Choose the perfect plan for your job search. Start free and upgrade as you grow.',
};

export default function PricingPage() {
  return (
    <div className="bg-white dark:bg-background pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center pt-12 sm:pt-16 mb-12 sm:mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-8 text-lg leading-8 text-gray-600 dark:text-gray-400">
            Choose the plan that's right for you. Start free and upgrade
            anytime. No hidden fees, cancel anytime.
          </p>
        </div>

        <PricingCards />

        {/* FAQ Section */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>

          <dl className="mt-10 space-y-6">
            <div>
              <dt className="text-lg font-semibold text-gray-900 dark:text-white">
                Can I change plans later?
              </dt>
              <dd className="mt-2 text-gray-600 dark:text-gray-400">
                Yes! You can upgrade or downgrade your plan at any time. Changes
                take effect immediately.
              </dd>
            </div>

            <div>
              <dt className="text-lg font-semibold text-gray-900 dark:text-white">
                What payment methods do you accept?
              </dt>
              <dd className="mt-2 text-gray-600 dark:text-gray-400">
                We accept all major credit cards (Visa, Mastercard, American
                Express) and PayPal.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
