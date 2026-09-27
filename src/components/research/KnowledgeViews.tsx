'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CircleHelp, ExternalLink, FileClock, History, Layers2, LoaderCircle, Plus, Quote, RotateCcw, Trash2 } from 'lucide-react';
import type { CanvasNode, Connection, GraphRevisionSummary, ResearchSession } from '@/types/canvas';
import type { WorkspaceSection } from './WorkspaceSidebar';
import { WebsiteLogo, getLinkThumbnail } from './SourceMetadata';

const names: Record<string, string> = {
  concept: 'Concept', claim: 'Claim', question: 'Question', hypothesis: 'Hypothesis', source: 'Source',
  link: 'Link & Website', note: 'Note', group: 'Cluster', section: 'Cluster', ai_insight: 'AI insight', research_result: 'Research result'
};

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function sourceHost(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : 'Invalid source URL';
  } catch { return 'Invalid source URL'; }
}

export function KnowledgeViews({
  section, nodes, edges, sessions, onSelectNode, onOpenSession, projectId, onRestoreRevision, onCreateCheckpoint
}: {
  section: WorkspaceSection;
  nodes: CanvasNode[];
  edges: Connection[];
  sessions: ResearchSession[];
  onSelectNode: (id: string) => void;
  onOpenSession: (session: ResearchSession) => void;
  projectId?: string;
  onRestoreRevision?: (revisionId: string) => Promise<void> | void;
  onCreateCheckpoint?: (title: string) => Promise<void> | void;
}) {
  if (section === 'revisions') {
    return (
      <RevisionsView
        projectId={projectId || 'default'}
        currentNodesCount={nodes.length}
        currentEdgesCount={edges.length}
        onRestoreRevision={onRestoreRevision}
        onCreateCheckpoint={onCreateCheckpoint}
      />
    );
  }

  if (section === 'history') return (
    <div className="content-view">
      <div className="view-heading"><div><span className="panel-overline">Activity</span><h2>Research history</h2><p>Each run keeps its question, search trail, and review decisions.</p></div><FileClock size={21} /></div>
      {sessions.length === 0 ? <div className="empty-view"><FileClock size={22} /><strong>No research runs yet</strong><span>Use Research to add grounded proposals to this workspace.</span></div> :
        <div className="history-list">{sessions.map(session => <button className="history-row" key={session.id} onClick={() => onOpenSession(session)}>
          <span className="history-mode">{session.mode === 'deep' ? 'Deep research' : 'Quick research'}<i className={session.status === 'review' ? 'pending-dot' : 'done-dot'} /></span>
          <strong>{session.query}</strong><span className="history-summary">{session.summary}</span>
          <span className="history-meta">{new Date(session.createdAt).toLocaleString()} · {session.changes.filter(item => item.status === 'pending').length} awaiting review</span>
        </button>)}</div>}
    </div>
  );

  if (section === 'evidence') {
    const claims = nodes.filter(node => node.type === 'claim');
    return <div className="content-view">
      <div className="view-heading"><div><span className="panel-overline">Traceability</span><h2>Evidence paths</h2><p>Review how claims connect to source material.</p></div><ArrowDownRight size={21} /></div>
      {claims.length === 0 ? <div className="empty-view"><Quote size={22} /><strong>No claims to trace</strong><span>Add a claim and connect it to supporting or contradicting sources.</span></div> :
        <div className="evidence-list">{claims.map(claim => {
          const related = edges.filter(edge => edge.from === claim.id || edge.to === claim.id);
          return <article className="evidence-row" key={claim.id}>
            <button className="evidence-claim" onClick={() => onSelectNode(claim.id)}><span className={`status-dot status-${claim.metadata?.claimStatus || 'unverified'}`} />
              <span><strong>{claim.title}</strong><small>{(claim.metadata?.claimStatus || 'unverified').replaceAll('_', ' ')}</small></span><ArrowUpRight size={15} />
            </button>
            {related.length ? <div className="evidence-links">{related.map(edge => {
              const otherId = edge.from === claim.id ? edge.to : edge.from;
              const other = nodes.find(node => node.id === otherId);
              return <button key={edge.id} onClick={() => onSelectNode(otherId)}><span>{edge.label || 'related to'}</span><b>{other?.title || 'Missing record'}</b><small>{names[other?.type || ''] || 'Knowledge'} · {edge.metadata?.evidence ? 'evidence noted' : 'no excerpt saved'}</small></button>;
            })}</div> : <p className="no-path">No connected sources or related records yet.</p>}
          </article>;
        })}</div>}
    </div>;
  }

  let viewNodes = nodes;
  let title = 'Outline';
  let eyebrow = 'Structure';
  let description = 'A readable sequence of the ideas in this knowledge sheet.';
  if (section === 'sources') { viewNodes = nodes.filter(node => node.type === 'source' || node.type === 'link'); title = 'Sources'; eyebrow = 'Library'; description = 'Reference material saved in this workspace.'; }
  if (section === 'questions') { viewNodes = nodes.filter(node => node.type === 'question'); title = 'Open questions'; eyebrow = 'Next to explore'; description = 'Unresolved questions that can guide the next research run.'; }
  if (section === 'table') { viewNodes = nodes.filter(node => node.type === 'claim' || node.type === 'question'); title = 'Claims & questions'; eyebrow = 'Knowledge ledger'; description = 'Claims carry an explicit evidence status; questions remain open until resolved.'; }
  if (section === 'outline') viewNodes = nodes.filter(node => !['source', 'link', 'image'].includes(node.type));
  return <div className="content-view">
    <div className="view-heading"><div><span className="panel-overline">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{section === 'questions' ? <CircleHelp size={21} /> : <Layers2 size={21} />}</div>
    {viewNodes.length === 0 ? <div className="empty-view"><Layers2 size={22} /><strong>Nothing here yet</strong><span>Add a record from the graph or run research to build this view.</span></div> :
      <div className="records-list">{viewNodes.sort((a, b) => a.y - b.y || a.title.localeCompare(b.title)).map(node => {
        const connectedCount = edges.filter(edge => edge.from === node.id || edge.to === node.id).length;
        const linkThumb = (node.type === 'source' || node.type === 'link') ? getLinkThumbnail(node) : null;
        const previewImage = linkThumb?.thumbnailUrl;
        return <button className="record-row" key={node.id} onClick={() => onSelectNode(node.id)}>
          <span className={`record-icon type-${node.type}`}>
            {(node.type === 'source' || node.type === 'link') ? (
              <WebsiteLogo url={node.url} domain={node.domain} logo={node.metadata?.logo as string} size={16} />
            ) : node.type === 'question' ? (
              <CircleHelp size={16} />
            ) : node.type === 'claim' ? (
              <Quote size={16} />
            ) : (
              <Layers2 size={16} />
            )}
          </span>
          <span className="record-main"><span className="record-type">{names[node.type] || 'Knowledge'}{node.metadata?.origin === 'ai' ? ' · AI proposal' : ''}</span><strong>{node.title}</strong><small>{node.content || node.description || (node.url ? sourceHost(node.url) : 'No notes added')}</small></span>
          <span className="record-trailing">
            {node.metadata?.claimStatus && <em className={`status-pill status-${node.metadata.claimStatus}`}>{node.metadata.claimStatus.replaceAll('_', ' ')}</em>}
            {previewImage && (
              <img
                src={previewImage}
                alt=""
                className="source-thumb-mini"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
              />
            )}
            {(node.type === 'source' || node.type === 'link') && node.url && <ExternalLink size={14} />}
            {connectedCount > 0 && <small>{connectedCount} links</small>}
          </span>
        </button>;
      })}</div>}
  </div>;
}

