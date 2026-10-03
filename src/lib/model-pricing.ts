/**
 * What each model costs per token, and the extra credits a request owes when its real cost runs past
 * what its flat credit rate covers. Pure, so tests and both providers share the same numbers.
 *
 * Prices are USD per 1M tokens, from the providers' pricing pages (checked 2026-10-03):
 * - OpenAI: https://developers.openai.com/api/docs/pricing (standard tier, ≤272K input tokens)
 * - Gemini: https://ai.google.dev/gemini-api/docs/pricing (paid tier)
 * Update this table when a model or its price changes.
 */
import { SUBSCRIPTION_TIERS } from './plans.ts';

interface ModelPrice {
  /** First day this price applies (UTC, inclusive). Omit for the earliest known price. */
  from?: string;
  input: number;
  /** Cached input reads; falls back to `input` when a provider does not discount them. */
  cachedInput?: number;
  output: number;
}

/** Each model's prices, oldest first. */
export const MODEL_PRICES: Record<string, ModelPrice[]> = {
  'gpt-6-luna': [{ input: 0.10, cachedInput: 0.01, output: 0.50 }],
  'gemini-3.8-flash': [
    { input: 0.75, output: 3.75 },                      // introductory rate through 2026-12-31
    { from: '2027-01-01', input: 1.50, output: 7.50 }
  ],
  'gemini-3.5-flash': [{ input: 1.50, output: 9.00 }]
};

/** The model cost one credit covers: what a credit sells for on Pro, the cheapest per-credit price. */
export const USD_PER_CREDIT = SUBSCRIPTION_TIERS.pro.priceMonthlyUsd / SUBSCRIPTION_TIERS.pro.creditsMonthly;

/** A request never owes more than this many times its flat rate in extra credits. */
export const MAX_EXTRA_MULTIPLE = 2;

export interface MeteredUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

/** USD cost of one model call, or undefined when the model has no price on file. */
export function modelCostUsd(modelId: string, usage: MeteredUsage, at = new Date()): number | undefined {
  const day = at.toISOString().slice(0, 10);
  const price = MODEL_PRICES[modelId]?.filter(entry => !entry.from || entry.from <= day).at(-1);
  if (!price) return undefined;
  const input = usage.inputTokens ?? 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, input);
  return ((input - cached) * price.input + cached * (price.cachedInput ?? price.input) + (usage.outputTokens ?? 0) * price.output) / 1_000_000;
}

/** Extra credits owed past the flat `baseCredits` already charged, capped at MAX_EXTRA_MULTIPLE × base. */
export function extraCreditsFor(costUsd: number | undefined, baseCredits: number): number {
  if (!costUsd || !Number.isFinite(costUsd)) return 0;
  const owed = Math.ceil(costUsd / USD_PER_CREDIT - 1e-9) - baseCredits;
  return Math.min(Math.max(owed, 0), baseCredits * MAX_EXTRA_MULTIPLE);
}
