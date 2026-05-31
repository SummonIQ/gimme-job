import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import { stripe } from '@/lib/stripe/client';
import { PLANS } from '@/lib/stripe/constants';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsert(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        // Unhandled event type - ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!subscriptionId) return;

  // Fetch the full subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? '';
  const periodStart = item
    ? new Date(item.current_period_start * 1000)
    : new Date();
  const periodEnd = item
    ? new Date(item.current_period_end * 1000)
    : new Date();

  await db.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      plan: PLANS.PRO.name,
      priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      plan: PLANS.PRO.name,
      priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Prefer the userId on the subscription's metadata. If Stripe replays an
  // older event before metadata propagates, fall back to looking up the
  // existing row by stripeSubscriptionId — same shape the deleted-handler uses.
  let userId = subscription.metadata?.userId;
  if (!userId) {
    const existing = await db.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      select: { userId: true },
    });
    userId = existing?.userId;
  }
  if (!userId) {
    console.error(
      `No userId for subscription ${subscription.id} (metadata empty, no existing row)`,
    );
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? '';
  const periodStart = item
    ? new Date(item.current_period_start * 1000)
    : new Date();
  const periodEnd = item
    ? new Date(item.current_period_end * 1000)
    : new Date();

  await db.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      plan: PLANS.PRO.name,
      priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find by stripeSubscriptionId
    const existing = await db.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (existing) {
      await db.subscription.update({
        where: { id: existing.id },
        data: { status: 'canceled' },
      });
    }
    return;
  }

  const existing = await db.subscription.findFirst({ where: { userId } });
  if (existing) {
    await db.subscription.update({
      where: { id: existing.id },
      data: { status: 'canceled' },
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const existing = await db.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (existing) {
    await db.subscription.update({
      where: { id: existing.id },
      data: { status: 'past_due' },
    });
  }
}
