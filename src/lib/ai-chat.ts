import { generateText, streamText, Output } from 'ai';
import { z } from 'zod';
import type { CanvasNodeType } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import type { ChatToolCall, ProposedNodeItem, ProposedRelationshipItem } from '../types/chat-tools';
import { buildGraphRAGContext } from './rag/context-builder.ts';
import { auditGraphTopology } from './graph-analyst.ts';
import {
  GEMINI_BACKUP_MODEL,
  GEMINI_MODEL,
  OPENAI_MODEL,
  PROVIDER_OPTIONS,
  isAbort,
  isGeminiCapacityError,
  languageModel,
  providerPlan,
  recordProviderOutcome,
  type ProviderName
} from './ai-providers.ts';

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface GraphAnswer {
  answer: string;
  referencedNodeIds: string[];
  provider?: ProviderName;
  model?: string;
  reasoningEffort?: 'medium';
  usedFallback?: boolean;
  toolCall?: ChatToolCall | null;
  usage?: TokenUsage;
}

export interface ChatStreamEvent {
  type: 'status' | 'thinking' | 'delta' | 'tool' | 'done' | 'error';
  status?: string;
  step?: string;
  text?: string;
  referencedNodeIds?: string[];
  model?: string;
  provider?: ProviderName;
  usedFallback?: boolean;
  toolCall?: ChatToolCall | null;
  usage?: TokenUsage;
  error?: string;
}

export interface ChatOptions {
  selectedNodeId?: string;
  projectId?: string;
  /** Aborts the model call, e.g. when the client disconnects. */
  signal?: AbortSignal;
}

const CHAT_TIMEOUT_MS = 90_000;
const CONTEXT_TOKEN_BUDGET = 6000;

/* =====================================================================
   Output schema and prompt
===================================================================== */
const PROPOSABLE_NODE_TYPES = ['concept', 'claim', 'question', 'hypothesis', 'note', 'source'] as const;
const LAYOUT_STRATEGIES = ['cluster_by_type', 'hierarchical', 'compact'] as const;

// Every field is required and nullable: OpenAI strict structured outputs reject optional fields.
const chatOutputSchema = z.object({
  answer: z.string().describe('Markdown answer grounded in the graph context'),
  referencedNodeIds: z.array(z.string()).describe('IDs of graph nodes that directly support the answer'),
  toolCall: z.object({
    tool: z.enum(['research', 'recommend_improvements', 'organize_layout', 'propose_nodes']),
    parameters: z.object({
      query: z.string().nullable().describe('research: specific research query'),
      mode: z.enum(['quick', 'deep']).nullable().describe('research: depth'),
      focusArea: z.string().nullable().describe('recommend_improvements: optional topic to focus on'),
      strategy: z.enum(LAYOUT_STRATEGIES).nullable().describe('organize_layout: layout strategy'),
      nodes: z.array(z.object({
        title: z.string(),
        type: z.enum(PROPOSABLE_NODE_TYPES),
        content: z.string(),
        rationale: z.string()
      })).nullable().describe('propose_nodes: nodes to add'),
      relationships: z.array(z.object({
        fromTitle: z.string(),
        toTitle: z.string(),
        label: z.string(),
        evidence: z.string()
      })).nullable().describe('propose_nodes: relationships to add, by exact node title')
    }).describe('Fill the parameters of the chosen tool; set every other parameter to null')
  }).nullable().describe('A suggested action, or null when the user is only asking a question')
});

type ChatOutput = z.infer<typeof chatOutputSchema>;

const CHAT_SYSTEM_PROMPT = `You are Synthex Studio's Agentic Knowledge Graph Assistant.
You answer user inquiries with strict epistemic rigor based on the provided Knowledge Graph context, and you can suggest one action using a tool.

Available tools (set "toolCall" to suggest one; it only runs if the user accepts it):
1. research: web-grounded research that stages new knowledge cards for human review. Parameters: query, mode ("quick" or "deep").
   Use when the user asks to research a topic, explore a concept further, or find external grounding.
2. recommend_improvements: audit the graph for missing links, unverified claims, and blind spots. Parameters: focusArea (optional).
   Use when the user asks for recommendations, next steps, what is missing, or how to improve the graph.
3. organize_layout: rearrange the canvas (positions only). Parameters: strategy ("cluster_by_type", "hierarchical" or "compact").
   Use when the user asks to tidy, organize, arrange, cluster, or lay out the canvas.
4. propose_nodes: propose nodes and connections. Parameters: nodes, relationships. "fromTitle"/"toTitle" must exactly match a proposed or existing node title.
   Use when the user asks to add, create, or link specific ideas, claims, or connections.

Rules:
1. Ground your reasoning strictly in the retrieved nodes, claims, and evidence links.
2. Suggest a tool only when the user's intent is an action; otherwise set "toolCall" to null.
3. Put only IDs of nodes that directly support your answer in "referencedNodeIds".
4. Never invent sources or treat unverified claims as facts.`;

