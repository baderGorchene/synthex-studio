import { generateText, streamText, Output } from 'ai';
import { z } from 'zod';
import type { CanvasNodeType } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import type { ChatToolCall, ProposedNodeItem, ProposedRelationshipItem } from '../types/chat-tools';
import { buildGraphRAGContext } from './rag/context-builder.ts';
import { auditGraphTopology } from './graph-analyst.ts';
import {
  PROVIDER_OPTIONS,
  isAbort,
  isGeminiCapacityError,
  languageModel,
  logUsage,
  modelsFor,
  providerPlan,
  recordProviderOutcome,
  withModelFallback,
  type ProviderName,
  type TokenUsage
} from './ai-providers.ts';

export type { TokenUsage };

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

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
  referencedNodeIds?: string[];
}

export interface ChatOptions {
  selectedNodeId?: string;
  /** Earlier turns of this conversation, oldest first (loaded server-side, never from the client). */
  history?: ChatHistoryTurn[];
  projectId?: string;
  /** Nodes the user attached to this question (already checked against the graph by the route). */
  contextNodeIds?: string[];
  /** Aborts the model call, e.g. when the client disconnects. */
  signal?: AbortSignal;
}

const CHAT_TIMEOUT_MS = 90_000;
const CONTEXT_TOKEN_BUDGET = 6000;
const HISTORY_MAX_TURNS = 6;
const HISTORY_MAX_CHARS = 6000;
const HISTORY_TURN_MAX_CHARS = 1500;
const FOLLOW_UP_SEED_LIMIT = 5;

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
4. Never invent sources or treat unverified claims as facts.
5. Earlier turns of the conversation may precede the latest question. Use them to resolve follow-ups ("that", "the second one"), but ground every fact in the Graph Context of the latest message.`;

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
   Conversation memory
===================================================================== */
/** The most recent turns that fit the budget, oldest first, each trimmed. */
function recentHistory(history: ChatHistoryTurn[] = []): ChatHistoryTurn[] {
  const kept: ChatHistoryTurn[] = [];
  let chars = 0;
  for (const turn of history.slice(-HISTORY_MAX_TURNS).reverse()) {
    const content = turn.content.length > HISTORY_TURN_MAX_CHARS
      ? `${turn.content.slice(0, HISTORY_TURN_MAX_CHARS)}…`
      : turn.content;
    if (!content.trim()) continue;
    if (chars + content.length > HISTORY_MAX_CHARS) break;
    chars += content.length;
    kept.unshift({ ...turn, content });
  }
  // A conversation sent to the model must open with a user turn.
  while (kept[0]?.role === 'assistant') kept.shift();
  return kept;
}

/**
 * Retrieval input for a follow-up: the previous question joins the search text,
 * and the nodes the previous answer cited seed the graph walk.
 */
function followUpRetrieval(question: string, history: ChatHistoryTurn[]) {
  const previousQuestion = [...history].reverse().find(turn => turn.role === 'user')?.content;
  const previousAnswer = [...history].reverse().find(turn => turn.role === 'assistant');
  return {
    query: previousQuestion ? `${previousQuestion.slice(0, 500)}\n${question}` : question,
    extraSeedIds: (previousAnswer?.referencedNodeIds ?? []).slice(0, FOLLOW_UP_SEED_LIMIT)
  };
}

/* =====================================================================
   Model calls
===================================================================== */
interface ChatRequest {
  contextMarkdown: string;
  question: string;
  history: ChatHistoryTurn[];
}

function callSettings(provider: ProviderName, modelId: string, request: ChatRequest, signal?: AbortSignal) {
  return {
    model: languageModel(provider, modelId),
    system: CHAT_SYSTEM_PROMPT,
    messages: [
      ...request.history.map(turn => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: chatPrompt(request.contextMarkdown, request.question) }
    ],
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

async function prepareRequest(question: string, graph: KnowledgeGraph, options: ChatOptions): Promise<ChatRequest> {
  const history = recentHistory(options.history);
  const retrieval = followUpRetrieval(question, history);
  const context = await buildGraphRAGContext({
    projectId: options.projectId ?? 'default',
    graph,
    query: retrieval.query,
    selectedNodeId: options.selectedNodeId,
    extraSeedIds: retrieval.extraSeedIds,
    pinnedIds: options.contextNodeIds,
    tokenBudget: CONTEXT_TOKEN_BUDGET
  });
  return { contextMarkdown: context.markdown, question, history };
}

async function generateWithProvider(
  provider: ProviderName,
  request: ChatRequest,
  graph: KnowledgeGraph,
  signal?: AbortSignal
): Promise<GraphAnswer> {
  return withModelFallback(provider, async modelId => {
    const result = await generateText(callSettings(provider, modelId, request, signal));
    const usage = toUsage(result.totalUsage);
    logUsage('chat', provider, modelId, usage);
    return {
      ...finalizeChat(result.output, graph),
      provider,
      model: modelId,
      ...(provider === 'OpenAI' ? { reasoningEffort: 'medium' as const } : {}),
      usage
    };
  }, signal);
}

async function* streamWithProvider(
  provider: ProviderName,
  request: ChatRequest,
  graph: KnowledgeGraph,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const models = modelsFor(provider);
  for (const [index, modelId] of models.entries()) {
    yield { type: 'thinking', step: `Reasoning over graph with ${modelId}...` };

    // The SDK reports stream failures through onError and a generic rejection of `output`.
    let streamError: unknown;
    const result = streamText({
      ...callSettings(provider, modelId, request, signal),
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
    logUsage('chat', provider, modelId, usage);
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
  const request = await prepareRequest(question, graph, options);

  let lastError: unknown;
  for (const step of plan) {
    try {
      const answer = await generateWithProvider(step.provider, request, graph, options.signal);
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
  const request = await prepareRequest(question, graph, options);

  for (const [index, step] of plan.entries()) {
    try {
      if (index > 0) yield { type: 'status', status: `Switching to ${step.provider}...` };
      for await (const event of streamWithProvider(step.provider, request, graph, options.signal)) {
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
