/**
 * Synthex Studio: Unified Authentication & Multi-Tenant Authorization Provider
 * Integrates Clerk for production SaaS and provides zero-config offline fallback.
 */

import { getUserByClerkId, upsertUser, type UserRecord } from './db.ts';

export interface AuthContext {
  userId: string;
  clerkId: string | null;
  orgId: string | null;
  orgRole: string | null;
  isLocal: boolean;
  user: UserRecord | null;
}

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
}

/**
 * Retrieves the current authentication and organization context on the server.
 * In production, extracts verified Clerk session claims.
 * In local/offline mode, provides a fallback development researcher context.
 */
export async function getServerAuth(): Promise<AuthContext> {
  if (!isClerkConfigured()) {
    // Zero-config offline/local development mode
    let localUser = getUserByClerkId('local_researcher');
    if (!localUser) {
      localUser = upsertUser({
        clerkId: 'local_researcher',
        email: 'local@synthex.internal',
        name: 'Local Researcher',
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        contextCredits: 5000,
        trialEndsAt: null
      });
    }

    return {
      userId: localUser.id,
      clerkId: 'local_researcher',
      orgId: null,
      orgRole: null,
      isLocal: true,
      user: localUser
    };
  }

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const authState = await auth();

    if (!authState.userId) {
      return {
        userId: '',
        clerkId: null,
        orgId: null,
        orgRole: null,
        isLocal: false,
        user: null
      };
    }

    let userRecord = getUserByClerkId(authState.userId);
    if (!userRecord) {
      // First-time sign in provision: 3-day free trial with 100 Context Credits
      userRecord = upsertUser({
        clerkId: authState.userId,
        subscriptionTier: 'trial',
        subscriptionStatus: 'trialing',
        contextCredits: 100,
        trialEndsAt: Date.now() + 3 * 24 * 60 * 60 * 1000
      });
    }

    return {
      userId: userRecord.id,
      clerkId: authState.userId,
      orgId: authState.orgId || null,
      orgRole: authState.orgRole || null,
      isLocal: false,
      user: userRecord
    };
  } catch (error) {
    console.warn('Failed to resolve Clerk authentication context:', error);
    return {
      userId: '',
      clerkId: null,
      orgId: null,
      orgRole: null,
      isLocal: false,
      user: null
    };
  }
}
