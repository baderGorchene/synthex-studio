import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, SUBSCRIPTION_TIERS } from '@/lib/stripe';
import {
  getUserById,
  getUserByStripeCustomerId,
  getUserByStripeSubscriptionId,
  updateUserSubscription,
  topUpUserCredits
} from '@/lib/db';

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Never accept unsigned events: they grant credits and plan upgrades.
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhooks are not configured.' }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // 1. One-time payment (e.g. 500 Credits Refill) or initial session completion
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string | undefined;

        if (session.mode === 'payment' && session.metadata?.type === 'credit_refill') {
          const creditsToAdd = Number(session.metadata?.credits) || 500;
          if (userId) {
            await topUpUserCredits(userId, creditsToAdd, 'refill', `Stripe checkout refill (${creditsToAdd} credits)`);
          }
        } else if (session.mode === 'subscription' && userId && customerId) {
          await updateUserSubscription(userId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: session.subscription as string | undefined
          });
        }
        break;
      }

      // 2. Subscription Created or Updated (Tier Upgrade, Plan Change, Seat Expansion)
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const subId = sub.id;
        const userId = sub.metadata?.userId;
        const tierId = (sub.metadata?.tierId || 'pro') as 'trial' | 'byok' | 'pro' | 'team';
        const seats = Number(sub.metadata?.seats) || 1;
        const status = sub.status as 'active' | 'past_due' | 'canceled' | 'trialing';
        const firstItem = sub.items?.data?.[0];
        const periodEndNum = typeof firstItem?.current_period_end === 'number'
          ? firstItem.current_period_end
          : (sub as unknown as { current_period_end?: number }).current_period_end;
        const currentPeriodEnd = typeof periodEndNum === 'number'
          ? periodEndNum * 1000
          : undefined;

        const user = userId
          ? (await getUserById(userId))
          : ((customerId ? (await getUserByStripeCustomerId(customerId)) : null) || (await getUserByStripeSubscriptionId(subId)));

        if (user && customerId) {
          const prevTier = user.subscriptionTier;
          await updateUserSubscription(user.id, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subId,
            subscriptionTier: tierId,
            subscriptionStatus: status,
            seatCount: seats,
            currentPeriodEnd
          });

          // If upgraded to Pro or Team on new creation, seed plan credits
          if (event.type === 'customer.subscription.created' || prevTier !== tierId) {
            const plan = SUBSCRIPTION_TIERS[tierId];
            if (plan && plan.creditsMonthly > 0) {
              const allocatedCredits = plan.perSeat ? plan.creditsMonthly * seats : plan.creditsMonthly;
              await topUpUserCredits(
                user.id,
                allocatedCredits,
                'bonus',
                `Initial allocation for ${plan.name} (${allocatedCredits} credits)`
              );
            }
          }
        }
        break;
      }

      // 3. Recurring Billing Cycle: Replenish Monthly Context Credits
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const billingReason = invoice.billing_reason;

        // When a subscription renews automatically on its monthly/annual cycle
        if (billingReason === 'subscription_cycle' && customerId) {
          const user = await getUserByStripeCustomerId(customerId);
          if (user) {
            const plan = SUBSCRIPTION_TIERS[user.subscriptionTier];
            if (plan && plan.creditsMonthly > 0) {
              const seats = user.seatCount || 1;
              const monthlyCredits = plan.perSeat ? plan.creditsMonthly * seats : plan.creditsMonthly;
              await topUpUserCredits(
                user.id,
                monthlyCredits,
                'refill',
                `Monthly recurring credit replenishment (${monthlyCredits} credits)`
              );
            }
          }
        }
        break;
      }

      // 4. Subscription Cancelled / Deleted
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const subId = sub.id;

        const user = (customerId ? (await getUserByStripeCustomerId(customerId)) : null) || (await getUserByStripeSubscriptionId(subId));
        if (user) {
          await updateUserSubscription(user.id, {
            subscriptionTier: 'trial',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null
          });
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Stripe webhook event:', error);
    return NextResponse.json(
      { error: 'Error processing webhook event' },
      { status: 500 }
    );
  }
}
