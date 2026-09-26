import type { CanvasNode, Connection, ConnectionPath, Coordinates } from '../types/canvas';

export function screenToCanvas(
  screenX: number,
  screenY: number,
  pan: Coordinates,
  zoom: number
): Coordinates {
  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom
  };
}

export function snapCoord(value: number, gridSize = 20): number {
  return Math.round(value / gridSize) * gridSize;
}

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
    const itemCount = node.items?.length || 0;
    return Math.max(90 + (itemCount > 0 ? 24 : 0) + itemCount * 30, 90);
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

export function calculateBoundingBox(nodes: CanvasNode[]) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 600, width: 1000, height: 600 };
  }

  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + (n.width || 300)));
  const maxY = Math.max(...nodes.map(n => n.y + getNodeHeight(n)));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Determine if a node's center coordinate sits inside a section's rectangle
 */
export function isNodeInsideSection(node: CanvasNode, section: CanvasNode): boolean {
  if (node.id === section.id || node.type === 'section') return false;

  const nodeW = node.width || 300;
  const nodeH = getNodeHeight(node);
  const centerX = node.x + nodeW / 2;
  const centerY = node.y + nodeH / 2;

  const secW = section.width || 600;
  const secH = section.height || 400;

  return (
    centerX >= section.x &&
    centerX <= section.x + secW &&
    centerY >= section.y &&
    centerY <= section.y + secH
  );
}

/**
 * Calculate the auto-expanded bounding box for a section to tightly contain all its member cards
 */
export function calculateSectionBoundingBox(
  section: CanvasNode,
  memberNodes: CanvasNode[],
  padding = 48
): { x: number; y: number; width: number; height: number } {
  if (memberNodes.length === 0) {
    return {
      x: section.x,
      y: section.y,
      width: Math.max(section.width || 600, 520),
      height: Math.max(section.height || 400, 360)
    };
  }

  const minX = Math.min(...memberNodes.map(n => n.x));
  const minY = Math.min(...memberNodes.map(n => n.y));
  const maxX = Math.max(...memberNodes.map(n => n.x + (n.width || 300)));
  const maxY = Math.max(...memberNodes.map(n => n.y + getNodeHeight(n)));

  const targetX = Math.min(section.x, minX - padding);
  const targetY = Math.min(section.y, minY - padding - 30); // 30px extra for section title bar
  const targetMaxX = Math.max(section.x + (section.width || 600), maxX + padding);
  const targetMaxY = Math.max(section.y + (section.height || 400), maxY + padding);

  return {
    x: Math.round(targetX / 20) * 20,
    y: Math.round(targetY / 20) * 20,
    width: Math.max(Math.round((targetMaxX - targetX) / 20) * 20, 520),
    height: Math.max(Math.round((targetMaxY - targetY) / 20) * 20, 360)
  };
}

/**
 * Compute an interactive curved rubber-band SVG path from a source card to current mouse coordinates
 */
export function calculateRubberBandPath(fromNode: CanvasNode, mousePos: Coordinates): string {
  const fromW = fromNode.width || 300;
  const fromH = getNodeHeight(fromNode);
  const startX = fromNode.x + fromW / 2;
  const startY = fromNode.y + fromH / 2;
  const endX = mousePos.x;
  const endY = mousePos.y;

  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  const curvature = Math.min(Math.max(dist * 0.35, 20), 100);

  const cp1X = startX + (dx > 0 ? curvature : -curvature);
  const cp1Y = startY;
  const cp2X = endX - (dx > 0 ? curvature : -curvature);
  const cp2Y = endY;

  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
}

