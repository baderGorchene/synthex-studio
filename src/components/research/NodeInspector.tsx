import { useState } from 'react';
import { ExternalLink, FileText, Images, LoaderCircle, Maximize2, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { CanvasNode, CanvasNodeType, formatFileSize } from '@/types/canvas';
import { nodeLabel } from './nodes/BaseKnowledgeCard';
import { CLUSTER_COLORS, CLUSTER_RANGE, clusterWidth } from './inkPalette';
import { WidthSlider } from './WidthSlider';
import { uploadFile } from '@/lib/upload';
import { MarkdownEditor } from './MarkdownEditor';
import { CustomSelect } from './CustomSelect';
import { WebsiteLogo, WebsiteImage, getWebsiteDomain, extractYouTubeVideoId } from './SourceMetadata';
import { AttachedFileBadge, FileViewerModal, ImageViewerModal } from './FileAndMediaModal';
import { extractPageNumber } from '@/utils/citation';

const types: CanvasNodeType[] = ['concept', 'question', 'claim', 'hypothesis', 'note', 'source'];

export function NodeInspector({
  node, relationshipCount, onUpdate, onDelete, onClose, floating = false, hideHeader = false, projectId, allNodes = []
}: {
  node: CanvasNode;
  relationshipCount: number;
  onUpdate: (fields: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  floating?: boolean;
  hideHeader?: boolean;
  projectId?: string;
  allNodes?: CanvasNode[];
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
          <div className="inspector-title"><h2>Details</h2></div>
          <button className="icon-button" aria-label="Close details" onClick={onClose}><X size={17} /></button>
        </div>
      )}
      <label className="field-label" htmlFor="node-title">Title</label>
      <input id="node-title" className="field-input title-input" maxLength={500} value={node.title} onChange={event => onUpdate({ title: event.target.value })} onBlur={() => { if (!node.title.trim()) onUpdate({ title: node.type === 'group' || node.type === 'section' ? 'Untitled cluster' : 'Untitled idea' }); }} />

      <label className="field-label" htmlFor="node-kind">Type</label>
      <CustomSelect className="field-input" ariaLabel="Type" value={node.type} options={(types.includes(node.type) ? types : [node.type, ...types]).map(id => ({ value: id, label: nodeLabel[id] || 'Idea' }))} onChange={value => {
        const type = value as CanvasNodeType;
        onUpdate({ type, ...(type === 'claim' && !node.metadata?.claimStatus ? { metadata: { ...node.metadata, claimStatus: 'unverified' } } : {}) });
      }} />

      {/* Colour: a cluster's pen line and tape, or a note's paper tint, top rule and pin. The first swatch clears it. */}
      <span className="field-label" id="item-colour">Colour</span>
      <div className="swatch-row" role="radiogroup" aria-labelledby="item-colour">
        {CLUSTER_COLORS.map(swatch => {
          const isCluster = node.type === 'group' || node.type === 'section';
          const plain = swatch.id === 'ink';
          const label = plain ? (isCluster ? 'Ink' : 'Plain paper') : swatch.label;
          const checked = plain ? !node.color?.startsWith('#') || node.color === swatch.hex : node.color === swatch.hex;
          return (
            <button key={swatch.id} type="button" role="radio" aria-checked={checked} aria-label={label} title={label}
              onClick={() => onUpdate({ color: plain ? undefined : swatch.hex })}>
              <i className={plain && !isCluster ? 'is-plain' : undefined} style={{ background: plain && !isCluster ? '#fff' : swatch.hex }} />
            </button>
          );
        })}
      </div>

      {(node.type === 'group' || node.type === 'section') && <>
        <WidthSlider
          label="Line width"
          value={clusterWidth(node.metadata?.penWidth)}
          {...CLUSTER_RANGE}
          color={node.color?.startsWith('#') ? node.color : '#111214'}
          onChange={penWidth => onUpdate({ metadata: { ...node.metadata, penWidth } })}
        />
      </>}

      <p className="field-label">Text</p>
      {/* Every kind of card gets the same editor: its text renders as Markdown on the board. The title field keeps the focus on open. */}
      <MarkdownEditor key={node.id} className="inspector-markdown-editor" autoFocus={false} ariaLabel={node.type === 'task' ? 'To-do list' : 'Text'} value={node.content || ''} onChange={content => onUpdate({ content })} />

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
          { value: 'open_question', label: 'Open question' },
          { value: 'weakly_supported', label: 'Weakly supported' },
          { value: 'supported', label: 'Supported' },
          { value: 'disputed', label: 'Disputed' },
          { value: 'contradicted', label: 'Contradicted' },
          { value: 'outdated', label: 'Outdated' }
        ]} onChange={value => onUpdate({ metadata: { ...node.metadata, claimStatus: value as NonNullable<CanvasNode['metadata']>['claimStatus'] } })} />
      </>}

      {(isClaim || (node.metadata?.evidence && node.metadata.evidence.length > 0)) && (
        <EvidenceInspectorSection node={node} allNodes={allNodes} onUpdate={onUpdate} />
      )}

      <p className="note-meta inspector-meta">
        {[
          node.metadata?.origin === 'ai' ? 'From research' : 'Added by you',
          `${relationshipCount} ${relationshipCount === 1 ? 'relation' : 'relations'}`,
          typeof node.metadata?.confidence === 'number' ? `${Math.round(node.metadata.confidence * 100)}% confidence` : null
        ].filter(Boolean).join(' · ')}
      </p>
      {node.metadata?.rationale && <p className="inspector-rationale">{node.metadata.rationale}</p>}
      <button className="text-button danger-text inspector-remove" title="Remove from map (Delete / Backspace)" onClick={onDelete}>Remove from map</button>
    </aside>
  );
}

