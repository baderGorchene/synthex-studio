'use client';

import { Eraser, GitBranch, GripVertical, Hand, Highlighter, LayoutGrid, MousePointer2, PenLine, Plus, Scan } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CanvasNodeType } from '@/types/canvas';
import { MARKER_COLORS, MARKER_RANGE, PEN_COLORS, PEN_RANGE, type SketchStyle } from './inkPalette';
import { WidthSlider } from './WidthSlider';

export interface ResearchProject {
  id: string;
  title: string;
  createdAt: number;
  organizationId?: string | null;
  /** The signed-in user created this map, so they may move it between workspaces. */
  isOwner?: boolean;
}

export type WorkspaceSection = 'canvas' | 'outline' | 'evidence' | 'table' | 'sources' | 'questions' | 'history' | 'revisions';
export type CanvasTool = 'select' | 'connect' | 'hand' | 'pen' | 'marker' | 'eraser';

export const addableRecords = [
  { type: 'note', label: 'Note', description: 'An idea, hypothesis or free text', shortcut: 'N' },
  { type: 'claim', label: 'Claim', description: 'Something you can check against sources', shortcut: 'K' },
  { type: 'source', label: 'Source', description: 'A link, paper or file', shortcut: 'S' },
  { type: 'image', label: 'Image', description: 'A diagram, chart or screenshot', shortcut: 'I' },
  { type: 'group', label: 'Cluster', description: 'A sheet that holds related notes', shortcut: 'G' }
] as const;

const layouts = [
  { strategy: 'cluster_by_type', label: 'Group by type', description: 'Sources, then ideas, claims and questions' },
  { strategy: 'hierarchical', label: 'Top-down', description: 'From sources to conclusions' },
  { strategy: 'compact', label: 'Compact grid', description: 'Tight rows and columns' }
] as const;

export interface CanvasToolDockProps {
  activeTool?: CanvasTool;
  onSelectTool?: (tool: CanvasTool) => void;
  onFit?: () => void;
  onAddRecord?: (type: CanvasNodeType) => void;
  onOrganizeLayout?: (strategy: 'cluster_by_type' | 'hierarchical' | 'compact') => void;
  // Resize locking lives in the More views menu now; kept here for older callers.
  isResizeLocked?: boolean;
  onToggleResizeLock?: () => void;
  sketchStyle?: SketchStyle;
  onSketchStyleChange?: (tool: 'pen' | 'marker', patch: Partial<SketchStyle['pen']>) => void;
  // Optional legacy props for backward compatibility
  projects?: ResearchProject[];
  projectId?: string;
  section?: WorkspaceSection;
  aiConfigured?: boolean;
  pendingCount?: number;
  floating?: boolean;
  onSelectProject?: (id: string) => void;
  onOpenProjects?: () => void;
  onNavigate?: (section: WorkspaceSection) => void;
  onSearch?: () => void;
}

function ToolTip({ label, keys }: { label: string; keys?: string }) {
  return <span className="tool-tooltip">{label}{keys && <kbd>{keys}</kbd>}</span>;
}

