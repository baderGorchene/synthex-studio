import type { KnowledgeGraph } from './graph';
import type { CanvasNode, CanvasConnection } from '@/types/canvas';
import { calculateConnectionPaths } from '../utils/canvasMath.ts';

export interface CanvasExportOptions {
  padding?: number;
  scale?: number; // 2 for Retina/Hi-DPI
  backgroundColor?: string;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  concept: { bg: '#e8f4f4', border: '#3c6e71', text: '#284b63' },
  claim: { bg: '#eef2f6', border: '#284b63', text: '#284b63' },
  source: { bg: '#f1f5f9', border: '#577590', text: '#353535' },
  link: { bg: '#f0f9ff', border: '#0284c7', text: '#0369a1' },
  question: { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' },
  hypothesis: { bg: '#eef2ff', border: '#6366f1', text: '#4338ca' },
  note: { bg: '#f8fafc', border: '#94a3b8', text: '#334155' },
  task: { bg: '#ecfdf5', border: '#10b981', text: '#047857' },
  ai_insight: { bg: '#ecfeff', border: '#06b6d4', text: '#0e7490' },
  research_result: { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' },
  group: { bg: 'rgba(60, 110, 113, 0.04)', border: 'rgba(60, 110, 113, 0.35)', text: '#3c6e71' },
  section: { bg: 'rgba(60, 110, 113, 0.04)', border: 'rgba(60, 110, 113, 0.35)', text: '#3c6e71' }
};

const RELATION_COLORS: Record<string, string> = {
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  indigo: '#6366f1',
  sky: '#0ea5e9',
  purple: '#a855f7',
  neutral: '#64748b'
};

function escapeXml(unsafe: string = ''): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates publication-ready standalone vector SVG markup from a KnowledgeGraph or node/edge arrays.
 * Clean, standard SVG with no external scripts, suitable for Figma, Illustrator, or browser viewing.
 */
export function generateStandaloneSvg(
  graphOrNodes: KnowledgeGraph | CanvasNode[],
  param2: string | CanvasConnection[] = 'Synthex Graph',
  param3: CanvasExportOptions | string = {},
  param4: CanvasExportOptions = {}
): string {
  let nodes: CanvasNode[] = [];
  let edges: CanvasConnection[] = [];
  let title = 'Synthex Graph';
  let options: CanvasExportOptions = {};

  if (Array.isArray(graphOrNodes)) {
    nodes = graphOrNodes;
    edges = Array.isArray(param2) ? param2 : [];
    title = typeof param3 === 'string' ? param3 : (typeof param2 === 'string' ? param2 : 'Synthex Graph');
    options = (typeof param3 === 'object' ? param3 : param4) || {};
  } else {
    nodes = Object.values(graphOrNodes?.nodesById ?? {});
    edges = Object.values(graphOrNodes?.edgesById ?? {});
    title = typeof param2 === 'string' ? param2 : 'Synthex Graph';
    options = (typeof param3 === 'object' ? param3 : {}) || {};
  }

  const padding = options.padding ?? 80;

  if (nodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="#ffffff"/><text x="300" y="200" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#64748b">Graph has no nodes.</text></svg>`;
  }

  // Calculate canvas bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const w = node.width || 280;
    const h = node.height || 140;
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + w);
    maxY = Math.max(maxY, node.y + h);
  }

  const width = Math.max(600, Math.round(maxX - minX + padding * 2));
  const height = Math.max(400, Math.round(maxY - minY + padding * 2));

  // Coordinate offset to center graph with padding
  const ox = padding - minX;
  const oy = padding - minY;

  const svgParts: string[] = [];

  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  svgParts.push(`<defs>`);
  svgParts.push(`  <style>`);
  svgParts.push(`    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&amp;display=swap');`);
  svgParts.push(`    text { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }`);
  svgParts.push(`    .card-title { font-size: 13px; font-weight: 650; fill: #1e293b; }`);
  svgParts.push(`    .card-type { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }`);
  svgParts.push(`    .card-body { font-size: 11px; fill: #475569; line-height: 1.4; }`);
  svgParts.push(`    .edge-label { font-size: 9.5px; font-weight: 600; fill: #334155; }`);
  svgParts.push(`  </style>`);

