'use client';

import { ExternalLink, Trash2, X } from 'lucide-react';
import type { CanvasNode, CanvasNodeType } from '@/types/canvas';

const types: Array<{ id: CanvasNodeType; label: string }> = [
  { id: 'concept', label: 'Concept' }, { id: 'claim', label: 'Claim' }, { id: 'question', label: 'Question' },
  { id: 'hypothesis', label: 'Hypothesis' }, { id: 'source', label: 'Source' }, { id: 'note', label: 'Note' },
  { id: 'group', label: 'Knowledge cluster' }, { id: 'section', label: 'Knowledge cluster (legacy)' },
  { id: 'link', label: 'Source (legacy)' }, { id: 'image', label: 'Image source' }, { id: 'task', label: 'Research task' },
  { id: 'research_result', label: 'Research result' }, { id: 'ai_insight', label: 'AI insight' }
];

export function NodeInspector({
  node, relationshipCount, onUpdate, onDelete, onClose
}: {
  node: CanvasNode;
  relationshipCount: number;
  onUpdate: (fields: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const isClaim = node.type === 'claim';
  let safeUrl: string | undefined;
  try {
    const parsed = new URL(node.url || '');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeUrl = parsed.href;
  } catch { /* Keep malformed source text editable without making it clickable. */ }
  return (
    <aside className="inspector-panel" aria-label="Node details">
      <div className="inspector-head">
        <div><span className="panel-overline">Knowledge record</span><h2>Details</h2></div>
        <button className="icon-button" aria-label="Close details" onClick={onClose}><X size={17} /></button>
      </div>
      <label className="field-label" htmlFor="node-title">Title</label>
      <input id="node-title" className="field-input title-input" maxLength={500} value={node.title} onChange={event => onUpdate({ title: event.target.value })} onBlur={() => { if (!node.title.trim()) onUpdate({ title: node.type === 'group' || node.type === 'section' ? 'Untitled cluster' : 'Untitled record' }); }} />

      <label className="field-label" htmlFor="node-kind">Record type</label>
      <select id="node-kind" className="field-input" value={node.type} onChange={event => {
        const type = event.target.value as CanvasNodeType;
        onUpdate({ type, ...(type === 'claim' && !node.metadata?.claimStatus ? { metadata: { ...node.metadata, claimStatus: 'unverified' } } : {}) });
      }}>
        {types.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>

      <label className="field-label" htmlFor="node-content">Notes</label>
      <textarea id="node-content" className="field-input field-textarea" maxLength={50000} placeholder="Add a description, evidence, or a working thought…" value={node.content || ''} onChange={event => onUpdate({ content: event.target.value })} />

      {(node.type === 'source' || node.type === 'link') && <>
        <label className="field-label" htmlFor="node-url">Source URL</label>
        <div className="url-edit-row">
          <input id="node-url" className="field-input" type="url" maxLength={4096} value={node.url || ''} placeholder="https://" onChange={event => onUpdate({ url: event.target.value })} />
          {safeUrl && <a className="icon-button" href={safeUrl} target="_blank" rel="noreferrer" aria-label="Open source"><ExternalLink size={15} /></a>}
        </div>
      </>}

      {isClaim && <>
        <label className="field-label" htmlFor="claim-status">Evidence status</label>
        <select id="claim-status" className="field-input" value={node.metadata?.claimStatus || 'unverified'} onChange={event => onUpdate({ metadata: { ...node.metadata, claimStatus: event.target.value as NonNullable<CanvasNode['metadata']>['claimStatus'] } })}>
          <option value="unverified">Unverified</option><option value="weakly_supported">Weakly supported</option>
          <option value="supported">Supported</option><option value="disputed">Disputed</option>
          <option value="contradicted">Contradicted</option><option value="outdated">Outdated</option>
        </select>
      </>}

      <div className="inspector-facts">
        <div><span>Origin</span><strong>{node.metadata?.origin || 'user'}</strong></div>
        <div><span>Relationships</span><strong>{relationshipCount}</strong></div>
        {typeof node.metadata?.confidence === 'number' && <div><span>AI confidence</span><strong>{Math.round(node.metadata.confidence * 100)}%</strong></div>}
      </div>
      {node.metadata?.rationale && <p className="inspector-rationale">{node.metadata.rationale}</p>}
      <button className="danger-button" onClick={onDelete}><Trash2 size={15} /> Delete record</button>
    </aside>
  );
}