function EvidenceInspectorSection({
  node,
  allNodes = [],
  onUpdate
}: {
  node: CanvasNode;
  allNodes?: CanvasNode[];
  onUpdate: (fields: Partial<CanvasNode>) => void;
}) {
  const [activePdfPreview, setActivePdfPreview] = useState<{
    fileData: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    initialPage?: number;
    highlightExcerpt?: string;
  } | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [page, setPage] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [relation, setRelation] = useState<'supports' | 'contradicts'>('supports');

  const evidenceList = node.metadata?.evidence || [];
  const sources = allNodes.filter(n => n.type === 'source' || n.type === 'link' || n.fileData);

  const handleAddCitation = () => {
    if (!sourceId) return;
    const pageNum = parseInt(page, 10);
    const newCitation = {
      sourceId,
      page: !isNaN(pageNum) && pageNum > 0 ? pageNum : undefined,
      location: !isNaN(pageNum) && pageNum > 0 ? `p. ${pageNum}` : (page.trim() || undefined),
      excerpt: excerpt.trim() || undefined,
      relation
    };
    const updated = [...evidenceList, newCitation];
    onUpdate({
      metadata: {
        ...node.metadata,
        evidence: updated,
        sourceIds: Array.from(new Set([...(node.metadata?.sourceIds || []), sourceId]))
      }
    });
    setSourceId('');
    setPage('');
    setExcerpt('');
    setIsAdding(false);
  };

  const handleRemoveCitation = (indexToRemove: number) => {
    const updated = evidenceList.filter((_, idx) => idx !== indexToRemove);
    onUpdate({
      metadata: {
        ...node.metadata,
        evidence: updated
      }
    });
  };

  return (
    <div className="inspector-evidence-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="field-label" style={{ margin: 0 }}>Sources cited ({evidenceList.length})</label>
        <button
          type="button"
          className="inspector-action-btn"
          onClick={() => setIsAdding(prev => !prev)}
          title="Add evidence citation"
        >
          <span>{isAdding ? 'Cancel' : 'Cite a source'}</span>
        </button>
      </div>

      {isAdding && (
        <div className="evidence-citation-card">
          <span className="evidence-form-title">Cite a source</span>
          <select
            className="field-input"
            value={sourceId}
            onChange={e => setSourceId(e.target.value)}
          >
            <option value="">Choose a source</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>
                {s.title} {s.fileName ? `(${s.fileName})` : ''}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              min={1}
              placeholder="Page #"
              value={page}
              onChange={e => setPage(e.target.value)}
              className="field-input"
              style={{ width: '96px' }}
            />
            <select
              className="field-input"
              value={relation}
              onChange={e => setRelation(e.target.value as 'supports' | 'contradicts')}
              style={{ flex: 1 }}
            >
              <option value="supports">Supports claim</option>
              <option value="contradicts">Contradicts claim</option>
            </select>
          </div>
          <textarea
            placeholder="Quote from the source"
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            className="field-input field-textarea"
            style={{ minHeight: '72px' }}
          />
          <button
            type="button"
            className="inspector-action-btn primary"
            disabled={!sourceId}
            onClick={handleAddCitation}
            style={{ alignSelf: 'flex-end' }}
          >
            <span>Cite it</span>
          </button>
        </div>
      )}

      {evidenceList.map((item, idx) => {
        const srcNode = allNodes.find(n => n.id === item.sourceId);
        const pageNum = item.page || extractPageNumber(item.location);
        const isPdf = Boolean(srcNode?.fileData && (srcNode.fileType?.includes('pdf') || srcNode.fileName?.toLowerCase().endsWith('.pdf') || srcNode.fileData.startsWith('data:application/pdf')));

        return (
          <div key={idx} className="evidence-citation-card">
            <div className="evidence-citation-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <span className="evidence-citation-title" title={srcNode?.title || item.sourceId}>
                  {srcNode?.title || item.sourceId}
                </span>
                {pageNum && (
                  <span className="evidence-page-badge">p. {pageNum}</span>
                )}
              </div>
              <button
                type="button"
                className="inspector-action-btn danger"
                style={{ padding: '2px 5px' }}
                onClick={() => handleRemoveCitation(idx)}
                title="Remove citation"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {item.excerpt && (
              <p className="evidence-citation-quote">“{item.excerpt}”</p>
            )}

            <div className="evidence-citation-actions">
              <small className="note-meta">
                {item.relation === 'contradicts' ? 'Contradicts the claim' : 'Supports the claim'}
              </small>
              {isPdf && srcNode?.fileData && (
                <button
                  type="button"
                  className="evidence-pdf-link-btn"
                  onClick={() => setActivePdfPreview({
                    fileData: srcNode.fileData!,
                    fileName: srcNode.fileName || srcNode.title,
                    fileSize: srcNode.fileSize,
                    fileType: srcNode.fileType || 'application/pdf',
                    initialPage: pageNum,
                    highlightExcerpt: item.excerpt
                  })}
                  title={`Open PDF at page ${pageNum || 1}`}
                >
                  <FileText size={11} />
                  <span>View in PDF {pageNum ? `(p. ${pageNum})` : ''}</span>
                </button>
              )}
            </div>
          </div>
        );
      })}

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
    </div>
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
        <Images size={14} strokeWidth={1.75} />
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

      <label className="field-label" htmlFor="figure-caption" style={{ marginTop: 10 }}>Caption</label>
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
      <label className="field-label" htmlFor="node-url">Link</label>
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
            <span>Fetch title and preview</span>
          </>
        )}
      </button>

      {errorMsg && <p className="meta-status-hint">{errorMsg}</p>}

      {/* Document / File attachment */}
      <div className="inspector-doc-attachment-zone">
        <label className="field-label" style={{ marginTop: 8 }}>Attached file</label>
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
