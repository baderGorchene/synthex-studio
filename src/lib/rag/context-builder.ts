import type { CanvasNode, Connection } from '../../types/canvas';
import type { KnowledgeGraph } from '../graph.ts';
import { extractReasoningSubgraph } from './graph-walker.ts';
import { hybridSearch } from './vector-store.ts';

export interface GraphRAGContextOptions {
  projectId: string;
  graph: KnowledgeGraph;
  query: string;
  selectedNodeId?: string;
  tokenBudget?: number; // approximate token budget (chars / 4)
  maxNodes?: number;
}

export interface GraphRAGContextResult {
  markdown: string;
  json: string;
  retrievedNodeIds: string[];
  seedNodeIds: string[];
  totalNodesInGraph: number;
}

/**
 * Format a canvas node into concise markdown for LLM consumption
 */
function serializeNode(node: CanvasNode): string {
  const lines: string[] = [];
  const status = node.metadata?.claimStatus ? ` [Status: ${node.metadata.claimStatus}]` : '';
  const conf = node.metadata?.confidence ? ` (confidence: ${(node.metadata.confidence * 100).toFixed(0)}%)` : '';

  lines.push(`### [${node.type.toUpperCase()}] ${node.title} (ID: ${node.id})${status}${conf}`);

  if (node.content) {
    lines.push(node.content.trim());
  }
  if (node.description) {
    lines.push(`*Description*: ${node.description.trim()}`);
  }
  if (node.url) {
    lines.push(`*Source URL*: ${node.url}`);
  }
  if (Array.isArray(node.metadata?.evidence)) {
    const quotes = node.metadata.evidence.map(e => e.excerpt).filter(Boolean);
    if (quotes.length > 0) {
      lines.push(`*Grounded Evidence*: ${quotes.map(q => `"${q}"`).join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Builds an epistemic, multi-hop Graph RAG context using Hybrid Search (Dense + Sparse)
 * followed by HippoRAG Personalized PageRank graph walk.
 */
export async function buildGraphRAGContext(
  options: GraphRAGContextOptions
): Promise<GraphRAGContextResult> {
  const {
    projectId,
    graph,
    query,
    selectedNodeId,
    tokenBudget = 6000,
    maxNodes = 25
  } = options;

  const totalNodesInGraph = Object.keys(graph.nodesById).length;

  if (totalNodesInGraph === 0) {
    return {
      markdown: '*(Knowledge graph is currently empty)*',
      json: JSON.stringify({ nodes: [], relationships: [] }),
      retrievedNodeIds: [],
      seedNodeIds: [],
      totalNodesInGraph: 0
    };
  }

  // 1. Gather seed nodes
  const seedIds: string[] = [];
  if (selectedNodeId && graph.nodesById[selectedNodeId]) {
    seedIds.push(selectedNodeId);
  }

  if (query.trim()) {
    try {
      const searchHits = await hybridSearch(projectId, query, 5);
      for (const hit of searchHits) {
        if (graph.nodesById[hit.nodeId] && !seedIds.includes(hit.nodeId)) {
          seedIds.push(hit.nodeId);
        }
      }
    } catch (err) {
      console.warn('Hybrid search step in context builder:', err);
    }
  }

  // Fallback to top-degree or recent nodes if no seeds were activated
  if (seedIds.length === 0) {
    const allNodes = Object.values(graph.nodesById);
    // Sort by edge degree
    const degrees = new Map<string, number>();
    for (const edge of Object.values(graph.edgesById)) {
      degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
    }
    allNodes.sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0));
    seedIds.push(...allNodes.slice(0, 3).map(n => n.id));
  }

  // 2. Extract subgraph with HippoRAG Personalized PageRank & epistemic neighbor expansion
  const subgraph = extractReasoningSubgraph(graph, seedIds, {
    maxNodes,
    damping: 0.85
  });

  // 4. Token-budgeted serialization
  const maxCharBudget = tokenBudget * 4;
  let currentChars = 0;
  const includedNodes: CanvasNode[] = [];

  for (const node of subgraph.nodes) {
    const serialized = serializeNode(node);
    if (currentChars + serialized.length > maxCharBudget && includedNodes.length >= 3) {
      break;
    }
    includedNodes.push(node);
    currentChars += serialized.length + 4;
  }

  const includedNodeIds = new Set(includedNodes.map(n => n.id));
  const relevantEdges: Connection[] = subgraph.edges.filter(
    e => includedNodeIds.has(e.from) && includedNodeIds.has(e.to)
  );

  // 5. Construct Structured Markdown context
  const sections: string[] = [];

  sections.push(`## Active Knowledge Subgraph (${includedNodes.length} nodes retrieved from ${totalNodesInGraph} total)`);

  const nodesByType: Record<string, CanvasNode[]> = {};
  for (const n of includedNodes) {
    const type = n.type || 'concept';
    if (!nodesByType[type]) nodesByType[type] = [];
    nodesByType[type].push(n);
  }

  for (const [type, groupNodes] of Object.entries(nodesByType)) {
    sections.push(`\n### ${type.toUpperCase()}S`);
    for (const node of groupNodes) {
      sections.push(serializeNode(node));
    }
  }

  if (relevantEdges.length > 0) {
    sections.push('\n### SEMANTIC RELATIONSHIPS & EVIDENCE');
    for (const edge of relevantEdges) {
      const fromNode = graph.nodesById[edge.from];
      const toNode = graph.nodesById[edge.to];
      const fromTitle = fromNode?.title || edge.from;
      const toTitle = toNode?.title || edge.to;
      const label = edge.label ? ` --[${edge.label}]--> ` : ' ----> ';
      const evidence = edge.metadata?.evidence ? ` (Evidence: "${edge.metadata.evidence}")` : '';
      sections.push(`- **${fromTitle}** (ID: ${edge.from})${label}**${toTitle}** (ID: ${edge.to})${evidence}`);
    }
  }

  const markdown = sections.join('\n');
  const json = JSON.stringify({
    nodes: includedNodes.map(({ id, type, title, content, url, metadata }) => ({
      id,
      type,
      title,
      content: content?.slice(0, 1800),
      url,
      status: metadata?.claimStatus
    })),
    relationships: relevantEdges.map(({ from, to, label }) => ({ from, to, label }))
  });

  return {
    markdown,
    json,
    retrievedNodeIds: includedNodes.map(n => n.id),
    seedNodeIds: seedIds,
    totalNodesInGraph
  };
}
