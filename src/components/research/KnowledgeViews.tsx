'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CircleHelp, Database, Download, ExternalLink, FileClock, FileText, History, Layers2, LoaderCircle, Plus, Quote, RotateCcw, Trash2 } from 'lucide-react';
import type { CanvasNode, Connection, DatabaseSnapshotSummary, GraphRevisionSummary, ResearchSession } from '@/types/canvas';
import type { WorkspaceSection } from './WorkspaceSidebar';
import { WebsiteLogo, getLinkThumbnail } from './SourceMetadata';
import { FileViewerModal } from './FileAndMediaModal';
import { extractPageNumber } from '@/utils/citation';

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function sourceHost(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : 'Invalid source URL';
  } catch { return 'Invalid source URL'; }
}

export function KnowledgeViews({
  section, nodes, edges, sessions, onSelectNode, onOpenSession, projectId, onRestoreRevision, onCreateCheckpoint, onRestoreDatabase
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
  onRestoreDatabase?: () => Promise<void> | void;
}) {
  const [activePdfPreview, setActivePdfPreview] = useState<{
    fileData: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    initialPage?: number;
    highlightExcerpt?: string;
  } | null>(null);

  if (section === 'revisions') {
    return (
      <RevisionsView
        projectId={projectId || 'default'}
        currentNodesCount={nodes.length}
        currentEdgesCount={edges.length}
        onRestoreRevision={onRestoreRevision}
        onCreateCheckpoint={onCreateCheckpoint}
        onRestoreDatabase={onRestoreDatabase}
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
            {claim.metadata?.evidence?.length ? (
              <div className="card-evidence-list" style={{ margin: '6px 0 10px 0' }}>
                {claim.metadata.evidence.map((ev, idx) => {
                  const src = nodes.find(n => n.id === ev.sourceId);
                  const pageNum = ev.page || extractPageNumber(ev.location);
                  const isContradiction = ev.relation === 'contradicts';
                  const hasPdf = Boolean(src?.fileData && (src.fileType?.includes('pdf') || src.fileName?.toLowerCase().endsWith('.pdf') || src.fileData.startsWith('data:application/pdf')));

                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`card-evidence-pill ${isContradiction ? 'contradicts' : 'supports'} ${hasPdf ? 'has-pdf' : ''}`}
                      title={ev.excerpt ? `“${ev.excerpt}” — Click to ${hasPdf ? 'open PDF citation' : 'view source'}` : `Source: ${src?.title || ev.sourceId}`}
                      onClick={() => {
                        if (hasPdf && src?.fileData) {
                          setActivePdfPreview({
                            fileData: src.fileData,
                            fileName: src.fileName || src.title,
                            fileSize: src.fileSize,
                            fileType: src.fileType || 'application/pdf',
                            initialPage: pageNum,
                            highlightExcerpt: ev.excerpt
                          });
                        } else if (src) {
                          onSelectNode(src.id);
                        }
                      }}
                    >
                      <span className="evidence-relation-dot" />
                      <span className="evidence-source-title">{src?.title || ev.sourceId}</span>
                      {pageNum && <span className="evidence-page-badge">p.{pageNum}</span>}
                      {hasPdf && <FileText size={10} className="evidence-pdf-icon" />}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {related.length ? <div className="evidence-links">{related.map(edge => {
              const otherId = edge.from === claim.id ? edge.to : edge.from;
              const other = nodes.find(node => node.id === otherId);
              return <button key={edge.id} onClick={() => onSelectNode(otherId)}><span>{edge.label || 'related to'}</span><b>{other?.title || 'Missing record'}</b><small>{names[other?.type || ''] || 'Knowledge'} · {edge.metadata?.evidence ? 'evidence noted' : 'no excerpt saved'}</small></button>;
            })}</div> : <p className="no-path">No connected sources or related records yet.</p>}
          </article>;
        })}</div>}

      {activePdfPreview && (
        <FileViewerModal
          fileData={activePdfPreview.fileData}
          fileName={activePdfPreview.fileName}
          fileSize={activePdfPreview.fileSize}
          fileType={activePdfPreview.fileType}
          initialPage={activePdfPreview.initialPage}
          highlightExcerpt={activePdfPreview.highlightExcerpt}
          onClose={() => setActivePdfPreview(null)}
        />
      )}
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
  onCreateCheckpoint,
  onRestoreDatabase
}: {
  projectId: string;
  currentNodesCount: number;
  currentEdgesCount: number;
  onRestoreRevision?: (revisionId: string) => Promise<void> | void;
  onCreateCheckpoint?: (title: string) => Promise<void> | void;
  onRestoreDatabase?: () => Promise<void> | void;
}) {
  const [activeTab, setActiveTab] = useState<'revisions' | 'snapshots'>('revisions');

  // Revisions state
  const [revisions, setRevisions] = useState<GraphRevisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkpointTitle, setCheckpointTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);

  // Snapshots state
  const [snapshots, setSnapshots] = useState<DatabaseSnapshotSummary[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [showSnapshotInput, setShowSnapshotInput] = useState(false);
  const [restoringSnapshotFile, setRestoringSnapshotFile] = useState<string | null>(null);
  const [deletingSnapshotFile, setDeletingSnapshotFile] = useState<string | null>(null);

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

  const fetchSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      if (data.snapshots) {
        setSnapshots(data.snapshots);
      }
    } catch (err) {
      console.error('Failed to fetch snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

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

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSnapshot(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', label: snapshotLabel.trim() || undefined })
      });
      const data = await res.json();
      if (data.success && data.snapshot) {
        setSnapshots(curr => [data.snapshot, ...curr]);
        setSnapshotLabel('');
        setShowSnapshotInput(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create database snapshot');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (fileName: string, label: string) => {
    const confirmed = window.confirm(
      `RESTORE DATABASE SNAPSHOT\n\nAre you sure you want to restore "${label}"?\n\nThis will overwrite the entire canvas.db database with this snapshot. All workspaces will revert to the snapshot state.`
    );
    if (!confirmed) return;

    setRestoringSnapshotFile(fileName);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', fileName })
      });
      const data = await res.json();
      if (data.success) {
        if (onRestoreDatabase) {
          await onRestoreDatabase();
        } else {
          window.location.reload();
        }
      } else {
        alert(data.error || 'Could not restore snapshot');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not restore snapshot');
    } finally {
      setRestoringSnapshotFile(null);
    }
  };

  const handleDeleteSnapshot = async (fileName: string) => {
    const confirmed = window.confirm(`Delete snapshot "${fileName}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingSnapshotFile(fileName);
    try {
      await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', fileName })
      });
      setSnapshots(curr => curr.filter(s => s.fileName !== fileName));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete snapshot');
    } finally {
      setDeletingSnapshotFile(null);
    }
  };

  return (
    <div className="content-view">
      <div className="view-heading">
        <div>
          <span className="panel-overline">Version History & Recovery</span>
          <h2>{activeTab === 'revisions' ? 'Persistent Revisions & Checkpoints' : 'Workspace Database Snapshots'}</h2>
          <p>
            {activeTab === 'revisions'
              ? 'Time-travel to previous states in this workspace. All revisions are stored permanently in local SQLite.'
              : 'Full offline SQLite snapshots of canvas.db. Backs up all projects, nodes, links, and history.'}
          </p>
        </div>
        {activeTab === 'revisions' ? <History size={21} /> : <Database size={21} />}
      </div>

      <div className="revisions-tabs">
        <button
          type="button"
          className={`revisions-tab ${activeTab === 'revisions' ? 'active' : ''}`}
          onClick={() => { setActiveTab('revisions'); fetchRevisions(); }}
        >
          <History size={14} />
          <span>Project Checkpoints ({revisions.length})</span>
        </button>
        <button
          type="button"
          className={`revisions-tab ${activeTab === 'snapshots' ? 'active' : ''}`}
          onClick={() => { setActiveTab('snapshots'); fetchSnapshots(); }}
        >
          <Database size={14} />
          <span>Database Snapshots ({snapshots.length})</span>
        </button>
      </div>

      {activeTab === 'revisions' ? (
        <>
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
        </>
      ) : (
        <>
          <div className="revisions-toolbar">
            {showSnapshotInput ? (
              <form onSubmit={handleCreateSnapshot} className="revisions-checkpoint-form">
                <input
                  type="text"
                  className="field-input revisions-checkpoint-input"
                  placeholder="e.g. Before importing large dataset..."
                  value={snapshotLabel}
                  autoFocus
                  onChange={e => setSnapshotLabel(e.target.value)}
                  disabled={creatingSnapshot}
                />
                <button type="submit" className="primary-button" disabled={creatingSnapshot}>
                  {creatingSnapshot ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}
                  <span>{creatingSnapshot ? 'Creating…' : 'Create Snapshot'}</span>
                </button>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => { setShowSnapshotInput(false); setSnapshotLabel(''); }}
                  disabled={creatingSnapshot}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '11px', color: '#3c6e71' }}>
                  Offline SQLite snapshots stored in <code>.backups/</code>
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href="/api/backup?download=1"
                    className="download-snap-btn"
                    title="Download active canvas.db SQLite database"
                  >
                    <Download size={13} />
                    <span>Download canvas.db</span>
                  </a>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setShowSnapshotInput(true)}
                  >
                    <Plus size={14} />
                    <span>Create DB Snapshot</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {loadingSnapshots ? (
            <div className="empty-view">
              <LoaderCircle size={22} className="spin" />
              <strong>Loading database snapshots…</strong>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="empty-view">
              <Database size={22} />
              <strong>No database snapshots taken yet</strong>
              <span>Create a snapshot above to backup the entire offline SQLite database.</span>
            </div>
          ) : (
            <div className="revisions-list">
              {snapshots.map(snap => {
                const isRestoring = restoringSnapshotFile === snap.fileName;
                const isDeleting = deletingSnapshotFile === snap.fileName;

                return (
                  <div className="revision-card" key={snap.id}>
                    <div className="revision-card-left">
                      <div className="revision-icon-wrap" style={{ background: '#284b63', color: '#fff' }}>
                        <Database size={16} />
                      </div>
                      <div className="revision-details">
                        <div className="revision-title-row">
                          <strong className="revision-title">{snap.label}</strong>
                          <span className="revision-badge">{snap.fileName}</span>
                        </div>
                        <div className="revision-meta-row">
                          <span>{formatRelativeTime(snap.createdAt)}</span>
                          <span>·</span>
                          <span>{new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>·</span>
                          <span>{formatBytes(snap.sizeBytes)}</span>
                          <span>·</span>
                          <span className="revision-badge">{snap.projectCount} projects · {snap.nodeCount} records · {snap.edgeCount} relationships</span>
                        </div>
                      </div>
                    </div>

                    <div className="revision-actions">
                      <a
                        href={`/api/backup?download=1&fileName=${encodeURIComponent(snap.fileName)}`}
                        className="download-snap-btn"
                        title="Download this SQLite snapshot file"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </a>
                      <button
                        type="button"
                        className="restore-btn"
                        disabled={isRestoring || isDeleting}
                        onClick={() => handleRestoreSnapshot(snap.fileName, snap.label)}
                        title="Restore full database from this snapshot"
                      >
                        {isRestoring ? <LoaderCircle size={13} className="spin" /> : <RotateCcw size={13} />}
                        <span>{isRestoring ? 'Restoring…' : 'Restore'}</span>
                      </button>
                      <button
                        type="button"
                        className="delete-rev-btn"
                        disabled={isRestoring || isDeleting}
                        onClick={() => handleDeleteSnapshot(snap.fileName)}
                        title="Delete this snapshot"
                        aria-label="Delete snapshot"
                      >
                        {isDeleting ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

