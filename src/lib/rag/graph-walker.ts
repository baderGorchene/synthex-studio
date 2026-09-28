import type { CanvasNode, Connection } from '../../types/canvas';
import type { KnowledgeGraph } from '../graph.ts';

export interface ScoredNode {
  node: CanvasNode;
  score: number;
}

export interface ExtractedSubgraph {
  nodes: CanvasNode[];
  edges: Connection[];
  seedNodeIds: string[];
  totalScore: number;
}

export interface GraphWalkerOptions {
  damping?: number;        // Damping factor for PPR (default 0.85)
  maxIterations?: number;  // Max power iterations (default 25)
  convergenceThreshold?: number; // Epsilon threshold for convergence (default 1e-5)
  maxNodes?: number;       // Maximum nodes to extract in subgraph (default 20)
  minScoreThreshold?: number; // Minimum PPR score to include in subgraph (default 0.005)
}

/**
 * Semantic weights for canvas connection ontologies.
 * Contradictions and support receive amplified energy to ensure
 * epistemic evidence and refutations are surfaced in RAG retrieval.
 */
export const RELATION_WEIGHTS: Record<string, number> = {
  contradicts: 1.35,
  refutes: 1.35,
  supports: 1.15,
  answers: 1.25,
  depends_on: 1.0,
  derived_from: 1.0,
  extends: 0.95,
  related_to: 0.8,
  neutral: 0.8
};

/**
 * In-memory Personalized PageRank (PPR) engine inspired by HippoRAG.
 * Given a set of seed nodes from vector/lexical retrieval, propagates activation
 * across canvas edges to discover multi-hop conceptual chains and evidence paths.
 */
export function personalizedPageRank(
  graph: KnowledgeGraph,
  seedNodeIds: string[],
  options: GraphWalkerOptions = {}
): Map<string, number> {
  const damping = options.damping ?? 0.85;
  const maxIterations = options.maxIterations ?? 25;
  const epsilon = options.convergenceThreshold ?? 1e-5;

  const allNodeIds = Object.keys(graph.nodesById);
  const totalNodes = allNodeIds.length;

  if (totalNodes === 0) return new Map();

  // Filter seed nodes to valid existing nodes
  const validSeeds = seedNodeIds.filter(id => Boolean(graph.nodesById[id]));
  const effectiveSeeds = validSeeds.length > 0 ? validSeeds : allNodeIds;

  // Build weighted adjacency list (treating canvas graph as bidirectional with directional bias)
  // Forward edges receive full weight; reverse edges receive 0.7x weight so activation can flow both ways
  const adj = new Map<string, Array<{ to: string; weight: number }>>();
  const outWeights = new Map<string, number>();

  for (const id of allNodeIds) {
    adj.set(id, []);
    outWeights.set(id, 0);
  }

  for (const edge of Object.values(graph.edgesById)) {
    if (!graph.nodesById[edge.from] || !graph.nodesById[edge.to]) continue;

    const baseWeight = RELATION_WEIGHTS[edge.label || 'neutral'] || 0.85;

    // Forward link
    adj.get(edge.from)?.push({ to: edge.to, weight: baseWeight });
    outWeights.set(edge.from, (outWeights.get(edge.from) || 0) + baseWeight);

    // Backward link (reverse reasoning)
    const reverseWeight = baseWeight * 0.7;
    adj.get(edge.to)?.push({ to: edge.from, weight: reverseWeight });
    outWeights.set(edge.to, (outWeights.get(edge.to) || 0) + reverseWeight);
  }

  // Initialize seed distribution vector s
  const seedProb = 1 / effectiveSeeds.length;
  const s = new Map<string, number>();
  for (const id of allNodeIds) {
    s.set(id, 0);
  }
  for (const id of effectiveSeeds) {
    s.set(id, seedProb);
  }

  // Initial probability vector p^(0) = s
  let p = new Map<string, number>(s);

  // Power iteration: p^(t+1) = (1 - d) * s + d * (p^(t) * W)
  for (let iter = 0; iter < maxIterations; iter++) {
    const nextP = new Map<string, number>();
    for (const id of allNodeIds) {
      nextP.set(id, (1 - damping) * (s.get(id) || 0));
    }

    // Distribute rank mass across edges
    for (const [nodeId, currentRank] of p.entries()) {
      const neighbors = adj.get(nodeId) || [];
      const totalWeight = outWeights.get(nodeId) || 0;

      if (totalWeight > 0 && currentRank > 0) {
        for (const { to, weight } of neighbors) {
          const flow = damping * currentRank * (weight / totalWeight);
          nextP.set(to, (nextP.get(to) || 0) + flow);
        }
      } else if (currentRank > 0) {
        // Dangling node: distribute rank mass back into seed set
        for (const seedId of effectiveSeeds) {
          const flow = damping * currentRank * (1 / effectiveSeeds.length);
          nextP.set(seedId, (nextP.get(seedId) || 0) + flow);
        }
      }
    }

    // Check convergence (L1 norm difference)
    let diff = 0;
    for (const id of allNodeIds) {
      diff += Math.abs((nextP.get(id) || 0) - (p.get(id) || 0));
    }

    p = nextP;

    if (diff < epsilon) {
      break;
    }
  }

  return p;
}

