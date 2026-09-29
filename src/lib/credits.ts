/**
 * Synthex Studio — Context Credits Economic Engine
 * Abstract away raw dollar/token figures into a clean, predictable research currency.
 */

import { deductUserCredits, topUpUserCredits } from './db.ts';
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

/**
 * Calculates required context credits for an action and optional units (e.g. pages)
 */
export function getActionCost(action: Extract<CreditAction, 'chat' | 'quick_research' | 'deep_research' | 'pdf_extract'>, units = 1): number {
  const baseRate = CREDIT_RATES[action] ?? 1;
  return Math.max(1, Math.round(baseRate * units));
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
 * Gives back credits charged up front for an AI operation that then failed.
 */
export async function refundCredits(
  userIdentifier: string,
  action: Extract<CreditAction, 'chat' | 'quick_research' | 'deep_research' | 'pdf_extract'>,
  metadata?: string
): Promise<void> {
  await topUpUserCredits(userIdentifier, getActionCost(action), 'refund', metadata);
}

/**
 * Format credit numbers cleanly (e.g., "1,500" or "500").
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}
