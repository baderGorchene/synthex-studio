// Colours and sizes for board drawings and cluster outlines. These are the user's own marks, so they may use
// colour; proof blue (#1F3DFF) is left out on purpose because it means "AI drafted this" or "selected".

export type Swatch = { id: string; label: string; hex: string };

export const PEN_COLORS: Swatch[] = [
  { id: 'ink', label: 'Ink', hex: '#111214' },
  { id: 'red', label: 'Red', hex: '#D92D20' },
  { id: 'green', label: 'Green', hex: '#079455' },
  { id: 'blue', label: 'Blue', hex: '#1570EF' },
  { id: 'purple', label: 'Purple', hex: '#7A5AF8' },
  { id: 'orange', label: 'Orange', hex: '#E04F16' }
];

export const MARKER_COLORS: Swatch[] = [
  { id: 'yellow', label: 'Yellow', hex: '#FDE047' },
  { id: 'green', label: 'Green', hex: '#86EFAC' },
  { id: 'pink', label: 'Pink', hex: '#F9A8D4' },
  { id: 'orange', label: 'Orange', hex: '#FDBA74' },
  { id: 'blue', label: 'Blue', hex: '#93C5FD' },
  { id: 'grey', label: 'Grey', hex: '#A7AAAF' }
];

export const CLUSTER_COLORS: Swatch[] = [
  { id: 'ink', label: 'Ink', hex: '#111214' },
  { id: 'red', label: 'Red', hex: '#D92D20' },
  { id: 'orange', label: 'Orange', hex: '#E04F16' },
  { id: 'yellow', label: 'Yellow', hex: '#EAAA08' },
  { id: 'green', label: 'Green', hex: '#079455' },
  { id: 'blue', label: 'Blue', hex: '#1570EF' },
  { id: 'purple', label: 'Purple', hex: '#7A5AF8' },
  { id: 'pink', label: 'Pink', hex: '#DD2590' }
];

export const SIZES = ['s', 'm', 'l'] as const;
export type SizeId = typeof SIZES[number];
export const SIZE_LABEL: Record<SizeId, string> = { s: 'Fine', m: 'Medium', l: 'Bold' };
export const PEN_WIDTH: Record<SizeId, number> = { s: 1.5, m: 2.5, l: 4.5 };
export const MARKER_WIDTH: Record<SizeId, number> = { s: 10, m: 16, l: 26 };
export const CLUSTER_WIDTH: Record<SizeId, number> = { s: 1.2, m: 1.8, l: 3 };

// Line widths are free values on a slider; these ranges keep every stroke readable. S/M/L presets saved before the
// sliders existed are converted with the old maps above.
export const PEN_RANGE = { min: 1, max: 10, step: 0.5 };
export const MARKER_RANGE = { min: 6, max: 40, step: 1 };
export const CLUSTER_RANGE = { min: 1, max: 6, step: 0.2 };

const clamp = (value: number, range: { min: number; max: number }) => Math.min(range.max, Math.max(range.min, value));

/** A cluster's pen width in px from its stored metadata.penWidth (a number, or a legacy 's' | 'm' | 'l'). */
export function clusterWidth(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return clamp(value, CLUSTER_RANGE);
  return CLUSTER_WIDTH[value as SizeId] ?? CLUSTER_WIDTH.m;
}

export type SketchStyle = { pen: { color: string; width: number }; marker: { color: string; width: number } };
export const DEFAULT_SKETCH_STYLE: SketchStyle = { pen: { color: '#111214', width: PEN_WIDTH.m }, marker: { color: '#FDE047', width: MARKER_WIDTH.m } };

export function parseSketchStyle(raw: string | null): SketchStyle {
  try {
    const value = JSON.parse(raw || 'null');
    const read = (tool: 'pen' | 'marker') => {
      const saved = value?.[tool] || {};
      const widths = tool === 'pen' ? PEN_WIDTH : MARKER_WIDTH;
      const range = tool === 'pen' ? PEN_RANGE : MARKER_RANGE;
      const width = typeof saved.width === 'number' ? saved.width : widths[saved.size as SizeId] ?? DEFAULT_SKETCH_STYLE[tool].width;
      return { color: typeof saved.color === 'string' ? saved.color : DEFAULT_SKETCH_STYLE[tool].color, width: clamp(width, range) };
    };
    return { pen: read('pen'), marker: read('marker') };
  } catch { return DEFAULT_SKETCH_STYLE; }
}
