import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getServerAuth } from '@/lib/auth';
import { createProjectInDb, getProjectsFromDb, updateUserSubscription } from '@/lib/db';
import { createCheckoutSession, isStripeConfigured, SUBSCRIPTION_TIERS } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth.user) {
      return NextResponse.json({ error: 'Authentication required to select a plan.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const plan = typeof body?.plan === 'string' ? body.plan.toLowerCase() : '';
    const interval = body?.interval === 'year' || body?.interval === 'annual' ? 'year' : 'month';

    if (!['trial', 'byok', 'pro', 'team'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected. Choose trial, byok, pro, or team.' }, { status: 400 });
    }

    // Ensure the user has at least one personal workspace project
    const existingProjects = await getProjectsFromDb(auth.user.id, auth.orgId, auth.clerkId);
    let starterProject = existingProjects[0];
    if (!starterProject) {
      starterProject = await createProjectInDb(
        `project-${randomUUID()}`,
        'Synthex Studio Guide',
        'rag',
        auth.user.id,
        auth.orgId
      );
    }

    // 1. Free Trial: instant activation without payment details
    if (plan === 'trial') {
      const trialEndsAt = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 days
      await updateUserSubscription(auth.user.id, {
        subscriptionTier: 'trial',
        subscriptionStatus: 'trialing',
        contextCredits: 100,
        trialEndsAt
      });

      return NextResponse.json({
        success: true,
        hasSelectedPlan: true,
        tier: 'trial',
        credits: 100,
        project: starterProject
      });
    }

    // 2. Paid tiers (byok, pro, team)
    if (isStripeConfigured()) {
      const origin = req.headers.get('origin') || req.nextUrl.origin || 'http://localhost:3000';
      const session = await createCheckoutSession({
        userId: auth.user.id,
        userEmail: auth.user.email,
        tierId: plan,
        interval,
        seats: 1,
        stripeCustomerId: auth.user.stripeCustomerId,
        returnUrlOrigin: origin
      });

      return NextResponse.json({
        success: true,
        url: session.url,
        sessionId: session.sessionId
      });
    }

    // 3. Dev / Mock fallback if Stripe is not configured
    const tierMeta = SUBSCRIPTION_TIERS[plan];
    const credits = tierMeta ? tierMeta.creditsMonthly : (plan === 'team' ? 5000 : plan === 'pro' ? 1500 : 0);
    await updateUserSubscription(auth.user.id, {
      subscriptionTier: plan as 'byok' | 'pro' | 'team',
      subscriptionStatus: 'active',
      contextCredits: credits,
      billingInterval: interval,
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    return NextResponse.json({
      success: true,
      hasSelectedPlan: true,
      tier: plan,
      credits,
      project: starterProject
    });
  } catch (error) {
    console.error('Plan selection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not activate plan.' },
      { status: 500 }
    );
  }
}
