import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { upsertUser, getUserByClerkId } from '@/lib/db';

export async function POST(req: NextRequest) {
  const signingSecret = process.env.CLERK_WEBHOOK_SECRET || process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: 'Clerk webhooks are not configured.' }, { status: 503 });
  }

  let payload: { type: string; data: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    payload = (await verifyWebhook(req, { signingSecret })) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    const eventType = payload.type;

    if (eventType === 'user.created') {
      const data = payload.data;
      const clerkId = data.id;
      // Don't reset credits/plan of a user already provisioned by getServerAuth.
      if (await getUserByClerkId(clerkId)) {
        return NextResponse.json({ success: true });
      }
      const primaryEmail = data.email_addresses?.[0]?.email_address || null;
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

      // Allocate 3-day trial and 100 Context Credits
      const trialDurationMs = 3 * 24 * 60 * 60 * 1000;
      const user = await upsertUser({
        clerkId,
        email: primaryEmail,
        name: fullName,
        subscriptionTier: 'trial',
        subscriptionStatus: 'trialing',
        contextCredits: 100,
        trialEndsAt: Date.now() + trialDurationMs
      });

      return NextResponse.json({ success: true, message: 'User provisioned with 3-day trial and 100 Context Credits.', user });
    }

    if (eventType === 'user.updated') {
      const data = payload.data;
      const clerkId = data.id;
      const primaryEmail = data.email_addresses?.[0]?.email_address;
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');

      const existing = (await getUserByClerkId(clerkId)) as import('@/lib/db').UserRecord | null;
      if (existing) {
        await upsertUser({
          clerkId,
          email: primaryEmail || existing.email,
          name: fullName || existing.name
        });
      }

      return NextResponse.json({ success: true });
    }

    if (eventType === 'organization.created' || eventType === 'organizationMembership.created') {
      // Organization / Team activity logged
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Clerk webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook handling failed.' },
      { status: 500 }
    );
  }
}
