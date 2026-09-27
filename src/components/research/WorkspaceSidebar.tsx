'use client';

import { BookOpen, FileText, GitBranch, GripVertical, Hand, Images, Layers2, MousePointer2, Plus, Quote, Scan } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CanvasNodeType } from '@/types/canvas';

export interface ResearchProject {
  id: string;
  title: string;
  createdAt: number;
}

export type WorkspaceSection = 'canvas' | 'outline' | 'evidence' | 'table' | 'sources' | 'questions' | 'history';
export type CanvasTool = 'select' | 'connect' | 'hand';

export const addableRecords = [
  { type: 'note', label: 'Note & Idea', description: 'Concept, hypothesis or markdown note', icon: FileText, shortcut: 'N' },
  { type: 'claim', label: 'Claim & Inquiry', description: 'Verifiable assertion or open question', icon: Quote, shortcut: 'K' },
  { type: 'source', label: 'Document & Source', description: 'Web reference, PDF, TXT, JSON, paper', icon: BookOpen, shortcut: 'S' },
  { type: 'image', label: 'Media & Figure', description: 'Diagram, chart, screenshot or asset', icon: Images, shortcut: 'I' },
  { type: 'group', label: 'Knowledge cluster', description: 'Collapsible stack & section container', icon: Layers2, shortcut: 'G' }
] as const;

export interface CanvasToolDockProps {
  activeTool?: CanvasTool;
  onSelectTool?: (tool: CanvasTool) => void;
  onFit?: () => void;
  onAddRecord?: (type: CanvasNodeType) => void;
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

export function CanvasToolDock({
  activeTool = 'select',
  onSelectTool,
  onFit,
  onAddRecord,
}: CanvasToolDockProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
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

  return (
    <aside
      className="workspace-sidebar floating-workspace-sidebar canvas-tool-dock"
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', transform: 'none' } : undefined}
      aria-label="Canvas tools"
    >
      <button
        className="sidebar-drag-handle"
        aria-label="Move tool dock"
        title="Drag to reposition"
        onPointerDown={event => {
          const rect = event.currentTarget.closest('.workspace-sidebar')?.getBoundingClientRect();
          if (!rect) return;
          dragOrigin.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
          setPosition({ x: rect.left, y: rect.top });
        }}
      >
        <GripVertical size={16} />
      </button>

      <div className="sidebar-tool-row" role="group" aria-label="Canvas tools">
        <button
          className={`sidebar-tool-button ${activeTool === 'select' ? 'active' : ''}`}
          aria-label="Select and move records"
          aria-pressed={activeTool === 'select'}
          onClick={() => onSelectTool?.('select')}
          title="Select & multi-select (V)"
        >
          <MousePointer2 size={16} />
          <span className="tool-tooltip">Select & multi-select · V</span>
        </button>

        <button
          className={`sidebar-tool-button ${activeTool === 'connect' ? 'active' : ''}`}
          aria-label="Connect records"
          aria-pressed={activeTool === 'connect'}
          onClick={() => onSelectTool?.('connect')}
          title="Connect records (C)"
        >
          <GitBranch size={16} />
          <span className="tool-tooltip">Connect records · C</span>
        </button>

        <button
          className={`sidebar-tool-button ${activeTool === 'hand' ? 'active' : ''}`}
          aria-label="Pan canvas"
          aria-pressed={activeTool === 'hand'}
          onClick={() => onSelectTool?.('hand')}
          title="Pan canvas (H or Space)"
        >
          <Hand size={16} />
          <span className="tool-tooltip">Pan canvas · H or Space</span>
        </button>

        <button
          className="sidebar-tool-button"
          aria-label="Fit sheet"
          onClick={onFit}
          title="Fit all records (F)"
        >
          <Scan size={16} />
          <span className="tool-tooltip">Fit all records · F</span>
        </button>

        <div className="dock-add-record" ref={addMenuRef}>
          <button
            className={`sidebar-tool-button dock-add-btn ${addMenuOpen ? 'active' : ''}`}
            aria-label="Add record to graph"
            aria-expanded={addMenuOpen}
            aria-haspopup="menu"
            onClick={() => setAddMenuOpen(value => !value)}
            title="Add record (N)"
          >
            <Plus size={17} />
            <span className="tool-tooltip">Add record · N</span>
          </button>

          {addMenuOpen && (
            <div className="dock-add-record-menu" role="menu" aria-label="Add record type">
              <span className="popover-heading">Add to canvas</span>
              {addableRecords.map(({ type, label, description, icon: Icon, shortcut }) => (
                <button
                  key={type}
                  className={`record-create-item type-${type}`}
                  role="menuitem"
                  title={`${label} (${shortcut})`}
                  onClick={() => {
                    onAddRecord?.(type);
                    setAddMenuOpen(false);
                  }}
                >
                  <span className="record-item-icon"><Icon size={14} /></span>
                  <div className="record-item-text">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </div>
                  <kbd className="record-shortcut-badge">{shortcut}</kbd>
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
