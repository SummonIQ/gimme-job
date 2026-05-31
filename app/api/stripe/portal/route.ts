import { NextRequest, NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe/client';
import { getUserSubscription } from '@/lib/stripe/subscription';
import { getCurrentUser } from '@/lib/user/query';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 },
      );
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_HOST ||
      process.env.PUBLIC_HOST ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:10100';

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${origin}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    );
  }
}