  // Markers for arrowheads
  for (const [colorName, colorHex] of Object.entries(RELATION_COLORS)) {
    svgParts.push(`  <marker id="arrow-${colorName}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto-start-reverse">`);
    svgParts.push(`    <path d="M0,0 L0,6 L7,3 z" fill="${colorHex}" />`);
    svgParts.push(`  </marker>`);
  }

  // Background dot grid pattern
  svgParts.push(`  <pattern id="export-dot-grid" width="22" height="22" patternUnits="userSpaceOnUse">`);
  svgParts.push(`    <circle cx="2" cy="2" r="1" fill="#e2e8f0" />`);
  svgParts.push(`  </pattern>`);
  svgParts.push(`</defs>`);

  // Background
  svgParts.push(`<rect width="100%" height="100%" fill="#ffffff" />`);
  svgParts.push(`<rect width="100%" height="100%" fill="url(#export-dot-grid)" />`);

  // Title Watermark
  svgParts.push(`<g opacity="0.6">`);
  svgParts.push(`  <text x="${padding}" y="${padding - 35}" font-size="16" font-weight="700" fill="#284b63">${escapeXml(title)}</text>`);
  svgParts.push(`  <text x="${padding}" y="${padding - 18}" font-size="10" font-weight="500" fill="#64748b">Synthex Studio Knowledge Graph · ${new Date().toLocaleDateString()}</text>`);
  svgParts.push(`</g>`);

  // 1. Render Clusters / Sections first (background frames)
  for (const node of nodes) {
    if (node.type !== 'group' && node.type !== 'section') continue;
    const nx = Math.round(node.x + ox);
    const ny = Math.round(node.y + oy);
    const nw = Math.round(node.width || 540);
    const nh = Math.round(node.height || 360);

    svgParts.push(`<g class="cluster-frame">`);
    svgParts.push(`  <rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" rx="10" ry="10" fill="rgba(60, 110, 113, 0.03)" stroke="#3c6e71" stroke-width="1.5" stroke-dasharray="6 4" />`);
    svgParts.push(`  <rect x="${nx}" y="${ny}" width="${nw}" height="32" rx="10" ry="10" fill="rgba(60, 110, 113, 0.08)" />`);
    svgParts.push(`  <text x="${nx + 14}" y="${ny + 21}" font-size="11" font-weight="700" fill="#284b63">${escapeXml(node.title || 'Cluster')}</text>`);
    svgParts.push(`</g>`);
  }

  // 2. Render Relationships (SVG paths with labels & markers)
  const shiftedNodes = nodes.map(n => ({
    ...n,
    x: n.x + ox,
    y: n.y + oy
  }));
  const connectionPaths = calculateConnectionPaths(shiftedNodes, edges);

  for (const cp of connectionPaths) {
    const colorKey = cp.color || 'neutral';
    const colorHex = RELATION_COLORS[colorKey] || '#64748b';

    const dashArray = cp.strokePattern === 'dotted' ? 'stroke-dasharray="2 4"' : cp.strokePattern === 'dashed' ? 'stroke-dasharray="6 4"' : '';
    const markerEnd = cp.arrowhead === 'none' || cp.arrowhead === 'start' ? '' : `marker-end="url(#arrow-${colorKey})"`;
    const markerStart = cp.arrowhead === 'both' || cp.arrowhead === 'start' ? `marker-start="url(#arrow-${colorKey})"` : '';

    svgParts.push(`<g class="relationship-connector">`);
    svgParts.push(`  <path d="${cp.path}" fill="none" stroke="${colorHex}" stroke-width="2" stroke-linecap="round" ${dashArray} ${markerEnd} ${markerStart} />`);

    if (cp.label) {
      const labelText = escapeXml(cp.label.replace(/_/g, ' '));
      const textWidth = Math.max(50, labelText.length * 6.5 + 14);
      svgParts.push(`  <rect x="${Math.round(cp.mid.x - textWidth / 2)}" y="${Math.round(cp.mid.y - 10)}" width="${textWidth}" height="20" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`);
      svgParts.push(`  <text x="${Math.round(cp.mid.x)}" y="${Math.round(cp.mid.y + 4)}" text-anchor="middle" class="edge-label" fill="${colorHex}">${labelText}</text>`);
    }
    svgParts.push(`</g>`);
  }


