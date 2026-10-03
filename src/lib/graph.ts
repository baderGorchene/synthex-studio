import type { CanvasNode, Connection } from '../types/canvas';

export interface KnowledgeGraph {
  nodesById: Record<string, CanvasNode>;
  edgesById: Record<string, Connection>;
}

const compareById = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

export function normalizeGraph(nodes: CanvasNode[], edges: Connection[]): KnowledgeGraph {
  const nodesById: KnowledgeGraph['nodesById'] = Object.create(null);
  const edgesById: KnowledgeGraph['edgesById'] = Object.create(null);

  for (const node of nodes) {
    if (!node.id || !node.title || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new Error('Every node needs an id, title, and finite position.');
    }
    if (nodesById[node.id]) throw new Error(`Duplicate node id: ${node.id}`);
    nodesById[node.id] = node;
  }

  for (const edge of edges) {
    if (!edge.id || !edge.from || !edge.to) throw new Error('Every relationship needs an id and two endpoints.');
    if (edgesById[edge.id]) throw new Error(`Duplicate relationship id: ${edge.id}`);
    if (!nodesById[edge.from] || !nodesById[edge.to]) {
      throw new Error(`Relationship ${edge.id} points to a missing node.`);
    }
    if (edge.from === edge.to) throw new Error(`Relationship ${edge.id} cannot point to itself.`);
    edgesById[edge.id] = edge;
  }

  return { nodesById, edgesById };
}

export function addNode(graph: KnowledgeGraph, node: CanvasNode): KnowledgeGraph {
  if (graph.nodesById[node.id]) throw new Error(`Duplicate node id: ${node.id}`);
  return { ...graph, nodesById: { ...graph.nodesById, [node.id]: node } };
}

export function updateNode(graph: KnowledgeGraph, id: string, fields: Partial<CanvasNode>): KnowledgeGraph {
  const current = graph.nodesById[id];
  if (!current) return graph;
  return { ...graph, nodesById: { ...graph.nodesById, [id]: { ...current, ...fields, id } } };
}

export function addRelationship(graph: KnowledgeGraph, edge: Connection): KnowledgeGraph {
  if (graph.edgesById[edge.id]) return graph;
  if (!graph.nodesById[edge.from] || !graph.nodesById[edge.to]) {
    throw new Error('Both relationship endpoints must exist in the graph.');
  }
  if (edge.from === edge.to) return graph;
  const duplicate = Object.values(graph.edgesById).some(
    current => current.from === edge.from && current.to === edge.to && current.label === edge.label
  );
  if (duplicate) return graph;
  return { ...graph, edgesById: { ...graph.edgesById, [edge.id]: edge } };
}

export function updateRelationship(graph: KnowledgeGraph, id: string, fields: Partial<Connection>): KnowledgeGraph {
  const current = graph.edgesById[id];
  if (!current) return graph;
  const updated = { ...current, ...fields, id };
  if (!graph.nodesById[updated.from] || !graph.nodesById[updated.to] || updated.from === updated.to) {
    throw new Error('Both relationship endpoints must be distinct nodes in the graph.');
  }
  return { ...graph, edgesById: { ...graph.edgesById, [id]: updated } };
}

export function removeNode(graph: KnowledgeGraph, id: string): KnowledgeGraph {
  if (!graph.nodesById[id]) return graph;
  const nodesById = { ...graph.nodesById };
  delete nodesById[id];
  const edgesById = Object.fromEntries(
    Object.entries(graph.edgesById).filter(([, edge]) => edge.from !== id && edge.to !== id)
  );
  return { nodesById, edgesById };
}

/** Cards a user may attach to one chat question. */
export const CHAT_CONTEXT_LIMIT = 10;

/** Untrusted ids from a request: unique strings naming nodes in this graph, at most `limit`. */
export function pickContextNodeIds(graph: KnowledgeGraph, raw: unknown, limit = CHAT_CONTEXT_LIMIT): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  for (const id of raw) {
    if (ids.size >= limit) break;
    if (typeof id === 'string' && Object.hasOwn(graph.nodesById, id)) ids.add(id);
  }
  return [...ids];
}

