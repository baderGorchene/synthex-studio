import { CanvasNode, Connection, ConnectionPath, Coordinates } from '@/types/canvas';

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
  if (node.type === 'section') {
    return 420;
  }
  if (node.type === 'image') {
    return 290;
  }
  if (node.type === 'task') {
    const itemCount = node.items?.length || 0;
    // Header (~36px) + padding (~28px) + optional progress (~24px) + items (~30px each) + add button (~30px)
    return Math.max(90 + (itemCount > 0 ? 24 : 0) + itemCount * 30, 90);
  }
  if (node.type === 'link') {
    return 140;
  }
  if (node.type === 'note') {
    const len = (node.content || '').length;
    return len > 150 ? 220 : len > 50 ? 175 : 155;
  }
  return 140;
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

    const fromW = fromNode.width || 300;
    const fromH = getNodeHeight(fromNode);
    const toW = toNode.width || 300;
    const toH = getNodeHeight(toNode);

    const fromCenter = { x: fromNode.x + fromW / 2, y: fromNode.y + fromH / 2 };
    const toCenter = { x: toNode.x + toW / 2, y: toNode.y + toH / 2 };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    let start = { x: fromCenter.x, y: fromCenter.y };
    let end = { x: toCenter.x, y: toCenter.y };

    if (Math.abs(dx) > Math.abs(dy)) {
      start = dx > 0 ? { x: fromNode.x + fromW, y: fromCenter.y } : { x: fromNode.x, y: fromCenter.y };
      end = dx > 0 ? { x: toNode.x, y: toCenter.y } : { x: toNode.x + toW, y: toCenter.y };
    } else {
      start = dy > 0 ? { x: fromCenter.x, y: fromNode.y + fromH } : { x: fromCenter.x, y: fromNode.y };
      end = dy > 0 ? { x: toCenter.x, y: toNode.y } : { x: toCenter.x, y: toNode.y + toH };
    }

    let pathString = '';
    let mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

    if (conn.lineStyle === 'straight') {
      pathString = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    } else if (conn.lineStyle === 'stepped') {
      if (Math.abs(dx) > Math.abs(dy)) {
        const midX = (start.x + end.x) / 2;
        pathString = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
        mid = { x: midX, y: (start.y + end.y) / 2 };
      } else {
        const midY = (start.y + end.y) / 2;
        pathString = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
        mid = { x: (start.x + end.x) / 2, y: midY };
      }
    } else {
      // Default: Curved cubic bezier
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      const curvature = Math.min(Math.max(dist * 0.4, 30), 120);

      const cp1 = { x: start.x, y: start.y };
      const cp2 = { x: end.x, y: end.y };

      if (Math.abs(dx) > Math.abs(dy)) {
        const sign = dx > 0 ? 1 : -1;
        cp1.x += curvature * sign;
        cp2.x -= curvature * sign;
      } else {
        const sign = dy > 0 ? 1 : -1;
        cp1.y += curvature * sign;
        cp2.y -= curvature * sign;
      }

      pathString = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
      mid = {
        x: 0.125 * start.x + 0.375 * cp1.x + 0.375 * cp2.x + 0.125 * end.x,
        y: 0.125 * start.y + 0.375 * cp1.y + 0.375 * cp2.y + 0.125 * end.y
      };
    }

    paths.push({
      ...conn,
      path: pathString,
      mid
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

