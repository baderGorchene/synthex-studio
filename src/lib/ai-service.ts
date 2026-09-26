import type { ResearchMode } from '@/types/canvas';
import type { KnowledgeGraph } from '@/lib/graph';

export interface ResearchGeneration {
  summary: string;
  subquestions: string[];
  nodes: Array<{
    tempId: string;
    type: 'concept' | 'note' | 'claim' | 'question' | 'hypothesis' | 'ai_insight';
    title: string;
    content: string;
    rationale: string;
  }>;
  relationships: Array<{
    fromTempId: string;
    toTempId: string;
    label: string;
    evidence: string;
    confidence: number;
  }>;
}

export interface GraphAnswer {
  answer: string;
  referencedNodeIds: string[];
}

interface AIService {
  research(query: string, mode: ResearchMode, graph: KnowledgeGraph): Promise<{
    result: ResearchGeneration;
    sources: Array<{ title: string; url: string }>;
    searchQueries: string[];
  }>;
  chat(question: string, graph: KnowledgeGraph, selectedNodeId?: string): Promise<GraphAnswer>;
}

const model = 'gemini-3.8-flash';
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const researchSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    subquestions: { type: 'ARRAY', items: { type: 'STRING' } },
    nodes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tempId: { type: 'STRING' },
          type: { type: 'STRING', enum: ['concept', 'note', 'claim', 'question', 'hypothesis', 'ai_insight'] },
          title: { type: 'STRING' },
          content: { type: 'STRING' },
          rationale: { type: 'STRING' }
        },
        required: ['tempId', 'type', 'title', 'content', 'rationale']
      }
    },
    relationships: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          fromTempId: { type: 'STRING' },
          toTempId: { type: 'STRING' },
          label: { type: 'STRING' },
          evidence: { type: 'STRING' },
          confidence: { type: 'NUMBER' }
        },
        required: ['fromTempId', 'toTempId', 'label', 'evidence', 'confidence']
      }
    }
  },
  required: ['summary', 'subquestions', 'nodes', 'relationships']
};

const chatSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    referencedNodeIds: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['answer', 'referencedNodeIds']
};

interface GenerateResult {
  data: unknown;
  grounding: { groundingChunks?: unknown; webSearchQueries?: unknown };
}

function apiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

export function isAIConfigured(): boolean {
  return Boolean(apiKey());
}

async function generate(prompt: string, schema: object, useSearch: boolean): Promise<GenerateResult> {
  const key = apiKey();
  if (!key) throw new Error('AI_NOT_CONFIGURED');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        responseFormat: { text: { mimeType: 'application/json', schema } }
      }
    })
  });
  if (!response.ok) {
    console.error('AI provider returned status:', response.status);
    throw new Error('AI_PROVIDER_FAILED');
  }

  const body = await response.json();
  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.find((part: { text?: string }) => part.text)?.text;
  if (typeof text !== 'string') throw new Error('AI_INVALID_RESPONSE');
  return { data: JSON.parse(text), grounding: candidate.groundingMetadata || {} };
}

function graphContext(graph: KnowledgeGraph, focusId?: string): string {
  const nodes = Object.values(graph.nodesById);
  const focused = focusId && graph.nodesById[focusId]
    ? new Set([
        focusId,
        ...Object.values(graph.edgesById).flatMap(edge =>
          edge.from === focusId ? [edge.to] : edge.to === focusId ? [edge.from] : []
        )
      ])
    : undefined;
  const visible = nodes.filter(node => !focused || focused.has(node.id)).slice(0, 80);
  const ids = new Set(visible.map(node => node.id));
  const edges = Object.values(graph.edgesById)
    .filter(edge => ids.has(edge.from) && ids.has(edge.to))
    .slice(0, 160);
  return JSON.stringify({
    nodes: visible.map(({ id, type, title, content, url, metadata }) => ({ id, type, title, content: content?.slice(0, 1800), url, status: metadata?.claimStatus })),
    relationships: edges.map(({ from, to, label }) => ({ from, to, label }))
  });
}

class GeminiAIService implements AIService {
  async research(query: string, mode: ResearchMode, graph: KnowledgeGraph) {
    const maxNodes = mode === 'deep' ? 12 : 5;
    const prompt = `Research this topic for a persistent knowledge graph. Mode: ${mode}.\n\nQuery: ${query}\n\nExisting graph context:\n${graphContext(graph)}\n\nReturn at most ${maxNodes} proposed nodes and 14 semantic relationships. Include concepts, testable claims, and unresolved questions. A claim is always unverified until a human reviews it and links evidence. Do not invent sources, URLs, quotations, or citations. Explain the reason for each proposed node and the basis for each relationship. Make relationships between the proposed nodes using their tempIds. Use short stable tempIds. Prefer sourceable, specific claims. The search tool is enabled; use it to gather evidence and return a concise synthesis.`;
    const response = await generate(prompt, researchSchema, true);
    const result = response.data as ResearchGeneration;
    const groundedChunks = Array.isArray(response.grounding?.groundingChunks) ? response.grounding.groundingChunks : [];
    const sources = groundedChunks.flatMap((chunk: { web?: { title?: string; uri?: string } }) => {
      const url = chunk.web?.uri;
      if (!url || !/^https?:\/\//i.test(url)) return [];
      return [{ title: String(chunk.web?.title || new URL(url).hostname).slice(0, 300), url: url.slice(0, 4096) }];
    }).filter((source: { url: string }, index: number, list: Array<{ url: string }>) =>
      list.findIndex(item => item.url === source.url) === index
    ).slice(0, mode === 'deep' ? 16 : 8);
    const searchQueries = Array.isArray(response.grounding?.webSearchQueries)
      ? response.grounding.webSearchQueries.filter((item: unknown): item is string => typeof item === 'string').slice(0, 12)
      : [];

    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.nodes) || !Array.isArray(result.relationships)) {
      throw new Error('AI_INVALID_RESPONSE');
    }
    return { result, sources, searchQueries };
  }

  async chat(question: string, graph: KnowledgeGraph, selectedNodeId?: string) {
    const prompt = `Answer the user's question using only the supplied knowledge graph. If the graph does not contain enough information, say what is missing. Never invent sources or treat unverified claims as facts. Reference node IDs only when they directly support the answer.\n\nGraph:\n${graphContext(graph, selectedNodeId)}\n\nQuestion: ${question}`;
    const response = await generate(prompt, chatSchema, false);
    const result = response.data as GraphAnswer;
    if (!result || typeof result.answer !== 'string' || !Array.isArray(result.referencedNodeIds)) {
      throw new Error('AI_INVALID_RESPONSE');
    }
    result.referencedNodeIds = result.referencedNodeIds.filter(id => Boolean(graph.nodesById[id])).slice(0, 12);
    return result;
  }
}

const aiService: AIService = new GeminiAIService();

export function researchGraph(query: string, mode: ResearchMode, graph: KnowledgeGraph) {
  return aiService.research(query, mode, graph);
}

export function askGraph(question: string, graph: KnowledgeGraph, selectedNodeId?: string) {
  return aiService.chat(question, graph, selectedNodeId);
}
