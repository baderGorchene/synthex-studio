import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { createCustomerPortalSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth.user) {
      return NextResponse.json({ error: 'Authentication required to access customer portal.' }, { status: 401 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    if (!auth.user.stripeCustomerId) {
      // In offline/dev or before first payment
      return NextResponse.json({
        url: `${origin}/app?notice=no_active_stripe_customer`,
        isMock: true
      });
    }

    const session = await createCustomerPortalSession({
      stripeCustomerId: auth.user.stripeCustomerId,
      returnUrlOrigin: origin
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Customer portal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not create billing portal session.' },
      { status: 500 }
    );
  }
}
