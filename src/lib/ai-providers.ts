import { createOpenAI } from '@ai-sdk/openai';
import { createGoogle } from '@ai-sdk/google';
import { APICallError, type LanguageModel } from 'ai';

export type ProviderName = 'OpenAI' | 'Gemini';

export const OPENAI_MODEL = 'gpt-6-luna';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
/** Used for one retry when the main Gemini model is rate limited (429) or overloaded (503). */
export const GEMINI_BACKUP_MODEL = 'gemini-3.5-flash';

export function openAiKey(): string {
  return (process.env.OPENAI_API_KEY || '').trim().replace(/^[\"']|[\"']$/g, '');
}

export function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim().replace(/^[\"']|[\"']$/g, '');
}

/** AI SDK model handle. Keys are read per call so a changed environment takes effect without a restart. */
export function languageModel(provider: ProviderName, modelId?: string): LanguageModel {
  return provider === 'OpenAI'
    ? createOpenAI({ apiKey: openAiKey() })(modelId ?? OPENAI_MODEL)
    : createGoogle({ apiKey: geminiKey() })(modelId ?? GEMINI_MODEL);
}

/** Provider-specific request options shared by every call. */
export const PROVIDER_OPTIONS = {
  // store: false keeps research graphs out of OpenAI's stored responses.
  openai: { reasoningEffort: 'medium', store: false, reasoningSummary: null },
  google: {}
} as const;

/** HTTP status of a failed provider call, when there is one. */
export function providerStatusCode(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) return error.statusCode;
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === 'number' ? status : undefined;
}

export function isGeminiCapacityError(error: unknown): boolean {
  const status = providerStatusCode(error);
  return status === 429 || status === 503;
}

/* =====================================================================
   Provider selection

   OpenAI is primary when configured. After an OpenAI failure (with Gemini
   configured) requests go to Gemini first for a short cooldown, then OpenAI
   is tried again. The cooldown is per server instance and self-expiring, so
   one bad request never pins an instance to the fallback until restart.
===================================================================== */
const OPENAI_COOLDOWN_MS = 2 * 60_000;
let openAiCooldownUntil = 0;

export function providerPlan(): Array<{ provider: ProviderName; usedFallback: boolean }> {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());
  if (!hasOpenAI && !hasGemini) throw new Error('AI_NOT_CONFIGURED');
  if (!hasGemini) return [{ provider: 'OpenAI', usedFallback: false }];
  if (!hasOpenAI) return [{ provider: 'Gemini', usedFallback: false }];
  if (Date.now() < openAiCooldownUntil) {
    return [{ provider: 'Gemini', usedFallback: true }, { provider: 'OpenAI', usedFallback: false }];
  }
  return [{ provider: 'OpenAI', usedFallback: false }, { provider: 'Gemini', usedFallback: true }];
}

export function recordProviderOutcome(provider: ProviderName, ok: boolean) {
  if (provider !== 'OpenAI') return;
  openAiCooldownUntil = ok ? 0 : Date.now() + OPENAI_COOLDOWN_MS;
}

/** A caller-initiated abort must not count against a provider or trigger a fallback. */
export function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === 'AbortError');
}

/** Models to try within one provider step: Gemini gets one retry on its backup model when at capacity. */
export function modelsFor(provider: ProviderName): string[] {
  if (provider === 'OpenAI') return [OPENAI_MODEL];
  return GEMINI_MODEL === GEMINI_BACKUP_MODEL ? [GEMINI_MODEL] : [GEMINI_MODEL, GEMINI_BACKUP_MODEL];
}

export async function withModelFallback<T>(
  provider: ProviderName,
  run: (modelId: string) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const models = modelsFor(provider);
  for (const [index, modelId] of models.entries()) {
    try {
      return await run(modelId);
    } catch (err) {
      if (index < models.length - 1 && isGeminiCapacityError(err) && !isAbort(err, signal)) {
        console.warn(`Gemini ${modelId} is at capacity; retrying with ${models[index + 1]}.`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('NO_MODEL_AVAILABLE');
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export function addUsage(total: TokenUsage, usage: TokenUsage | undefined): TokenUsage {
  if (!usage) return total;
  return {
    inputTokens: (total.inputTokens ?? 0) + (usage.inputTokens ?? 0),
    outputTokens: (total.outputTokens ?? 0) + (usage.outputTokens ?? 0)
  };
}

export function logUsage(task: string, provider: ProviderName, model: string, usage: TokenUsage | undefined) {
  if (usage) console.info(`[ai] ${task} ${provider}/${model} input=${usage.inputTokens ?? '?'} output=${usage.outputTokens ?? '?'}`);
}

export async function runWithFallback<T extends { usedFallback?: boolean }>(
  task: string,
  run: (provider: ProviderName) => Promise<T>,
  onSwitch?: (provider: ProviderName) => void,
  signal?: AbortSignal
): Promise<T> {
  const plan = providerPlan();
  let lastError: unknown;
  for (const [index, step] of plan.entries()) {
    if (index > 0) onSwitch?.(step.provider);
    try {
      const result = await run(step.provider);
      recordProviderOutcome(step.provider, true);
      return { ...result, usedFallback: step.usedFallback };
    } catch (err) {
      if (isAbort(err, signal)) throw err;
      recordProviderOutcome(step.provider, false);
      console.warn(`${step.provider} provider failed in ${task}:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }
  throw lastError;
}
