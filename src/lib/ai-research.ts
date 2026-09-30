import { generateText, Output, type ToolSet } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { ResearchMode } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import { buildGraphRAGContext } from './rag/context-builder.ts';
import {
  PROVIDER_OPTIONS,
  addUsage,
  isAbort,
  languageModel,
  logUsage,
  providerPlan,
  providerStatusCode,
  runWithFallback,
  withModelFallback,
  type ProviderName,
  type TokenUsage
} from './ai-providers.ts';

/* =====================================================================
   Types
===================================================================== */
const NODE_TYPES = ['concept', 'note', 'claim', 'question', 'hypothesis', 'ai_insight'] as const;
const RELATION_LABELS = ['supports', 'contradicts', 'depends_on', 'answers', 'derived_from', 'extends'] as const;

// Every field is required: OpenAI strict structured outputs reject optional fields.
const researchOutputSchema = z.object({
  summary: z.string().describe('Synthesis of the findings in markdown'),
  subquestions: z.array(z.string()).describe('Unresolved research questions worth investigating next'),
  sources: z.array(z.object({ title: z.string(), url: z.string() }))
    .describe('Pages returned by the search tool that support the cards; never a URL from memory'),
  nodes: z.array(z.object({
    tempId: z.string().describe('Short unique id used by relationships'),
    type: z.enum(NODE_TYPES),
    title: z.string(),
    content: z.string(),
    rationale: z.string().describe('Why this card belongs in the knowledge graph')
  })),
  relationships: z.array(z.object({
    fromTempId: z.string(),
    toTempId: z.string(),
    label: z.enum(RELATION_LABELS),
    evidence: z.string().describe('Quotation or finding connecting the two cards'),
    confidence: z.number().describe('0 to 1')
  }))
});

type ResearchOutput = z.infer<typeof researchOutputSchema>;

export type ResearchGeneration = Omit<ResearchOutput, 'sources'>;

export interface ResearchResultPayload {
  result: ResearchGeneration;
  sources: Array<{ title: string; url: string }>;
  searchQueries: string[];
  provider: ProviderName;
  model: string;
  reasoningEffort?: 'medium';
  usedFallback: boolean;
  /** Set when sources could not be grounded in real search results and were withheld. */
  groundingNote?: string;
  usage?: TokenUsage;
}

export type ResearchStreamEvent =
  | { type: 'step'; step: string; stepId?: string }
  | { type: 'query'; query: string }
  | { type: 'source'; source: { title: string; url: string } }
  | { type: 'hop'; hop: number; description: string }
  | { type: 'done'; result: ResearchResultPayload }
  | { type: 'error'; error: string };

type ResearchProgress = (event: Exclude<ResearchStreamEvent, { type: 'done' | 'error' }>) => void;

export interface ResearchOptions {
  projectId?: string;
  signal?: AbortSignal;
  onProgress?: ResearchProgress;
}

const PLAN_TIMEOUT_MS = 60_000;
const SEARCH_TIMEOUT_MS = 150_000;
const CONTEXT_TOKEN_BUDGET = 4000;