function RevisionsView({
  projectId,
  currentNodesCount,
  currentEdgesCount,
  onRestoreRevision,
  onCreateCheckpoint
}: {
  projectId: string;
  currentNodesCount: number;
  currentEdgesCount: number;
  onRestoreRevision?: (revisionId: string) => Promise<void> | void;
  onCreateCheckpoint?: (title: string) => Promise<void> | void;
}) {
  const [revisions, setRevisions] = useState<GraphRevisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkpointTitle, setCheckpointTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);

  const fetchRevisions = useCallback(async () => {
    try {
      const res = await fetch(`/api/revisions?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      if (data.revisions) {
        setRevisions(data.revisions);
      }
    } catch (err) {
      console.error('Failed to fetch revisions:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/revisions?projectId=${encodeURIComponent(projectId)}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.revisions) {
          setRevisions(data.revisions);
        }
      })
      .catch(err => console.error('Failed to fetch revisions:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointTitle.trim() && !onCreateCheckpoint) return;
    setCreating(true);
    try {
      if (onCreateCheckpoint) {
        await onCreateCheckpoint(checkpointTitle.trim());
      } else {
        await fetch('/api/revisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            action: 'create',
            title: checkpointTitle.trim() || 'Manual Checkpoint'
          })
        });
      }
      setCheckpointTitle('');
      setShowCreateInput(false);
      await fetchRevisions();
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (id: string, title: string) => {
    const confirmRestore = window.confirm(`Restore this revision "${title}"? Any unsaved edits will be preserved in a new restore checkpoint.`);
    if (!confirmRestore) return;

    setRestoringId(id);
    try {
      if (onRestoreRevision) {
        await onRestoreRevision(id);
      } else {
        await fetch('/api/revisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, action: 'restore', revisionId: id })
        });
      }
      await fetchRevisions();
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch('/api/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'delete', revisionId: id })
      });
      setRevisions(current => current.filter(rev => rev.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="content-view">
      <div className="view-heading">
        <div>
          <span className="panel-overline">Version History</span>
          <h2>Persistent Revisions & Checkpoints</h2>
          <p>Time-travel to previous states. All revisions are stored permanently in local SQLite.</p>
        </div>
        <History size={21} />
      </div>

      <div className="revisions-toolbar">
        {showCreateInput ? (
          <form onSubmit={handleCreate} className="revisions-checkpoint-form">
            <input
              type="text"
              className="field-input revisions-checkpoint-input"
              placeholder="e.g. Before merging research notes..."
              value={checkpointTitle}
              autoFocus
              onChange={e => setCheckpointTitle(e.target.value)}
              disabled={creating}
            />
            <button type="submit" className="primary-button" disabled={creating}>
              {creating ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}
              <span>{creating ? 'Saving…' : 'Save'}</span>
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={() => { setShowCreateInput(false); setCheckpointTitle(''); }}
              disabled={creating}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '11px', color: '#3c6e71' }}>
              Current sheet: <strong>{currentNodesCount}</strong> records, <strong>{currentEdgesCount}</strong> links
            </span>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowCreateInput(true)}
            >
              <Plus size={14} />
              <span>Create checkpoint</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty-view">
          <LoaderCircle size={22} className="spin" />
          <strong>Loading revisions…</strong>
        </div>
      ) : revisions.length === 0 ? (
        <div className="empty-view">
          <History size={22} />
          <strong>No revisions recorded yet</strong>
          <span>Create a checkpoint above or make changes to start recording point-in-time snapshots.</span>
        </div>
      ) : (
        <div className="revisions-list">
          {revisions.map(rev => {
            const isRestoring = restoringId === rev.id;
            const isDeleting = deletingId === rev.id;
            const isRestored = rev.title.startsWith('Restored:');

            return (
              <div className="revision-card" key={rev.id}>
                <div className="revision-card-left">
                  <div className="revision-icon-wrap" style={isRestored ? { background: '#3c6e71', color: '#fff' } : undefined}>
                    <History size={16} />
                  </div>
                  <div className="revision-details">
                    <div className="revision-title-row">
                      <strong className="revision-title">{rev.title}</strong>
                      {isRestored && <span className="revision-badge">Restoration</span>}
                    </div>
                    <div className="revision-meta-row">
                      <span>{formatRelativeTime(rev.createdAt)}</span>
                      <span>·</span>
                      <span>{new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      <span className="revision-badge">{rev.nodeCount} records · {rev.edgeCount} relationships</span>
                    </div>
                  </div>
                </div>

                <div className="revision-actions">
                  <button
                    type="button"
                    className="restore-btn"
                    disabled={isRestoring || isDeleting}
                    onClick={() => handleRestore(rev.id, rev.title)}
                    title="Restore graph to this state"
                  >
                    {isRestoring ? <LoaderCircle size={13} className="spin" /> : <RotateCcw size={13} />}
                    <span>{isRestoring ? 'Restoring…' : 'Restore'}</span>
                  </button>
                  <button
                    type="button"
                    className="delete-rev-btn"
                    disabled={isRestoring || isDeleting}
                    onClick={() => handleDelete(rev.id)}
                    title="Delete this revision"
                    aria-label="Delete revision"
                  >
                    {isDeleting ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