export function CanvasToolDock({
  activeTool = 'select',
  onSelectTool,
  onFit,
  onAddRecord,
  onOrganizeLayout,
  sketchStyle,
  onSketchStyleChange,
}: CanvasToolDockProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [organizeMenuOpen, setOrganizeMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const organizeMenuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', closeOutside, true);
    return () => window.removeEventListener('pointerdown', closeOutside, true);
  }, [addMenuOpen]);

  useEffect(() => {
    if (!organizeMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (organizeMenuRef.current && !organizeMenuRef.current.contains(event.target as Node)) {
        setOrganizeMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', closeOutside, true);
    return () => window.removeEventListener('pointerdown', closeOutside, true);
  }, [organizeMenuOpen]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const origin = dragOrigin.current;
      if (!origin) return;
      setPosition({
        x: Math.max(8, Math.min(window.innerWidth - 72, origin.left + event.clientX - origin.x)),
        y: Math.max(8, Math.min(window.innerHeight - 180, origin.top + event.clientY - origin.y))
      });
    };
    const up = () => { dragOrigin.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const icon = { size: 18, strokeWidth: 1.75 };

  return (
    <aside
      className="workspace-sidebar floating-workspace-sidebar canvas-tool-dock"
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', transform: 'none' } : undefined}
      aria-label="Map tools"
    >
      <button
        className="sidebar-drag-handle"
        aria-label="Move tool dock"
        title="Drag to move"
        onPointerDown={event => {
          const rect = event.currentTarget.closest('.workspace-sidebar')?.getBoundingClientRect();
          if (!rect) return;
          dragOrigin.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
          setPosition({ x: rect.left, y: rect.top });
        }}
      >
        <GripVertical size={16} strokeWidth={1.75} />
      </button>

      <div className="sidebar-tool-row" role="group" aria-label="Map tools">
        <button
          className={`sidebar-tool-button ${activeTool === 'select' ? 'active' : ''}`}
          aria-label="Select and move"
          aria-pressed={activeTool === 'select'}
          onClick={() => onSelectTool?.('select')}
        >
          <MousePointer2 {...icon} />
          <ToolTip label="Select" keys="V" />
        </button>

        <button
          className={`sidebar-tool-button ${activeTool === 'connect' ? 'active' : ''}`}
          aria-label="Connect ideas"
          aria-pressed={activeTool === 'connect'}
          onClick={() => onSelectTool?.('connect')}
        >
          <GitBranch {...icon} />
          <ToolTip label="Connect" keys="C" />
        </button>

        <button
          className={`sidebar-tool-button ${activeTool === 'hand' ? 'active' : ''}`}
          aria-label="Pan the map"
          aria-pressed={activeTool === 'hand'}
          onClick={() => onSelectTool?.('hand')}
        >
          <Hand {...icon} />
          <ToolTip label="Pan" keys="H" />
        </button>

        <span className="sidebar-tool-divider" aria-hidden="true" />

        <div className="dock-draw-tools">
        {([
          ['pen', 'Pen', PenLine, 'P'],
          ['marker', 'Marker', Highlighter, 'B'],
          ['eraser', 'Eraser', Eraser, 'E']
        ] as const).map(([id, label, Icon, keys]) => (
          <button
            key={id}
            className={`sidebar-tool-button ${activeTool === id ? 'active' : ''}`}
            aria-label={`${label}: draw on the board, not part of the map`}
            aria-pressed={activeTool === id}
            onClick={() => onSelectTool?.(activeTool === id ? 'select' : id)}
          >
            <Icon {...icon} />
            <ToolTip label={id === 'eraser' ? 'Eraser' : `${label} · drawing only`} keys={keys} />
          </button>
        ))}
        {(activeTool === 'pen' || activeTool === 'marker') && sketchStyle && onSketchStyleChange && (() => {
          const drawTool = activeTool;
          const current = sketchStyle[drawTool];
          const colors = drawTool === 'pen' ? PEN_COLORS : MARKER_COLORS;
          const range = drawTool === 'pen' ? PEN_RANGE : MARKER_RANGE;
          const set = (patch: Partial<SketchStyle['pen']>) => onSketchStyleChange(drawTool, patch);
          return (
            <div className={`sketch-options is-${drawTool}`} role="group" aria-label={`${drawTool === 'pen' ? 'Pen' : 'Marker'} size and colour`}>
              <WidthSlider label="Width" value={current.width} {...range} color={current.color} opacity={drawTool === 'marker' ? .5 : 1} onChange={width => set({ width })} />
              <span className="sketch-options-rule" aria-hidden="true" />
              <div className="sketch-colors" role="radiogroup" aria-label="Colour">
                {colors.map(swatch => (
                  <button key={swatch.id} type="button" role="radio" aria-checked={current.color === swatch.hex} aria-label={swatch.label} title={swatch.label} onClick={() => set({ color: swatch.hex })}>
                    <i style={{ background: swatch.hex }} />
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        </div>

        <span className="sidebar-tool-divider" aria-hidden="true" />

        <button
          className="sidebar-tool-button"
          aria-label="Fit the map to the screen"
          onClick={onFit}
        >
          <Scan {...icon} />
          <ToolTip label="Fit to screen" keys="F" />
        </button>

        <div className="dock-add-record" ref={addMenuRef}>
          <button
            className={`sidebar-tool-button dock-add-btn ${addMenuOpen ? 'active' : ''}`}
            aria-label="Add to the map"
            aria-expanded={addMenuOpen}
            aria-haspopup="menu"
            onClick={() => setAddMenuOpen(value => !value)}
          >
            <Plus {...icon} />
            <ToolTip label="Add" keys="N" />
          </button>

          {addMenuOpen && (
            <div className="dock-add-record-menu dock-menu" role="menu" aria-label="Add to the map">
              {addableRecords.map(({ type, label, description, shortcut }) => (
                <button
                  key={type}
                  role="menuitem"
                  onClick={() => {
                    onAddRecord?.(type);
                    setAddMenuOpen(false);
                  }}
                >
                  <strong>{label}</strong>
                  <small>{description} · {shortcut}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dock-organize-record" ref={organizeMenuRef}>
          <button
            className={`sidebar-tool-button dock-organize-btn ${organizeMenuOpen ? 'active' : ''}`}
            aria-label="Tidy the layout"
            aria-expanded={organizeMenuOpen}
            aria-haspopup="menu"
            onClick={() => setOrganizeMenuOpen(value => !value)}
          >
            <LayoutGrid {...icon} />
            <ToolTip label="Tidy layout" />
          </button>

          {organizeMenuOpen && (
            <div className="dock-organize-menu dock-menu" role="menu" aria-label="Tidy the layout">
              {layouts.map(({ strategy, label, description }) => (
                <button
                  key={strategy}
                  role="menuitem"
                  onClick={() => {
                    onOrganizeLayout?.(strategy);
                    setOrganizeMenuOpen(false);
                  }}
                >
                  <strong>{label}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export const WorkspaceSidebar = CanvasToolDock;