function chatPrompt(contextMarkdown: string, question: string) {
  return `Graph Context:\n${contextMarkdown}\n\nUser Question: ${question}`;
}

/* =====================================================================
   Output validation
===================================================================== */
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Validate a model-proposed tool call against the graph; returns null for anything unusable. */
export function sanitizeToolCall(raw: unknown, graph: KnowledgeGraph): ChatToolCall | null {
  if (!raw || typeof raw !== 'object') return null;
  const { tool, parameters } = raw as { tool?: unknown; parameters?: unknown };
  const p = (parameters && typeof parameters === 'object' ? parameters : {}) as Record<string, unknown>;

  switch (tool) {
    case 'research': {
      const query = text(p.query, 500);
      if (!query) return null;
      return { tool, parameters: { query, mode: p.mode === 'deep' ? 'deep' : 'quick' } };
    }
    case 'recommend_improvements': {
      const focusArea = text(p.focusArea, 500);
      return { tool, parameters: focusArea ? { focusArea } : {}, analysis: auditGraphTopology(graph) };
    }
    case 'organize_layout': {
      const strategy = (LAYOUT_STRATEGIES as readonly unknown[]).includes(p.strategy) ? p.strategy : 'cluster_by_type';
      return { tool, parameters: { strategy: strategy as (typeof LAYOUT_STRATEGIES)[number] } };
    }
    case 'propose_nodes': {
      const nodes: ProposedNodeItem[] = (Array.isArray(p.nodes) ? p.nodes : []).flatMap((item: unknown) => {
        const n = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const title = text(n.title, 300);
        if (!title || !(PROPOSABLE_NODE_TYPES as readonly unknown[]).includes(n.type)) return [];
        return [{ title, type: n.type as CanvasNodeType, content: text(n.content, 4000), rationale: text(n.rationale, 1000) }];
      }).slice(0, 12);
      const relationships: ProposedRelationshipItem[] = (Array.isArray(p.relationships) ? p.relationships : []).flatMap((item: unknown) => {
        const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const fromTitle = text(r.fromTitle, 300);
        const toTitle = text(r.toTitle, 300);
        if (!fromTitle || !toTitle) return [];
        return [{ fromTitle, toTitle, label: text(r.label, 120) || 'related_to', evidence: text(r.evidence, 1000) }];
      }).slice(0, 20);
      if (nodes.length === 0 && relationships.length === 0) return null;
      return { tool, parameters: { nodes, relationships } };
    }
    default:
      return null;
  }
}

function finalizeChat(output: Partial<ChatOutput> | null | undefined, graph: KnowledgeGraph) {
  const referencedNodeIds = Array.isArray(output?.referencedNodeIds)
    ? [...new Set(output.referencedNodeIds.filter(id => typeof id === 'string' && Boolean(graph.nodesById[id])))].slice(0, 12)
    : [];
  return {
    answer: typeof output?.answer === 'string' ? output.answer : '',
    referencedNodeIds,
    toolCall: sanitizeToolCall(output?.toolCall, graph)
  };
}

/* =====================================================================
   Model attempts

   Each provider step tries its models in order: OpenAI has one; Gemini
   retries once on its backup model when the main one is at capacity.
===================================================================== */
function modelsFor(provider: ProviderName): string[] {
  if (provider === 'OpenAI') return [OPENAI_MODEL];
  return GEMINI_MODEL === GEMINI_BACKUP_MODEL ? [GEMINI_MODEL] : [GEMINI_MODEL, GEMINI_BACKUP_MODEL];
}

function callSettings(provider: ProviderName, modelId: string, contextMarkdown: string, question: string, signal?: AbortSignal) {
  return {
    model: languageModel(provider, modelId),
    system: CHAT_SYSTEM_PROMPT,
    prompt: chatPrompt(contextMarkdown, question),
    output: Output.object({ schema: chatOutputSchema, name: 'graph_answer' }),
    providerOptions: PROVIDER_OPTIONS,
    maxRetries: 0,
    timeout: CHAT_TIMEOUT_MS,
    abortSignal: signal
  };
}

function toUsage(usage: { inputTokens?: number; outputTokens?: number } | undefined): TokenUsage | undefined {
  return usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } : undefined;
}

function logUsage(provider: ProviderName, model: string, usage: TokenUsage | undefined) {
  if (usage) console.info(`[ai] chat ${provider}/${model} input=${usage.inputTokens ?? '?'} output=${usage.outputTokens ?? '?'}`);
}

async function retrieveContext(question: string, graph: KnowledgeGraph, options: ChatOptions) {
  const context = await buildGraphRAGContext({
    projectId: options.projectId ?? 'default',
    graph,
    query: question,
    selectedNodeId: options.selectedNodeId,
    tokenBudget: CONTEXT_TOKEN_BUDGET
  });
  return context.markdown;
}