/* =====================================================================
   Sources
===================================================================== */
/** Canonical form used to match a cited URL against the URLs a search actually returned. */
function canonicalUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`;
  } catch {
    return null;
  }
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

/** URLs the search tool surfaced in one call, keyed by canonical form. */
type SeenSources = Map<string, { title: string; url: string }>;

function rememberSource(seen: SeenSources, url: unknown, title: unknown) {
  if (typeof url !== 'string') return;
  const key = canonicalUrl(url);
  if (!key) return;
  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 300) : '';
  const existing = seen.get(key);
  if (!existing || (!existing.title && cleanTitle)) seen.set(key, { title: cleanTitle, url: url.slice(0, 4096) });
}

/** Keep model-listed sources that the search returned (with the model's title), then the other returned URLs. */
function verifiedSources(modelSources: ResearchOutput['sources'], seen: SeenSources, limit: number) {
  const result: Array<{ title: string; url: string }> = [];
  const used = new Set<string>();
  const add = (key: string, title: string) => {
    const source = seen.get(key);
    if (!source || used.has(key)) return;
    used.add(key);
    result.push({ title: title || source.title || hostname(source.url), url: source.url });
  };
  for (const source of modelSources) {
    const key = canonicalUrl(source.url);
    if (key) add(key, source.title.trim().slice(0, 300));
  }
  for (const key of seen.keys()) add(key, '');
  return result.slice(0, limit);
}

/* =====================================================================
   Model calls
===================================================================== */
function searchTools(provider: ProviderName): ToolSet {
  return provider === 'OpenAI'
    ? { web_search: openai.tools.webSearch({}) }
    : { google_search: google.tools.googleSearch({}) };
}

interface SearchCallResult {
  output: ResearchOutput;
  seen: SeenSources;
  queries: string[];
  searched: boolean;
  model: string;
  usage?: TokenUsage;
}

/**
 * One web-grounded model call returning a schema-checked research object plus the
 * URLs and queries the search tool actually used. If OpenAI rejects the search tool
 * (HTTP 400), the call is repeated without it and every source is withheld.
 */
async function groundedCall(
  provider: ProviderName,
  system: string,
  prompt: string,
  signal?: AbortSignal
): Promise<SearchCallResult> {
  return withModelFallback(provider, async modelId => {
    const run = (withSearch: boolean) => generateText({
      model: languageModel(provider, modelId),
      system,
      prompt,
      output: Output.object({ schema: researchOutputSchema, name: 'research_graph' }),
      ...(withSearch ? { tools: searchTools(provider) } : {}),
      providerOptions: PROVIDER_OPTIONS,
      maxRetries: 0,
      timeout: SEARCH_TIMEOUT_MS,
      abortSignal: signal
    });

    let searched = true;
    let result;
    try {
      result = await run(true);
    } catch (err) {
      if (provider !== 'OpenAI' || providerStatusCode(err) !== 400 || isAbort(err, signal)) throw err;
      console.warn('OpenAI web_search unavailable, retrying without search:', err instanceof Error ? err.message : err);
      searched = false;
      result = await run(false);
    }

    const seen: SeenSources = new Map();
    const queries: string[] = [];
    for (const step of result.steps) {
      for (const source of step.sources) {
        if (source.sourceType === 'url') rememberSource(seen, source.url, source.title);
      }
      for (const part of step.content) {
        if (part.type !== 'tool-result' || part.toolName !== 'web_search') continue;
        const output = part.output as { action?: { query?: unknown; queries?: unknown }; sources?: Array<{ url?: unknown }> } | undefined;
        if (typeof output?.action?.query === 'string') queries.push(output.action.query);
        if (Array.isArray(output?.action?.queries)) queries.push(...output.action.queries.filter((q): q is string => typeof q === 'string'));
        for (const source of output?.sources ?? []) rememberSource(seen, source.url, '');
      }
    }
    const grounding = (result.providerMetadata?.google as { groundingMetadata?: { webSearchQueries?: unknown } } | undefined)?.groundingMetadata;
    if (Array.isArray(grounding?.webSearchQueries)) {
      queries.push(...grounding.webSearchQueries.filter((q): q is string => typeof q === 'string'));
    }

    const usage = { inputTokens: result.totalUsage.inputTokens, outputTokens: result.totalUsage.outputTokens };
    logUsage('research', provider, modelId, usage);
    return { output: result.output, seen: searched ? seen : new Map(), queries: [...new Set(queries)], searched, model: modelId, usage };
  }, signal);
}

const planSchema = z.object({
  axes: z.array(z.object({
    name: z.string(),
    searchQuery: z.string().describe('A specific web search query'),
    focus: z.string()
  })),
  preliminaryHypotheses: z.array(z.string())
});

async function planAxes(provider: ProviderName, query: string, contextMarkdown: string, signal?: AbortSignal) {
  return withModelFallback(provider, async modelId => {
    const result = await generateText({
      model: languageModel(provider, modelId),
      system: `You are Synthex Studio's Deep Research Planner. Decompose a research inquiry into exactly 3 complementary investigative axes:
