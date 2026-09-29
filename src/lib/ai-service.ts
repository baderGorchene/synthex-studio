import type { ResearchMode, CanvasNode } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import type { ChatToolCall } from '../types/chat-tools';
import { buildGraphRAGContext } from './rag/context-builder.ts';
import { syncGraphVectors } from './rag/vector-store.ts';
import { auditGraphTopology } from './graph-analyst.ts';

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
  toolCall?: ChatToolCall | null;
}

export interface ChatStreamEvent {
  type: 'status' | 'thinking' | 'delta' | 'tool' | 'done' | 'error';
  status?: string;
  step?: string;
  text?: string;
  referencedNodeIds?: string[];
  model?: string;
  provider?: 'OpenAI' | 'Gemini';
  usedFallback?: boolean;
  toolCall?: ChatToolCall | null;
  error?: string;
}

function extractProgressiveAnswer(raw: string): string {
  const match = raw.match(/"answer"\s*:\s*"/);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  let text = '';
  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (char === '\\') {
      if (i + 1 < raw.length) {
        const next = raw[i + 1];
        if (next === '"') { text += '"'; i++; }
        else if (next === 'n') { text += '\n'; i++; }
        else if (next === 't') { text += '\t'; i++; }
        else if (next === '\\') { text += '\\'; i++; }
        else if (next === 'r') { i++; }
        else { text += next; i++; }
      }
    } else if (char === '"') {
      break;
    } else {
      text += char;
    }
  }
  return text;
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
  return (process.env.OPENAI_API_KEY || '').trim().replace(/^[\"']|[\"']$/g, '');
}

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim().replace(/^[\"']|[\"']$/g, '');
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

    const systemPrompt = `You are Synthex Studio's Agentic Knowledge Graph Assistant running with medium reasoning depth.
You answer user inquiries with strict epistemic rigor based on the provided Knowledge Graph context, and you have access to powerful tools to take action on behalf of the user.

Available Tools:
1. 'research': Execute web-grounded research on a topic to generate new knowledge cards staged for human review.
   Parameters: { "query": "string (specific research query)", "mode": "quick" | "deep" }
   Use when: The user asks to research a topic, explore a concept further, or find external grounding.

2. 'recommend_improvements': Audit graph topology for missing links, unverified claims, and blind spots.
   Parameters: { "focusArea": "string (optional specific topic or question to focus on)" }
   Use when: The user asks for recommendations, next steps, what is missing, or how to improve the graph.

3. 'propose_nodes': Propose adding or updating nodes and connections.
   Parameters: {
     "nodes": [{ "title": "string", "type": "concept" | "claim" | "question" | "hypothesis" | "note" | "source", "content": "string", "rationale": "string" }],
     "relationships": [{ "fromTitle": "string", "toTitle": "string", "label": "string", "evidence": "string" }]
   }
   Use when: The user asks to add, create, or link specific ideas, claims, or connections.

Rules:
1. Ground your reasoning strictly in the retrieved nodes, claims, and evidence links.
2. If the user's intent is best fulfilled by taking an action (researching, recommending, or creating nodes), generate the corresponding "toolCall".
3. If the user is simply asking a question, set "toolCall": null.
4. Reference only valid node IDs that directly support your claims.
5. Return your output strictly as a JSON object matching this schema:
{
  "answer": "string (markdown supported)",
  "referencedNodeIds": ["string array of node IDs cited in the answer"],
  "toolCall": {
    "tool": "research" | "recommend_improvements" | "propose_nodes",
    "parameters": { ... }
  } | null
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

    let toolCall: ChatToolCall | null = null;
    if (parsed.toolCall && typeof parsed.toolCall === 'object' && typeof parsed.toolCall.tool === 'string') {
      const tc = parsed.toolCall as ChatToolCall;
      if (tc.tool === 'recommend_improvements') {
        tc.analysis = auditGraphTopology(graph);
      }
      toolCall = tc;
    }

    return {
      answer: parsed.answer,
      referencedNodeIds,
      provider: 'OpenAI',
      model: this.model,
      reasoningEffort: this.reasoningEffort,
      toolCall
    };
  }

  async *chatStream(
    question: string,
    projectId: string,
    graph: KnowledgeGraph,
    selectedNodeId?: string
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const key = openAiKey();
    if (!key) throw new Error('OPENAI_NOT_CONFIGURED');

    yield { type: 'thinking', step: 'Retrieving graph subgraphs & semantic paths...' };

    const ragContext = await buildGraphRAGContext({
      projectId,
      graph,
      query: question,
      selectedNodeId,
      tokenBudget: 6000
    });

    yield { type: 'thinking', step: `Reasoning over graph with ${this.model} (${this.reasoningEffort} reasoning)...` };

    const systemPrompt = `You are Synthex Studio's Agentic Knowledge Graph Assistant running with medium reasoning depth.
You answer user inquiries with strict epistemic rigor based on the provided Knowledge Graph context, and you have access to powerful tools to take action on behalf of the user.

Available Tools:
1. 'research': Execute web-grounded research on a topic to generate new knowledge cards staged for human review.
   Parameters: { "query": "string (specific research query)", "mode": "quick" | "deep" }
   Use when: The user asks to research a topic, explore a concept further, or find external grounding.

2. 'recommend_improvements': Audit graph topology for missing links, unverified claims, and blind spots.
   Parameters: { "focusArea": "string (optional specific topic or question to focus on)" }
   Use when: The user asks for recommendations, next steps, what is missing, or how to improve the graph.

3. 'propose_nodes': Propose adding or updating nodes and connections.
   Parameters: {
     "nodes": [{ "title": "string", "type": "concept" | "claim" | "question" | "hypothesis" | "note" | "source", "content": "string", "rationale": "string" }],
     "relationships": [{ "fromTitle": "string", "toTitle": "string", "label": "string", "evidence": "string" }]
   }
   Use when: The user asks to add, create, or link specific ideas, claims, or connections.

Rules:
1. Ground your reasoning strictly in the retrieved nodes, claims, and evidence links.
2. If the user's intent is best fulfilled by taking an action (researching, recommending, or creating nodes), generate the corresponding "toolCall".
3. If the user is simply asking a question, set "toolCall": null.
4. Reference only valid node IDs that directly support your claims.
5. Return your output strictly as a JSON object matching this schema:
{
  "answer": "string (markdown supported)",
  "referencedNodeIds": ["string array of node IDs cited in the answer"],
  "toolCall": {
    "tool": "research" | "recommend_improvements" | "propose_nodes",
    "parameters": { ... }
  } | null
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
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenAI chat stream failed: HTTP ${response.status}: ${errText}`);
      throw new Error(`OPENAI_FAILED_${response.status}`);
    }

    if (!response.body) throw new Error('OPENAI_NO_STREAM_BODY');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let lastEmittedLength = 0;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        if (trimmed === 'data: [DONE]') continue;

        try {
          const json = JSON.parse(trimmed.slice(5).trim());
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            const currentAnswer = extractProgressiveAnswer(fullContent);
            if (currentAnswer.length > lastEmittedLength) {
              const newChars = currentAnswer.slice(lastEmittedLength);
              lastEmittedLength = currentAnswer.length;
              yield { type: 'delta', text: newChars };
            }
          }
        } catch {
          // ignore partial chunks
        }
      }
    }

    let parsed: {
      answer?: string;
      referencedNodeIds?: string[];
      toolCall?: ChatToolCall | null;
    } | null = null;
    try {
      parsed = JSON.parse(fullContent);
    } catch {
      try {
        const fixed = fullContent.trim().endsWith('}') ? fullContent : fullContent + '}';
        parsed = JSON.parse(fixed);
      } catch {
        parsed = { answer: extractProgressiveAnswer(fullContent) || fullContent, referencedNodeIds: [] };
      }
    }

    const referencedNodeIds = Array.isArray(parsed?.referencedNodeIds)
      ? parsed.referencedNodeIds.filter((id: string) => Boolean(graph.nodesById[id]))
      : [];

    let toolCall: ChatToolCall | null = null;
    if (parsed?.toolCall && typeof parsed.toolCall === 'object' && typeof parsed.toolCall.tool === 'string') {
      const tc = parsed.toolCall as ChatToolCall;
      if (tc.tool === 'recommend_improvements') {
        tc.analysis = auditGraphTopology(graph);
      }
      toolCall = tc;
      yield { type: 'tool', toolCall };
    }

    yield {
      type: 'done',
      text: parsed?.answer || '',
      referencedNodeIds,
      model: this.model,
      provider: 'OpenAI',
      usedFallback: false,
      toolCall
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

    if (mode === 'quick') {
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

      const userPrompt = `Research Mode: quick\nQuery: ${query}\n\nExisting Graph Knowledge Context:\n${ragContext.markdown}`;

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

    // =========================================================================
    // Mode: Deep Research — Autonomous Multi-Hop Decomposition & Synthesis
    // =========================================================================
    // Hop 1: Decompose inquiry into 3 targeted investigative axes
    const decompPrompt = `You are Synthex Studio's Deep Research Planner.
Decompose this research inquiry into 3 distinct, complementary investigative axes:
1. Core theoretical foundations & architectural mechanics
2. Empirical benchmarks, latest real-world developments & practical findings (2025-2026)
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
      const decompRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          model: this.model,
          reasoning_effort: 'medium',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: decompPrompt }]
        })
      });
      if (decompRes.ok) {
        const decompBody = await decompRes.json();
        const decompContent = decompBody.choices?.[0]?.message?.content;
        if (decompContent) {
          const parsedDecomp = JSON.parse(decompContent);
          if (Array.isArray(parsedDecomp.axes)) {
            axesQueries = parsedDecomp.axes
              .map((a: { searchQuery?: string; focus?: string }) => a.searchQuery || a.focus)
              .filter((q: unknown): q is string => typeof q === 'string');
          }
          if (Array.isArray(parsedDecomp.preliminaryHypotheses)) {
            preliminaryHypotheses = parsedDecomp.preliminaryHypotheses;
          }
        }
      }
    } catch (decompErr) {
      console.warn('Decomposition hop failed, proceeding with direct deep query:', decompErr);
    }

    const multiHopSearchQueries = [
      query,
      ...(axesQueries.length > 0 ? axesQueries : [
        `${query} architectural foundations and mechanisms`,
        `${query} empirical benchmarks 2025 2026`,
        `${query} limitations edge cases and counterarguments`
      ])
    ];

    // Hop 2: Recursive Deep Synthesis across all decomposed investigative axes
    const deepSystemPrompt = `You are Synthex Studio's Autonomous Deep Research Engine running with medium reasoning depth.
You transform complex, multi-hop research inquiries into comprehensive, highly structured epistemic knowledge graphs.
You have analyzed the research question across multiple investigative facets:
${multiHopSearchQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Rules:
1. Synthesize between 10 and 14 cohesive, highly informative cards: concepts, testable empirical claims, hypotheses, and open questions.
2. Every claim must have an explicit 'unverified' epistemic status until empirical evidence is linked.
3. Propose 12-18 directional semantic relationships between cards: 'supports', 'contradicts', 'depends_on', 'answers', 'derived_from', 'extends'.
4. Ground assertions in verified academic literature, technical documentation, or credible publications with authentic https:// URLs.
5. Emphasize epistemic contradictions, trade-offs, and empirical findings.
6. Return your response strictly as a JSON object with this exact structure:
{
  "summary": "Deep, multi-paragraph synthesis analyzing the research inquiry across all investigative axes, highlighting consensus, emerging empirical findings, and open debates.",
  "subquestions": ["string array of 4-6 unresolved research questions"],
  "sources": [{"title": "Publication, paper, or documentation title", "url": "https://..."}],
  "nodes": [
    {
      "tempId": "temp-1",
      "type": "concept" | "note" | "claim" | "question" | "hypothesis" | "ai_insight",
      "title": "Clear concise card title",
      "content": "Rich analytical content with factual depth, technical nuance, and statistics",
      "rationale": "Why this node belongs in the knowledge graph"
    }
  ],
  "relationships": [
    {
      "fromTempId": "temp-1",
      "toTempId": "temp-2",
      "label": "supports" | "contradicts" | "depends_on" | "answers" | "derived_from" | "extends",
      "evidence": "Quotation, empirical finding, or analytical evidence connecting them",
      "confidence": 0.88
    }
  ]
}`;

    const deepUserPrompt = `Research Mode: Deep Multi-Hop Research
Primary Query: ${query}

Investigative Axes:
${multiHopSearchQueries.map(q => `• ${q}`).join('\n')}

Preliminary Hypotheses:
${preliminaryHypotheses.map(h => `• ${h}`).join('\n')}

Existing Knowledge Context:
${ragContext.markdown}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(180000),
      body: JSON.stringify({
        model: this.model,
        reasoning_effort: this.reasoningEffort,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: deepSystemPrompt },
          { role: 'user', content: deepUserPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenAI deep research failed: HTTP ${response.status}: ${errText}`);
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
      searchQueries: multiHopSearchQueries,
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
  readonly model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  readonly fallbackModel = 'gemini-3.5-flash';

  private getEndpoint(model: string) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  private async generate(prompt: string, schema: object, useSearch: boolean) {
    const key = geminiKey();
    if (!key) throw new Error('GEMINI_NOT_CONFIGURED');

    const executeCall = async (model: string) => {
      return fetch(this.getEndpoint(model), {
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
    };

    let response = await executeCall(this.model);

    // Free-tier rate limit (429) or temporary capacity (503) fallback to gemini-3.5-flash
    if (!response.ok && (response.status === 429 || response.status === 503) && this.model !== this.fallbackModel) {
      console.warn(`Gemini Free Tier ${this.model} returned status ${response.status}. Retrying with free-tier fallback model ${this.fallbackModel}...`);
      response = await executeCall(this.fallbackModel);
    }

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
        referencedNodeIds: { type: 'ARRAY', items: { type: 'STRING' } },
        toolCall: {
          type: 'OBJECT',
          properties: {
            tool: { type: 'STRING' },
            parameters: {
              type: 'OBJECT',
              properties: {
                query: { type: 'STRING' },
                mode: { type: 'STRING' },
                focusArea: { type: 'STRING' },
                strategy: { type: 'STRING' }
              }
            }
          }
        }
      },
      required: ['answer', 'referencedNodeIds']
    };

    const prompt = `You are Synthex Studio's Agentic Knowledge Graph Assistant.
You answer user inquiries with strict epistemic rigor based on the provided Knowledge Graph context, and you have access to tools to take action:
1. 'research': Execute web-grounded research { "query": "...", "mode": "quick"|"deep" }
2. 'recommend_improvements': Audit graph topology for missing links, gaps, and improvements { "focusArea": "..." }
3. 'propose_nodes': Propose adding or updating nodes and connections.

If the user's intent requires an action or tool, include "toolCall". If the user is simply asking a question, omit toolCall.
Never invent sources or treat unverified claims as facts. Reference node IDs only when they directly support the answer.

Graph Context:
${ragContext.markdown}

Question: ${question}`;

    const res = await this.generate(prompt, chatSchema, false);
    const result = res.data as GraphAnswer & { toolCall?: ChatToolCall | null };
    if (!result || typeof result.answer !== 'string' || !Array.isArray(result.referencedNodeIds)) {
      throw new Error('GEMINI_MALFORMED_OUTPUT');
    }

    let toolCall: ChatToolCall | null = null;
    if (result.toolCall && typeof result.toolCall === 'object' && typeof result.toolCall.tool === 'string') {
      const tc = result.toolCall as ChatToolCall;
      if (tc.tool === 'recommend_improvements') {
        tc.analysis = auditGraphTopology(graph);
      }
      toolCall = tc;
    }

    return {
      answer: result.answer,
      referencedNodeIds: result.referencedNodeIds.filter(id => Boolean(graph.nodesById[id])).slice(0, 12),
      provider: 'Gemini',
      model: this.model,
      toolCall
    };
  }

  async *chatStream(
    question: string,
    projectId: string,
    graph: KnowledgeGraph,
    selectedNodeId?: string
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    yield { type: 'thinking', step: `Reasoning with ${this.model}...` };
    const res = await this.chat(question, projectId, graph, selectedNodeId);
    if (res.answer) {
      yield { type: 'delta', text: res.answer };
    }
    if (res.toolCall) {
      yield { type: 'tool', toolCall: res.toolCall };
    }
    yield {
      type: 'done',
      text: res.answer,
      referencedNodeIds: res.referencedNodeIds,
      model: this.model,
      provider: 'Gemini',
      usedFallback: true,
      toolCall: res.toolCall
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

    if (mode === 'quick') {
      const prompt = `Research this topic for a persistent knowledge graph. Mode: quick.\n\nQuery: ${query}\n\nExisting graph context:\n${ragContext.markdown}\n\nReturn at most ${maxNodes} proposed nodes and 12 semantic relationships. Include concepts, testable claims, and unresolved questions. A claim is always unverified until a human reviews it and links evidence. Do not invent sources, URLs, quotations, or citations. Explain the reason for each proposed node and the basis for each relationship. Make relationships between the proposed nodes using their tempIds. Use short stable tempIds. Prefer sourceable, specific claims. The search tool is enabled; use it to gather evidence and return a concise synthesis.`;

      const res = await this.generate(prompt, researchSchema, true);
      const result = res.data as ResearchGeneration;
      const groundedChunks = Array.isArray(res.grounding?.groundingChunks) ? res.grounding.groundingChunks : [];
      const sources = groundedChunks.flatMap((chunk: { web?: { title?: string; uri?: string } }) => {
        const url = chunk.web?.uri;
        if (!url || !/^https?:\/\//i.test(url)) return [];
        return [{ title: String(chunk.web?.title || new URL(url).hostname).slice(0, 300), url: url.slice(0, 4096) }];
      }).filter((source: { url: string }, index: number, list: Array<{ url: string }>) =>
        list.findIndex(item => item.url === source.url) === index
      ).slice(0, 8);

      const searchQueries = Array.isArray(res.grounding?.webSearchQueries)
        ? res.grounding.webSearchQueries.filter((item: unknown): item is string => typeof item === 'string').slice(0, 10)
        : [query];

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

    // =========================================================================
    // Mode: Deep Research — Multi-Hop Recursive Google Search Grounding
    // =========================================================================
    // Hop 1: Broad Landscape Grounding & Facet Exploration
    const hop1Prompt = `Hop 1 of Autonomous Deep Research: Conduct broad search-grounded investigation on:
Query: ${query}

Existing knowledge graph context:
${ragContext.markdown}

Use Google Search Grounding to explore the conceptual landscape. Propose up to 7 nodes, 8 relationships, and 3-4 specific subquestions exploring empirical benchmarks, edge cases, and counterarguments.`;

    const resHop1 = await this.generate(hop1Prompt, researchSchema, true);
    const dataHop1 = resHop1.data as ResearchGeneration;
    const chunksHop1 = Array.isArray(resHop1.grounding?.groundingChunks) ? resHop1.grounding.groundingChunks : [];
    const queriesHop1 = Array.isArray(resHop1.grounding?.webSearchQueries) ? resHop1.grounding.webSearchQueries : [query];

    const followupSubquestions = Array.isArray(dataHop1?.subquestions) && dataHop1.subquestions.length > 0
      ? dataHop1.subquestions.slice(0, 3)
      : [`${query} empirical benchmarks 2025 2026`, `${query} limitations trade-offs`];

    // Hop 2: Deep Grounded Investigation on follow-up facets
    const hop2Prompt = `Hop 2 of Autonomous Deep Research: Deep dive into these specific unresolved subquestions and counterarguments uncovered in Hop 1:
${followupSubquestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Core Topic: ${query}
Use Google Search Grounding to find verified citations, empirical data, and opposing viewpoints. Propose up to 7 new cards (use tempIds starting with 'hop2-') and directional relationships connecting them back to foundational concepts.`;

    let dataHop2: ResearchGeneration | null = null;
    let chunksHop2: Array<{ web?: { title?: string; uri?: string } }> = [];
    let queriesHop2: string[] = [];

    try {
      const resHop2 = await this.generate(hop2Prompt, researchSchema, true);
      dataHop2 = resHop2.data as ResearchGeneration;
      if (Array.isArray(resHop2.grounding?.groundingChunks)) chunksHop2 = resHop2.grounding.groundingChunks;
      if (Array.isArray(resHop2.grounding?.webSearchQueries)) queriesHop2 = resHop2.grounding.webSearchQueries;
    } catch (hop2Err) {
      console.warn('Hop 2 in Gemini deep research failed, proceeding with Hop 1 results:', hop2Err);
    }

    // Merge results, sources, and search queries across both hops
    const allChunks = [...chunksHop1, ...chunksHop2];
    const allQueries = [...new Set([...queriesHop1, ...queriesHop2, ...followupSubquestions])];

    const sources = allChunks.flatMap((chunk: { web?: { title?: string; uri?: string } }) => {
      const url = chunk.web?.uri;
      if (!url || !/^https?:\/\//i.test(url)) return [];
      return [{ title: String(chunk.web?.title || new URL(url).hostname).slice(0, 300), url: url.slice(0, 4096) }];
    }).filter((source: { url: string }, index: number, list: Array<{ url: string }>) =>
      list.findIndex(item => item.url === source.url) === index
    ).slice(0, 20);

    const mergedNodes = [...(dataHop1?.nodes || []), ...(dataHop2?.nodes || [])].slice(0, 14);
    const mergedRels = [...(dataHop1?.relationships || []), ...(dataHop2?.relationships || [])].slice(0, 18);
    const combinedSummary = dataHop2?.summary
      ? `${dataHop1.summary}\n\n**Deep Investigation Analysis:**\n${dataHop2.summary}`
      : (dataHop1?.summary || 'Deep research completed.');

    return {
      result: {
        summary: combinedSummary,
        subquestions: [...new Set([...(dataHop1?.subquestions || []), ...(dataHop2?.subquestions || [])])],
        nodes: mergedNodes,
        relationships: mergedRels
      },
      sources,
      searchQueries: allQueries.slice(0, 16),
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

export async function* askGraphStream(
  question: string,
  graph: KnowledgeGraph,
  selectedNodeId?: string,
  projectId = 'default'
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());

  if (!hasOpenAI && !hasGemini) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  // 1. Try OpenAI gpt-6-luna streaming first
  if (hasOpenAI && !hasSwitchedToFallback) {
    try {
      for await (const event of openaiProvider.chatStream(question, projectId, graph, selectedNodeId)) {
        yield event;
      }
      return;
    } catch (err) {
      console.warn('Primary OpenAI provider failed in chatStream:', err instanceof Error ? err.message : err);
      if (hasGemini) {
        hasSwitchedToFallback = true;
        yield { type: 'status', status: 'Switching to Gemini fallback...' };
        for await (const event of geminiProvider.chatStream(question, projectId, graph, selectedNodeId)) {
          yield event;
        }
        return;
      }
      throw err;
    }
  }

  // 2. Fallback to Gemini
  if (hasGemini) {
    try {
      for await (const event of geminiProvider.chatStream(question, projectId, graph, selectedNodeId)) {
        yield event;
      }
      return;
    } catch (geminiErr) {
      if (hasOpenAI) {
        hasSwitchedToFallback = false;
        yield { type: 'status', status: 'Switching back to OpenAI...' };
        for await (const event of openaiProvider.chatStream(question, projectId, graph, selectedNodeId)) {
          yield event;
        }
        return;
      }
      throw geminiErr;
    }
  }

  for await (const event of openaiProvider.chatStream(question, projectId, graph, selectedNodeId)) {
    yield event;
  }
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

export type ResearchStreamEvent =
  | { type: 'step'; step: string }
  | { type: 'query'; query: string }
  | { type: 'source'; source: { title: string; url: string } }
  | { type: 'hop'; hop: number; description: string }
  | { type: 'done'; result: ResearchResultPayload }
  | { type: 'error'; error: string };

export async function* researchGraphStream(
  query: string,
  mode: ResearchMode,
  graph: KnowledgeGraph,
  projectId = 'default'
): AsyncGenerator<ResearchStreamEvent, void, unknown> {
  const hasOpenAI = Boolean(openAiKey());
  const hasGemini = Boolean(geminiKey());

  if (!hasOpenAI && !hasGemini) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  yield {
    type: 'step',
    step: `Initializing ${mode === 'deep' ? 'Recursive Deep Multi-Hop' : 'Quick'} Research...`
  };

  if (mode === 'deep') {
    yield {
      type: 'step',
      step: 'Decomposing inquiry across 3 investigative axes (Theories, Empirical Benchmarks, Counterarguments)...'
    };
    yield { type: 'query', query: `${query} theoretical foundations & architecture` };
    yield { type: 'query', query: `${query} empirical benchmarks 2025-2026` };
    yield { type: 'query', query: `${query} limitations & counterarguments` };
    yield {
      type: 'hop',
      hop: 1,
      description: 'Hop 1: Querying web indices & exploring the conceptual landscape...'
    };
  } else {
    yield {
      type: 'step',
      step: `Searching web indices on "${query}"...`
    };
  }

  // Execute research with provider fallback resilience
  const res = await researchGraph(query, mode, graph, projectId);

  // Stream each discovered source live
  for (const source of res.sources) {
    yield { type: 'source', source };
  }

  if (mode === 'deep') {
    yield {
      type: 'hop',
      hop: 2,
      description: 'Hop 2: Deep-diving into unresolved subquestions, trade-offs & empirical data...'
    };
    yield {
      type: 'step',
      step: `Synthesizing ${res.result.nodes.length} epistemic nodes and ${res.result.relationships.length} relationships...`
    };
  } else {
    yield {
      type: 'step',
      step: `Synthesizing ${res.result.nodes.length} knowledge cards and citations...`
    };
  }

  yield {
    type: 'done',
    result: res
  };
}

/**
 * Background helper to update node embeddings and FTS5 search index
 */
export function indexGraphNodes(projectId: string, nodes: CanvasNode[]) {
  syncGraphVectors(projectId, nodes).catch(err => {
    console.warn(`Vector indexing error for project "${projectId}":`, err instanceof Error ? err.message : err);
  });
}