/**
 * Extracts a high-relevance, connected subgraph around seed nodes using Personalized PageRank.
 * Retains direct and multi-hop paths, epistemic evidence links, and interconnecting edges.
 */
export function extractReasoningSubgraph(
  graph: KnowledgeGraph,
  seedNodeIds: string[],
  options: GraphWalkerOptions = {}
): ExtractedSubgraph {
  const maxNodes = options.maxNodes ?? 16;
  const minScore = options.minScoreThreshold ?? 0.005;

  if (Object.keys(graph.nodesById).length === 0) {
    return { nodes: [], edges: [], seedNodeIds: [], totalScore: 0 };
  }

  const pprScores = personalizedPageRank(graph, seedNodeIds, options);

  // Sort nodes by PPR score descending
  const rankedNodes: ScoredNode[] = Object.keys(graph.nodesById)
    .map(id => ({ node: graph.nodesById[id], score: pprScores.get(id) || 0 }))
    .sort((a, b) => b.score - a.score);

  // Guarantee seed nodes are included if valid, then fill with highest-ranking neighbors
  const selectedNodeIds = new Set<string>();
  const finalNodes: CanvasNode[] = [];
  let totalScore = 0;

  // 1. Add seeds first
  for (const seedId of seedNodeIds) {
    if (graph.nodesById[seedId] && !selectedNodeIds.has(seedId)) {
      selectedNodeIds.add(seedId);
      finalNodes.push(graph.nodesById[seedId]);
      totalScore += pprScores.get(seedId) || 0;
    }
  }

  // 2. Add top PPR nodes up to maxNodes
  for (const { node, score } of rankedNodes) {
    if (finalNodes.length >= maxNodes) break;
    if (selectedNodeIds.has(node.id)) continue;
    if (score < minScore && finalNodes.length >= 3) break;

    selectedNodeIds.add(node.id);
    finalNodes.push(node);
    totalScore += score;
  }

  // 3. Epistemic Evidence Expansion: For any selected claims, bring in their direct cited source nodes
  for (const node of [...finalNodes]) {
    if (node.metadata?.evidence && Array.isArray(node.metadata.evidence)) {
      for (const ev of node.metadata.evidence) {
        if (ev.sourceId && graph.nodesById[ev.sourceId] && !selectedNodeIds.has(ev.sourceId)) {
          if (finalNodes.length < maxNodes + 4) { // allow small overflow for direct evidence
            selectedNodeIds.add(ev.sourceId);
            finalNodes.push(graph.nodesById[ev.sourceId]);
            totalScore += pprScores.get(ev.sourceId) || 0;
          }
        }
      }
    }
  }

  // 4. Collect all interconnecting edges between the selected nodes
  const finalEdges: Connection[] = Object.values(graph.edgesById).filter(
    edge => selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to)
  );

  return {
    nodes: finalNodes,
    edges: finalEdges,
    seedNodeIds,
    totalScore
  };
}
