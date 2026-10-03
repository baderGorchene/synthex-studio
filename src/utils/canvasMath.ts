import type { CanvasNode, Connection, ConnectionPath } from '../types/canvas';
import { countTodos } from './todo.ts';

/**
 * Accurately calculate or estimate a node's rendered height based on its measured
 * height, content type, and internal elements so edge connectors dock with 0 gap.
 */
export function getNodeHeight(node: CanvasNode): number {
  if (node.height && node.height > 0) {
    return node.height;
  }
  if (node.type === 'section' || node.type === 'group') {
    return node.metadata?.collapsed ? 98 : (node.height || 360);
  }
  if (node.type === 'image') {
    return 290;
  }
  if (node.type === 'task') {
    const itemCount = countTodos(node.content, node.items);
    // title + add-item row, plus a progress line and one row per item
    return 124 + (itemCount > 0 ? 26 : 0) + itemCount * 28;
  }
  let h = 51;
  const titleLines = Math.max(1, Math.ceil((node.title?.length || 10) / 26));
  h += titleLines * 22;

  const isSource = node.type === 'source' || node.type === 'link';
  const previewImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);
  if (isSource && previewImage) {
    h += 127;
  }

  const content = node.content || node.description || node.caption || '';
  if (content) {
    const lines = Math.min(4, Math.max(1, Math.ceil(content.length / 35)));
    h += lines * 18 + 6;
  }

  if (isSource && (node.url || (node as unknown as { domain?: string }).domain)) {
    h += 32;
  }
  if (node.metadata?.evidence?.length) {
    h += 24;
  }

  return Math.max(124, Math.round(h));
}

export function calculateConnectionPaths(
  nodes: CanvasNode[],
  connections: Connection[]
): ConnectionPath[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const paths: ConnectionPath[] = [];

  for (const conn of connections) {
    const fromNode = nodeMap.get(conn.from);
    const toNode = nodeMap.get(conn.to);
    if (!fromNode || !toNode) continue;

    const fromW = fromNode.width || 280;
    const fromH = getNodeHeight(fromNode);
    const toW = toNode.width || 280;
    const toH = getNodeHeight(toNode);

    const fromCenter = { x: fromNode.x + fromW / 2, y: fromNode.y + fromH / 2 };
    const toCenter = { x: toNode.x + toW / 2, y: toNode.y + toH / 2 };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    const aspectWeight = (fromH + toH) / (fromW + toW);
    const isHorizontal = Math.abs(dx) * aspectWeight > Math.abs(dy);

    const start = { x: fromCenter.x, y: fromCenter.y };
    const end = { x: toCenter.x, y: toCenter.y };

    if (!isHorizontal) {
      if (dy >= 0) {
        start.y = fromNode.y + fromH;
        end.y = toNode.y;
      } else {
        start.y = fromNode.y;
        end.y = toNode.y + toH;
      }

      const overlapMin = Math.max(fromNode.x, toNode.x);
      const overlapMax = Math.min(fromNode.x + fromW, toNode.x + toW);
      if (overlapMax - overlapMin >= 24) {
        const dockX = (overlapMin + overlapMax) / 2;
        start.x = dockX;
        end.x = dockX;
      } else {
        start.x = Math.min(Math.max(toCenter.x, fromNode.x + 28), fromNode.x + fromW - 28);
        end.x = Math.min(Math.max(fromCenter.x, toNode.x + 28), toNode.x + toW - 28);
      }
    } else {
      if (dx >= 0) {
        start.x = fromNode.x + fromW;
        end.x = toNode.x;
      } else {
        start.x = fromNode.x;
        end.x = toNode.x + toW;
      }

      const overlapMin = Math.max(fromNode.y, toNode.y);
      const overlapMax = Math.min(fromNode.y + fromH, toNode.y + toH);
      if (overlapMax - overlapMin >= 20) {
        const dockY = (overlapMin + overlapMax) / 2;
        start.y = dockY;
        end.y = dockY;
      } else {
        start.y = Math.min(Math.max(toCenter.y, fromNode.y + 20), fromNode.y + fromH - 20);
        end.y = Math.min(Math.max(fromCenter.y, toNode.y + 20), toNode.y + toH - 20);
      }
    }

    let pathString = '';
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    if (conn.lineStyle === 'straight') {
      pathString = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    } else if (conn.lineStyle === 'stepped') {
      if (isHorizontal) {
        pathString = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      } else {
        pathString = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
      }
    } else {
      // Default: Curved cubic bezier with proper direction tangent
      if (isHorizontal) {
        const curvature = Math.min(Math.max(Math.abs(end.x - start.x) * 0.44, 36), 140);
        const cp1x = dx >= 0 ? start.x + curvature : start.x - curvature;
        const cp2x = dx >= 0 ? end.x - curvature : end.x + curvature;
        pathString = `M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`;
      } else {
        const curvature = Math.min(Math.max(Math.abs(end.y - start.y) * 0.44, 34), 140);
        const cp1y = dy >= 0 ? start.y + curvature : start.y - curvature;
        const cp2y = dy >= 0 ? end.y - curvature : end.y + curvature;
        pathString = `M ${start.x} ${start.y} C ${start.x} ${cp1y}, ${end.x} ${cp2y}, ${end.x} ${end.y}`;
      }
    }

    paths.push({
      ...conn,
      path: pathString,
      mid: {
        x: isHorizontal ? midX : midX + (dx >= 0 ? 8 : -8),
        y: isHorizontal ? midY - 10 : midY
      }
    });
  }

  return paths;
}

/**
 * Determine if a node's center coordinate sits inside a section's rectangle
 */
/**
 * Calculate the auto-expanded bounding box for a section to tightly contain all its member cards
 */
/**
 * Compute an interactive curved rubber-band SVG path from a source card to current mouse coordinates
 */
