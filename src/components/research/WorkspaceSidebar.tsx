'use client';

import { Eraser, GitBranch, GripVertical, Hand, Highlighter, LayoutGrid, Lock, LockOpen, MousePointer2, PenLine, Plus, Scan, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

const drawTools = [
  { id: 'pen', label: 'Pen', description: 'Freehand ink, board only', Icon: PenLine, keys: 'P' },
  { id: 'marker', label: 'Marker', description: 'Highlight areas, board only', Icon: Highlighter, keys: 'B' },
  { id: 'eraser', label: 'Eraser', description: 'Remove pen and marker ink', Icon: Eraser, keys: 'E' }
] as const;

export interface CanvasToolDockProps {
  activeTool?: CanvasTool;
  onSelectTool?: (tool: CanvasTool) => void;
  onFit?: () => void;
  onAddRecord?: (type: CanvasNodeType) => void;
  onOrganizeLayout?: (strategy: 'cluster_by_type' | 'hierarchical' | 'compact') => void;
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

/** Keyboard keys drawn as keycaps. */
export function Keys({ keys }: { keys: string }) {
  return (
    <span className="keycaps" aria-hidden="true">
      {keys.split('+').map(key => <kbd key={key} className="keycap">{key}</kbd>)}
    </span>
  );
}

/** The dock shows icons only; hovering it (or tabbing into it) widens every row to show its name, what it does and its shortcut. */
function ToolInfo({ label, description, keys, trailing }: { label: string; description: string; keys?: string; trailing?: ReactNode }) {
  return (
    <>
      <span className="tool-info">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="tool-trailing">{trailing ?? (keys && <Keys keys={keys} />)}</span>
    </>
  );
}

export function CanvasToolDock({
  activeTool = 'select',
  onSelectTool,
  onFit,
  onAddRecord,
  onOrganizeLayout,
  isResizeLocked = false,
  onToggleResizeLock,
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
  const toolButton = (id: 'select' | 'connect' | 'hand', label: string, ariaLabel: string, description: string, Icon: LucideIcon, keys: string) => (
    <button
      className={`sidebar-tool-button ${activeTool === id ? 'active' : ''}`}
      aria-label={ariaLabel}
      aria-pressed={activeTool === id}
      aria-keyshortcuts={keys}
      onClick={() => onSelectTool?.(id)}
    >
      <span className="tool-icon"><Icon {...icon} /></span>
      <ToolInfo label={label} description={description} keys={keys} />
    </button>
  );
  const LockIcon = isResizeLocked ? Lock : LockOpen;

  return (
    <aside
      className={`workspace-sidebar floating-workspace-sidebar canvas-tool-dock ${addMenuOpen || organizeMenuOpen ? 'is-expanded' : ''}`}
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', transform: 'none' } : undefined}
      aria-label="Map tools"
    >
      <button
        className="sidebar-drag-handle"
        aria-label="Move tool dock"
        onPointerDown={event => {
          const rect = event.currentTarget.closest('.workspace-sidebar')?.getBoundingClientRect();
          if (!rect) return;
          dragOrigin.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
          setPosition({ x: rect.left, y: rect.top });
        }}
      >
        <GripVertical size={16} strokeWidth={1.75} />
        <span className="dock-heading">Tools</span>
        <span className="dock-heading-hint">Drag to move</span>
      </button>

      <div className="sidebar-tool-row" role="group" aria-label="Map tools">
        {toolButton('select', 'Select', 'Select and move', 'Pick, move and box-select', MousePointer2, 'V')}
        {toolButton('connect', 'Connect', 'Connect ideas', 'Drag from one note to another', GitBranch, 'C')}
        {toolButton('hand', 'Pan', 'Pan the map', 'Move around the board', Hand, 'H')}

        <span className="sidebar-tool-divider" aria-hidden="true" />

        <div className="dock-draw-tools">
        {drawTools.map(({ id, label, description, Icon, keys }) => (
          <button
            key={id}
            className={`sidebar-tool-button ${activeTool === id ? 'active' : ''}`}
            aria-label={`${label}: draw on the board, not part of the map`}
            aria-pressed={activeTool === id}
            aria-keyshortcuts={keys}
            onClick={() => onSelectTool?.(activeTool === id ? 'select' : id)}
          >
            <span className="tool-icon"><Icon {...icon} /></span>
            <ToolInfo label={label} description={description} keys={keys} />
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
          aria-keyshortcuts="F"
          onClick={onFit}
        >
          <span className="tool-icon"><Scan {...icon} /></span>
          <ToolInfo label="Fit to screen" description="Zoom to show every note" keys="F" />
        </button>

        <div className="dock-add-record" ref={addMenuRef}>
          <button
            className={`sidebar-tool-button dock-add-btn ${addMenuOpen ? 'active' : ''}`}
            aria-label="Add to the map"
            aria-expanded={addMenuOpen}
            aria-haspopup="menu"
            onClick={() => setAddMenuOpen(value => !value)}
          >
            <span className="tool-icon"><Plus {...icon} /></span>
            <ToolInfo label="Add" description="Note, claim, source, image…" keys="N" />
          </button>

          {addMenuOpen && (
            <div className="dock-add-record-menu dock-menu" role="menu" aria-label="Add to the map">
              {addableRecords.map(({ type, label, description, shortcut }) => (
                <button
                  key={type}
                  role="menuitem"
                  aria-keyshortcuts={shortcut}
                  onClick={() => {
                    onAddRecord?.(type);
                    setAddMenuOpen(false);
                  }}
                >
                  <span className="dock-menu-text">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <Keys keys={shortcut} />
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
            <span className="tool-icon"><LayoutGrid {...icon} /></span>
            <ToolInfo label="Tidy layout" description="Rearrange notes for you" />
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

        {onToggleResizeLock && (
          <button
            className={`sidebar-tool-button dock-lock-btn ${isResizeLocked ? 'is-locked' : ''}`}
            role="switch"
            aria-checked={isResizeLocked}
            aria-label="Lock note sizes"
            onClick={onToggleResizeLock}
          >
            <span className="tool-icon"><LockIcon {...icon} /></span>
            <ToolInfo
              label={isResizeLocked ? 'Sizes locked' : 'Lock note sizes'}
              description={isResizeLocked ? 'Click to allow resizing again' : 'Stop accidental resizing'}
              trailing={<span className="dock-switch" aria-hidden="true"><i /></span>}
            />
          </button>
        )}
      </div>
    </aside>
  );
}

export const WorkspaceSidebar = CanvasToolDock;
