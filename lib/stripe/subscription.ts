import 'server-only';

import { db } from '@/lib/db/client';

import { SUBSCRIPTION_STATUS } from './constants';

/**
 * Check if a user has an active Pro subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (process.env.FORCE_PRO === 'true') return true;

  const subscription = await db.subscription.findFirst({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });

  if (!subscription) return false;

  const isActive =
    subscription.status === SUBSCRIPTION_STATUS.ACTIVE ||
    subscription.status === SUBSCRIPTION_STATUS.TRIALING;

  const isNotExpired = subscription.currentPeriodEnd > new Date();

  return isActive && isNotExpired;
}

/**
 * Get subscription details for a user
 */
export async function getUserSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { userId },
  });
}

/**
 * Get or create a Stripe customer ID for a user
 */
export async function getOrCreateStripeCustomerId(
  userId: string,
): Promise<string> {
  const { stripe } = await import('./client');

  // Check if user already has a subscription record with a Stripe customer ID
  const existing = await db.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  // Get user details for Stripe customer creation
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: { userId },
  });

  return customer.id;
}
