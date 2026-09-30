'use client';

import { Caveat } from 'next/font/google';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const hand = Caveat({ subsets: ['latin'], weight: ['500', '700'] });

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Size = { width: number; height: number };

type GuideNote = {
  id: string;
  /** CSS selector of the interface element the arrow points at. */
  target: string;
  /** Lines of handwriting. Wrap a phrase in *asterisks* to ink it in blue. */
  lines: string[];
  /** Where the note sits, given the target box and the note's own size. Later spots are fallbacks for tight screens. */
  place: (target: Box, note: Size) => Array<{ x: number; y: number }>;
  /** How much the arrow curves; the sign picks the side. */
  bend?: number;
  /** Also scribble a loop around the target. */
  circle?: boolean;
  tilt?: number;
};

// Listed in priority order: when space runs out, later notes are dropped first.
const NOTES: GuideNote[] = [
  {
    id: 'composer',
    target: '.map-start .composer textarea',
    lines: ['*Start here!* Ask a question,', 'dump your thoughts or paste notes.', 'AI only drafts: you keep what\'s right.'],
    place: (t, n) => [{ x: t.right + 64, y: t.top - 6 }, { x: t.right + 36, y: t.top - n.height - 40 }, { x: t.right - n.width, y: t.bottom + 130 }],
    bend: -0.4,
    tilt: 2
  },
  {
    id: 'note',
    target: '.map-start .composer .line-button',
    lines: ['...or build it *by hand*,', 'one note at a time'],
    place: (t, n) => [{ x: t.left - n.width - 36, y: t.bottom + 66 }, { x: t.left + 10, y: t.bottom + 96 }],
    bend: 0.3,
    circle: true,
    tilt: -3
  },
  {
    id: 'tools',
    target: '.canvas-tool-dock .sidebar-tool-row > button:nth-of-type(2)',
    lines: ['*Select* · *connect* ideas · *pan*', 'shortcuts: V · C · H'],
    place: t => [{ x: t.right + 64, y: t.top - 44 }, { x: t.right + 36, y: t.top - 40 }],
    bend: 0.3,
    tilt: -2
  },
  {
    id: 'draw',
    target: '.canvas-tool-dock .dock-draw-tools',
    lines: ['Pen, marker & eraser:', '*doodle freely*, sketches', 'never touch your map'],
    place: t => [{ x: t.right + 70, y: t.top + 4 }, { x: t.right + 36, y: t.top + 4 }],
    bend: -0.25,
    tilt: 1.5
  },
  {
    id: 'add',
    target: '.canvas-tool-dock .dock-add-btn',
    lines: ['*+* adds an idea, claim,', 'question or source (N)', '▦ tidies the layout'],
    place: t => [{ x: t.right + 70, y: t.top + 6 }, { x: t.right + 36, y: t.top + 6 }],
    bend: 0.3,
    tilt: -1.5
  },
  {
    id: 'maps',
    target: '.topbar-project-trigger',
    lines: ['All your *maps* live here:', 'switch or start a new one.', 'Everything saves by itself'],
    place: t => [{ x: t.left + 30, y: t.bottom + 62 }, { x: t.left + 70, y: t.bottom + 30 }],
    bend: -0.3,
    tilt: -2
  },
  {
    id: 'views',
    target: '.topbar-center .layout-switch',
    lines: ['Same ideas, *different lenses*:', 'map, map + doc, or a document.', 'More views has outline & claims'],
    place: (t, n) => [{ x: t.left + t.width / 2 - n.width / 2 + 10, y: t.bottom + 64 }, { x: t.left + t.width / 2 - n.width / 2 + 20, y: t.bottom + 30 }],
    bend: 0.25,
    tilt: 1
  },
  {
    id: 'ask',
    target: '.ask-button',
    lines: ['*Chat with your map.*', 'Answers cite your own notes'],
    place: (t, n) => [{ x: t.left - n.width + 60, y: t.bottom + 112 }, { x: t.left - 20, y: t.bottom + 100 }, { x: t.right - n.width, y: t.bottom + 100 }],
    bend: 0.3,
    tilt: 2
  },
  {
    id: 'search',
    target: 'button[aria-label="Search the map"]',
    lines: ['Ctrl K finds anything,', 'Ctrl Z takes it back'],
    place: (t, n) => [{ x: t.left - n.width + 6, y: t.bottom + 34 }, { x: t.left - n.width / 2, y: t.bottom + 30 }],
    bend: -0.4,
    tilt: -1
  },
  {
    id: 'share',
    target: '.share-button',
    lines: ['*Share* it: image, Obsidian,', 'BibTeX, Mermaid & more'],
    place: (t, n) => [{ x: t.right - n.width + 10, y: t.bottom + 236 }, { x: t.right - n.width + 10, y: t.bottom + 190 }],
    bend: -0.25,
    tilt: -1.5
  }
];

