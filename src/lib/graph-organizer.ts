import type { CanvasNode } from '../types/canvas';
import type { KnowledgeGraph } from './graph.ts';
import type { PositionDelta } from '../types/chat-tools';

export interface LayoutOptions {
  startX?: number;
  startY?: number;
  columnSpacing?: number;
  rowSpacing?: number;
}

/**
 * Organizes nodes into dedicated functional columns based on epistemic record type:
 * Column 1: Sources & Links
 * Column 2: Concepts & Notes
 * Column 3: Claims & Hypotheses
 * Column 4: Questions & AI Insights
 */
export function clusterByTypeLayout(
  graph: KnowledgeGraph,
  options: LayoutOptions = {}
): PositionDelta[] {
  const startX = options.startX ?? 120;
  const startY = options.startY ?? 120;
  const colSpacing = options.columnSpacing ?? 360;
  const rowSpacing = options.rowSpacing ?? 260;

  const typeColumns: Record<string, number> = {
    source: 0,
    link: 0,
    concept: 1,
    note: 1,
    claim: 2,
    hypothesis: 2,
    question: 3,
    ai_insight: 3,
    group: 1,
    section: 1,
    task: 3,
    image: 0,
    research_result: 3
  };

  const columnBuckets: Record<number, CanvasNode[]> = {
    0: [],
    1: [],
    2: [],
    3: []
  };

  for (const node of Object.values(graph.nodesById)) {
    const colIndex = typeColumns[node.type] ?? 1;
    columnBuckets[colIndex].push(node);
  }

  const positions: PositionDelta[] = [];

  for (let col = 0; col <= 3; col++) {
    const nodesInCol = columnBuckets[col];
    // Sort alphabetically by title for deterministic, clean presentation
    nodesInCol.sort((a, b) => a.title.localeCompare(b.title));

    for (let row = 0; row < nodesInCol.length; row++) {
      const node = nodesInCol[row];
      positions.push({
        id: node.id,
        x: Math.round(startX + col * colSpacing),
        y: Math.round(startY + row * rowSpacing)
      });
    }
  }

  return positions;
}

/**
 * Topologically layered hierarchical DAG layout:
 * Follows directional edges from upstream roots (sources, antecedent concepts)
 * to downstream claims, answers, and conclusions.
 */
export function hierarchicalLayout(
  graph: KnowledgeGraph,
  options: LayoutOptions = {}
): PositionDelta[] {
  const startX = options.startX ?? 120;
  const startY = options.startY ?? 120;
  const levelSpacing = options.columnSpacing ?? 380;
  const rankSpacing = options.rowSpacing ?? 250;

  const nodes = Object.values(graph.nodesById);
  if (nodes.length === 0) return [];

  // Compute in-degrees
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of Object.values(graph.edgesById)) {
    if (inDegree.has(edge.to)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
    if (adjacency.has(edge.from)) {
      adjacency.get(edge.from)?.push(edge.to);
    }
  }

  // Assign levels using BFS from root nodes (inDegree === 0)
  const nodeLevels = new Map<string, number>();
  const queue: string[] = [];

  for (const node of nodes) {
    if ((inDegree.get(node.id) || 0) === 0) {
      nodeLevels.set(node.id, 0);
      queue.push(node.id);
    }
  }

  // Handle cycle or graph without 0-degree nodes
  if (queue.length === 0 && nodes.length > 0) {
    nodeLevels.set(nodes[0].id, 0);
    queue.push(nodes[0].id);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentLevel = nodeLevels.get(currentId) || 0;
    const neighbors = adjacency.get(currentId) || [];

    for (const neighborId of neighbors) {
      const existingLevel = nodeLevels.get(neighborId);
      const nextLevel = currentLevel + 1;
      if (existingLevel === undefined || nextLevel > existingLevel) {
        nodeLevels.set(neighborId, nextLevel);
        queue.push(neighborId);
      }
    }
  }

  // Put any unreached disconnected components at level 0
  for (const node of nodes) {
    if (!nodeLevels.has(node.id)) {
      nodeLevels.set(node.id, 0);
    }
  }

  // Group nodes by level
  const levelGroups = new Map<number, CanvasNode[]>();
  for (const node of nodes) {
    const level = nodeLevels.get(node.id) || 0;
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(node);
  }

  const positions: PositionDelta[] = [];
  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const group = levelGroups.get(level)!;
    group.sort((a, b) => a.title.localeCompare(b.title));

    for (let i = 0; i < group.length; i++) {
      positions.push({
        id: group[i].id,
        x: Math.round(startX + level * levelSpacing),
        y: Math.round(startY + i * rankSpacing)
      });
    }
  }

  return positions;
}

/**
 * Arranges nodes into a compact balanced grid
 */
export function compactGridLayout(
  graph: KnowledgeGraph,
  options: LayoutOptions = {}
): PositionDelta[] {
  const startX = options.startX ?? 120;
  const startY = options.startY ?? 120;
  const colSpacing = options.columnSpacing ?? 340;
  const rowSpacing = options.rowSpacing ?? 240;

  const nodes = Object.values(graph.nodesById);
  if (nodes.length === 0) return [];

  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length * 1.5)));
  const positions: PositionDelta[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      id: nodes[i].id,
      x: Math.round(startX + col * colSpacing),
      y: Math.round(startY + row * rowSpacing)
    });
  }

  return positions;
}

/**
 * Universal layout runner for Chat Tool execution
 */
export function computeOrganizedLayout(
  graph: KnowledgeGraph,
  strategy: 'cluster_by_type' | 'hierarchical' | 'compact' = 'cluster_by_type'
): PositionDelta[] {
  switch (strategy) {
    case 'hierarchical':
      return hierarchicalLayout(graph);
    case 'compact':
      return compactGridLayout(graph);
    case 'cluster_by_type':
    default:
      return clusterByTypeLayout(graph);
  }
}
