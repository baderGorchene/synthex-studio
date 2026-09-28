import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { getCreditTransactions } from '@/lib/db';
import { CREDIT_RATES, TIER_CREDIT_QUOTAS } from '@/lib/credits';

export async function GET() {
  try {
    const auth = await getServerAuth();
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to view your credit history.' },
        { status: 401 }
      );
    }

    const transactions = getCreditTransactions(auth.user.id, 50);
    const tier = auth.user.subscriptionTier as keyof typeof TIER_CREDIT_QUOTAS;
    const monthlyQuota = TIER_CREDIT_QUOTAS[tier] ?? 100;

    return NextResponse.json({
      balance: auth.user.contextCredits,
      monthlyQuota,
      subscriptionTier: auth.user.subscriptionTier,
      subscriptionStatus: auth.user.subscriptionStatus,
      trialEndsAt: auth.user.trialEndsAt,
      rates: CREDIT_RATES,
      transactions
    });
  } catch (error) {
    console.error('Failed to load credit history:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve credit history.' },
      { status: 500 }
    );
  }
}
