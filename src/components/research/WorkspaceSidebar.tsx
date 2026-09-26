'use client';

import { BookOpenText, BookOpen, Boxes, ChevronDown, CircleHelp, FileClock, Files, FileText, FlaskConical, FolderKanban, GripVertical, Hand, Layers2, Lightbulb, MousePointer2, Network, Plus, Search, Shapes, Sparkles, Quote, GitBranch, Scan } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CustomSelect } from './CustomSelect';
import type { CanvasNodeType } from '@/types/canvas';
export interface ResearchProject {
  id: string;
  title: string;
  createdAt: number;
}

export type WorkspaceSection = 'canvas' | 'outline' | 'evidence' | 'table' | 'sources' | 'questions' | 'history';
type CanvasTool = 'select' | 'connect' | 'hand';

const primary = [
  { id: 'canvas', label: 'Knowledge graph', icon: Network },
  { id: 'outline', label: 'Outline', icon: BookOpenText },
  { id: 'evidence', label: 'Evidence paths', icon: Shapes },
  { id: 'table', label: 'Claims & questions', icon: Files }
] as const;

const addableRecords = [
  { type: 'concept', label: 'Concept', icon: Lightbulb },
  { type: 'claim', label: 'Claim', icon: Quote },
  { type: 'question', label: 'Question', icon: CircleHelp },
  { type: 'hypothesis', label: 'Hypothesis', icon: FlaskConical },
  { type: 'source', label: 'Source', icon: BookOpen },
  { type: 'note', label: 'Note', icon: FileText },
  { type: 'group', label: 'Knowledge cluster', icon: Layers2 }
] as const;

