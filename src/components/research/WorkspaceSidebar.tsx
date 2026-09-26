'use client';

import { BookOpenText, Boxes, ChevronDown, FileClock, Files, FolderKanban, Network, Plus, Search, Shapes, Sparkles, CircleHelp } from 'lucide-react';
export interface ResearchProject {
  id: string;
  title: string;
  createdAt: number;
}

export type WorkspaceSection = 'canvas' | 'outline' | 'evidence' | 'table' | 'sources' | 'questions' | 'history';

const primary = [
  { id: 'canvas', label: 'Knowledge graph', icon: Network },
  { id: 'outline', label: 'Outline', icon: BookOpenText },
  { id: 'evidence', label: 'Evidence paths', icon: Shapes },
  { id: 'table', label: 'Claims & questions', icon: Files }
] as const;

export function WorkspaceSidebar({
  projects, projectId, section, aiConfigured, pendingCount = 0, onSelectProject, onOpenProjects, onNavigate, onSearch
}: {
  projects: ResearchProject[];
  projectId: string;
  section: WorkspaceSection;
  aiConfigured: boolean;
  pendingCount?: number;
  onSelectProject: (id: string) => void;
  onOpenProjects: () => void;
  onNavigate: (section: WorkspaceSection) => void;
  onSearch: () => void;
}) {
  const project = projects.find(item => item.id === projectId);
  return (
    <aside className="workspace-sidebar">
      <a className="brand-lockup" href="#workspace" aria-label="Synthex workspace">
        <span className="brand-mark"><i /><i /><i /><i /></span>
        <span className="brand-name">Synthex</span>
      </a>

      <div className="project-switcher">
        <span className="workspace-caption">Personal workspace</span>
        <select aria-label="Choose project" value={projectId} onChange={event => onSelectProject(event.target.value)}>
          {projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <ChevronDown className="project-chevron" size={14} />
        <button className="icon-button project-menu-button" aria-label="Manage projects" onClick={onOpenProjects}><Plus size={15} /></button>
        <span className="project-title-small">{project?.title || 'Loading project'}</span>
      </div>

      <button className="sidebar-search" aria-label="Search knowledge" title="Search knowledge" onClick={onSearch}>
        <Search size={15} /><span>Search knowledge</span><kbd>Ctrl K</kbd>
      </button>

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
