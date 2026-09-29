import type { CanvasNode } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';

const isSource = (node: CanvasNode) => node.type === 'source' || node.type === 'link';
const readingOrder = (a: CanvasNode, b: CanvasNode) => a.y - b.y || a.x - b.x;

export type DocBlock = { node: CanvasNode; citations: number[] };
export type DocSection = { head?: CanvasNode; blocks: DocBlock[] };

/** The map read as a document: each question opens a section, linked ideas follow in board reading order, sources are numbered. */
export function buildDocument(graph: KnowledgeGraph): { sections: DocSection[]; sources: CanvasNode[] } {
  const nodes = Object.values(graph.nodesById).filter(node => !['group', 'section', 'image'].includes(node.type));
  const links = new Map<string, string[]>();
  for (const edge of Object.values(graph.edgesById)) {
    links.set(edge.from, [...(links.get(edge.from) || []), edge.to]);
    links.set(edge.to, [...(links.get(edge.to) || []), edge.from]);
  }
  const sources = nodes.filter(isSource).sort((a, b) => a.createdAt - b.createdAt || readingOrder(a, b));
  const sourceNumber = new Map(sources.map((source, index) => [source.id, index + 1]));
  const toBlock = (node: CanvasNode): DocBlock => ({
    node,
    citations: (links.get(node.id) || []).map(other => sourceNumber.get(other)).filter((n): n is number => n !== undefined).sort((a, b) => a - b)
  });

  const used = new Set<string>();
  const sections: DocSection[] = nodes.filter(node => node.type === 'question').sort(readingOrder).map(head => {
    used.add(head.id);
    const children = (links.get(head.id) || [])
      .map(id => graph.nodesById[id])
      .filter((node): node is CanvasNode => Boolean(node) && !isSource(node) && node.type !== 'question' && !used.has(node.id))
      .sort(readingOrder);
    children.forEach(child => used.add(child.id));
    return { head, blocks: children.map(toBlock) };
  });
  const rest = nodes.filter(node => !used.has(node.id) && !isSource(node) && node.type !== 'question').sort(readingOrder);
  if (rest.length) sections.push({ blocks: rest.map(toBlock) });
  return { sections, sources };
}

export function sourceHost(url?: string, domain?: string) {
  if (domain) return domain;
  try { return url ? new URL(url).hostname : ''; } catch { return ''; }
}
