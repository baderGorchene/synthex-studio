'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasNode } from '@/types/canvas';
import type { KnowledgeGraph } from '@/lib/graph';
import { buildDocument, sourceHost } from '@/lib/document';
import { MarkdownView } from './MarkdownView';

export function DocumentPane({ graph, title, selectedIds, draftCount, onSelect, onUpdate, fullWidth }: {
  graph: KnowledgeGraph;
  title: string;
  selectedIds: string[];
  draftCount: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
  fullWidth?: boolean;
}) {
  const { sections, sources } = useMemo(() => buildDocument(graph), [graph]);
  const [editingBody, setEditingBody] = useState<string | null>(null);
  const paneRef = useRef<HTMLElement>(null);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : undefined;

  useEffect(() => {
    if (!selectedId) return;
    paneRef.current?.querySelector(`[data-doc-node="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const editableTitle = (node: CanvasNode, Tag: 'h2' | 'h3') => (
    <Tag
      contentEditable
      suppressContentEditableWarning
      spellCheck
      aria-label={`${node.type === 'question' ? 'Question' : 'Idea'} title`}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
      onBlur={event => {
        const text = event.currentTarget.textContent?.trim();
        if (text && text !== node.title) onUpdate(node.id, { title: text.slice(0, 500) });
        else event.currentTarget.textContent = node.title;
      }}
    >
      {node.title}
    </Tag>
  );

  const body = (node: CanvasNode) => {
    const text = node.content || node.description || '';
    if (editingBody === node.id) {
      return (
        <textarea
          className="doc-body-editor"
          autoFocus
          defaultValue={text}
          aria-label={`Notes for ${node.title}`}
          onBlur={event => { if (event.currentTarget.value !== text) onUpdate(node.id, { content: event.currentTarget.value }); setEditingBody(null); }}
          onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.blur(); }}
        />
      );
    }
    return (
      <button type="button" className="doc-body" onClick={() => setEditingBody(node.id)} aria-label={`Edit notes for ${node.title}`}>
        {text ? <MarkdownView content={text} /> : <span className="doc-placeholder">Add notes…</span>}
      </button>
    );
  };

  const isEmpty = sections.every(section => !section.head && section.blocks.length === 0) && sources.length === 0;

  return (
    <aside ref={paneRef} className={`document-pane ${fullWidth ? 'is-full' : ''}`} aria-label="Document">
      <div className="doc-column">
        <h1>{title}</h1>
        <p className="doc-meta">
          {Object.keys(graph.nodesById).length} ideas · {sources.length} {sources.length === 1 ? 'source' : 'sources'} · written from your map{draftCount ? ` · ${draftCount} drafts waiting on the map` : ''}
        </p>
        {isEmpty && <p className="doc-empty">Your document writes itself as the map grows. Ask a question on the map to start.</p>}
        {sections.map((section, index) => (
          <section key={section.head?.id || `rest-${index}`} className="doc-section">
            {section.head ? (
              <div data-doc-node={section.head.id} className={`doc-block is-head ${selectedId === section.head.id ? 'is-selected' : ''}`} onClick={() => onSelect(section.head!.id)}>
                {editableTitle(section.head, 'h2')}
                {(section.head.content || section.head.description) && body(section.head)}
              </div>
            ) : sections.length > 1 && <h2 className="doc-rest-heading">More ideas</h2>}
            {section.blocks.map(({ node, citations }) => (
              <div key={node.id} data-doc-node={node.id} className={`doc-block ${selectedId === node.id ? 'is-selected' : ''}`} onClick={() => onSelect(node.id)}>
                {editableTitle(node, 'h3')}
                {body(node)}
                {citations.length > 0 && <p className="doc-cites">Sources {citations.join(', ')}</p>}
              </div>
            ))}
          </section>
        ))}
        {sources.length > 0 && (
          <section className="doc-sources">
            <h2>Sources</h2>
            <ol>
              {sources.map(source => (
                <li key={source.id} data-doc-node={source.id} className={selectedId === source.id ? 'is-selected' : ''} onClick={() => onSelect(source.id)}>
                  <span>{source.title}</span>
                  {source.url && <a href={source.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{sourceHost(source.url, source.domain)}</a>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </aside>
  );
}
