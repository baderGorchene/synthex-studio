import type { ResearchMode, CanvasNode } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import { buildGraphRAGContext } from './rag/context-builder.ts';
import { syncGraphVectors } from './rag/vector-store.ts';
import { EMBEDDING_DIMENSION, GEMINI_EMBEDDING_MODEL, OPENAI_EMBEDDING_MODEL } from './rag/embeddings.ts';
import {
  GEMINI_BACKUP_MODEL,
  GEMINI_MODEL,
  OPENAI_MODEL,
  geminiKey,
  openAiKey,
  providerPlan,
  runWithFallback,
  type ProviderName
} from './ai-providers.ts';

// Chat lives in ai-chat.ts (AI SDK); research below still calls the provider APIs directly.
export { askGraph, askGraphStream, sanitizeToolCall } from './ai-chat.ts';
export type { GraphAnswer, ChatStreamEvent, ChatOptions } from './ai-chat.ts';

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
}

export interface AIStatus {
  configured: boolean;
  activeProvider: ProviderName | 'None';
  activeModel: string;
  reasoningEffort: 'medium';
  embeddingModel: string;
  embeddingDimension: number;
  fallbackConfigured: boolean;
  fallbackProvider: ProviderName | null;
  fallbackModel: string | null;
  usingFallback: boolean;
  providers: {
    openai: { configured: boolean; model: string; embeddings: string };
    gemini: { configured: boolean; model: string; embeddings: string };
  };
}

export function getAIStatus(): AIStatus {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());

  const openaiInfo = {
    configured: hasOpenAI,
    model: openaiProvider.model,
    embeddings: `${OPENAI_EMBEDDING_MODEL} (${EMBEDDING_DIMENSION}d)`
  };
  const geminiInfo = {
    configured: hasGemini,
    model: geminiProvider.model,
    embeddings: `${GEMINI_EMBEDDING_MODEL} (${EMBEDDING_DIMENSION}d)`
  };
  const providers = { openai: openaiInfo, gemini: geminiInfo };

  if (!hasOpenAI && !hasGemini) {
    return {
      configured: false,
      activeProvider: 'None',
      activeModel: 'None',
      reasoningEffort: 'medium',
      embeddingModel: 'None (keyword search only)',
      embeddingDimension: EMBEDDING_DIMENSION,
      fallbackConfigured: false,
      fallbackProvider: null,
      fallbackModel: null,
      usingFallback: false,
      providers
    };
  }

  const [active, fallback] = providerPlan();
  const info = (p: ProviderName) => (p === 'OpenAI' ? openaiInfo : geminiInfo);
  return {
    configured: true,
    activeProvider: active.provider,
    activeModel: info(active.provider).model,
    reasoningEffort: 'medium',
    // New documents are embedded by the first configured provider (OpenAI, then Gemini).
    embeddingModel: hasOpenAI ? openaiInfo.embeddings : geminiInfo.embeddings,
    embeddingDimension: EMBEDDING_DIMENSION,
    fallbackConfigured: Boolean(fallback),
    fallbackProvider: fallback?.provider ?? null,
    fallbackModel: fallback ? info(fallback.provider).model : null,
    usingFallback: active.usedFallback,
    providers
  };
}

/* =====================================================================
   Research helpers
===================================================================== */
export type ResearchStreamEvent =
  | { type: 'step'; step: string; stepId?: string }
  | { type: 'query'; query: string }
  | { type: 'source'; source: { title: string; url: string } }
  | { type: 'hop'; hop: number; description: string }
  | { type: 'done'; result: ResearchResultPayload }
  | { type: 'error'; error: string };

type ResearchProgress = (event: Exclude<ResearchStreamEvent, { type: 'done' | 'error' }>) => void;

