'use client';

import { useRef, useState } from 'react';
import type { Viewport } from '@/types/canvas';
import type { SketchStyle } from './inkPalette';

/** Freehand pen and marker marks on the board. They never enter the graph, the document or AI context. */
// points are flat [x, y, x, y…] in world units; strokes saved before colours existed have no color/width and keep the ink look.
export interface SketchStroke { id: string; tool: 'pen' | 'marker'; points: number[]; color?: string; width?: number }
export type SketchTool = 'pen' | 'marker' | 'eraser';

const LEGACY_WIDTH = { pen: 2.25, marker: 16 };
const widthOf = (stroke: SketchStroke) => stroke.width ?? LEGACY_WIDTH[stroke.tool];

function StrokePath({ stroke, d }: { stroke: SketchStroke; d: string }) {
  return <path className={`sketch-stroke is-${stroke.tool} ${stroke.color ? '' : 'is-legacy'}`} d={d} strokeWidth={widthOf(stroke)} stroke={stroke.color} />;
}

// Smooth the pointer samples with quadratic curves through their midpoints.
function toPath(p: number[]) {
  if (p.length < 4) return `M ${p[0]} ${p[1]} l 0.01 0`;
  let d = `M ${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    d += ` Q ${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  }
  return `${d} L ${p[p.length - 2]} ${p[p.length - 1]}`;
}

export function SketchLayer({ tool, viewport, strokes, style, onChange }: {
  tool: string;
  style: SketchStyle;
  viewport: Viewport;
  strokes: SketchStroke[];
  onChange: (update: (strokes: SketchStroke[]) => SketchStroke[]) => void;
}) {
  const [draft, setDraft] = useState<SketchStroke | null>(null);
  const drawing = useRef<SketchStroke | null>(null);
  const drawTool = tool === 'pen' || tool === 'marker' ? tool : null;
  const erasing = tool === 'eraser';

  const toWorld = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.round(((event.clientX - rect.left - viewport.pan.x) / viewport.zoom) * 10) / 10,
      Math.round(((event.clientY - rect.top - viewport.pan.y) / viewport.zoom) * 10) / 10
    ];
  };

  const erase = (id: string) => onChange(current => current.filter(stroke => stroke.id !== id));

  return <>
    <div className="sketch-world" style={{ transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})` }}>
      <svg className={`sketch-layer ${erasing ? 'is-erasing' : ''}`} width="1" height="1" aria-hidden="true">
        {strokes.map(stroke => {
          const d = toPath(stroke.points);
          return <g key={stroke.id}>
            <StrokePath stroke={stroke} d={d} />
            {erasing && <path
              className="sketch-hit"
              d={d}
              strokeWidth={Math.max(widthOf(stroke), 18 / viewport.zoom)}
              onPointerDown={event => { event.stopPropagation(); erase(stroke.id); }}
              onPointerEnter={event => { if (event.buttons === 1) erase(stroke.id); }}
            />}
          </g>;
        })}
        {draft && <StrokePath stroke={draft} d={toPath(draft.points)} />}
      </svg>
    </div>

    {drawTool && <div
      className={`sketch-capture is-${drawTool}`}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* keep drawing without capture */ }
        const { color, width } = style[drawTool];
        drawing.current = {
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          tool: drawTool, color, width, points: toWorld(event)
        };
        setDraft(drawing.current);
      }}
      onPointerMove={event => {
        const current = drawing.current;
        if (!current) return;
        const [x, y] = toWorld(event);
        const px = current.points[current.points.length - 2], py = current.points[current.points.length - 1];
        if (Math.hypot(x - px, y - py) < 1.5 / viewport.zoom) return; // drop near-duplicate samples to keep saved strokes small
        drawing.current = { ...current, points: [...current.points, x, y] };
        setDraft(drawing.current);
      }}
      onPointerUp={() => {
        const finished = drawing.current;
        if (finished) onChange(current => [...current, finished]);
        drawing.current = null;
        setDraft(null);
      }}
      onPointerCancel={() => { drawing.current = null; setDraft(null); }}
    />}
  </>;
}
