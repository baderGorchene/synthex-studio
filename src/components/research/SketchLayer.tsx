'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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

type Rect = { x: number; y: number; width: number; height: number };

// Pen ink is cut away wherever there is text, so writing on the board stays readable under a scribble.
const TEXT_SELECTOR = '.knowledge-card, .relationship-label-layer text';
const TEXT_PAD = 1.5;

function strokeBounds(stroke: SketchStroke): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < stroke.points.length; i += 2) {
    minX = Math.min(minX, stroke.points[i]); maxX = Math.max(maxX, stroke.points[i]);
    minY = Math.min(minY, stroke.points[i + 1]); maxY = Math.max(maxY, stroke.points[i + 1]);
  }
  const half = widthOf(stroke) / 2;
  return { x: minX - half, y: minY - half, width: maxX - minX + half * 2, height: maxY - minY + half * 2 };
}

const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/** Line boxes of every piece of text that a pen stroke passes over, in world units. */
function measureText(canvas: Element, viewport: Viewport, pens: Rect[]): Rect[] {
  if (!pens.length) return [];
  const origin = canvas.getBoundingClientRect();
  const toWorld = (r: DOMRect): Rect => ({
    x: (r.left - origin.left - viewport.pan.x) / viewport.zoom,
    y: (r.top - origin.top - viewport.pan.y) / viewport.zoom,
    width: r.width / viewport.zoom,
    height: r.height / viewport.zoom
  });
  const boxes: Rect[] = [];
  const add = (r: DOMRect) => {
    if (r.width === 0 || r.height === 0) return;
    const box = toWorld(r);
    if (pens.some(pen => intersects(pen, box))) boxes.push({ x: box.x - TEXT_PAD, y: box.y - TEXT_PAD, width: box.width + TEXT_PAD * 2, height: box.height + TEXT_PAD * 2 });
  };
  const range = document.createRange();
  for (const element of Array.from(canvas.querySelectorAll(TEXT_SELECTOR))) {
    const bounds = toWorld(element.getBoundingClientRect());
    if (!pens.some(pen => intersects(pen, bounds))) continue;
    if (element instanceof SVGElement) { add(element.getBoundingClientRect()); continue; }
    element.querySelectorAll('textarea, input').forEach(field => add(field.getBoundingClientRect()));
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) add(rect);
    }
  }
  return boxes;
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

  const maskId = `sketch-text-mask-${useId().replace(/:/g, '')}`;
  const worldRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  const [textBoxes, setTextBoxes] = useState<Rect[]>([]);
  const penStrokes = strokes.filter(stroke => stroke.tool === 'pen');
  const markerStrokes = strokes.filter(stroke => stroke.tool === 'marker');
  const penBounds = [...penStrokes, ...(draft?.tool === 'pen' ? [draft] : [])].map(strokeBounds);
  const penKey = penBounds.map(b => `${b.x},${b.y},${b.width},${b.height}`).join('|');
  const penBoundsRef = useRef(penBounds);
  useLayoutEffect(() => {
    viewportRef.current = viewport;
    penBoundsRef.current = penBounds;
  });

  // Re-measure when strokes change or when cards move, resize, appear or are edited.
  useEffect(() => {
    const canvas = worldRef.current?.closest('.graph-canvas');
    if (!canvas) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTextBoxes(measureText(canvas, viewportRef.current, penBoundsRef.current)));
    };
    measure();
    if (!penBoundsRef.current.length) return () => cancelAnimationFrame(frame);
    const world = canvas.querySelector('.graph-world');
    // Panning only restyles the world itself, which leaves world coordinates unchanged.
    const observer = new MutationObserver(records => { if (records.some(record => record.target !== world)) measure(); });
    if (world) observer.observe(world, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    canvas.addEventListener('input', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('input', measure);
    };
  }, [penKey]);

  const worldStyle = { transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})` };

  return <>
    {/* Marker ink multiplies with the board like a real highlighter, so text shows through it. */}
    <div className="sketch-world is-marker-layer" style={worldStyle}>
      <svg className={`sketch-layer ${erasing ? 'is-erasing' : ''}`} width="1" height="1" aria-hidden="true">
        {markerStrokes.map(stroke => <StrokePath key={stroke.id} stroke={stroke} d={toPath(stroke.points)} />)}
        {draft?.tool === 'marker' && <StrokePath stroke={draft} d={toPath(draft.points)} />}
      </svg>
    </div>

    <div className="sketch-world" ref={worldRef} style={worldStyle}>
      <svg className={`sketch-layer ${erasing ? 'is-erasing' : ''}`} width="1" height="1" aria-hidden="true">
        {textBoxes.length > 0 && <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-1000000" y="-1000000" width="2000000" height="2000000">
            <rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="white" />
            {textBoxes.map((box, index) => <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} rx={2} fill="black" />)}
          </mask>
        </defs>}
        <g mask={textBoxes.length > 0 ? `url(#${maskId})` : undefined}>
          {penStrokes.map(stroke => <StrokePath key={stroke.id} stroke={stroke} d={toPath(stroke.points)} />)}
          {draft?.tool === 'pen' && <StrokePath stroke={draft} d={toPath(draft.points)} />}
        </g>
        {erasing && strokes.map(stroke => <path
          key={stroke.id}
          className="sketch-hit"
          d={toPath(stroke.points)}
          strokeWidth={Math.max(widthOf(stroke), 18 / viewport.zoom)}
          onPointerDown={event => { event.stopPropagation(); erase(stroke.id); }}
          onPointerEnter={event => { if (event.buttons === 1) erase(stroke.id); }}
        />)}
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
