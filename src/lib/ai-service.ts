import type { ResearchMode, CanvasNode } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import { buildGraphRAGContext } from './rag/context-builder.ts';
import { syncGraphVectors } from './rag/vector-store.ts';

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
  provider?: 'OpenAI' | 'Gemini';
  model?: string;
  reasoningEffort?: 'medium';
  usedFallback?: boolean;
}

export interface ResearchResultPayload {
  result: ResearchGeneration;
  sources: Array<{ title: string; url: string }>;
  searchQueries: string[];
  provider: 'OpenAI' | 'Gemini';
  model: string;
  reasoningEffort?: 'medium';
  usedFallback: boolean;
}

export interface AIStatus {
  configured: boolean;
  activeProvider: 'OpenAI' | 'Gemini' | 'None';
  activeModel: string;
  reasoningEffort: 'medium';
  embeddingModel: string;
  embeddingDimension: number;
  fallbackConfigured: boolean;
  fallbackProvider: 'OpenAI' | 'Gemini' | null;
  fallbackModel: string | null;
  usingFallback: boolean;
  providers: {
    openai: { configured: boolean; model: string; embeddings: string };
    gemini: { configured: boolean; model: string; embeddings: string };
  };
}

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || '';
}

function geminiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

export function isAIConfigured(): boolean {
  return Boolean(openAiKey() || geminiKey());
}

// Track whether fallback was triggered during the active server session
let hasSwitchedToFallback = false;

export function getAIStatus(): AIStatus {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());

  const openaiInfo = {
    configured: hasOpenAI,
    model: 'gpt-6-luna',
    embeddings: 'text-embedding-3-small (1536d)'
  };
  const geminiInfo = {
    configured: hasGemini,
    model: 'gemini-3.8-flash',
    embeddings: 'text-embedding-004 (768d)'
  };

  if (hasOpenAI) {
    if (hasSwitchedToFallback && hasGemini) {
      return {
        configured: true,
        activeProvider: 'Gemini',
        activeModel: geminiInfo.model,
        reasoningEffort: 'medium',
        embeddingModel: geminiInfo.embeddings,
        embeddingDimension: 1536,
        fallbackConfigured: true,
        fallbackProvider: 'OpenAI',
        fallbackModel: openaiInfo.model,
        usingFallback: true,
        providers: { openai: openaiInfo, gemini: geminiInfo }
      };
    }

    return {
      configured: true,
      activeProvider: 'OpenAI',
      activeModel: openaiInfo.model,
      reasoningEffort: 'medium',
      embeddingModel: openaiInfo.embeddings,
      embeddingDimension: 1536,
      fallbackConfigured: hasGemini,
      fallbackProvider: hasGemini ? 'Gemini' : null,
      fallbackModel: hasGemini ? geminiInfo.model : null,
      usingFallback: false,
      providers: { openai: openaiInfo, gemini: geminiInfo }
    };
  }

  if (hasGemini) {
    return {
      configured: true,
      activeProvider: 'Gemini',
      activeModel: geminiInfo.model,
      reasoningEffort: 'medium',
      embeddingModel: geminiInfo.embeddings,
      embeddingDimension: 1536,
      fallbackConfigured: false,
      fallbackProvider: null,
      fallbackModel: null,
      usingFallback: false,
      providers: { openai: openaiInfo, gemini: geminiInfo }
    };
  }

  return {
    configured: false,
    activeProvider: 'None',
    activeModel: 'None',
    reasoningEffort: 'medium',
    embeddingModel: 'None',
    embeddingDimension: 1536,
    fallbackConfigured: false,
    fallbackProvider: null,
    fallbackModel: null,
    usingFallback: false,
    providers: { openai: openaiInfo, gemini: geminiInfo }
  };
}

/* =====================================================================
   OpenAI Provider (gpt-6-luna with medium reasoning)
===================================================================== */
class OpenAIProvider {
  readonly model = 'gpt-6-luna';
  readonly reasoningEffort = 'medium' as const;

