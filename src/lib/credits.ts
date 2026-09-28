/**
 * Synthex Studio — Context Credits Economic Engine
 * Abstract away raw dollar/token figures into a clean, predictable research currency.
 */

import { deductUserCredits, getUserById, getUserByClerkId, type UserRecord } from './db.ts';
import { isNeonConfigured } from './neon.ts';

export type CreditAction =
  | 'chat'
  | 'quick_research'
  | 'deep_research'
  | 'pdf_extract'
  | 'refill'
  | 'bonus';

export const CREDIT_RATES: Record<Extract<CreditAction, 'chat' | 'quick_research' | 'deep_research' | 'pdf_extract'>, number> = {
  chat: 1,                 // 1 credit per Graph Chat question
  quick_research: 5,       // 5 credits per Quick Web-Grounded Research session
  deep_research: 20,       // 20 credits per Recursive Multi-Hop Deep Research run
  pdf_extract: 2           // 2 credits per page for Document AI / layout extraction
};

export const TIER_CREDIT_QUOTAS = {
  trial: 100,
  byok: 0,
  pro: 1500,
  team: 5000
};

export interface CreditCheckResult {
  hasSufficient: boolean;
  cost: number;
  currentBalance: number;
  error?: string;
}

/**
 * Calculates required context credits for an action and optional units (e.g. pages)
 */
export function getActionCost(action: Extract<CreditAction, 'chat' | 'quick_research' | 'deep_research' | 'pdf_extract'>, units = 1): number {
  const baseRate = CREDIT_RATES[action] ?? 1;
  return Math.max(1, Math.round(baseRate * units));
}

/**
 * Verifies whether a user has enough context credits before launching an AI operation.
 * Supports both sync SQLite (unit tests / local dev) and async Neon Postgres.
 */
export function verifyCreditBalance(
  userIdentifier: string,
  action: Extract<CreditAction, 'chat' | 'quick_research' | 'deep_research' | 'pdf_extract'>,
  units = 1
): CreditCheckResult | Promise<CreditCheckResult> {
  const cost = getActionCost(action, units);

  if (isNeonConfigured()) {
    return (async () => {
      const user = (await getUserByClerkId(userIdentifier)) || (await getUserById(userIdentifier));
      if (!user) {
        return {
          hasSufficient: false,
          cost,
          currentBalance: 0,
          error: 'User profile not found.'
        };
      }
      const hasSufficient = user.contextCredits >= cost;
      return {
        hasSufficient,
        cost,
        currentBalance: user.contextCredits,
        error: hasSufficient
          ? undefined
          : `Insufficient Context Credits. This operation requires ${cost} credits, but your current balance is ${user.contextCredits}.`
      };
    })();
  }

  const user = (getUserByClerkId(userIdentifier) || getUserById(userIdentifier)) as UserRecord | null;

  if (!user) {
    return {
      hasSufficient: false,
      cost,
      currentBalance: 0,
      error: 'User profile not found.'
    };
  }

  const hasSufficient = user.contextCredits >= cost;

  return {
    hasSufficient,
    cost,
    currentBalance: user.contextCredits,
    error: hasSufficient
      ? undefined
      : `Insufficient Context Credits. This operation requires ${cost} credits, but your current balance is ${user.contextCredits}.`
  };
}

/**
 * Atomically deducts context credits from the user balance and records an audit log in credit_transactions.
 * Supports both sync SQLite (unit tests / local dev) and async Neon Postgres.
 */
export function deductCredits(
  userIdentifier: string,
  action: Extract<CreditAction, 'chat' | 'quick_research' | 'deep_research' | 'pdf_extract'>,
  metadata?: string,
  units = 1
):
  | { success: boolean; cost: number; balance: number; error?: string }
  | Promise<{ success: boolean; cost: number; balance: number; error?: string }> {
  const cost = getActionCost(action, units);

  if (isNeonConfigured()) {
    return (async () => {
      const result = await deductUserCredits(userIdentifier, cost, action, metadata);
      return {
        success: result.success,
        cost,
        balance: result.balance,
        error: result.error
      };
    })();
  }

  const result = deductUserCredits(userIdentifier, cost, action, metadata) as { success: boolean; balance: number; error?: string };

  return {
    success: result.success,
    cost,
    balance: result.balance,
    error: result.error
  };
}

/**
 * Format credit numbers cleanly (e.g., "1,500" or "500").
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}
