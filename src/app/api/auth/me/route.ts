import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authContext = await getServerAuth();
    const user = authContext.user;
    const hasSelectedPlan = Boolean(
      authContext.isLocal ||
      (user && user.subscriptionTier !== 'none' && user.subscriptionStatus !== 'unselected')
    );

    return NextResponse.json({
      authenticated: Boolean(authContext.userId),
      userId: authContext.userId,
      clerkId: authContext.clerkId,
      orgId: authContext.orgId,
      orgRole: authContext.orgRole,
      isLocal: authContext.isLocal,
      hasSelectedPlan,
      user,
      contextCredits: user?.contextCredits ?? 0,
      subscriptionTier: user?.subscriptionTier ?? 'none'
    });
  } catch (error) {
    console.error('Failed to get current auth state:', error);
    return NextResponse.json(
      { error: 'Could not resolve authentication context.' },
      { status: 500 }
    );
  }
}
