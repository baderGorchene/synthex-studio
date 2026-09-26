'use client';

import { useState } from 'react';
import { Check, ExternalLink, LoaderCircle, Sparkles, Trash2, X } from 'lucide-react';
import { CanvasNode, CanvasNodeType, ELEMENT_PALETTE } from '@/types/canvas';
import { MarkdownEditor } from './MarkdownEditor';
import { CustomSelect } from './CustomSelect';
import { WebsiteLogo, WebsiteImage, getWebsiteDomain } from '@/components/canvas/SourceMetadata';

const types: Array<{ id: CanvasNodeType; label: string }> = [
  { id: 'concept', label: 'Concept' }, { id: 'claim', label: 'Claim' }, { id: 'question', label: 'Question' },
  { id: 'hypothesis', label: 'Hypothesis' }, { id: 'source', label: 'Source' }, { id: 'note', label: 'Note' },
  { id: 'group', label: 'Knowledge cluster' }, { id: 'section', label: 'Knowledge cluster (legacy)' },
  { id: 'link', label: 'Source (legacy)' }, { id: 'image', label: 'Image source' }, { id: 'task', label: 'Research task' },
  { id: 'research_result', label: 'Research result' }, { id: 'ai_insight', label: 'AI insight' }
];

export function NodeInspector({
  node, relationshipCount, onUpdate, onDelete, onClose, floating = false, hideHeader = false
}: {
  node: CanvasNode;
  relationshipCount: number;
  onUpdate: (fields: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  floating?: boolean;
  hideHeader?: boolean;
}) {
  const isClaim = node.type === 'claim';
  let safeUrl: string | undefined;
  try {
    const parsed = new URL(node.url || '');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeUrl = parsed.href;
  } catch { /* Keep malformed source text editable without making it clickable. */ }
  return (
    <aside className={`inspector-panel ${floating ? 'floating-inspector' : ''}`} aria-label="Node details">
      {!hideHeader && (
        <div className="inspector-head">
          <div className="inspector-title"><span className="panel-overline">Knowledge record</span><h2>Details</h2></div>
          <button className="icon-button" aria-label="Close details" onClick={onClose}><X size={17} /></button>
        </div>
      )}
      <label className="field-label" htmlFor="node-title">Title</label>
      <input id="node-title" className="field-input title-input" maxLength={500} value={node.title} onChange={event => onUpdate({ title: event.target.value })} onBlur={() => { if (!node.title.trim()) onUpdate({ title: node.type === 'group' || node.type === 'section' ? 'Untitled cluster' : 'Untitled record' }); }} />

      <label className="field-label" htmlFor="node-kind">Record type</label>
      <CustomSelect className="field-input" ariaLabel="Record type" value={node.type} options={types.map(item => ({ value: item.id, label: item.label }))} onChange={value => {
        const type = value as CanvasNodeType;
        onUpdate({ type, ...(type === 'claim' && !node.metadata?.claimStatus ? { metadata: { ...node.metadata, claimStatus: 'unverified' } } : {}) });
      }} />

      <div className="inspector-color-section">
        <div className="inspector-color-head">
          <label className="field-label" style={{ margin: 0 }}>Color accent</label>
          {node.color && (
            <button
              type="button"
              className="color-reset-btn"
              onClick={() => onUpdate({ color: undefined })}
              title="Reset to default color"
            >
              Reset
            </button>
          )}
        </div>
        <div className="inspector-palette-grid" role="radiogroup" aria-label="Select accent color">
          {ELEMENT_PALETTE.map(hex => {
            const isSelected = node.color?.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`palette-swatch ${isSelected ? 'is-selected' : ''}`}
                style={{ backgroundColor: hex }}
                onClick={() => onUpdate({ color: isSelected ? undefined : hex })}
                title={`Accent: ${hex}`}
              >
                {isSelected && <Check size={12} className="swatch-check" />}
              </button>
            );
          })}
        </div>
      </div>

      <label className="field-label" htmlFor="node-content">Notes</label>
      {node.type === 'note' ? <MarkdownEditor className="inspector-markdown-editor" ariaLabel="Note content in Markdown" value={node.content || ''} onChange={content => onUpdate({ content })} /> : <textarea id="node-content" className="field-input field-textarea" maxLength={50000} placeholder="Add a description, evidence, or a working thought…" value={node.content || ''} onChange={event => onUpdate({ content: event.target.value })} />}

      {(node.type === 'source' || node.type === 'link') && (
        <SourceInspectorSection node={node} safeUrl={safeUrl} onUpdate={onUpdate} />
      )}

      {isClaim && <>
        <label className="field-label" htmlFor="claim-status">Evidence status</label>
        <CustomSelect className="field-input" ariaLabel="Evidence status" value={node.metadata?.claimStatus || 'unverified'} options={[
          { value: 'unverified', label: 'Unverified' }, { value: 'weakly_supported', label: 'Weakly supported' }, { value: 'supported', label: 'Supported' },
          { value: 'disputed', label: 'Disputed' }, { value: 'contradicted', label: 'Contradicted' }, { value: 'outdated', label: 'Outdated' }
        ]} onChange={value => onUpdate({ metadata: { ...node.metadata, claimStatus: value as NonNullable<CanvasNode['metadata']>['claimStatus'] } })} />
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

function SourceInspectorSection({
  node,
  safeUrl,
  onUpdate
}: {
  node: CanvasNode;
  safeUrl?: string;
  onUpdate: (fields: Partial<CanvasNode>) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveDomain = getWebsiteDomain(node.url, node.domain);
  const websiteLogo = (node.metadata?.logo as string) || (node.metadata?.favicon as string);
  const siteName = (node.metadata?.siteName as string);
  const previewImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);

  const handleFetchMetadata = async () => {
    if (!node.url || !node.url.trim()) return;
    setFetching(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(node.url.trim())}`);
      const data = await response.json();
      if (!response.ok || data.error) {
        setErrorMsg(data.error || 'Failed to extract metadata');
        return;
      }

      const updates: Partial<CanvasNode> = {
        domain: data.domain || node.domain,
        metadata: {
          ...node.metadata,
          siteName: data.siteName || node.metadata?.siteName,
          logo: data.logo || node.metadata?.logo,
          image: data.image || node.metadata?.image
        }
      };

      if (data.image) {
        updates.imageUrl = data.image;
      }
      if ((!node.title || node.title === 'New source' || node.title.startsWith('http')) && data.title) {
        updates.title = data.title;
      }
      if (!node.description && data.description) {
        updates.description = data.description;
      }
      if (!node.content && data.description) {
        updates.content = data.description;
      }

      onUpdate(updates);
    } catch {
      setErrorMsg('Could not fetch website metadata');
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <label className="field-label" htmlFor="node-url">Source URL</label>
      <div className="url-edit-row">
        <input
          id="node-url"
          className="field-input"
          type="url"
          maxLength={4096}
          value={node.url || ''}
          placeholder="https://..."
          onChange={event => onUpdate({ url: event.target.value })}
        />
        {safeUrl && (
          <a
            className="icon-button"
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open source"
            title="Open external website"
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>

      <button
        type="button"
        className="fetch-meta-btn"
        disabled={fetching || !node.url?.trim()}
        onClick={handleFetchMetadata}
      >
        {fetching ? (
          <>
            <LoaderCircle size={13} className="spin" />
            <span>Fetching metadata…</span>
          </>
        ) : (
          <>
            <Sparkles size={13} />
            <span>Auto-fetch website metadata</span>
          </>
        )}
      </button>

      {errorMsg && <p className="meta-status-hint">{errorMsg}</p>}

      {/* Website Preview Card */}
      {(effectiveDomain || safeUrl || websiteLogo || previewImage) && (
        <div className="inspector-website-preview">
          <div className="website-preview-header">
            <WebsiteLogo url={safeUrl} domain={effectiveDomain} logo={websiteLogo} size={18} />
            <div className="website-preview-info">
              <strong className="website-preview-name">{siteName || effectiveDomain || 'Website'}</strong>
              <small className="website-preview-domain">{effectiveDomain || 'web-source'}</small>
            </div>
            {safeUrl && (
              <a
                href={safeUrl}
                target="_blank"
                rel="noreferrer"
                className="website-preview-external"
                title="Open website"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Website Image Preview */}
          {previewImage ? (
            <div className="inspector-image-wrap">
              <WebsiteImage
                imageUrl={previewImage}
                alt={node.title}
                maxHeight={110}
              />
              <button
                type="button"
                className="inspector-image-remove-btn"
                title="Remove preview image"
                onClick={() => onUpdate({ imageUrl: undefined, metadata: { ...node.metadata, image: undefined } })}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="inspector-image-empty">
              <input
                type="url"
                placeholder="Paste website preview image URL..."
                className="field-input image-url-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      onUpdate({ imageUrl: val, metadata: { ...node.metadata, image: val } });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val) {
                    onUpdate({ imageUrl: val, metadata: { ...node.metadata, image: val } });
                    e.target.value = '';
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