async function generateWithProvider(
  provider: ProviderName,
  contextMarkdown: string,
  question: string,
  graph: KnowledgeGraph,
  signal?: AbortSignal
): Promise<GraphAnswer> {
  const models = modelsFor(provider);
  for (const [index, modelId] of models.entries()) {
    try {
      const result = await generateText(callSettings(provider, modelId, contextMarkdown, question, signal));
      const usage = toUsage(result.totalUsage);
      logUsage(provider, modelId, usage);
      return {
        ...finalizeChat(result.output, graph),
        provider,
        model: modelId,
        ...(provider === 'OpenAI' ? { reasoningEffort: 'medium' as const } : {}),
        usage
      };
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

async function* streamWithProvider(
  provider: ProviderName,
  contextMarkdown: string,
  question: string,
  graph: KnowledgeGraph,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const models = modelsFor(provider);
  for (const [index, modelId] of models.entries()) {
    yield { type: 'thinking', step: `Reasoning over graph with ${modelId}...` };

    // The SDK reports stream failures through onError and a generic rejection of `output`.
    let streamError: unknown;
    const result = streamText({
      ...callSettings(provider, modelId, contextMarkdown, question, signal),
      onError: ({ error }) => { streamError = error; }
    });

    let emitted = '';
    for await (const partial of result.partialOutputStream) {
      const answer = typeof partial?.answer === 'string' ? partial.answer : '';
      if (answer.length > emitted.length && answer.startsWith(emitted)) {
        yield { type: 'delta', text: answer.slice(emitted.length) };
        emitted = answer;
      }
    }

    let output: ChatOutput;
    try {
      output = await result.output;
    } catch (err) {
      const cause = streamError ?? err;
      if (!emitted && index < models.length - 1 && isGeminiCapacityError(cause) && !isAbort(cause, signal)) {
        console.warn(`Gemini ${modelId} is at capacity; retrying with ${models[index + 1]}.`);
        continue;
      }
      // Tag whether any answer text reached the client, so the caller knows if a fallback is still safe.
      throw Object.assign(cause instanceof Error ? cause : new Error(String(cause)), { emittedOutput: Boolean(emitted) });
    }

    const final = finalizeChat(output, graph);
    if (final.answer.length > emitted.length && final.answer.startsWith(emitted)) {
      yield { type: 'delta', text: final.answer.slice(emitted.length) };
    }
    if (final.toolCall) yield { type: 'tool', toolCall: final.toolCall };

    const usage = toUsage(await result.totalUsage);
    logUsage(provider, modelId, usage);
    yield {
      type: 'done',
      text: final.answer,
      referencedNodeIds: final.referencedNodeIds,
      model: modelId,
      provider,
      toolCall: final.toolCall,
      usage
    };
    return;
  }
}

/* =====================================================================
   Public API
===================================================================== */
export async function askGraph(question: string, graph: KnowledgeGraph, options: ChatOptions = {}): Promise<GraphAnswer> {
  const plan = providerPlan();
  const contextMarkdown = await retrieveContext(question, graph, options);

  let lastError: unknown;
  for (const step of plan) {
    try {
      const answer = await generateWithProvider(step.provider, contextMarkdown, question, graph, options.signal);
      recordProviderOutcome(step.provider, true);
      return { ...answer, usedFallback: step.usedFallback };
    } catch (err) {
      if (isAbort(err, options.signal)) throw err;
      recordProviderOutcome(step.provider, false);
      console.warn(`${step.provider} provider failed in chat:`, err instanceof Error ? err.message : err);
      lastError = err;
    }
  }
  throw lastError;
}

export async function* askGraphStream(
  question: string,
  graph: KnowledgeGraph,
  options: ChatOptions = {}
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const plan = providerPlan();

  yield { type: 'thinking', step: 'Retrieving graph subgraphs & semantic paths...' };
  const contextMarkdown = await retrieveContext(question, graph, options);

  for (const [index, step] of plan.entries()) {
    try {
      if (index > 0) yield { type: 'status', status: `Switching to ${step.provider}...` };
      for await (const event of streamWithProvider(step.provider, contextMarkdown, question, graph, options.signal)) {
        yield event.type === 'done' ? { ...event, usedFallback: step.usedFallback } : event;
      }
      recordProviderOutcome(step.provider, true);
      return;
    } catch (err) {
      if (isAbort(err, options.signal)) throw err;
      recordProviderOutcome(step.provider, false);
      console.warn(`${step.provider} provider failed in chatStream:`, err instanceof Error ? err.message : err);
      // Once answer text has reached the client, switching providers would duplicate output.
      const emittedOutput = Boolean((err as { emittedOutput?: boolean }).emittedOutput);
      if (emittedOutput || index === plan.length - 1) throw err;
    }
  }
}
