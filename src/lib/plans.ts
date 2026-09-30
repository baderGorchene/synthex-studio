/**
 * Plan, pack and credit-rate constants with no server imports, so the landing page and
 * billing dialogs can read the same numbers the server charges. stripe.ts and credits.ts re-export them.
 */

export interface SubscriptionPlan {
  id: 'trial' | 'byok' | 'pro' | 'team';
  name: string;
  priceMonthlyUsd: number;
  priceAnnualUsd: number;
  creditsMonthly: number;
  perSeat?: boolean;
  features: string[];
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionPlan> = {
  trial: {
    id: 'trial',
    name: '3-Day Free Trial',
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    creditsMonthly: 100,
    features: [
      '100 Context Credits',
      'No credit card required upfront',
      'Unlimited local workspaces',
      'Full Mermaid & Markdown exports'
    ]
  },
  byok: {
    id: 'byok',
    name: 'BYOK / No-AI',
    priceMonthlyUsd: 3.00,
    priceAnnualUsd: 2.70,
    creditsMonthly: 0,
    features: [
      'Bring your own OpenAI or Gemini API key',
      '0 platform AI markup',
      'Cloud SQL multi-device sync & backups',
      'Google Cloud Storage document vault & PDF jumps'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro Studio',
    priceMonthlyUsd: 9.99,
    priceAnnualUsd: 8.99,
    creditsMonthly: 1500,
    features: [
      '1,500 Context Credits / month',
      'Autonomous Multi-Hop Deep Research (gpt-6-luna)',
      'Google Search Grounding & citations',
      '20 GB GCS Document Vault',
      'Obsidian & Logseq Vault ZIP exports'
    ]
  },
  team: {
    id: 'team',
    name: 'Team Plan',
    priceMonthlyUsd: 29.99,
    priceAnnualUsd: 26.99,
    creditsMonthly: 5000,
    perSeat: true,
    features: [
      '5,000 Pooled Credits / month',
      'Clerk Organization RBAC & member invites',
      'Shared collaborative research graphs',
      'Team-wide research review queue',
      'Centralized Stripe invoice billing'
    ]
  }
};

export const REFILL_PACKS = {
  refill_500: {
    id: 'refill_500',
    name: '500 Context Credits Refill',
    priceUsd: 5.00,
    credits: 500
  }
};

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
