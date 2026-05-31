export type BillingInterval = 'month' | 'year';

export const PRICING = {
  monthly: {
    interval: 'month' as const,
    amount: 39,
    display: '$39',
    period: 'per month',
  },
  yearly: {
    interval: 'year' as const,
    amount: 348,
    display: '$348',
    period: 'per year',
    monthlyEquivalent: 29,
    monthlyEquivalentDisplay: '$29',
    savingsPercent: 26,
  },
} as const;

export const PLANS = {
  PRO: {
    name: 'Gimme Job Pro',
    productId: process.env.STRIPE_PRODUCT_ID!,
    priceIds: {
      month: process.env.STRIPE_PRICE_ID_MONTHLY!,
      year: process.env.STRIPE_PRICE_ID_YEARLY!,
    },
    features: [
      'AI-Guided Job Application Assist',
      'Automated Application Submission',
      'Advanced Resume Optimization',
      'Priority Job Matching',
    ],
  },
} as const;

export function getPriceId(interval: BillingInterval): string {
  return PLANS.PRO.priceIds[interval];
}

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  PAST_DUE: 'past_due',
  PAUSED: 'paused',
  TRIALING: 'trialing',
  UNPAID: 'unpaid',
} as const;

export const PRO_FEATURES = [
  'guided_application',
  'automated_submission',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];