export function neighborhood(graph: KnowledgeGraph, startId: string, depth = 1): Set<string> {
  if (!graph.nodesById[startId]) return new Set();
  const visited = new Set([startId]);
  let frontier = [startId];
  for (let step = 0; step < Math.max(0, Math.floor(depth)); step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of Object.values(graph.edgesById)) {
        const neighbor = edge.from === id ? edge.to : edge.to === id ? edge.from : undefined;
        if (neighbor && !visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

export function mermaidId(id: string): string {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const slug = id.normalize('NFKD').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28);
  return `node_${slug || 'item'}_${(hash >>> 0).toString(36)}`;
}

function safeMermaidLabel(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\|/g, '&#124;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>]/g, '');
}

function safeMarkdownHeading(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/([\\`*_{}\[\]<>])/g, '\\$1');
}

function safeSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function exportMermaid(graph: KnowledgeGraph): string {
  const lines = ['graph TD'];
  for (const node of Object.values(graph.nodesById).sort(compareById)) {
    lines.push(`  ${mermaidId(node.id)}["${safeMermaidLabel(node.title)}"]`);
  }
  for (const edge of Object.values(graph.edgesById).sort(compareById)) {
    const relation = safeMermaidLabel(edge.label || 'related to');
    lines.push(`  ${mermaidId(edge.from)} -->|${relation}| ${mermaidId(edge.to)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function exportContextMarkdown(graph: KnowledgeGraph, title: string): string {
  const nodes = Object.values(graph.nodesById).sort((a, b) =>
    a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
  );
  const edges = Object.values(graph.edgesById).sort(compareById);
  const sections = [`# ${safeMarkdownHeading(title.trim() || 'Knowledge graph')}`, '', '## Overview', '',
    `${nodes.length} nodes and ${edges.length} relationships.`, '', '## Knowledge'];

  for (const node of nodes.filter(item => item.type !== 'source' && item.type !== 'link')) {
    sections.push('', `### ${safeMarkdownHeading(node.title)}`, '', `Type: ${node.type}`);
    if (node.content?.trim()) sections.push('', node.content.trim());
    if (node.metadata?.claimStatus) sections.push('', `Evidence status: ${node.metadata.claimStatus.replaceAll('_', ' ')}`);
    if (node.metadata?.origin) sections.push('', `Origin: ${node.metadata.origin}`);
    if (node.metadata?.rationale) sections.push('', `Provenance: ${node.metadata.rationale}`);
    for (const evidence of node.metadata?.evidence || []) {
      const source = graph.nodesById[evidence.sourceId];
      sections.push('', `Evidence (${evidence.relation}): ${source?.title || evidence.sourceId}`);
      if (evidence.location) sections.push(`Location: ${evidence.location}`);
      if (evidence.excerpt) sections.push(`> ${evidence.excerpt.replace(/[\r\n]+/g, ' ')}`);
    }
  }

  sections.push('', '## Relationships');
  for (const edge of edges) {
    const from = graph.nodesById[edge.from]?.title || edge.from;
    const to = graph.nodesById[edge.to]?.title || edge.to;
    sections.push('', `- **${safeMarkdownHeading(from)}** — ${edge.label || 'related to'} → **${safeMarkdownHeading(to)}**`);
    if (edge.metadata?.evidence) sections.push(`  - Evidence: ${edge.metadata.evidence}`);
  }

  const sources = nodes.filter(node => node.type === 'source' || node.type === 'link');
  sections.push('', '## Sources');
  for (const source of sources) {
    const url = source.url ? safeSourceUrl(source.url) : undefined;
    sections.push('', `- ${safeMarkdownHeading(source.title)}${url ? ` — <${url}>` : ''}`);
    if (source.description?.trim()) sections.push(`  - ${source.description.trim()}`);
  }

  const questions = nodes.filter(node => node.type === 'question');
  sections.push('', '## Open questions');
  for (const question of questions) sections.push('', `- ${safeMarkdownHeading(question.title)}`);
  return `${sections.join('\n').trimEnd()}\n`;
}

export function exportGraphJson(graph: KnowledgeGraph): string {
  return JSON.stringify({
    version: 1,
    nodes: Object.values(graph.nodesById).sort(compareById),
    relationships: Object.values(graph.edgesById).sort(compareById)
  }, null, 2);
}

const DASHED_RELATIONS = new Set(['contradicts', 'challenges', 'refutes', 'disputes', 'replaces']);
const DOTTED_RELATIONS = new Set(['asks', 'answers', 'questions']);

/** Line grammar: a relation's meaning sets its stroke (solid supports, dashed challenges, dotted open questions). */
export function strokeForLabel(label = ''): NonNullable<Connection['strokePattern']> {
  const key = label.trim().toLowerCase().replace(/\s+/g, '_');
  if (DASHED_RELATIONS.has(key)) return 'dashed';
  if (DOTTED_RELATIONS.has(key)) return 'dotted';
  return 'solid';
}