const RESEARCH_JSON_SHAPE = `{
  "summary": "string",
  "subquestions": ["string"],
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

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

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

function dedupeSources(sources: Array<{ title: string; url: string }>, limit: number) {
  const seen = new Set<string>();
  return sources.filter(source => {
    const key = canonicalUrl(source.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function parseResearchJson(content: string, label: string): ResearchGeneration & { sources?: unknown } {
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed.summary !== 'string' || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.relationships)) {
    throw new Error(`${label}_MALFORMED_OUTPUT`);
  }
  return {
    ...parsed,
    subquestions: Array.isArray(parsed.subquestions) ? parsed.subquestions.filter((q: unknown) => typeof q === 'string') : []
  };
}

/* =====================================================================
   OpenAI Provider (gpt-6-luna with medium reasoning)
===================================================================== */
interface OpenAIWebResult {
  text: string;
  /** URLs the web_search tool actually returned or cited, keyed by canonical form. */
  seenUrls: Map<string, { title: string; url: string }>;
  queries: string[];
  searched: boolean;
}

class OpenAIProvider {
  readonly model = OPENAI_MODEL;
  readonly reasoningEffort = 'medium' as const;

  private async chatCompletion(messages: Array<{ role: string; content: string }>, timeoutMs: number) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey()}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: this.model,
        reasoning_effort: this.reasoningEffort,
        response_format: { type: 'json_object' },
        messages
      })
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenAI chat completion failed: HTTP ${response.status}: ${errText}`);
      throw new Error(`OPENAI_FAILED_${response.status}`);
    }
    return response;
  }

  private async jsonCompletion(messages: Array<{ role: string; content: string }>, timeoutMs: number): Promise<string> {
    const response = await this.chatCompletion(messages, timeoutMs);
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('OPENAI_INVALID_RESPONSE');
    return content;
  }

  /**
   * Responses API call with the hosted web_search tool. Returns the JSON text plus
   * every URL the search tool surfaced, so model-written citations can be verified.
   * If the model or account rejects the tool (HTTP 400), retries once without it.
   */
  private async webResearch(instructions: string, input: string, timeoutMs: number): Promise<OpenAIWebResult> {
    const call = (withSearch: boolean) => fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey()}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: this.model,
        reasoning: { effort: this.reasoningEffort },
        instructions,
        input,
        text: { format: { type: 'json_object' } },
        ...(withSearch ? { tools: [{ type: 'web_search' }], include: ['web_search_call.action.sources'] } : {})
      })
    });

    let searched = true;
    let response = await call(true);
    if (response.status === 400) {
      const errText = await response.text().catch(() => '');
      console.warn(`OpenAI web_search unavailable, retrying without search: ${errText.slice(0, 500)}`);
      searched = false;
      response = await call(false);
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenAI research failed: HTTP ${response.status}: ${errText}`);
      throw new Error(`OPENAI_FAILED_${response.status}`);
    }

    const body = await response.json();
    const seenUrls = new Map<string, { title: string; url: string }>();
    const queries: string[] = [];
    let outputText = '';
    const remember = (url: unknown, title: unknown) => {
      if (typeof url !== 'string') return;
      const key = canonicalUrl(url);
      if (!key) return;
      const existing = seenUrls.get(key);
      const cleanTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 300) : '';
      if (!existing || (!existing.title && cleanTitle)) seenUrls.set(key, { title: cleanTitle, url: url.slice(0, 4096) });
    };

    for (const item of Array.isArray(body.output) ? body.output : []) {
      if (item?.type === 'web_search_call') {
        const action = item.action || {};
        if (typeof action.query === 'string') queries.push(action.query);
        if (Array.isArray(action.queries)) queries.push(...action.queries.filter((q: unknown) => typeof q === 'string'));
        for (const source of Array.isArray(action.sources) ? action.sources : []) remember(source?.url, source?.title);
      } else if (item?.type === 'message') {
        for (const part of Array.isArray(item.content) ? item.content : []) {
          if (part?.type !== 'output_text' || typeof part.text !== 'string') continue;
          outputText += part.text;
          for (const annotation of Array.isArray(part.annotations) ? part.annotations : []) {
            if (annotation?.type === 'url_citation') remember(annotation.url, annotation.title);
          }
        }
      }
    }
    if (!outputText) throw new Error('OPENAI_INVALID_RESPONSE');
    return { text: outputText, seenUrls, queries: [...new Set(queries)], searched };
  }

  /** Keep only model-listed sources the search actually surfaced, then add remaining cited URLs. */
  private verifiedSources(modelSources: unknown, web: OpenAIWebResult, limit: number) {
    if (!web.searched) return [];
    const verified: Array<{ title: string; url: string }> = [];
    for (const source of Array.isArray(modelSources) ? modelSources : []) {
      const key = typeof source?.url === 'string' ? canonicalUrl(source.url) : null;
      const seen = key ? web.seenUrls.get(key) : undefined;
      if (seen) verified.push({ title: text(source.title, 300) || seen.title || new URL(seen.url).hostname, url: seen.url });
    }
    for (const seen of web.seenUrls.values()) {
      verified.push({ title: seen.title || new URL(seen.url).hostname, url: seen.url });
    }
    return dedupeSources(verified, limit);
  }

  async research(
    query: string,
    mode: ResearchMode,
    projectId: string,
    graph: KnowledgeGraph,
    onProgress: ResearchProgress = () => {}
  ): Promise<ResearchResultPayload> {
    if (!openAiKey()) throw new Error('OPENAI_NOT_CONFIGURED');

    const ragContext = await buildGraphRAGContext({
      projectId,
      graph,
      query,
      tokenBudget: 4000
    });

    const sourceRules = `Use the web_search tool to find evidence. List in "sources" only pages you actually opened or received from web_search; never write a URL from memory. Any source that was not returned by the search is discarded.`;

    if (mode === 'quick') {
      const instructions = `You are Synthex Studio's AI Research Engine running with medium reasoning depth.
Your goal is to transform research topics into structured knowledge graphs.
Rules:
1. Propose between 4 and 7 cohesive nodes: concepts, testable claims, hypotheses, and open questions.
2. A claim must enter the graph with explicit 'unverified' epistemic status until empirical evidence is linked.
3. Propose directional semantic relationships using tempIds: 'supports', 'contradicts', 'depends_on', 'answers', 'derived_from', 'extends'.
4. Ground your assertions in real-world facts and explain the rationale for each card.
5. ${sourceRules}
6. Return your response strictly as a JSON object with this exact structure ("subquestions": 3-5 exploratory research questions):
${RESEARCH_JSON_SHAPE}`;

      onProgress({ type: 'step', stepId: 'search', step: `Searching the web with ${this.model}...` });
      const web = await this.webResearch(
        instructions,
        `Research Mode: quick\nQuery: ${query}\n\nExisting Graph Knowledge Context:\n${ragContext.markdown}`,
        120000
      );
      for (const q of web.queries) onProgress({ type: 'query', query: q });

      const parsed = parseResearchJson(web.text, 'OPENAI');
      const sources = this.verifiedSources(parsed.sources, web, 8);
      onProgress({ type: 'step', stepId: 'synthesis', step: `Synthesizing ${parsed.nodes.length} knowledge cards and ${sources.length} verified sources...` });

      return {
        result: { summary: parsed.summary, subquestions: parsed.subquestions, nodes: parsed.nodes, relationships: parsed.relationships },
        sources,
        searchQueries: web.queries.length > 0 ? web.queries : [query],
        provider: 'OpenAI',
        model: this.model,
        reasoningEffort: this.reasoningEffort,
        usedFallback: false,
        ...(web.searched ? {} : { groundingNote: 'Web search was unavailable for this model; no sources were attached.' })
      };
    }

    // =========================================================================
    // Mode: Deep Research — plan investigative axes, then one web-grounded synthesis
    // =========================================================================
    onProgress({ type: 'step', stepId: 'axes', step: 'Decomposing inquiry into investigative axes...' });
    const decompPrompt = `You are Synthex Studio's Deep Research Planner.
Decompose this research inquiry into 3 distinct, complementary investigative axes:
1. Core theoretical foundations & architectural mechanics
2. Empirical benchmarks, latest real-world developments & practical findings
3. Limitations, open controversies, and counterarguments

Research Inquiry: ${query}
Existing Knowledge Context:
${ragContext.markdown}

Return strictly a JSON object:
{
  "axes": [
    { "name": "Foundations", "searchQuery": "string specific query", "focus": "string detailed focus" },
    { "name": "Empirical", "searchQuery": "string specific query", "focus": "string detailed focus" },
    { "name": "Counterarguments", "searchQuery": "string specific query", "focus": "string detailed focus" }
  ],
  "preliminaryHypotheses": ["string testable hypothesis 1", "string testable hypothesis 2"]
}`;

    let axesQueries: string[] = [];
    let preliminaryHypotheses: string[] = [];
    try {
      const decompContent = await this.jsonCompletion([{ role: 'user', content: decompPrompt }], 60000);
      const parsedDecomp = JSON.parse(decompContent);
      if (Array.isArray(parsedDecomp.axes)) {
        axesQueries = parsedDecomp.axes
          .map((a: { searchQuery?: string; focus?: string }) => a.searchQuery || a.focus)
          .filter((q: unknown): q is string => typeof q === 'string')
          .slice(0, 3);
      }
      if (Array.isArray(parsedDecomp.preliminaryHypotheses)) {
        preliminaryHypotheses = parsedDecomp.preliminaryHypotheses.filter((h: unknown): h is string => typeof h === 'string');
      }
    } catch (decompErr) {
      console.warn('Decomposition step failed, proceeding with template axes:', decompErr);
    }

    const investigativeAxes = axesQueries.length > 0 ? axesQueries : [
      `${query} foundations and mechanisms`,
      `${query} empirical evidence and benchmarks`,
      `${query} limitations and counterarguments`
    ];
    onProgress({ type: 'step', stepId: 'queries', step: 'Formulated investigative axes' });
    for (const axis of investigativeAxes) onProgress({ type: 'query', query: axis });

    const deepInstructions = `You are Synthex Studio's Autonomous Deep Research Engine running with medium reasoning depth.
You transform complex research inquiries into comprehensive, highly structured epistemic knowledge graphs.
Investigate the question across these axes, searching the web for each:
${[query, ...investigativeAxes].map((q, i) => `${i + 1}. ${q}`).join('\n')}

Rules:
1. Synthesize between 10 and 14 cohesive, highly informative cards: concepts, testable empirical claims, hypotheses, and open questions.
2. Every claim must have an explicit 'unverified' epistemic status until empirical evidence is linked.
3. Propose 12-18 directional semantic relationships between cards: 'supports', 'contradicts', 'depends_on', 'answers', 'derived_from', 'extends'.
4. ${sourceRules}
5. Emphasize epistemic contradictions, trade-offs, and empirical findings.
6. Return your response strictly as a JSON object with this exact structure ("summary": a multi-paragraph synthesis; "subquestions": 4-6 unresolved research questions):
${RESEARCH_JSON_SHAPE}`;

    const deepInput = `Research Mode: Deep Research
Primary Query: ${query}

Preliminary Hypotheses:
${preliminaryHypotheses.map(h => `• ${h}`).join('\n') || '• (none)'}

Existing Knowledge Context:
${ragContext.markdown}`;

    onProgress({ type: 'hop', hop: 1, description: `Searching the web across ${investigativeAxes.length} axes with ${this.model}...` });
    const web = await this.webResearch(deepInstructions, deepInput, 180000);
    for (const q of web.queries) onProgress({ type: 'query', query: q });

    onProgress({ type: 'hop', hop: 2, description: 'Verifying cited sources against search results...' });
    const parsed = parseResearchJson(web.text, 'OPENAI');
    const sources = this.verifiedSources(parsed.sources, web, 20);
    onProgress({ type: 'step', stepId: 'synthesis', step: `Synthesizing ${parsed.nodes.length} epistemic nodes and ${parsed.relationships.length} relationships...` });

    return {
      result: { summary: parsed.summary, subquestions: parsed.subquestions, nodes: parsed.nodes, relationships: parsed.relationships },
      sources,
      searchQueries: [...new Set([query, ...investigativeAxes, ...web.queries])].slice(0, 16),
      provider: 'OpenAI',
      model: this.model,
      reasoningEffort: this.reasoningEffort,
      usedFallback: false,
      ...(web.searched ? {} : { groundingNote: 'Web search was unavailable for this model; no sources were attached.' })
    };
  }
}

/* =====================================================================
   Gemini Provider (gemini-3.8-flash with Google Search Grounding)
===================================================================== */
type GroundingChunk = { web?: { title?: string; uri?: string } };

function groundedSources(chunks: GroundingChunk[], limit: number) {
  return dedupeSources(chunks.flatMap(chunk => {
    const url = chunk.web?.uri;
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{ title: String(chunk.web?.title || new URL(url).hostname).slice(0, 300), url: url.slice(0, 4096) }];
  }), limit);
}

function groundingQueries(grounding: { webSearchQueries?: unknown }): string[] {
  return Array.isArray(grounding?.webSearchQueries)
    ? grounding.webSearchQueries.filter((item: unknown): item is string => typeof item === 'string')
    : [];
}

class GeminiProvider {
  readonly model = GEMINI_MODEL;
  readonly fallbackModel = GEMINI_BACKUP_MODEL;

  private requestBody(prompt: string, schema: object, useSearch: boolean) {
    return JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        responseFormat: { text: { mimeType: 'application/json', schema } }
      }
    });
  }

  /** POST to the model, retrying once on the fallback model for rate limits (429) or overload (503). */
  private async post(body: string, timeoutMs: number) {
    const key = geminiKey();
    if (!key) throw new Error('GEMINI_NOT_CONFIGURED');

    const execute = (model: string) => fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
        body
      }
    );

    let model = this.model;
    let response = await execute(model);
    if (!response.ok && (response.status === 429 || response.status === 503) && this.model !== this.fallbackModel) {
      console.warn(`Gemini ${this.model} returned status ${response.status}. Retrying with ${this.fallbackModel}...`);
      model = this.fallbackModel;
      response = await execute(model);
    }
    if (!response.ok) {
      console.error('Gemini API returned status:', response.status);
      throw new Error(`GEMINI_FAILED_${response.status}`);
    }
    return { response, model };
  }

  private async generate(prompt: string, schema: object, useSearch: boolean) {
    const { response, model } = await this.post(this.requestBody(prompt, schema, useSearch), 120000);
    const body = await response.json();
    const candidate = body.candidates?.[0];
    const responseText = candidate?.content?.parts?.find((part: { text?: string }) => part.text)?.text;
    if (typeof responseText !== 'string') throw new Error('GEMINI_INVALID_RESPONSE');
    return { data: JSON.parse(responseText), grounding: candidate.groundingMetadata || {}, model };
  }

  async research(
    query: string,
    mode: ResearchMode,
    projectId: string,
    graph: KnowledgeGraph,
    onProgress: ResearchProgress = () => {}
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

    if (mode === 'quick') {
      const prompt = `Research this topic for a persistent knowledge graph. Mode: quick.\n\nQuery: ${query}\n\nExisting graph context:\n${ragContext.markdown}\n\nReturn at most ${maxNodes} proposed nodes and 12 semantic relationships. Include concepts, testable claims, and unresolved questions. A claim is always unverified until a human reviews it and links evidence. Do not invent sources, URLs, quotations, or citations. Explain the reason for each proposed node and the basis for each relationship. Make relationships between the proposed nodes using their tempIds. Use short stable tempIds. Prefer sourceable, specific claims. The search tool is enabled; use it to gather evidence and return a concise synthesis.`;

      onProgress({ type: 'step', stepId: 'search', step: 'Searching the web with Google Search grounding...' });
      const res = await this.generate(prompt, researchSchema, true);
      const result = res.data as ResearchGeneration;
      if (!result || typeof result.summary !== 'string' || !Array.isArray(result.nodes) || !Array.isArray(result.relationships)) {
        throw new Error('GEMINI_MALFORMED_OUTPUT');
      }
      const searchQueries = groundingQueries(res.grounding).slice(0, 10);
      for (const q of searchQueries) onProgress({ type: 'query', query: q });
      const sources = groundedSources(Array.isArray(res.grounding?.groundingChunks) ? res.grounding.groundingChunks : [], 8);
      onProgress({ type: 'step', stepId: 'synthesis', step: `Synthesizing ${result.nodes.length} knowledge cards and ${sources.length} grounded sources...` });

      return {
        result,
        sources,
        searchQueries: searchQueries.length > 0 ? searchQueries : [query],
        provider: 'Gemini',
        model: res.model,
        usedFallback: false
      };
    }

    // =========================================================================
    // Mode: Deep Research — Multi-Hop Recursive Google Search Grounding
    // =========================================================================
    onProgress({ type: 'hop', hop: 1, description: 'Hop 1: Searching the web & exploring the conceptual landscape...' });
    const hop1Prompt = `Hop 1 of Autonomous Deep Research: Conduct broad search-grounded investigation on:
Query: ${query}

Existing knowledge graph context:
${ragContext.markdown}

Use Google Search Grounding to explore the conceptual landscape. Propose up to 7 nodes, 8 relationships, and 3-4 specific subquestions exploring empirical benchmarks, edge cases, and counterarguments. Do not invent sources, URLs, quotations, or citations.`;

    const resHop1 = await this.generate(hop1Prompt, researchSchema, true);
    const dataHop1 = resHop1.data as ResearchGeneration;
    if (!dataHop1 || typeof dataHop1.summary !== 'string' || !Array.isArray(dataHop1.nodes)) {
      throw new Error('GEMINI_MALFORMED_OUTPUT');
    }
    const chunksHop1: GroundingChunk[] = Array.isArray(resHop1.grounding?.groundingChunks) ? resHop1.grounding.groundingChunks : [];
    const queriesHop1 = groundingQueries(resHop1.grounding);
    for (const q of queriesHop1) onProgress({ type: 'query', query: q });

    const followupSubquestions = Array.isArray(dataHop1.subquestions) && dataHop1.subquestions.length > 0
      ? dataHop1.subquestions.slice(0, 3)
      : [`${query} empirical evidence`, `${query} limitations trade-offs`];

    onProgress({ type: 'hop', hop: 2, description: `Hop 2: Deep-diving into ${followupSubquestions.length} follow-up questions...` });
    const hop2Prompt = `Hop 2 of Autonomous Deep Research: Deep dive into these specific unresolved subquestions and counterarguments uncovered in Hop 1:
${followupSubquestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Core Topic: ${query}
Use Google Search Grounding to find verified citations, empirical data, and opposing viewpoints. Propose up to 7 new cards (use tempIds starting with 'hop2-') and directional relationships connecting them back to foundational concepts. Do not invent sources, URLs, quotations, or citations.`;

    let dataHop2: ResearchGeneration | null = null;
    let chunksHop2: GroundingChunk[] = [];
    let queriesHop2: string[] = [];

    try {
      const resHop2 = await this.generate(hop2Prompt, researchSchema, true);
      dataHop2 = resHop2.data as ResearchGeneration;
      if (Array.isArray(resHop2.grounding?.groundingChunks)) chunksHop2 = resHop2.grounding.groundingChunks;
      queriesHop2 = groundingQueries(resHop2.grounding);
      for (const q of queriesHop2) onProgress({ type: 'query', query: q });
    } catch (hop2Err) {
      console.warn('Hop 2 in Gemini deep research failed, proceeding with Hop 1 results:', hop2Err);
      onProgress({ type: 'step', step: 'Hop 2 failed; continuing with Hop 1 findings...' });
    }

    const sources = groundedSources([...chunksHop1, ...chunksHop2], 20);
    const mergedNodes = [...dataHop1.nodes, ...(dataHop2?.nodes || [])].slice(0, 14);
    const mergedRels = [...(dataHop1.relationships || []), ...(dataHop2?.relationships || [])].slice(0, 18);
    const combinedSummary = dataHop2?.summary
      ? `${dataHop1.summary}\n\n**Deep Investigation Analysis:**\n${dataHop2.summary}`
      : dataHop1.summary;
    onProgress({ type: 'step', stepId: 'synthesis', step: `Synthesizing ${mergedNodes.length} epistemic nodes and ${mergedRels.length} relationships...` });

    return {
      result: {
        summary: combinedSummary,
        subquestions: [...new Set([...(dataHop1.subquestions || []), ...(dataHop2?.subquestions || [])])],
        nodes: mergedNodes,
        relationships: mergedRels
      },
      sources,
      // Real search queries only; follow-up subquestions are reported as prompts, not searches.
      searchQueries: [...new Set([...queriesHop1, ...queriesHop2])].slice(0, 16),
      provider: 'Gemini',
      model: resHop1.model,
      usedFallback: false
    };
  }
}

/* =====================================================================
   Public API: OpenAI primary, Gemini fallback (see providerPlan)
===================================================================== */
const openaiProvider = new OpenAIProvider();
const geminiProvider = new GeminiProvider();

export async function researchGraph(
  query: string,
  mode: ResearchMode,
  graph: KnowledgeGraph,
  projectId = 'default',
  onProgress?: ResearchProgress
): Promise<ResearchResultPayload> {
  return runWithFallback(
    'research',
    provider => (provider === 'OpenAI' ? openaiProvider : geminiProvider).research(query, mode, projectId, graph, onProgress),
    provider => onProgress?.({ type: 'step', step: `Primary provider failed; retrying research with ${provider}...` })
  );
}

/**
 * Streams research progress as it happens: each event is emitted by the provider
 * at the point the corresponding work starts or finishes.
 */
export async function* researchGraphStream(
  query: string,
  mode: ResearchMode,
  graph: KnowledgeGraph,
  projectId = 'default'
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

  researchGraph(query, mode, graph, projectId, event => { queue.push(event); signal(); })
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

/**
 * Background helper to update node embeddings and the keyword search index
 */
export function indexGraphNodes(projectId: string, nodes: CanvasNode[]) {
  syncGraphVectors(projectId, nodes).catch(err => {
    console.warn(`Search indexing error for project "${projectId}":`, err instanceof Error ? err.message : err);
  });
}