  // 3. Render Cards
  for (const node of nodes) {
    if (node.type === 'group' || node.type === 'section') continue;
    const nx = Math.round(node.x + ox);
    const ny = Math.round(node.y + oy);
    const nw = Math.round(node.width || 280);
    const nh = Math.round(node.height || 140);

    const style = TYPE_COLORS[node.type] || TYPE_COLORS.note;

    svgParts.push(`<g class="knowledge-card" transform="translate(${nx}, ${ny})">`);
    // Card Drop Shadow & Background
    svgParts.push(`  <rect x="0" y="2" width="${nw}" height="${nh}" rx="8" ry="8" fill="rgba(40, 75, 99, 0.08)" />`);
    svgParts.push(`  <rect x="0" y="0" width="${nw}" height="${nh}" rx="8" ry="8" fill="#ffffff" stroke="${style.border}" stroke-width="1.2" />`);

    // Type Badge Header
    svgParts.push(`  <rect x="0" y="0" width="${nw}" height="24" rx="8" ry="8" fill="${style.bg}" />`);
    svgParts.push(`  <rect x="0" y="16" width="${nw}" height="8" fill="${style.bg}" />`); // Square off bottom of header
    svgParts.push(`  <circle cx="12" cy="12" r="3.5" fill="${style.border}" />`);
    svgParts.push(`  <text x="22" y="15" class="card-type" fill="${style.text}">${escapeXml(node.type)}</text>`);

    // Status Pill (for claims)
    if (node.metadata?.claimStatus) {
      const statusText = String(node.metadata.claimStatus).toUpperCase();
      svgParts.push(`  <text x="${nw - 10}" y="15" text-anchor="end" font-size="8" font-weight="700" fill="${style.border}">${escapeXml(statusText)}</text>`);
    }

    // Card Title
    const titleText = escapeXml(node.title || 'Untitled');
    svgParts.push(`  <text x="14" y="44" class="card-title">${titleText.length > 34 ? titleText.slice(0, 32) + '…' : titleText}</text>`);

    // Card Content Snippet
    const content = node.content || node.description || '';
    if (content.trim()) {
      const line1 = escapeXml(content.slice(0, 42).replace(/\n/g, ' '));
      const line2 = content.length > 42 ? escapeXml(content.slice(42, 84).replace(/\n/g, ' ') + (content.length > 84 ? '…' : '')) : '';
      svgParts.push(`  <text x="14" y="66" class="card-body">${line1}</text>`);
      if (line2) svgParts.push(`  <text x="14" y="82" class="card-body">${line2}</text>`);
    }

    // Source domain / URL
    if (node.domain || node.url) {
      const domain = escapeXml(node.domain || node.url);
      svgParts.push(`  <text x="14" y="${nh - 12}" font-size="9" font-weight="500" fill="#0284c7">🔗 ${domain.length > 34 ? domain.slice(0, 32) + '…' : domain}</text>`);
    }

    svgParts.push(`</g>`);
  }

  svgParts.push(`</svg>`);
  return svgParts.join('\n');
}

/**
 * Exports KnowledgeGraph to a high-resolution PNG image Blob using HTML5 Canvas.
 * Generates an SVG string, draws onto an off-screen Canvas at high DPI (scale = 2),
 * and converts to a PNG Blob.
 */
export async function exportGraphToPng(
  graph: KnowledgeGraph,
  title: string = 'Synthex Graph',
  scale: number = 2
): Promise<Blob> {
  const svgMarkup = generateStandaloneSvg(graph, title);
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not create Canvas 2D context'));
          return;
        }

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to encode PNG Blob from canvas'));
          }
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load SVG into image for PNG rendering'));
    };

    img.src = svgDataUrl;
  });
}