1. Core theoretical foundations and mechanisms
2. Empirical evidence, benchmarks, and recent real-world developments
3. Limitations, open controversies, and counterarguments
Give each axis one specific web search query. Also list 2-3 testable preliminary hypotheses.`,
      prompt: `Research Inquiry: ${query}\n\nExisting Knowledge Context:\n${contextMarkdown}`,
      output: Output.object({ schema: planSchema, name: 'research_plan' }),
      providerOptions: PROVIDER_OPTIONS,
      maxRetries: 0,
      timeout: PLAN_TIMEOUT_MS,
      abortSignal: signal
    });
    logUsage('research-plan', provider, modelId, result.totalUsage);
    return { plan: result.output, usage: result.totalUsage };
  }, signal);
}

/* =====================================================================
   Prompts
===================================================================== */
const RESEARCH_RULES = `Rules:
- Cards are concepts, testable claims, hypotheses, open questions, notes, or insights. Explain the rationale for each card.
- A claim enters the graph as unverified until a human reviews it and links evidence; phrase claims so they can be checked.
- Relationships connect cards by tempId and are directional. Prefer supports, contradicts, depends_on, answers, derived_from, extends.
- Use the search tool to gather evidence. List in "sources" only pages the search returned; never write a URL from memory. Sources the search did not return are discarded.
- Emphasize contradictions, trade-offs, and empirical findings over generic background.`;

const SYSTEM_PROMPT = `You are Synthex Studio's AI Research Engine. You turn research questions into structured, evidence-grounded knowledge graph proposals that a human will review.
${RESEARCH_RULES}`;

/* =====================================================================
   Research flows
===================================================================== */
async function runQuick(provider: ProviderName, query: string, contextMarkdown: string, options: ResearchOptions) {
  const progress = options.onProgress ?? (() => {});
  progress({ type: 'step', stepId: 'search', step: provider === 'OpenAI' ? 'Searching the web...' : 'Searching the web with Google Search grounding...' });

  const call = await groundedCall(
    provider,
    SYSTEM_PROMPT,
    `Research mode: quick.
Query: ${query}

Propose between 4 and 6 cards and up to 12 relationships between them. Give 3-5 subquestions.

Existing graph context (do not repeat what is already there):
${contextMarkdown}`,
    options.signal
  );
  for (const q of call.queries) progress({ type: 'query', query: q });

  const sources = verifiedSources(call.output.sources, call.seen, 8);
  progress({ type: 'step', stepId: 'synthesis', step: `Synthesizing ${call.output.nodes.length} knowledge cards and ${sources.length} verified sources...` });

  const { summary, subquestions, nodes, relationships } = call.output;
  return {
    result: { summary, subquestions, nodes, relationships },
    sources,
    searchQueries: call.queries.length > 0 ? call.queries : [query],
    model: call.model,
    searched: call.searched,
    usage: call.usage
  };
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function runDeep(provider: ProviderName, query: string, contextMarkdown: string, options: ResearchOptions) {
  const progress = options.onProgress ?? (() => {});
  let usage: TokenUsage = {};

  // 1. Plan three investigative axes (no search).
  progress({ type: 'step', stepId: 'axes', step: 'Decomposing inquiry into investigative axes...' });
  let axes: string[] = [];
  let hypotheses: string[] = [];
  try {
    const { plan, usage: planUsage } = await planAxes(provider, query, contextMarkdown, options.signal);
    usage = addUsage(usage, planUsage);
    axes = plan.axes.map(a => a.searchQuery || a.focus).filter(Boolean).slice(0, 3);
    hypotheses = plan.preliminaryHypotheses.slice(0, 3);
  } catch (err) {
    if (isAbort(err, options.signal)) throw err;
    console.warn('Research planning failed, using template axes:', err instanceof Error ? err.message : err);
  }
  if (axes.length === 0) {
    axes = [
      `${query} foundations and mechanisms`,
      `${query} empirical evidence and benchmarks`,
      `${query} limitations and counterarguments`
    ];
  }
  progress({ type: 'step', stepId: 'queries', step: 'Formulated investigative axes' });
  for (const axis of axes) progress({ type: 'query', query: axis });

  // 2. Hop 1: grounded search across the axes.
  progress({ type: 'hop', hop: 1, description: `Hop 1: Searching the web across ${axes.length} investigative axes...` });
  const hop1 = await groundedCall(
    provider,
    SYSTEM_PROMPT,
    `Research mode: deep, hop 1 of 2.
