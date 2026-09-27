import { useState } from 'react';
import { Check, ExternalLink, Images, LoaderCircle, Maximize2, Paperclip, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { CanvasNode, CanvasNodeType, ELEMENT_PALETTE, formatFileSize } from '@/types/canvas';
import { uploadFile } from '@/lib/upload';
import { MarkdownEditor } from './MarkdownEditor';
import { CustomSelect } from './CustomSelect';
import { WebsiteLogo, WebsiteImage, getWebsiteDomain, extractYouTubeVideoId } from './SourceMetadata';
import { AttachedFileBadge, FileViewerModal, ImageViewerModal } from './FileAndMediaModal';

const types: Array<{ id: CanvasNodeType; label: string }> = [
  { id: 'note', label: 'Note & Idea' },
  { id: 'claim', label: 'Claim & Inquiry' },
  { id: 'source', label: 'Document & Source' },
  { id: 'image', label: 'Media & Figure' },
  { id: 'link', label: 'Link & Website' },
  { id: 'group', label: 'Knowledge cluster' },
  { id: 'concept', label: 'Concept (legacy)' },
  { id: 'hypothesis', label: 'Hypothesis (legacy)' },
  { id: 'question', label: 'Question (legacy)' },
  { id: 'section', label: 'Knowledge cluster (legacy)' },
  { id: 'task', label: 'Research task' },
  { id: 'research_result', label: 'Research result' },
  { id: 'ai_insight', label: 'AI insight' }
];

export function NodeInspector({
  node, relationshipCount, onUpdate, onDelete, onClose, floating = false, hideHeader = false, projectId
}: {
  node: CanvasNode;
  relationshipCount: number;
  onUpdate: (fields: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  floating?: boolean;
  hideHeader?: boolean;
  projectId?: string;
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

      <label className="field-label" htmlFor="node-content">Notes & Content</label>
      {node.type === 'note' ? <MarkdownEditor className="inspector-markdown-editor" ariaLabel="Note content in Markdown" value={node.content || ''} onChange={content => onUpdate({ content })} /> : <textarea id="node-content" className="field-input field-textarea" maxLength={50000} placeholder="Add a description, evidence, or a working thought…" value={node.content || ''} onChange={event => onUpdate({ content: event.target.value })} />}

      {node.type === 'image' && (
        <ImageInspectorSection node={node} onUpdate={onUpdate} projectId={projectId} />
      )}

      {(node.type === 'source' || node.type === 'link') && (
        <SourceInspectorSection node={node} safeUrl={safeUrl} onUpdate={onUpdate} projectId={projectId} />
      )}

      {isClaim && <>
        <label className="field-label" htmlFor="claim-status">Evidence status</label>
        <CustomSelect className="field-input" ariaLabel="Evidence status" value={node.metadata?.claimStatus || 'unverified'} options={[
          { value: 'unverified', label: 'Unverified' },
          { value: 'open_question', label: '❓ Open inquiry / Question' },
          { value: 'weakly_supported', label: 'Weakly supported' },
          { value: 'supported', label: 'Supported' },
          { value: 'disputed', label: 'Disputed' },
          { value: 'contradicted', label: 'Contradicted' },
          { value: 'outdated', label: 'Outdated' }
        ]} onChange={value => onUpdate({ metadata: { ...node.metadata, claimStatus: value as NonNullable<CanvasNode['metadata']>['claimStatus'] } })} />
      </>}

      <div className="inspector-facts">
        <div><span>Origin</span><strong>{node.metadata?.origin || 'user'}</strong></div>
        <div><span>Relationships</span><strong>{relationshipCount}</strong></div>
        {typeof node.metadata?.confidence === 'number' && <div><span>AI confidence</span><strong>{Math.round(node.metadata.confidence * 100)}%</strong></div>}
      </div>
      {node.metadata?.rationale && <p className="inspector-rationale">{node.metadata.rationale}</p>}
      <button className="danger-button" title="Delete record (Delete / Backspace)" onClick={onDelete}><Trash2 size={15} /> Delete record</button>
    </aside>
  );
}

function ImageInspectorSection({
  node,
  onUpdate,
  projectId
}: {
  node: CanvasNode;
  onUpdate: (fields: Partial<CanvasNode>) => void;
  projectId?: string;
}) {
  const [showViewer, setShowViewer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const rawImage = node.fileData || node.imageUrl;
  const currentImage = (rawImage && !rawImage.includes('Changes icon') && !rawImage.includes('stays white')) ? rawImage : undefined;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, projectId);
      onUpdate({
        imageUrl: uploaded.url,
        fileData: uploaded.url,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: uploaded.fileType,
        ...(node.title === 'Media & figure' || node.title === 'New media & figure' ? { title: file.name.replace(/\.[^/.]+$/, '') } : {})
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="inspector-media-section">
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
        <Images size={14} style={{ color: '#284b63' }} />
        <span>Figure & Media Asset</span>
      </label>

      {currentImage ? (
        <div className="inspector-media-preview-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentImage} alt={node.caption || node.title} className="inspector-media-img" />
          <button
            type="button"
            className="inspector-media-expand-btn"
            onClick={() => setShowViewer(true)}
            title="Expand and view image"
            aria-label="Expand and view image"
          >
            <Maximize2 size={13} />
          </button>
          {(node.fileName || node.fileSize) && (
            <div className="inspector-media-file-info">
              <span className="inspector-media-filename" title={node.fileName}>{node.fileName || 'Image asset'}</span>
              {node.fileSize ? <span className="inspector-media-filesize">{formatFileSize(node.fileSize)}</span> : null}
            </div>
          )}
          <div className="inspector-media-actions">
            <button
              type="button"
              className="inspector-action-btn danger"
              onClick={() => onUpdate({ imageUrl: undefined, fileData: undefined, fileName: undefined, fileSize: undefined })}
              title="Remove figure asset"
            >
              <Trash2 size={12} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="inspector-media-dropzone">
          <label className="inspector-upload-button" style={uploading ? { opacity: 0.7, pointerEvents: 'none' } : undefined}>
            {uploading ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
            <span>{uploading ? 'Uploading image…' : 'Upload image file'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={handleFileUpload} disabled={uploading} />
          </label>
          <span className="inspector-or-divider">or paste URL</span>
          <input
            type="url"
            className="field-input"
            placeholder="https://... image URL"
            value={node.imageUrl || ''}
            onChange={e => onUpdate({ imageUrl: e.target.value })}
          />
        </div>
      )}

      <label className="field-label" htmlFor="figure-caption" style={{ marginTop: 10 }}>Caption / Legend</label>
      <input
        id="figure-caption"
        className="field-input"
        maxLength={300}
        placeholder="Figure 1: Architecture diagram..."
        value={node.caption || ''}
        onChange={e => onUpdate({ caption: e.target.value })}
      />

      {showViewer && currentImage && (
        <ImageViewerModal
          src={currentImage}
          title={node.title}
          caption={node.caption}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
}

function SourceInspectorSection({
  node,
  safeUrl,
  onUpdate,
  projectId
}: {
  node: CanvasNode;
  safeUrl?: string;
  onUpdate: (fields: Partial<CanvasNode>) => void;
  projectId?: string;
}) {
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);

  const effectiveDomain = getWebsiteDomain(node.url, node.domain);
  const websiteLogo = (node.metadata?.logo as string) || (node.metadata?.favicon as string);
  const siteName = (node.metadata?.siteName as string);
  const previewImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);
  const hasAttachedDoc = Boolean(node.fileData || node.fileName);

  const handleFetchMetadataForUrl = async (urlToFetch: string) => {
    if (!urlToFetch || !urlToFetch.trim() || !urlToFetch.trim().startsWith('http')) return;
    setFetching(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(urlToFetch.trim())}`);
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
          image: data.image || node.metadata?.image,
          ...(data.author ? { author: data.author } : {})
        }
      };

      if (data.image) {
        updates.imageUrl = data.image;
      }
      if ((!node.title || node.title === 'New source' || node.title === 'New link' || node.title.startsWith('http')) && data.title) {
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

  const handleFetchMetadata = () => {
    if (node.url) handleFetchMetadataForUrl(node.url);
  };

  const handleUrlChange = (newUrl: string) => {
    const trimmed = newUrl.trim();
    const ytId = extractYouTubeVideoId(trimmed);
    if (ytId) {
      onUpdate({
        url: newUrl,
        imageUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        domain: 'youtube.com',
        metadata: {
          ...node.metadata,
          siteName: 'YouTube',
          image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
        }
      });
      handleFetchMetadataForUrl(trimmed);
    } else {
      onUpdate({ url: newUrl });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
      const isText = ['json', 'txt', 'csv', 'tsv', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'sql', 'sh', 'yaml', 'yml'].includes(ext) || file.type.startsWith('text/') || file.type.includes('json');

      let textContent = '';
      if (isText) {
        try {
          textContent = await file.text();
        } catch { /* Ignore text parse error */ }
      }

      const uploaded = await uploadFile(file, projectId);
      onUpdate({
        fileData: uploaded.url,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        fileType: ext,
        ...(node.content ? {} : textContent ? { content: textContent.length > 50000 ? textContent.slice(0, 50000) : textContent } : {}),
        ...(node.title === 'New source' || !node.title ? { title: file.name.replace(/\.[^/.]+$/, '') } : {})
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <label className="field-label" htmlFor="node-url">Source URL or Paper Link</label>
      <div className="url-edit-row">
        <input
          id="node-url"
          className="field-input"
          type="url"
          maxLength={4096}
          value={node.url || ''}
          placeholder="https://... video or website URL"
          onChange={event => handleUrlChange(event.target.value)}
          onPaste={event => {
            const pasted = event.clipboardData.getData('text')?.trim();
            if (pasted && (pasted.startsWith('http://') || pasted.startsWith('https://'))) {
              setTimeout(() => {
                handleFetchMetadataForUrl(pasted);
              }, 40);
            }
          }}
          onBlur={() => {
            if (node.url?.trim().startsWith('http') && (!node.imageUrl || !node.title || node.title === 'New source' || node.title === 'New link')) {
              handleFetchMetadataForUrl(node.url.trim());
            }
          }}
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

      {/* Document / File attachment */}
      <div className="inspector-doc-attachment-zone">
        <label className="field-label" style={{ marginTop: 8 }}>Attached File (PDF, TXT, JSON, CSV...)</label>
        {hasAttachedDoc ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <AttachedFileBadge
              fileName={node.fileName}
              fileSize={node.fileSize}
              fileType={node.fileType}
              fileData={node.fileData}
              content={node.content}
              onOpenPreview={() => setShowFileModal(true)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="inspector-action-btn danger"
                onClick={() => onUpdate({ fileData: undefined, fileName: undefined, fileSize: undefined, fileType: undefined })}
                title="Remove attached file"
              >
                <Trash2 size={12} />
                <span>Remove attachment</span>
              </button>
            </div>
          </div>
        ) : (
          <label className="inspector-upload-doc-btn" style={uploading ? { opacity: 0.7, pointerEvents: 'none' } : undefined}>
            {uploading ? <LoaderCircle size={13} className="spin" /> : <Paperclip size={13} />}
            <span>{uploading ? 'Uploading file…' : 'Attach File (PDF, TXT, JSON, CSV, MD...)'}</span>
            <input
              type="file"
              accept=".pdf,.txt,.json,.csv,.tsv,.md,.js,.ts,.py,.html,.css,.yaml,.yml,application/pdf,application/json,text/*"
              className="sr-only"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {showFileModal && (
        <FileViewerModal
          fileData={node.fileData}
          fileName={node.fileName}
          fileSize={node.fileSize}
          fileType={node.fileType}
          content={node.content}
          onClose={() => setShowFileModal(false)}
        />
      )}

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
                maxHeight={115}
                isYouTube={Boolean(extractYouTubeVideoId(node.url))}
                linkUrl={safeUrl}
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