  async chat(
    question: string,
    projectId: string,
    graph: KnowledgeGraph,
    selectedNodeId?: string
  ): Promise<GraphAnswer> {
    const key = openAiKey();
    if (!key) throw new Error('OPENAI_NOT_CONFIGURED');

    const ragContext = await buildGraphRAGContext({
      projectId,
      graph,
      query: question,
      selectedNodeId,
      tokenBudget: 6000
    });

    const systemPrompt = `You are Synthex Studio's Knowledge Graph Assistant.
You answer user inquiries with strict epistemic rigor based SOLELY on the provided Knowledge Graph context.
Rules:
1. Ground your reasoning strictly in the retrieved nodes, claims, and evidence links.
2. If the graph context lacks sufficient evidence or details to answer fully, explicitly declare what is missing.
3. Treat claims marked as 'unverified' as provisional hypotheses, NOT facts.
4. Reference only valid node IDs that directly support your claims.
5. Return your output strictly as a JSON object matching this schema:
{
  "answer": "string (markdown supported)",
  "referencedNodeIds": ["string array of node IDs cited in the answer"]
}`;

    const userPrompt = `Graph Context:\n${ragContext.markdown}\n\nUser Question: ${question}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: this.model,
        reasoning_effort: this.reasoningEffort,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenAI chat request failed: HTTP ${response.status}: ${errText}`);
      throw new Error(`OPENAI_FAILED_${response.status}`);
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('OPENAI_INVALID_RESPONSE');

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed.answer !== 'string' || !Array.isArray(parsed.referencedNodeIds)) {
      throw new Error('OPENAI_MALFORMED_OUTPUT');
    }

    const referencedNodeIds = parsed.referencedNodeIds.filter((id: string) => Boolean(graph.nodesById[id]));

    return {
      answer: parsed.answer,
      referencedNodeIds,
      provider: 'OpenAI',
      model: this.model,
      reasoningEffort: this.reasoningEffort
    };
  }

  async research(
    query: string,
    mode: ResearchMode,
    projectId: string,
    graph: KnowledgeGraph
  ): Promise<ResearchResultPayload> {
    const key = openAiKey();
    if (!key) throw new Error('OPENAI_NOT_CONFIGURED');

    const maxNodes = mode === 'deep' ? 14 : 7;
    const ragContext = await buildGraphRAGContext({
      projectId,
      graph,
      query,
      tokenBudget: 4000
    });

    const systemPrompt = `You are Synthex Studio's AI Research Engine running with medium reasoning depth.
Your goal is to transform research topics into structured knowledge graphs.
Rules:
1. Propose between 4 and ${maxNodes} cohesive nodes: concepts, testable claims, hypotheses, and open questions.
2. A claim must enter the graph with explicit 'unverified' epistemic status until empirical evidence is linked.
3. Propose directional semantic relationships using tempIds: 'supports', 'contradicts', 'depends_on', 'answers', 'derived_from', 'extends'.
4. Ground your assertions in real-world facts and explain the rationale for each card.
5. Return your response strictly as a JSON object with this exact structure:
{
  "summary": "High-level synthesis of the topic",
  "subquestions": ["string array of 3-5 exploratory research questions"],
  "sources": [{"title": "Source or publication name", "url": "https://..."}],
  "nodes": [
    {
      "tempId": "temp-1",
      "type": "concept" | "note" | "claim" | "question" | "hypothesis" | "ai_insight",
      "title": "Clear concise card title",
      "content": "Rich analytical content",
      "rationale": "Why this node belongs in the knowledge graph"
    }
  ],
  "relationships": [
    {
      "fromTempId": "temp-1",
      "toTempId": "temp-2",
      "label": "supports" | "contradicts" | "depends_on" | "answers" | "derived_from" | "extends",
      "evidence": "Quotation or analytical evidence connecting them",
      "confidence": 0.85
    }
  ]
}`;

    const userPrompt = `Research Mode: ${mode}\nQuery: ${query}\n\nExisting Graph Knowledge Context:\n${ragContext.markdown}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: this.model,
        reasoning_effort: this.reasoningEffort,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenAI research failed: HTTP ${response.status}: ${errText}`);
      throw new Error(`OPENAI_FAILED_${response.status}`);
    }

    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('OPENAI_INVALID_RESPONSE');

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed.summary !== 'string' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.relationships)) {
      throw new Error('OPENAI_MALFORMED_OUTPUT');
    }

    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter((s: { url?: string }) => typeof s?.url === 'string' && /^https?:\/\//i.test(s.url))
      : [];

    return {
      result: {
        summary: parsed.summary,
        subquestions: Array.isArray(parsed.subquestions) ? parsed.subquestions : [],
        nodes: parsed.nodes,
        relationships: parsed.relationships
      },
      sources,
      searchQueries: [query, ...(Array.isArray(parsed.subquestions) ? parsed.subquestions.slice(0, 3) : [])],
      provider: 'OpenAI',
      model: this.model,
      reasoningEffort: this.reasoningEffort,
      usedFallback: false
    };
  }
}

