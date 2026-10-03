/**
 * Synthex Studio — Context Credits Economic Engine
 * Abstract away raw dollar/token figures into a clean, predictable research currency.
 */

import { deductUserCredits, topUpUserCredits } from './db.ts';
import { isNeonConfigured } from './neon.ts';

export { CREDIT_RATES, TIER_CREDIT_QUOTAS, type CreditAction, type MeteredAction } from './plans.ts';
import { CREDIT_RATES, type MeteredAction } from './plans.ts';
import { extraCreditsFor } from './model-pricing.ts';


/**
 * Calculates required context credits for an action and optional units (e.g. pages)
 */
export function getActionCost(action: MeteredAction, units = 1): number {
  const baseRate = CREDIT_RATES[action] ?? 1;
  return Math.max(1, Math.round(baseRate * units));
}

/**
 * Atomically deducts context credits from the user balance and records an audit log in credit_transactions.
 * Supports both sync SQLite (unit tests / local dev) and async Neon Postgres.
 */
export function deductCredits(
  userIdentifier: string,
  action: MeteredAction,
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
  action: MeteredAction,
  metadata?: string
): Promise<void> {
  await topUpUserCredits(userIdentifier, getActionCost(action), 'refund', metadata);
}

/**
 * After a metered AI call: charges extra credits when its real model cost ran past what the flat rate covers.
 * Atomic like `deductCredits`; if the balance cannot cover the extra, it is waived rather than failing the request.
 * Returns the extra charged (0 if none) and the new balance when it changed.
 */
export async function chargeExtraForUsage(
  userIdentifier: string,
  action: MeteredAction,
  costUsd: number | undefined,
  metadata: string
): Promise<{ extraCredits: number; balance?: number }> {
  const extraCredits = extraCreditsFor(costUsd, getActionCost(action));
  if (!extraCredits) return { extraCredits: 0 };
  const result = await deductUserCredits(userIdentifier, extraCredits, action, `Extra for a large request ($${costUsd?.toFixed(4)} model cost): ${metadata}`);
  if (!result.success) {
    console.info(`[credits] Waived ${extraCredits} extra credits for ${action}: balance too low.`);
    return { extraCredits: 0 };
  }
  return { extraCredits, balance: result.balance };
}

/** The notice shown to the user when a request cost extra credits. */
export function extraCreditsNotice(extraCredits: number, action: MeteredAction): string {
  const total = getActionCost(action) + extraCredits;
  return `This request was larger than usual, so it used ${total} credits instead of ${getActionCost(action)} (${extraCredits} extra).`;
}

/**
 * Format credit numbers cleanly (e.g., "1,500" or "500").
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString();
}
