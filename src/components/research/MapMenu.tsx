'use client';

import { useState, type FormEvent } from 'react';
import { Check, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, Trash2, UserRound, Users, X } from 'lucide-react';
import type { ResearchProject } from './WorkspaceSidebar';

type RowMode = 'actions' | 'rename' | 'delete';

interface MapMenuProps {
  projects: ResearchProject[];
  personalProjects: ResearchProject[];
  activeId: string;
  workspaceKind: 'personal' | 'team';
  onOpen: (id: string) => void;
  onMove: (id: string, workspace: 'team' | 'personal') => Promise<void> | void;
  /** Resolve true when the map was renamed. */
  onRename: (id: string, title: string) => Promise<boolean>;
  /** Resolve true when the map was deleted. */
  onDelete: (id: string) => Promise<boolean>;
  newTitle: string;
  onNewTitleChange: (value: string) => void;
  creating: boolean;
  onCreate: (event: FormEvent) => void;
}

/** The map switcher: open, rename, move and delete maps, and create a new one (pinned at the bottom). */
export function MapMenu({
  projects, personalProjects, activeId, workspaceKind, onOpen, onMove, onRename, onDelete,
  newTitle, onNewTitleChange, creating, onCreate
}: MapMenuProps) {
  const [filter, setFilter] = useState('');
  const [row, setRow] = useState<{ id: string; mode: RowMode } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const query = filter.trim().toLowerCase();
  const matches = (p: ResearchProject) => !query || p.title.toLowerCase().includes(query);
  const visibleProjects = projects.filter(matches);
  const visiblePersonal = personalProjects.filter(matches);
  const isTeam = workspaceKind === 'team';

  const toggleActions = (id: string) => setRow(current => current?.id === id ? null : { id, mode: 'actions' });
  const startRename = (p: ResearchProject) => { setRenameDraft(p.title); setRow({ id: p.id, mode: 'rename' }); };

  async function submitRename(event: FormEvent, id: string) {
    event.preventDefault();
    const title = renameDraft.trim();
    if (title.length < 2 || busy) return;
    setBusy(true);
    const ok = await onRename(id, title);
    setBusy(false);
    if (ok) setRow(null);
  }

  async function confirmDelete(id: string) {
    if (busy) return;
    setBusy(true);
    const ok = await onDelete(id);
    setBusy(false);
    if (ok) setRow(null);
  }

  function renderRow(p: ResearchProject, kind: 'workspace' | 'personal') {
    const isOpen = kind === 'workspace' && p.id === activeId;
    const mode = row?.id === p.id ? row.mode : null;
    // Personal maps are always the user's own; in a team only the creator may move or delete a map.
    const owns = kind === 'personal' || !isTeam || Boolean(p.isOwner);
    const title = p.title || 'Untitled map';

    if (mode === 'rename') {
      return (
        <li key={p.id} className="map-menu-row is-editing" role="none">
          <form className="map-menu-rename" onSubmit={event => void submitRename(event, p.id)}>
            <input
              className="field-input"
              value={renameDraft}
              onChange={event => setRenameDraft(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setRow(null); } }}
              maxLength={80}
              aria-label={`New name for “${title}”`}
              autoFocus
              onFocus={event => event.currentTarget.select()}
            />
            <button type="submit" className="map-menu-save" disabled={busy || renameDraft.trim().length < 2}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="map-menu-icon" aria-label="Cancel renaming" onClick={() => setRow(null)}><X size={14} /></button>
          </form>
        </li>
      );
    }

    return (
      <li key={p.id} className={`map-menu-row ${isOpen ? 'is-active' : ''} ${mode ? 'is-expanded' : ''}`} role="none">
        <div className="map-menu-line">
          {kind === 'workspace' ? (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isOpen}
              className="map-menu-open"
              title={title}
              onClick={() => onOpen(p.id)}
            >
              <span className="map-menu-check" aria-hidden="true">{isOpen && <Check size={14} strokeWidth={2.25} />}</span>
              <span className="map-menu-name">{title}</span>
              {isOpen && <span className="map-menu-badge">Open</span>}
            </button>
          ) : (
            <span className="map-menu-open is-static" title={title}>
              <span className="map-menu-check" aria-hidden="true" />
              <span className="map-menu-name">{title}</span>
            </span>
          )}
          <button
            type="button"
            className={`map-menu-icon ${mode ? 'is-on' : ''}`}
            aria-label={`Options for “${title}”`}
            aria-expanded={Boolean(mode)}
            title="Rename, move or delete"
            onClick={() => toggleActions(p.id)}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {mode === 'actions' && (
          <div className="map-menu-actions">
            <button type="button" className="map-menu-action" onClick={() => startRename(p)}>
              <Pencil size={13} strokeWidth={1.75} aria-hidden="true" /> Rename
            </button>
            {kind === 'personal' && (
              <button type="button" className="map-menu-action" onClick={() => { setRow(null); void onMove(p.id, 'team'); }}>
                <Users size={13} strokeWidth={1.75} aria-hidden="true" /> Move to team
              </button>
            )}
            {kind === 'workspace' && isTeam && owns && (
              <button
                type="button"
                className="map-menu-action"
                title="Teammates lose access"
                onClick={() => {
                  if (window.confirm(`Move “${title}” to your personal maps? Teammates will lose access to it.`)) { setRow(null); void onMove(p.id, 'personal'); }
                }}
              >
                <UserRound size={13} strokeWidth={1.75} aria-hidden="true" /> Make personal
              </button>
            )}
            {owns && (
              <button type="button" className="map-menu-action is-danger" onClick={() => setRow({ id: p.id, mode: 'delete' })}>
                <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" /> Delete
              </button>
            )}
            {!owns && <span className="map-menu-note">Only its creator can move or delete this map.</span>}
          </div>
        )}

        {mode === 'delete' && (
          <div className="map-menu-confirm" role="alertdialog" aria-label={`Delete “${title}”?`}>
            <p>
              Delete <strong>{title}</strong>{isTeam && kind === 'workspace' ? ' for everyone in the team' : ''}? Its notes, links, research history and chat go with it. This can&apos;t be undone.
            </p>
            <div>
              <button type="button" className="map-menu-action" onClick={() => setRow(null)} disabled={busy}>Cancel</button>
              <button type="button" className="map-menu-danger" onClick={() => void confirmDelete(p.id)} disabled={busy} autoFocus>
                {busy ? 'Deleting…' : 'Delete map'}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      {projects.length + personalProjects.length > 6 && (
        <div className="map-menu-search">
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Find a map…" aria-label="Find a map" autoFocus />
        </div>
      )}
      <div className="map-menu-scroll">
        <section className="map-menu-section">
          <p className="map-menu-heading">
            <span>{isTeam ? 'Team maps' : 'Your maps'}</span>
            <small>{projects.length}</small>
          </p>
          <ul className="map-menu-list" role="menu" aria-label={isTeam ? 'Team maps' : 'Your maps'}>
            {visibleProjects.map(p => renderRow(p, 'workspace'))}
            {visibleProjects.length === 0 && (
              <li className="map-menu-empty" role="none">{query ? 'No maps match.' : 'No maps yet. Create one below.'}</li>
            )}
          </ul>
        </section>
        {isTeam && personalProjects.length > 0 && (
          <section className="map-menu-section map-menu-personal">
            <p className="map-menu-heading">
              <span>Your personal maps</span>
              <small>{personalProjects.length}</small>
            </p>
            <p className="map-menu-hint">Only you can see these. Move one into the team so everyone can open and edit it.</p>
            <ul className="map-menu-list">
              {visiblePersonal.map(p => renderRow(p, 'personal'))}
              {visiblePersonal.length === 0 && <li className="map-menu-empty">No maps match.</li>}
            </ul>
          </section>
        )}
      </div>
      <form className="map-menu-new" onSubmit={onCreate}>
        <label className="map-menu-heading" htmlFor="project-name"><span>New map</span></label>
        <div className="map-menu-new-row">
          <input className="field-input" id="project-name" value={newTitle} onChange={event => onNewTitleChange(event.target.value)} maxLength={80} minLength={2} placeholder="e.g. Small language models" required />
          <button type="submit" className="map-menu-create" disabled={creating || newTitle.trim().length < 2}>
            {creating ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Plus size={14} strokeWidth={2} aria-hidden="true" />}
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </>
  );
}
