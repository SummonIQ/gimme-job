import { NextRequest, NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe/client';
import {
  type BillingInterval,
  getPriceId,
} from '@/lib/stripe/constants';
import {
  getOrCreateStripeCustomerId,
  hasActiveSubscription,
} from '@/lib/stripe/subscription';
import { getCurrentUser } from '@/lib/user/query';

const ALLOWED_INTERVALS = new Set<BillingInterval>(['month', 'year']);

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSubscribed = await hasActiveSubscription(user.id);
    if (isSubscribed) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 },
      );
    }

    let interval: BillingInterval = 'month';
    try {
      const body = (await request.json()) as { interval?: string };
      if (body?.interval && ALLOWED_INTERVALS.has(body.interval as BillingInterval)) {
        interval = body.interval as BillingInterval;
      }
    } catch {
      // No body provided — default to month
    }

    const customerId = await getOrCreateStripeCustomerId(user.id);

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_HOST ||
      process.env.PUBLIC_HOST ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:10100';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: getPriceId(interval),
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/billing?canceled=true`,
      metadata: {
        userId: user.id,
        billingInterval: interval,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          billingInterval: interval,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