/* =====================================================================
   Gemini Provider (gemini-3.8-flash with Google Search Grounding)
===================================================================== */
class GeminiProvider {
  readonly model = 'gemini-3.8-flash';
  private readonly endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

  private async generate(prompt: string, schema: object, useSearch: boolean) {
    const key = geminiKey();
    if (!key) throw new Error('GEMINI_NOT_CONFIGURED');

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: {
          responseFormat: { text: { mimeType: 'application/json', schema } }
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API returned status:', response.status);
      throw new Error(`GEMINI_FAILED_${response.status}`);
    }

    const body = await response.json();
    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.find((part: { text?: string }) => part.text)?.text;
    if (typeof text !== 'string') throw new Error('GEMINI_INVALID_RESPONSE');
    return { data: JSON.parse(text), grounding: candidate.groundingMetadata || {} };
  }

  async chat(
    question: string,
    projectId: string,
    graph: KnowledgeGraph,
    selectedNodeId?: string
  ): Promise<GraphAnswer> {
    const ragContext = await buildGraphRAGContext({
      projectId,
      graph,
      query: question,
      selectedNodeId,
      tokenBudget: 5000
    });

    const chatSchema = {
      type: 'OBJECT',
      properties: {
        answer: { type: 'STRING' },
        referencedNodeIds: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['answer', 'referencedNodeIds']
    };

    const prompt = `Answer the user's question using only the supplied knowledge graph context.
If the graph does not contain enough information, declare what is missing.
Never invent sources or treat unverified claims as facts. Reference node IDs only when they directly support the answer.

Graph Context:
${ragContext.markdown}

Question: ${question}`;

    const res = await this.generate(prompt, chatSchema, false);
    const result = res.data as GraphAnswer;
    if (!result || typeof result.answer !== 'string' || !Array.isArray(result.referencedNodeIds)) {
      throw new Error('GEMINI_MALFORMED_OUTPUT');
    }

    return {
      answer: result.answer,
      referencedNodeIds: result.referencedNodeIds.filter(id => Boolean(graph.nodesById[id])).slice(0, 12),
      provider: 'Gemini',
      model: this.model
    };
  }

  async research(
    query: string,
    mode: ResearchMode,
    projectId: string,
    graph: KnowledgeGraph
  ): Promise<ResearchResultPayload> {
    const maxNodes = mode === 'deep' ? 12 : 5;
    const ragContext = await buildGraphRAGContext({
      projectId,
      graph,
      query,
      tokenBudget: 3500
    });

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

    const prompt = `Research this topic for a persistent knowledge graph. Mode: ${mode}.\n\nQuery: ${query}\n\nExisting graph context:\n${ragContext.markdown}\n\nReturn at most ${maxNodes} proposed nodes and 14 semantic relationships. Include concepts, testable claims, and unresolved questions. A claim is always unverified until a human reviews it and links evidence. Do not invent sources, URLs, quotations, or citations. Explain the reason for each proposed node and the basis for each relationship. Make relationships between the proposed nodes using their tempIds. Use short stable tempIds. Prefer sourceable, specific claims. The search tool is enabled; use it to gather evidence and return a concise synthesis.`;

    const res = await this.generate(prompt, researchSchema, true);
    const result = res.data as ResearchGeneration;
    const groundedChunks = Array.isArray(res.grounding?.groundingChunks) ? res.grounding.groundingChunks : [];
    const sources = groundedChunks.flatMap((chunk: { web?: { title?: string; uri?: string } }) => {
      const url = chunk.web?.uri;
      if (!url || !/^https?:\/\//i.test(url)) return [];
      return [{ title: String(chunk.web?.title || new URL(url).hostname).slice(0, 300), url: url.slice(0, 4096) }];
    }).filter((source: { url: string }, index: number, list: Array<{ url: string }>) =>
      list.findIndex(item => item.url === source.url) === index
    ).slice(0, mode === 'deep' ? 16 : 8);

    const searchQueries = Array.isArray(res.grounding?.webSearchQueries)
      ? res.grounding.webSearchQueries.filter((item: unknown): item is string => typeof item === 'string').slice(0, 12)
      : [];

    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.nodes) || !Array.isArray(result.relationships)) {
      throw new Error('GEMINI_MALFORMED_OUTPUT');
    }

    return {
      result,
      sources,
      searchQueries,
      provider: 'Gemini',
      model: this.model,
      usedFallback: false
    };
  }
}

