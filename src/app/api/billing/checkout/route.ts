import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth.user) {
      return NextResponse.json({ error: 'Authentication required to start checkout.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { tierId, seats = 1, interval = 'month' } = body;

    if (!tierId) {
      return NextResponse.json({ error: 'Missing required field: tierId.' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const session = await createCheckoutSession({
      userId: auth.user.id,
      userEmail: auth.user.email,
      tierId,
      interval: interval === 'annual' || interval === 'year' ? 'year' : 'month',
      seats: Number(seats) || 1,
      stripeCustomerId: auth.user.stripeCustomerId,
      returnUrlOrigin: origin
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      { error: 'Could not create checkout session.' },
      { status: 500 }
    );
  }
}
