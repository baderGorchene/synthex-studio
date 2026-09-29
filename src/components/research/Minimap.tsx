'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ChevronDown, Map, Maximize2 } from 'lucide-react';
import type { CanvasNode, Viewport } from '@/types/canvas';

interface MinimapProps {
  nodes: CanvasNode[];
  groups: CanvasNode[];
  viewport: Viewport;
  canvasSize: { width: number; height: number };
  nodeBounds: Record<string, { x: number; y: number; width: number; height: number }>;
  onPanTo: (pan: { x: number; y: number }) => void;
  onFitCanvas?: () => void;
  selectedNodeIds?: string[];
  draftIds?: Set<string>;
}

// Typeset Grid: kept ideas are ink, sources lighter; proof blue is reserved for drafts and selection.
const KEPT_COLOR = '#6B6F76';
const SOURCE_COLOR = '#A7AAAF';
const PROOF = '#1F3DFF';

const MAP_WIDTH = 190;
const MAP_HEIGHT = 120;
const PADDING = 140;

export function Minimap({
  nodes,
  groups,
  viewport,
  canvasSize,
  nodeBounds,
  onPanTo,
  onFitCanvas,
  selectedNodeIds = [],
  draftIds
}: MinimapProps) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('synthex_minimap_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const isDraggingLens = useRef(false);
  const minimapSvgRef = useRef<SVGSVGElement>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('synthex_minimap_expanded', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Keyboard shortcut: Press 'M' (when not in input/textarea) to toggle minimap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        const target = e.target as HTMLElement | null;
        if (target) {
          const tagName = target.tagName.toLowerCase();
          if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
            return;
          }
        }
        toggleOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOpen]);

  // Compute total world bounds encompassing all nodes + current viewport
  const { worldBounds, scale, offsetX, offsetY } = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Include all node bounds
    for (const node of nodes) {
      const box = nodeBounds[node.id] || { x: node.x, y: node.y, width: node.width || 280, height: 160 };
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }

    // Include groups
    for (const group of groups) {
      const box = nodeBounds[group.id] || { x: group.x, y: group.y, width: group.width || 540, height: group.height || 360 };
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }

    // Include current visible viewport in world coordinates
    const safeZoom = Math.max(0.1, viewport.zoom);
    const viewWorldLeft = -viewport.pan.x / safeZoom;
    const viewWorldTop = -viewport.pan.y / safeZoom;
    const viewWorldRight = viewWorldLeft + (canvasSize.width || 1200) / safeZoom;
    const viewWorldBottom = viewWorldTop + (canvasSize.height || 800) / safeZoom;

    minX = Math.min(minX, viewWorldLeft);
    minY = Math.min(minY, viewWorldTop);
    maxX = Math.max(maxX, viewWorldRight);
    maxY = Math.max(maxY, viewWorldBottom);

    if (!isFinite(minX) || !isFinite(maxX)) {
      minX = 0;
      maxX = 1200;
      minY = 0;
      maxY = 800;
    }

    const bounds = {
      left: minX - PADDING,
      top: minY - PADDING,
      width: Math.max(800, (maxX - minX) + PADDING * 2),
      height: Math.max(600, (maxY - minY) + PADDING * 2)
    };

    const s = Math.min(MAP_WIDTH / bounds.width, MAP_HEIGHT / bounds.height);
    const ox = (MAP_WIDTH - bounds.width * s) / 2;
    const oy = (MAP_HEIGHT - bounds.height * s) / 2;

    return { worldBounds: bounds, scale: s, offsetX: ox, offsetY: oy };
  }, [nodes, groups, nodeBounds, viewport, canvasSize]);

  // Viewport viewfinder box in minimap coordinates
  const lens = useMemo(() => {
    const safeZoom = Math.max(0.1, viewport.zoom);
    const viewWorldLeft = -viewport.pan.x / safeZoom;
    const viewWorldTop = -viewport.pan.y / safeZoom;
    const viewWorldWidth = (canvasSize.width || 1200) / safeZoom;
    const viewWorldHeight = (canvasSize.height || 800) / safeZoom;

    const x = offsetX + (viewWorldLeft - worldBounds.left) * scale;
    const y = offsetY + (viewWorldTop - worldBounds.top) * scale;
    const width = Math.max(12, viewWorldWidth * scale);
    const height = Math.max(8, viewWorldHeight * scale);

    return { x, y, width, height };
  }, [viewport, canvasSize, worldBounds, scale, offsetX, offsetY]);

  // Center the main viewport on a clicked or dragged minimap point
  const panToMinimapPoint = useCallback((clientX: number, clientY: number) => {
    const svg = minimapSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mapX = clientX - rect.left;
    const mapY = clientY - rect.top;

    // Convert minimap coordinate to world coordinate
    const worldX = worldBounds.left + (mapX - offsetX) / scale;
    const worldY = worldBounds.top + (mapY - offsetY) / scale;

    // Center screen on (worldX, worldY)
    const newPanX = (canvasSize.width || 1200) / 2 - worldX * viewport.zoom;
    const newPanY = (canvasSize.height || 800) / 2 - worldY * viewport.zoom;

    onPanTo({ x: newPanX, y: newPanY });
  }, [worldBounds, scale, offsetX, offsetY, canvasSize, viewport.zoom, onPanTo]);

  // Handle pointer down on minimap (start drag or jump click)
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingLens.current = true;
    panToMinimapPoint(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingLens.current) return;
      panToMinimapPoint(ev.clientX, ev.clientY);
    };

    const onPointerUp = () => {
      isDraggingLens.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!isOpen) {
    return (
      <div className="canvas-minimap-collapsed" title="Open minimap (M)">
        <button
          type="button"
          className="canvas-minimap-toggle-btn"
          onClick={toggleOpen}
          aria-label="Open canvas overview minimap"
        >
          <Map size={15} />
          <span className="minimap-toggle-text">Map</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="canvas-minimap-card"
      role="complementary"
      aria-label="Canvas overview minimap"
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="canvas-minimap-header">
        <div className="canvas-minimap-title-wrap">
          <Map size={13} className="text-[#6B6F76]" />
          <span className="canvas-minimap-title">Minimap</span>
          <span className="canvas-minimap-badge">{nodes.length}</span>
        </div>
        <div className="canvas-minimap-actions">
          {onFitCanvas && (
            <button
              type="button"
              className="canvas-minimap-action-btn"
              title="Fit entire knowledge graph to view"
              aria-label="Fit graph to view"
              onClick={onFitCanvas}
            >
              <Maximize2 size={12} />
            </button>
          )}
          <button
            type="button"
            className="canvas-minimap-action-btn"
            title="Collapse minimap (M)"
            aria-label="Collapse minimap"
            onClick={toggleOpen}
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <div className="canvas-minimap-surface">
        <svg
          ref={minimapSvgRef}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          className="canvas-minimap-svg"
          onPointerDown={handlePointerDown}
        >
          {/* Subtle background grid pattern */}
          <defs>
            <pattern id="minimap-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="rgba(17, 18, 20, 0.15)" />
            </pattern>
          </defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#minimap-grid)" />

          {/* Render Groups / Sections as dashed boundary boxes */}
          {groups.map(group => {
            const box = nodeBounds[group.id] || { x: group.x, y: group.y, width: group.width || 540, height: group.height || 360 };
            const gx = offsetX + (box.x - worldBounds.left) * scale;
            const gy = offsetY + (box.y - worldBounds.top) * scale;
            const gw = Math.max(8, box.width * scale);
            const gh = Math.max(6, box.height * scale);

            return (
              <rect
                key={group.id}
                x={gx}
                y={gy}
                width={gw}
                height={gh}
                rx="3"
                ry="3"
                fill="rgba(17, 18, 20, 0.04)"
                stroke="rgba(17, 18, 20, 0.25)"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
            );
          })}

          {/* Render individual cards as colored micro-nodes */}
          {nodes.map(node => {
            if (node.type === 'group' || node.type === 'section') return null;
            const box = nodeBounds[node.id] || { x: node.x, y: node.y, width: node.width || 280, height: 140 };
            const nx = offsetX + (box.x - worldBounds.left) * scale;
            const ny = offsetY + (box.y - worldBounds.top) * scale;
            const nw = Math.max(4, box.width * scale);
            const nh = Math.max(3, box.height * scale);

            const isSelected = selectedNodeIds.includes(node.id);
            const color = isSelected || draftIds?.has(node.id) ? PROOF : node.type === 'source' || node.type === 'link' ? SOURCE_COLOR : KEPT_COLOR;

            return (
              <rect
                key={node.id}
                x={nx}
                y={ny}
                width={nw}
                height={nh}
                rx="1.5"
                ry="1.5"
                fill={color}
                opacity={isSelected ? 1 : 0.78}
                stroke={isSelected ? '#ffffff' : 'none'} 
                strokeWidth={isSelected ? 1.5 : 0}
              >
                <title>{node.title || node.id}</title>
              </rect>
            );
          })}

          {/* Active Viewport Viewfinder Lens */}
          <rect
            x={lens.x}
            y={lens.y}
            width={lens.width}
            height={lens.height}
            rx="3"
            ry="3"
            className="canvas-minimap-lens"
          />
        </svg>
      </div>
    </div>
  );
}