/* =====================================================================
   Fallback AI Service: Primary (OpenAI gpt-6-luna) -> Fallback (Gemini)
===================================================================== */
const openaiProvider = new OpenAIProvider();
const geminiProvider = new GeminiProvider();

export async function askGraph(
  question: string,
  graph: KnowledgeGraph,
  selectedNodeId?: string,
  projectId = 'default'
): Promise<GraphAnswer> {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());

  if (!hasOpenAI && !hasGemini) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  // 1. If OpenAI is configured and not previously fallen back
  if (hasOpenAI && !hasSwitchedToFallback) {
    try {
      return await openaiProvider.chat(question, projectId, graph, selectedNodeId);
    } catch (err) {
      console.warn('Primary OpenAI provider failed in chat:', err instanceof Error ? err.message : err);
      if (hasGemini) {
        hasSwitchedToFallback = true;
        console.warn('Switching to fallback Gemini provider for chat.');
        const geminiRes = await geminiProvider.chat(question, projectId, graph, selectedNodeId);
        return {
          ...geminiRes,
          usedFallback: true
        };
      }
      throw err;
    }
  }

  // 2. Fallback to Gemini
  if (hasGemini) {
    try {
      const res = await geminiProvider.chat(question, projectId, graph, selectedNodeId);
      return {
        ...res,
        usedFallback: hasOpenAI
      };
    } catch (geminiErr) {
      // If Gemini fails and OpenAI is available, attempt reverse fallback
      if (hasOpenAI) {
        hasSwitchedToFallback = false;
        return await openaiProvider.chat(question, projectId, graph, selectedNodeId);
      }
      throw geminiErr;
    }
  }

  // Fallback to OpenAI if Gemini was absent
  return await openaiProvider.chat(question, projectId, graph, selectedNodeId);
}

export async function researchGraph(
  query: string,
  mode: ResearchMode,
  graph: KnowledgeGraph,
  projectId = 'default'
): Promise<ResearchResultPayload> {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());

  if (!hasOpenAI && !hasGemini) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  // 1. Try OpenAI gpt-6-luna first
  if (hasOpenAI && !hasSwitchedToFallback) {
    try {
      return await openaiProvider.research(query, mode, projectId, graph);
    } catch (err) {
      console.warn('Primary OpenAI provider failed in research:', err instanceof Error ? err.message : err);
      if (hasGemini) {
        hasSwitchedToFallback = true;
        console.warn('Switching to fallback Gemini provider for research.');
        const geminiRes = await geminiProvider.research(query, mode, projectId, graph);
        return {
          ...geminiRes,
          usedFallback: true
        };
      }
      throw err;
    }
  }

  // 2. Gemini provider
  if (hasGemini) {
    try {
      const res = await geminiProvider.research(query, mode, projectId, graph);
      return {
        ...res,
        usedFallback: hasOpenAI
      };
    } catch (geminiErr) {
      if (hasOpenAI) {
        hasSwitchedToFallback = false;
        return await openaiProvider.research(query, mode, projectId, graph);
      }
      throw geminiErr;
    }
  }

  return await openaiProvider.research(query, mode, projectId, graph);
}

/**
 * Background helper to update node embeddings and FTS5 search index
 */
export function indexGraphNodes(projectId: string, nodes: CanvasNode[]) {
  syncGraphVectors(projectId, nodes).catch(err => {
    console.warn(`Vector indexing error for project "${projectId}":`, err instanceof Error ? err.message : err);
  });
}