export function WorkspaceSidebar({
  projects, projectId, section, aiConfigured, pendingCount = 0, floating = false, activeTool = 'select', onSelectTool, onFit, onAddRecord, onSelectProject, onOpenProjects, onNavigate, onSearch
}: {
  projects: ResearchProject[];
  projectId: string;
  section: WorkspaceSection;
  aiConfigured: boolean;
  pendingCount?: number;
  floating?: boolean;
  activeTool?: CanvasTool;
  onSelectTool?: (tool: CanvasTool) => void;
  onFit?: () => void;
  onAddRecord?: (type: CanvasNodeType) => void;
  onSelectProject: (id: string) => void;
  onOpenProjects: () => void;
  onNavigate: (section: WorkspaceSection) => void;
  onSearch: () => void;
}) {
  const project = projects.find(item => item.id === projectId);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useEffect(() => {
    if (!addMenuOpen) return;
    const closeOutside = (event: PointerEvent) => { if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) setAddMenuOpen(false); };
    window.addEventListener('pointerdown', closeOutside, true);
    return () => window.removeEventListener('pointerdown', closeOutside, true);
  }, [addMenuOpen]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const origin = dragOrigin.current;
      if (!origin) return;
      setPosition({
        x: Math.max(8, Math.min(window.innerWidth - 72, origin.left + event.clientX - origin.x)),
        y: Math.max(8, Math.min(window.innerHeight - 145, origin.top + event.clientY - origin.y))
      });
    };
    const up = () => { dragOrigin.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  if (floating) return <aside className="workspace-sidebar floating-workspace-sidebar canvas-tool-dock" style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', transform: 'none' } : undefined} aria-label="Canvas tools">
    <button className="sidebar-drag-handle" aria-label="Move tool sidebar" title="Drag to move" onPointerDown={event => {
      const rect = event.currentTarget.closest('.workspace-sidebar')?.getBoundingClientRect();
      if (!rect) return;
      dragOrigin.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      setPosition({ x: rect.left, y: rect.top });
    }}><GripVertical size={16} /></button>
    <div className="sidebar-tool-row" role="group" aria-label="Canvas tools">
      <button className={`sidebar-tool-button ${activeTool === 'select' ? 'active' : ''}`} aria-label="Select and move records" aria-pressed={activeTool === 'select'} onClick={() => onSelectTool?.('select')}><MousePointer2 size={16} /><span className="tool-tooltip">Select and move</span></button>
      <button className={`sidebar-tool-button ${activeTool === 'connect' ? 'active' : ''}`} aria-label="Connect records" aria-pressed={activeTool === 'connect'} onClick={() => onSelectTool?.('connect')}><GitBranch size={16} /><span className="tool-tooltip">Connect records · C</span></button>
      <button className={`sidebar-tool-button ${activeTool === 'hand' ? 'active' : ''}`} aria-label="Pan canvas" aria-pressed={activeTool === 'hand'} onClick={() => onSelectTool?.('hand')}><Hand size={16} /><span className="tool-tooltip">Pan canvas</span></button>
      <button className="sidebar-tool-button" aria-label="Fit sheet" onClick={onFit}><Scan size={16} /><span className="tool-tooltip">Fit sheet</span></button>
      <div className="dock-add-record" ref={addMenuRef}>
        <button className={`sidebar-tool-button ${addMenuOpen ? 'active' : ''}`} aria-label="Add record" aria-expanded={addMenuOpen} aria-haspopup="menu" onClick={() => setAddMenuOpen(value => !value)}><Plus size={17} /><span className="tool-tooltip">Add record</span></button>
        {addMenuOpen && <div className="dock-add-record-menu" role="menu" aria-label="Add record type">
          {addableRecords.map(({ type, label, icon: Icon }) => <button key={type} className={`record-create-item type-${type}`} role="menuitem" onClick={() => { onAddRecord?.(type); setAddMenuOpen(false); }}><span><Icon size={15} /></span>{label}</button>)}
        </div>}
      </div>
    </div>
  </aside>;
  return (
    <aside className={`workspace-sidebar ${floating ? 'floating-workspace-sidebar' : ''}`} style={floating && position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', height: `min(680px, calc(100dvh - ${position.y + 14}px))` } : undefined}>
      <a className="brand-lockup" href="#workspace" aria-label="Synthex workspace">
        <span className="brand-mark"><i /><i /><i /><i /></span>
        <span className="brand-name">Synthex</span>
      </a>

      <div className="project-switcher">
        <span className="workspace-caption">Personal workspace</span>
        <CustomSelect ariaLabel="Choose project" value={projectId} options={projects.map(item => ({ value: item.id, label: item.title }))} onChange={onSelectProject} />
        <ChevronDown className="project-chevron" size={14} />
        <button className="icon-button project-menu-button" aria-label="Manage projects" onClick={onOpenProjects}><Plus size={15} /></button>
        <span className="project-title-small">{project?.title || 'Loading project'}</span>
      </div>

      <button className="sidebar-search" aria-label="Search knowledge" title="Search knowledge" onClick={onSearch}>
        <Search size={15} /><span>Search knowledge</span><kbd>Ctrl K</kbd>
      </button>

      {floating && <div className="sidebar-canvas-tools">
        <span className="sidebar-tool-heading">Canvas tools</span>
        <div className="sidebar-tool-row" role="group" aria-label="Canvas tools">
          <button className={`sidebar-tool-button ${activeTool === 'select' ? 'active' : ''}`} aria-label="Select and move records" aria-pressed={activeTool === 'select'} title="Select and move records" onClick={() => onSelectTool?.('select')}><MousePointer2 size={15} /></button>
          <button className={`sidebar-tool-button ${activeTool === 'connect' ? 'active' : ''}`} aria-label="Connect records (C)" aria-pressed={activeTool === 'connect'} title="Connect records (C)" onClick={() => onSelectTool?.('connect')}><GitBranch size={15} /><kbd>C</kbd></button>
          <button className={`sidebar-tool-button ${activeTool === 'hand' ? 'active' : ''}`} aria-label="Pan canvas" aria-pressed={activeTool === 'hand'} title="Pan canvas" onClick={() => onSelectTool?.('hand')}><Hand size={15} /></button>
        </div>
      </div>}

      <nav className="sidebar-nav" aria-label="Workspace navigation">
        <div className="sidebar-nav-heading">Research space</div>
        {primary.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} aria-label={label} title={label} onClick={() => onNavigate(id)}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}

        <div className="sidebar-nav-heading nav-heading-spaced">Library</div>
        <button className={`nav-item ${section === 'sources' ? 'active' : ''}`} aria-label="Sources" title="Sources" onClick={() => onNavigate('sources')}>
          <FolderKanban size={16} strokeWidth={1.8} /><span>Sources</span>
        </button>
        <button className={`nav-item ${section === 'questions' ? 'active' : ''}`} aria-label="Open questions" title="Open questions" onClick={() => onNavigate('questions')}>
          <CircleHelp size={16} strokeWidth={1.8} /><span>Open questions</span>
        </button>
        <button className={`nav-item ${section === 'history' ? 'active' : ''}`} aria-label="Research history" title="Research history" onClick={() => onNavigate('history')}>
          <FileClock size={16} strokeWidth={1.8} /><span>Research history</span>{pendingCount > 0 && <small className="nav-count">{pendingCount}</small>}
        </button>
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-ai-link" aria-label={aiConfigured ? 'Research agent ready' : 'Connect research agent'} onClick={() => onNavigate('history')}>
          <span className={`ai-status-dot ${aiConfigured ? 'ready' : ''}`} />
          <span>{aiConfigured ? 'Research agent ready' : 'Connect research agent'}</span>
          <Sparkles size={14} />
        </button>
        <div className="local-storage-note"><Boxes size={13} /> Private local workspace</div>
      </div>
    </aside>
  );
}