// Things a note must never cover.
const OBSTACLES = ['.map-start-inner', '.workspace-topbar', '.canvas-tool-dock', '.workspace-drawer.is-open', '.toast-note'];

type Placed = {
  id: string;
  x: number;
  y: number;
  tilt: number;
  arrow: string;
  head: string;
  loop?: string;
};

function toBox(rect: DOMRect, origin: DOMRect): Box {
  const left = rect.left - origin.left;
  const top = rect.top - origin.top;
  return { left, top, right: left + rect.width, bottom: top + rect.height, width: rect.width, height: rect.height };
}

function overlaps(a: Box, b: Box, pad: number) {
  return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
}

/** A small, repeatable wobble so strokes look hand drawn but don't jitter between renders. */
function wobble(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return () => {
    h = (h * 1103515245 + 12345) | 0;
    return ((h >>> 8) & 0xffff) / 0xffff - 0.5;
  };
}

function closestOnBox(box: Box, px: number, py: number) {
  return { x: Math.max(box.left, Math.min(box.right, px)), y: Math.max(box.top, Math.min(box.bottom, py)) };
}

function drawArrow(id: string, note: Box, target: Box, bendFactor: number) {
  const rand = wobble(id);
  const tc = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
  const nc = { x: note.left + note.width / 2, y: note.top + note.height / 2 };
  const endOnTarget = closestOnBox(target, nc.x, nc.y);
  const start = closestOnBox({ ...note, left: note.left - 6, right: note.right + 6, top: note.top - 4, bottom: note.bottom + 4 }, tc.x, tc.y);
  // Stop just short of the target so the tip never touches the control.
  const dx = endOnTarget.x - start.x;
  const dy = endOnTarget.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const gap = 10;
  const end = { x: endOnTarget.x - (dx / length) * gap, y: endOnTarget.y - (dy / length) * gap };
  const bend = bendFactor * length;
  const control = {
    x: (start.x + end.x) / 2 - (dy / length) * bend + rand() * 8,
    y: (start.y + end.y) / 2 + (dx / length) * bend + rand() * 8
  };
  const arrow = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  const angle = Math.atan2(end.y - control.y, end.x - control.x);
  const size = 11;
  const spread = 0.5 + rand() * 0.12;
  const left = { x: end.x - size * Math.cos(angle - spread), y: end.y - size * Math.sin(angle - spread) };
  const right = { x: end.x - size * Math.cos(angle + spread), y: end.y - size * Math.sin(angle + spread) };
  const head = `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)}`;
  // Points along the curve, so other notes can keep clear of this arrow.
  const trail = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return {
      x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
      y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y
    };
  });
  return { arrow, head, trail };
}

