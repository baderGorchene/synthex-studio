import Stripe from 'stripe';

export { SUBSCRIPTION_TIERS, REFILL_PACKS, type SubscriptionPlan } from './plans.ts';
import { SUBSCRIPTION_TIERS, REFILL_PACKS } from './plans.ts';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey);
  }
  return stripeInstance;
}

export interface CheckoutOptions {
  userId: string;
  userEmail?: string | null;
  tierId: string;
  interval?: 'month' | 'year' | 'annual';
  seats?: number;
  stripeCustomerId?: string | null;
  returnUrlOrigin: string;
}

export async function createCheckoutSession(options: CheckoutOptions): Promise<{
  url: string | null;
  sessionId: string;
  isMock?: boolean;
}> {
  const stripe = getStripe();
  const {
    userId,
    userEmail,
    tierId,
    interval = 'month',
    seats = 1,
    stripeCustomerId,
    returnUrlOrigin
  } = options;

  // Handle on-demand refill pack ($5 for 500 credits)
  if (tierId === 'refill_500') {
    const refill = REFILL_PACKS.refill_500;
    if (!stripe) {
      // Offline / dev mock session
      return {
        url: `${returnUrlOrigin}/app?refill=success&credits=${refill.credits}&mock=true`,
        sessionId: `mock_refill_${Date.now()}`,
        isMock: true
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: stripeCustomerId || undefined,
      customer_email: !stripeCustomerId && userEmail ? userEmail : undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: refill.name,
              description: 'One-time addition of 500 Context Credits to your research balance.'
            },
            unit_amount: Math.round(refill.priceUsd * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        userId,
        type: 'credit_refill',
        credits: String(refill.credits)
      },
      success_url: `${returnUrlOrigin}/app?refill=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrlOrigin}/app?refill=cancel`
    });

    return {
      url: session.url,
      sessionId: session.id
    };
  }

  // Handle subscription tiers (byok, pro, team)
  const plan = SUBSCRIPTION_TIERS[tierId];
  if (!plan) {
    throw new Error(`Invalid subscription tier: "${tierId}". Valid tiers: ${Object.keys(SUBSCRIPTION_TIERS).join(', ')}`);
  }

  // If Stripe is not configured, generate a simulated dev upgrade URL
  if (!stripe) {
    return {
      url: `${returnUrlOrigin}/app?checkout=success&tier=${tierId}&seats=${seats}&mock=true`,
      sessionId: `mock_sub_${tierId}_${Date.now()}`,
      isMock: true
    };
  }

  const isAnnual = interval === 'annual' || interval === 'year';
  const unitAmountUsd = isAnnual ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
  const unitAmountCents = Math.round(unitAmountUsd * 100);
  const effectiveSeats = plan.perSeat ? Math.max(1, seats) : 1;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: stripeCustomerId || undefined,
    customer_email: !stripeCustomerId && userEmail ? userEmail : undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Synthex Studio ${plan.name}`,
            description: `${plan.features.join(' · ')} (${isAnnual ? 'Billed annually' : 'Billed monthly'})`
          },
          unit_amount: unitAmountCents,
          recurring: {
            interval: isAnnual ? 'year' : 'month'
          }
        },
        quantity: effectiveSeats
      }
    ],
    metadata: {
      userId,
      tierId: plan.id,
      seats: String(effectiveSeats),
      interval
    },
    subscription_data: {
      metadata: {
        userId,
        tierId: plan.id,
        seats: String(effectiveSeats)
      }
    },
    success_url: `${returnUrlOrigin}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrlOrigin}/app?checkout=cancel`
  });

  return {
    url: session.url,
    sessionId: session.id
  };
}

export async function createCustomerPortalSession(options: {
  stripeCustomerId: string;
  returnUrlOrigin: string;
}): Promise<{ url: string | null; isMock?: boolean }> {
  const stripe = getStripe();
  const { stripeCustomerId, returnUrlOrigin } = options;

  if (!stripe) {
    return {
      url: `${returnUrlOrigin}/app?portal=mock`,
      isMock: true
    };
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${returnUrlOrigin}/app`
  });

  return { url: portalSession.url };
}
