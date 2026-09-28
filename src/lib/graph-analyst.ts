import type { KnowledgeGraph } from './graph.ts';
import type { GraphAuditAnalysis, RecommendedConnection } from '../types/chat-tools';

/**
 * Performs a topological and epistemic audit of the knowledge graph
 * to generate actionable recommendations and research improvements.
 */
export function auditGraphTopology(graph: KnowledgeGraph): GraphAuditAnalysis {
  const nodes = Object.values(graph.nodesById);
  const edges = Object.values(graph.edgesById);

  // 1. Calculate degrees and edge maps
  const nodeDegrees = new Map<string, number>();
  const connectedPairs = new Set<string>();
  const answerEdges = new Set<string>();

  for (const node of nodes) {
    nodeDegrees.set(node.id, 0);
  }

  for (const edge of edges) {
    nodeDegrees.set(edge.from, (nodeDegrees.get(edge.from) || 0) + 1);
    nodeDegrees.set(edge.to, (nodeDegrees.get(edge.to) || 0) + 1);
    connectedPairs.add(`${edge.from}->${edge.to}`);
    connectedPairs.add(`${edge.to}->${edge.from}`);

    if (edge.label?.toLowerCase().includes('answer')) {
      answerEdges.add(edge.from);
      answerEdges.add(edge.to);
    }
  }

  // 2. Unverified claims
  const unverifiedClaims = nodes
    .filter(n => n.type === 'claim' && (!n.metadata?.claimStatus || n.metadata.claimStatus === 'unverified'))
    .map(n => ({ id: n.id, title: n.title }));

  // 3. Isolated / Orphaned nodes
  const isolatedNodes = nodes
    .filter(n => (nodeDegrees.get(n.id) || 0) === 0)
    .map(n => ({ id: n.id, title: n.title, type: n.type }));

  // 4. Open, unanswered questions
  const openQuestions = nodes
    .filter(n => n.type === 'question' && !answerEdges.has(n.id))
    .map(n => ({ id: n.id, title: n.title }));

  // 5. Suggested connection recommendations
  // Find pairs of concepts/claims that share keywords in title or content but are unconnected
  const suggestedConnections: RecommendedConnection[] = [];
  const keywordMap = new Map<string, Set<string>>();

  for (const node of nodes) {
    const text = `${node.title} ${node.content || ''}`.toLowerCase();
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !['about', 'which', 'their', 'there', 'where', 'these', 'would', 'could', 'should'].includes(w));
    keywordMap.set(node.id, new Set(words));
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (connectedPairs.has(`${a.id}->${b.id}`)) continue;

      const wordsA = keywordMap.get(a.id)!;
      const wordsB = keywordMap.get(b.id)!;

      let shared = 0;
      let sharedWord = '';
      for (const word of wordsA) {
        if (wordsB.has(word)) {
          shared++;
          if (!sharedWord) sharedWord = word;
        }
      }

      if (shared >= 2) {
        let label = 'related_to';
        if (a.type === 'claim' && b.type === 'concept') label = 'addresses';
        else if (a.type === 'source' && b.type === 'claim') label = 'supports';
        else if (a.type === 'concept' && b.type === 'question') label = 'answers';

        suggestedConnections.push({
          fromId: a.id,
          toId: b.id,
          fromTitle: a.title,
          toTitle: b.title,
          label,
          reason: `Both records share themes around "${sharedWord}".`
        });

        if (suggestedConnections.length >= 6) break;
      }
    }
    if (suggestedConnections.length >= 6) break;
  }

  // 6. Formulate high-priority research topics from gaps
  const suggestedTopics: string[] = [];
  if (unverifiedClaims.length > 0) {
    suggestedTopics.push(`Empirical verification of: "${unverifiedClaims[0].title}"`);
  }
  if (openQuestions.length > 0) {
    suggestedTopics.push(openQuestions[0].title);
  }
  if (isolatedNodes.length > 0) {
    suggestedTopics.push(`Contextual integration for: "${isolatedNodes[0].title}"`);
  }
  if (suggestedTopics.length === 0 && nodes.length > 0) {
    suggestedTopics.push(`Deep dive into: "${nodes[0].title}" counterarguments and trade-offs`);
  }

  return {
    unverifiedClaims,
    isolatedNodes,
    openQuestions,
    suggestedTopics,
    suggestedConnections
  };
}
