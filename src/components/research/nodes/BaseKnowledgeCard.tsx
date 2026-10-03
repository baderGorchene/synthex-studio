import { Check, ExternalLink, FileText, Images, ListTodo, Maximize2, Pencil, BookOpen, CircleHelp, Layers2, Lightbulb, Link2, Quote, Sparkles } from 'lucide-react';
import type { CanvasNode, SectionResizeHandle } from '@/types/canvas';
import { formatFileSize } from '@/types/canvas';
import type { CitationReference } from '@/utils/citation';
import { extractPageNumber } from '@/utils/citation';
import { MarkdownEditor } from '../MarkdownEditor';
import { MarkdownView } from '../MarkdownView';
import { WebsiteLogo, WebsiteImage, getWebsiteDomain, getLinkThumbnail } from '../SourceMetadata';
import { AttachedFileBadge, getFileCategory } from '../FileAndMediaModal';
import { TodoList } from './TodoList';
import { todoContent } from '@/utils/todo';

export const nodeLabel: Record<string, string> = {
  note: 'Note', claim: 'Claim', source: 'Source', image: 'Image', group: 'Cluster',
  concept: 'Idea', hypothesis: 'Hypothesis', question: 'Question', link: 'Link', section: 'Cluster',
  research_result: 'Research', task: 'To-do', ai_insight: 'Insight'
};
// Stable per-note hang angle (-0.6°..0.6°) so the board reads as pinned paper, not a spreadsheet.
function hangTilt(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 13) - 6) / 10;
}
function safeExternalHref(value?: string) {
  try { const url = new URL(value || ''); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined; }
  catch { return undefined; }
}
function toggleMarkdownTask(content: string, targetIndex: number) {
  let taskIndex = 0;
  return content.replace(/^([ \t]*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/gm, (match, before: string, checked: string, after: string) => {
    const currentIndex = taskIndex++;
    return currentIndex === targetIndex ? `${before}${checked === ' ' ? 'x' : ' '}${after}` : match;
  });
}
export function NodeGlyph({ type, fileName, fileType }: { type: string; fileName?: string; fileType?: string }) {
  const props = { size: 14, strokeWidth: 1.8 };
  switch (type) {
    case 'concept': return <Lightbulb {...props} />;
    case 'claim': return <Quote {...props} />;
    case 'question': return <CircleHelp {...props} />;
    case 'source': case 'link': {
      if (fileName || fileType) { const meta = getFileCategory(fileName, fileType); const Icon = meta.icon; return <Icon {...props} />; }
      return <BookOpen {...props} />;
    }
    case 'note': return <FileText {...props} />;
    case 'task': return <ListTodo {...props} />;
    case 'image': return <Images {...props} />;
    case 'group': case 'section': return <Layers2 {...props} />;
    case 'ai_insight': case 'research_result': return <Sparkles {...props} />;
    default: return <Link2 {...props} />;
  }
}

export function BaseKnowledgeCard({
  node, selected, isEditing, isGrabbed, dragTilt = 0, isDraft, isDetaching, isKept, isBlocked, isPlacing, onOpenEditor, onToggleEdit, onUpdateContent, onPointerDown, onClick, onOpenLightbox, onOpenFileModal,
  allNodesById, onOpenEvidenceCitation, isResizeLocked, onStartResize
}: {
  node: CanvasNode;
  selected: boolean;
  isEditing: boolean;
  isGrabbed?: boolean;
  dragTilt?: number;
  isDraft?: boolean;
  isDetaching?: boolean;
  isKept?: boolean;
  isBlocked?: boolean;
  isPlacing?: boolean;
  onOpenEditor?: () => void;
  onToggleEdit: () => void;
  onUpdateContent: (content: string) => void;
  onPointerDown: (event: React.PointerEvent, node: CanvasNode) => void;
  onClick: (event: React.MouseEvent, node: CanvasNode) => void;
  onOpenLightbox?: (src: string, title?: string, caption?: string) => void;
  onOpenFileModal?: (file: { fileData?: string; fileName?: string; fileSize?: number; fileType?: string; content?: string; initialPage?: number; highlightExcerpt?: string }) => void;
  allNodesById?: Record<string, CanvasNode>;
  onOpenEvidenceCitation?: (evidence: CitationReference) => void;
  isResizeLocked?: boolean;
  onStartResize?: (event: React.PointerEvent, handle: SectionResizeHandle) => void;
}) {
  // A hex node.color (chosen in the editor) tints the paper, top rule and pin; legacy names (neutral, terracotta…) don't.
  const noteColor = node.color?.startsWith('#') ? node.color : undefined;
  const isSource = node.type === 'source' || node.type === 'link';
  const isImage = node.type === 'image';
  const hasFile = Boolean(node.fileData || node.fileName);
  const status = node.metadata?.claimStatus?.replaceAll('_', ' ');
  const safeUrl = safeExternalHref(node.url);
  const effectiveDomain = getWebsiteDomain(node.url, node.domain);
  const websiteLogo = (node.metadata?.logo as string) || (node.metadata?.favicon as string);
  const siteName = (node.metadata?.siteName as string);
  const linkThumb = getLinkThumbnail(node);
  const rawImage = isImage ? (node.fileData || node.imageUrl) : (linkThumb.thumbnailUrl || node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string));
  const previewImage = (rawImage && !rawImage.includes('Changes icon') && !rawImage.includes('stays white')) ? rawImage : undefined;
  const caption = (node.caption && !node.caption.includes('Changes icon') && !node.caption.includes('stays white')) ? node.caption : undefined;
  const author = (node.metadata?.author as string);
  const body = node.content || node.description || (!isImage ? caption : '') || '';

  return (
    <article
      data-graph-node={node.id}
      className={`knowledge-card type-${node.type} ${selected ? 'is-selected' : ''} ${isGrabbed ? 'is-grabbed' : ''} ${isDraft ? 'is-draft' : ''} ${isDetaching ? 'is-detaching' : ''} ${isKept ? 'is-kept' : ''} ${noteColor ? 'has-color' : ''} ${isBlocked ? 'is-blocked' : ''} ${isPlacing ? 'is-placing' : ''}`}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0) scale(${isGrabbed ? 1.035 : 1}) rotate(${isGrabbed ? dragTilt : hangTilt(node.id)}deg) translateY(${isGrabbed ? -4 : 0}px)`,
        width: node.width || (isImage ? 320 : 280),
        // A photo's height always follows its picture, so it keeps the image's real proportions.
        height: node.height && !isImage ? `${node.height}px` : undefined,
        minHeight: isImage ? undefined : '124px',
        maxHeight: node.height && !isImage ? `${node.height}px` : undefined,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        ...(noteColor ? { ['--note-ink' as `--${string}`]: noteColor } : {}),
        // Selecting a note unpins it: it lifts off the board (translate/rotate/shadow in typeset.css) and settles back when released.
        transition: isGrabbed
          ? 'box-shadow 0.15s ease, border-color 0.15s ease, transform 0.06s ease-out'
          : 'border-color 0.15s ease, box-shadow 320ms cubic-bezier(.16, 1, .3, 1), translate 320ms cubic-bezier(.16, 1, .3, 1), rotate 320ms cubic-bezier(.16, 1, .3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onPointerDown={event => onPointerDown(event, node)}
      onClick={event => onClick(event, node)}
    >
      <span className="note-pin" aria-hidden="true" />
      {(isBlocked || isPlacing) && (
        <span className={`note-status-tab ${isBlocked ? 'is-blocked' : ''}`} role="status">
          {isBlocked ? 'No room here' : 'Drag me to an empty spot'}
        </span>
      )}
      {onOpenEditor && !isBlocked && (
        <button
          type="button"
          className="note-edit-button"
          aria-label={`Edit ${node.title}`}
          title="Edit (Enter)"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); onOpenEditor(); }}
        >
          <Pencil size={14} strokeWidth={1.75} /><span>Edit</span>
        </button>
      )}
      <h2>{node.title}</h2>

      <div className={`knowledge-card-body-scroll ${node.height && !isImage ? 'has-custom-height' : ''}`}>
        {/* A photo print: the picture at its own proportions, its caption written on the margin below */}
        {isImage && (
          <figure className="photo-print">
            {previewImage ? (
              <div className="photo-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage}
                  alt={caption || node.title}
                  title={[node.fileName, node.fileSize ? formatFileSize(node.fileSize) : null].filter(Boolean).join(' · ') || undefined}
                  className="photo-image"
                  loading="lazy"
                  draggable={false}
                />
                <button
                  type="button"
                  className="photo-zoom"
                  title="Expand and view image"
                  aria-label="Expand and view image"
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation();
                    onOpenLightbox?.(previewImage, node.title, caption);
                  }}
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            ) : (
              <div className="photo-frame is-empty">
                <Images size={26} strokeWidth={1.5} />
                <span>No picture yet</span>
              </div>
            )}
            {caption && <figcaption className="photo-caption">{caption}</figcaption>}
          </figure>
        )}

        {/* Messenger-style Link Preview: Thumbnail banner (with YouTube play badge) OR clean favicon preview */}
        {isSource && !hasFile && (safeUrl || effectiveDomain) && (
          linkThumb.thumbnailUrl ? (
            <WebsiteImage
              imageUrl={linkThumb.thumbnailUrl}
              alt={node.title}
              maxHeight={135}
              isYouTube={linkThumb.isYouTube}
              linkUrl={safeUrl}
              className="my-1.5"
            />
          ) : (
            <div
              className="link-no-thumb-preview"
              onClick={(e) => {
                if (safeUrl) {
                  e.stopPropagation();
                  window.open(safeUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              onPointerDown={(e) => {
                if (safeUrl) e.stopPropagation();
              }}
              title={safeUrl ? `Open ${safeUrl}` : undefined}
            >
              <div className="link-no-thumb-favicon">
                <WebsiteLogo url={safeUrl} domain={effectiveDomain} logo={websiteLogo} size={22} />
              </div>
              <div className="link-no-thumb-info">
                <span className="link-no-thumb-domain">{effectiveDomain || 'web link'}</span>
                {(node.description || node.content) && (
                  <span className="link-no-thumb-desc">{node.description || node.content}</span>
                )}
              </div>
              {safeUrl && <ExternalLink size={12} className="source-link-icon flex-shrink-0 text-slate-400" />}
            </div>
          )
        )}

        {/* File Attachment Badge for PDF, TXT, JSON, CSV, MD, Code */}
        {hasFile && !isImage && (
          <AttachedFileBadge
            fileName={node.fileName}
            fileSize={node.fileSize}
            fileType={node.fileType}
            fileData={node.fileData}
            content={node.content}
            onOpenPreview={() => onOpenFileModal?.({
              fileData: node.fileData,
              fileName: node.fileName,
              fileSize: node.fileSize,
              fileType: node.fileType,
              content: node.content
            })}
          />
        )}

        {node.type === 'task' ? (
          <TodoList content={todoContent(node.content, node.items)} onChange={onUpdateContent} autoFocus={selected && !node.content && !node.items?.length} />
        ) : node.type === 'note' && isEditing ? (
          <MarkdownEditor className="card-markdown-editor" value={node.content || ''} onChange={onUpdateContent} ariaLabel="Edit note in Markdown" />
        ) : body && !isImage ? (
          <MarkdownView
            content={body}
            className="node-summary note-markdown-preview"
            onToggleTask={node.type === 'note' ? index => onUpdateContent(toggleMarkdownTask(body, index)) : undefined}
          />
        ) : node.type === 'note' ? (
          <p className="node-summary note-placeholder">Add a note and format it with Markdown.</p>
        ) : null}

        {/* Website metadata: logo, domain, author and external link (shown below thumbnail) */}
        {isSource && (safeUrl || effectiveDomain) && !hasFile && linkThumb.thumbnailUrl && (
          <div className="source-meta-row">
            <a
              className="source-domain"
              href={safeUrl || '#'}
              target={safeUrl ? '_blank' : undefined}
              rel="noreferrer"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { if (!safeUrl) event.preventDefault(); event.stopPropagation(); }}
              title={safeUrl ? `Open ${safeUrl}` : undefined}
            >
              <WebsiteLogo url={safeUrl} domain={effectiveDomain} logo={websiteLogo} size={13} />
              <span className="source-domain-text">{effectiveDomain || 'web-source'}</span>
              {safeUrl && <ExternalLink size={11} className="source-link-icon" />}
            </a>
            {author && <span className="source-author" title={`By ${author}`}>By {author}</span>}
          </div>
        )}
        {node.metadata?.evidence?.length ? (
          <div className="card-evidence-list">
            {node.metadata.evidence.map((ev, idx) => {
              const src = allNodesById?.[ev.sourceId];
              const pageNum = ev.page || extractPageNumber(ev.location);
              const isContradiction = ev.relation === 'contradicts';
              const hasPdf = Boolean(src?.fileData && (src.fileType?.includes('pdf') || src.fileName?.toLowerCase().endsWith('.pdf') || src.fileData.startsWith('data:application/pdf')));

              return (
                <button
                  key={idx}
                  type="button"
                  className={`card-evidence-pill ${isContradiction ? 'contradicts' : 'supports'} ${hasPdf ? 'has-pdf' : ''}`}
                  title={ev.excerpt ? `“${ev.excerpt}” — Click to ${hasPdf ? 'open PDF citation' : 'view source'}` : `Source: ${src?.title || ev.sourceId}`}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    onOpenEvidenceCitation?.(ev);
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
      </div>

      {(!isImage || isDraft) && <p className="note-meta">
        {[nodeLabel[node.type] || 'Idea', isDraft ? 'Draft' : node.metadata?.origin === 'ai' ? 'From research' : null, siteName, status, node.metadata?.evidence?.length ? `${node.metadata.evidence.length} source${node.metadata.evidence.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
      </p>}

      {/* 8-point resize handles when card is selected and resize is unlocked */}
      {/* A photo only resizes in width: its height follows the picture. */}
      {selected && !isResizeLocked && !isGrabbed && ((isImage ? ['e', 'se', 'sw', 'w'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) as SectionResizeHandle[]).map(handle => (
        <span
          key={handle}
          className={`card-resize-handle handle-${handle}`}
          onPointerDown={event => onStartResize?.(event, handle)}
          title={`Resize card (${handle})`}
        />
      ))}
    </article>
  );
}

