'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CanvasNode } from '@/types/canvas';
import { NodeInspector } from './NodeInspector';
import { nodeLabel } from './nodes/BaseKnowledgeCard';

/**
 * Full-screen editor for one note or cluster. The board stays visible behind a blur; on the left the note
 * lands and re-pins itself as a live preview, on the right the Properties form edits it in place.
 */
export function NoteEditor({ node, relationshipCount, projectId, allNodes, onUpdate, onDelete, onClose }: {
  node: CanvasNode;
  relationshipCount: number;
  projectId?: string;
  allNodes: CanvasNode[];
  onUpdate: (fields: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const isCluster = node.type === 'group' || node.type === 'section';
  const color = node.color?.startsWith('#') ? node.color : undefined;
  const summary = (node.content || node.description || '').replace(/[#*_`>[\]]/g, '').trim();

  // Focus the title on open and give focus back to whatever opened the editor on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>('#node-title')?.focus());
    return () => opener?.focus?.();
  }, []);

  // Keep Tab inside the dialog.
  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return (
    <div className="note-editor-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} className="note-editor" role="dialog" aria-modal="true" aria-labelledby="note-editor-title" onKeyDown={trapTab}>
        <header className="note-editor-head">
          <h2 id="note-editor-title">Edit {isCluster ? 'cluster' : (nodeLabel[node.type] || 'idea').toLowerCase()}</h2>
          <div>
            <button type="button" className="ink-button" onClick={onClose}>Done</button>
            <button type="button" className="icon-button" aria-label="Close editor" onClick={onClose}><X size={20} strokeWidth={1.75} /></button>
          </div>
        </header>

        <div className="note-editor-body">
          <div className="note-editor-board" aria-hidden="true">
            {isCluster ? (
              <div className={`editor-preview-cluster ${color ? 'has-color' : ''}`} style={color ? { ['--cluster-ink' as `--${string}`]: color } : undefined}>
                <span className="group-tape"><strong>{node.title || 'Untitled cluster'}</strong></span>
              </div>
            ) : (
              <article
                className={`knowledge-card type-${node.type} editor-preview-note ${color ? 'has-color' : ''}`}
                style={color ? { ['--note-ink' as `--${string}`]: color } : undefined}
              >
                <span className="note-pin" />
                <h2>{node.title || 'Untitled idea'}</h2>
                {summary && <p className="node-summary">{summary.length > 220 ? `${summary.slice(0, 220)}…` : summary}</p>}
                <p className="note-meta">{nodeLabel[node.type] || 'Idea'}{node.metadata?.origin === 'ai' ? ' · From research' : ''}</p>
              </article>
            )}
            <p className="note-editor-hint">Changes save as you type.</p>
          </div>

          <div className="note-editor-form">
            <NodeInspector
              hideHeader
              floating={false}
              node={node}
              relationshipCount={relationshipCount}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onClose={onClose}
              projectId={projectId}
              allNodes={allNodes}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
