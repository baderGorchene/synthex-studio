'use client';

import { ArrowDownRight, ArrowUpRight, CircleHelp, ExternalLink, FileClock, Layers2, Quote } from 'lucide-react';
import type { CanvasNode, Connection, ResearchSession } from '@/types/canvas';
import type { WorkspaceSection } from './WorkspaceSidebar';

const names: Record<string, string> = {
  concept: 'Concept', claim: 'Claim', question: 'Question', hypothesis: 'Hypothesis', source: 'Source',
  link: 'Source', note: 'Note', group: 'Cluster', section: 'Cluster', ai_insight: 'AI insight', research_result: 'Research result'
};

function sourceHost(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : 'Invalid source URL';
  } catch { return 'Invalid source URL'; }
}

export function KnowledgeViews({
  section, nodes, edges, sessions, onSelectNode, onOpenSession
}: {
  section: WorkspaceSection;
  nodes: CanvasNode[];
  edges: Connection[];
  sessions: ResearchSession[];
  onSelectNode: (id: string) => void;
  onOpenSession: (session: ResearchSession) => void;
}) {
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
        return <button className="record-row" key={node.id} onClick={() => onSelectNode(node.id)}>
          <span className={`record-icon type-${node.type}`}>{node.type === 'question' ? <CircleHelp size={16} /> : node.type === 'claim' ? <Quote size={16} /> : <Layers2 size={16} />}</span>
          <span className="record-main"><span className="record-type">{names[node.type] || 'Knowledge'}{node.metadata?.origin === 'ai' ? ' · AI proposal' : ''}</span><strong>{node.title}</strong><small>{node.content || node.description || (node.url ? sourceHost(node.url) : 'No notes added')}</small></span>
          <span className="record-trailing">{node.metadata?.claimStatus && <em className={`status-pill status-${node.metadata.claimStatus}`}>{node.metadata.claimStatus.replaceAll('_', ' ')}</em>}{(node.type === 'source' || node.type === 'link') && node.url && <ExternalLink size={14} />}{connectedCount > 0 && <small>{connectedCount} links</small>}</span>
        </button>;
      })}</div>}
  </div>;
}