Primary query: ${query}

Search each investigative axis:
${axes.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Preliminary hypotheses to test:
${hypotheses.map(h => `- ${h}`).join('\n') || '- (none)'}

Propose up to 8 cards and up to 10 relationships. Give 3-4 subquestions that remain unresolved after this search; they drive hop 2.

Existing graph context (do not repeat what is already there):
${contextMarkdown}`,
    options.signal
  );
  usage = addUsage(usage, hop1.usage);
  for (const q of hop1.queries) progress({ type: 'query', query: q });

  // 3. Hop 2: grounded deep dive into hop 1's open questions, linking back to hop 1 cards.
  const followUps = hop1.output.subquestions.slice(0, 3);
  const hop1Cards = hop1.output.nodes.map(n => `- ${n.tempId}: [${n.type}] ${n.title}`).join('\n');
  let hop2: SearchCallResult | null = null;
  if (followUps.length > 0) {
    progress({ type: 'hop', hop: 2, description: `Hop 2: Deep-diving into ${followUps.length} follow-up questions...` });
    try {
      hop2 = await groundedCall(
        provider,
        SYSTEM_PROMPT,
        `Research mode: deep, hop 2 of 2.
Primary query: ${query}

Investigate these open questions from hop 1, looking for empirical data and opposing viewpoints:
${followUps.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Cards already proposed in hop 1 (reference their tempIds in relationships; do not propose them again):
${hop1Cards}

Propose up to 6 new cards and up to 8 relationships. Relationships may connect new cards to each other or to hop 1 cards. Give remaining subquestions.`,
        options.signal
      );
      usage = addUsage(usage, hop2.usage);
      for (const q of hop2.queries) progress({ type: 'query', query: q });
    } catch (err) {
      if (isAbort(err, options.signal)) throw err;
      console.warn('Research hop 2 failed, keeping hop 1 results:', err instanceof Error ? err.message : err);
      progress({ type: 'step', step: 'Hop 2 failed; continuing with hop 1 findings...' });
    }
  }

  // 4. Merge: hop 2 ids are namespaced; duplicate titles map onto the hop 1 card.
  const nodes = [...hop1.output.nodes];
  const relationships = [...hop1.output.relationships];
  if (hop2) {
    const hop1Ids = new Set(hop1.output.nodes.map(n => n.tempId));
    const hop1ByTitle = new Map(hop1.output.nodes.map(n => [normalizeTitle(n.title), n.tempId]));
    const idMap = new Map<string, string>();
    for (const node of hop2.output.nodes) {
      const existing = hop1ByTitle.get(normalizeTitle(node.title));
      if (existing) {
        idMap.set(node.tempId, existing);
        continue;
      }
      const id = `hop2-${node.tempId}`;
      idMap.set(node.tempId, id);
      nodes.push({ ...node, tempId: id });
    }
    const resolve = (tempId: string) => idMap.get(tempId) ?? (hop1Ids.has(tempId) ? tempId : `hop2-${tempId}`);
    for (const rel of hop2.output.relationships) {
      relationships.push({ ...rel, fromTempId: resolve(rel.fromTempId), toTempId: resolve(rel.toTempId) });
    }
  }

  const seen: SeenSources = new Map([...hop1.seen, ...(hop2?.seen ?? [])]);
  const sources = verifiedSources([...hop1.output.sources, ...(hop2?.output.sources ?? [])], seen, 20);
  const subquestions = [...new Set([...(hop2?.output.subquestions ?? []), ...hop1.output.subquestions])].slice(0, 6);
  const summary = hop2
    ? `${hop1.output.summary}\n\n**Deep investigation:**\n${hop2.output.summary}`
    : hop1.output.summary;

  progress({ type: 'step', stepId: 'synthesis', step: `Synthesizing ${Math.min(nodes.length, 14)} epistemic nodes and ${relationships.length} relationships...` });

  return {
    result: { summary, subquestions, nodes: nodes.slice(0, 14), relationships: relationships.slice(0, 18) },
    sources,
    searchQueries: [...new Set([...hop1.queries, ...(hop2?.queries ?? [])])].slice(0, 16),
    model: hop1.model,
    searched: hop1.searched,
    usage
  };
}

/* =====================================================================
   Public API
===================================================================== */
export async function researchGraph(
  query: string,
  mode: ResearchMode,
  graph: KnowledgeGraph,
  options: ResearchOptions = {}
): Promise<ResearchResultPayload> {
  providerPlan(); // throws AI_NOT_CONFIGURED before retrieval work
  const context = await buildGraphRAGContext({
    projectId: options.projectId ?? 'default',
    graph,
    query,
    tokenBudget: CONTEXT_TOKEN_BUDGET
  });

  return runWithFallback(
    'research',
    async provider => {
      const run = mode === 'deep' ? runDeep : runQuick;
      const outcome = await run(provider, query, context.markdown, options);
      return {
        result: outcome.result,
        sources: outcome.sources,
        searchQueries: outcome.searchQueries,
        provider,
        model: outcome.model,
        ...(provider === 'OpenAI' ? { reasoningEffort: 'medium' as const } : {}),
        usedFallback: false,
        usage: outcome.usage,
        ...(outcome.searched ? {} : { groundingNote: 'Web search was unavailable for this model; no sources were attached.' })
      };
    },
    provider => options.onProgress?.({ type: 'step', step: `Primary provider failed; retrying research with ${provider}...` }),
    options.signal
  );
}

/**
 * Streams research progress as it happens: each event is emitted at the point
 * the corresponding work starts or finishes.
 */
export async function* researchGraphStream(
  query: string,
  mode: ResearchMode,
  graph: KnowledgeGraph,
  options: Omit<ResearchOptions, 'onProgress'> = {}
): AsyncGenerator<ResearchStreamEvent, void, unknown> {
  providerPlan(); // throws AI_NOT_CONFIGURED before any event is sent

  const queue: ResearchStreamEvent[] = [];
  let wake: (() => void) | null = null;
  const signal = () => { wake?.(); wake = null; };
  let finished = false;
  let outcome: { ok: true; value: ResearchResultPayload } | { ok: false; error: unknown } | null = null;

  queue.push({
    type: 'step',
    stepId: mode === 'deep' ? 'axes' : 'queries',
    step: `Initializing ${mode === 'deep' ? 'deep multi-step' : 'quick'} research...`
  });

  researchGraph(query, mode, graph, { ...options, onProgress: event => { queue.push(event); signal(); } })
    .then(value => { outcome = { ok: true, value }; }, error => { outcome = { ok: false, error }; })
    .finally(() => { finished = true; signal(); });

  while (true) {
    while (queue.length > 0) yield queue.shift()!;
    if (finished) break;
    await new Promise<void>(resolve => { wake = resolve; });
  }

  const result = outcome as { ok: true; value: ResearchResultPayload } | { ok: false; error: unknown } | null;
  if (!result || !result.ok) throw result ? result.error : new Error('RESEARCH_FAILED');

  for (const source of result.value.sources) {
    yield { type: 'source', source };
  }
  yield { type: 'done', result: result.value };
}