/** A loose pen loop around a control that overshoots where it started, like a quick circle on paper. */
function drawLoop(id: string, target: Box) {
  const rand = wobble(`${id}-loop`);
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const rx = target.width / 2 + 12;
  const ry = target.height / 2 + 9;
  const start = -2.4 + rand() * 0.4;
  const steps = 22;
  const sweep = Math.PI * 2 + 0.55;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const a = start + (sweep * i) / steps;
    const r = 1 + rand() * 0.06 + (i / steps) * 0.08;
    return { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r };
  });
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)}`;
  }
  return d;
}

function Handwriting({ line }: { line: string }) {
  return <>{line.split(/(\*[^*]+\*)/).filter(Boolean).map((part, index) => part.startsWith('*') && part.endsWith('*')
    ? <em key={index}>{part.slice(1, -1)}</em>
    : <span key={index}>{part}</span>)}</>;
}

/**
 * Hand-drawn notes and arrows that explain the workspace while a map is empty.
 * Purely decorative: it never touches the graph and ignores the pointer, so the
 * composer and every control stay usable underneath it.
 */
export function EmptyMapGuide() {
  const layerRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [ready, setReady] = useState(false);

  const layout = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const origin = layer.getBoundingClientRect();
    if (origin.width === 0 || origin.height === 0) return;
    const bounds: Box = { left: 12, top: 12, right: origin.width - 12, bottom: origin.height - 12, width: origin.width - 24, height: origin.height - 24 };
    const obstacles = OBSTACLES.flatMap(selector => Array.from(document.querySelectorAll(selector)).map(element => toBox(element.getBoundingClientRect(), origin)))
      .filter(box => box.width > 0 && box.height > 0);
    const taken: Box[] = [];
    const trails: Array<Array<{ x: number; y: number }>> = [];
    const next: Placed[] = [];
    const inside = (box: Box, point: { x: number; y: number }) => point.x > box.left - 4 && point.x < box.right + 4 && point.y > box.top - 4 && point.y < box.bottom + 4;

    for (const note of NOTES) {
      const element = document.querySelector(note.target);
      const measure = measureRefs.current[note.id];
      if (!element || !measure) continue;
      const target = toBox(element.getBoundingClientRect(), origin);
      if (target.width === 0 || target.height === 0) continue;
      const size = { width: measure.offsetWidth, height: measure.offsetHeight };
      const choice = note.place(target, size)
        .map(({ x, y }): Box => ({ left: x, top: y, right: x + size.width, bottom: y + size.height, width: size.width, height: size.height }))
        .filter(spot => spot.left >= bounds.left && spot.top >= bounds.top && spot.right <= bounds.right && spot.bottom <= bounds.bottom
          && !obstacles.some(other => overlaps(spot, other, 14)) && !taken.some(other => overlaps(spot, other, 18))
          && !trails.some(trail => trail.some(point => inside(spot, point))))
        .map(spot => ({ spot, ink: drawArrow(note.id, spot, target, note.bend ?? 0.25) }))
        // An arrow must not run through handwriting that is already on the board.
        .find(({ ink }) => !taken.some(other => ink.trail.some(point => inside(other, point))));
      if (!choice) continue;
      const { spot, ink } = choice;
      taken.push(spot);
      trails.push(ink.trail);
      next.push({
        id: note.id,
        x: spot.left,
        y: spot.top,
        tilt: note.tilt ?? 0,
        arrow: ink.arrow,
        head: ink.head,
        loop: note.circle ? drawLoop(note.id, target) : undefined
      });
    }
    setPlaced(next);
    setReady(true);
  }, []);

  useLayoutEffect(() => {
    layout();
  }, [layout]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(layer);
    for (const selector of ['.workspace-topbar', '.map-start-inner']) {
      const element = document.querySelector(selector);
      if (element) resize.observe(element);
    }
    // The tool dock can be dragged around and the drawer slides in and out.
    const mutations = new MutationObserver(schedule);
    for (const selector of ['.canvas-tool-dock', '.workspace-drawer']) {
      const element = document.querySelector(selector);
      if (element) mutations.observe(element, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    const scroller = document.querySelector('.map-start');
    scroller?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      scroller?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [layout]);

  return (
    <div ref={layerRef} className={`empty-map-guide ${hand.className} ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      {/* Off-screen copies, used only to measure each note before placing it. */}
      <div className="guide-measure">
        {NOTES.map(note => (
          <div key={note.id} className="guide-note" ref={element => { measureRefs.current[note.id] = element; }}>
            {note.lines.map(line => <span key={line} className="guide-line"><Handwriting line={line} /></span>)}
          </div>
        ))}
      </div>

      <svg className="guide-ink" width="100%" height="100%">
        <defs>
          <filter id="guide-rough" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="2.2" />
          </filter>
        </defs>
        {placed.map((note, index) => {
          const delay = 0.35 + index * 0.32;
          return (
            <g key={note.id} filter="url(#guide-rough)">
              {note.loop && <path className="guide-stroke guide-loop" d={note.loop} pathLength={1} style={{ animationDelay: `${delay + 0.15}s` }} />}
              <path className="guide-stroke" d={note.arrow} pathLength={1} style={{ animationDelay: `${delay + 0.45}s` }} />
              <path className="guide-stroke guide-head" d={note.head} pathLength={1} style={{ animationDelay: `${delay + 0.95}s` }} />
            </g>
          );
        })}
      </svg>

      {placed.map((note, index) => {
        const source = NOTES.find(item => item.id === note.id)!;
        const delay = 0.35 + index * 0.32;
        return (
          <div key={note.id} className="guide-note is-placed" style={{ left: note.x, top: note.y, rotate: `${note.tilt}deg`, animationDelay: `${index * -1.3}s` }}>
            {source.lines.map((line, lineIndex) => (
              <span key={line} className="guide-line" style={{ animationDelay: `${delay + lineIndex * 0.22}s` }}>
                <Handwriting line={line} />
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
