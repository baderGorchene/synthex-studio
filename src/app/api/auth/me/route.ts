import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authContext = await getServerAuth();
    return NextResponse.json({
      authenticated: Boolean(authContext.userId),
      userId: authContext.userId,
      clerkId: authContext.clerkId,
      orgId: authContext.orgId,
      orgRole: authContext.orgRole,
      isLocal: authContext.isLocal,
      user: authContext.user,
      contextCredits: authContext.user?.contextCredits ?? 100,
      subscriptionTier: authContext.user?.subscriptionTier ?? 'trial'
    });
  } catch (error) {
    console.error('Failed to get current auth state:', error);
    return NextResponse.json(
      { error: 'Could not resolve authentication context.' },
      { status: 500 }
    );
  }
}
