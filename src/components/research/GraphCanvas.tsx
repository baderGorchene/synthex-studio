'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, CircleHelp, Download, ExternalLink, FileText, Images, Layers2, Lightbulb, Link2, Maximize2, Paperclip, Pencil, Quote, Sparkles, X } from 'lucide-react';
import type { CanvasNode, Connection, Coordinates, SectionResizeHandle, CanvasNodeType } from '@/types/canvas';
import { hexToRgba, formatFileSize } from '@/types/canvas';
import type { KnowledgeGraph } from '@/lib/graph';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownView } from './MarkdownView';
import { RelationshipControls } from './RelationshipControls';
import { WebsiteLogo, WebsiteImage, getWebsiteDomain } from '@/components/canvas/SourceMetadata';
import { AttachedFileBadge, FileViewerModal, ImageViewerModal, getFileCategory } from './FileAndMediaModal';

type Viewport = { zoom: number; pan: Coordinates };
type Gesture =
  | { kind: 'pan'; start: Coordinates; origin: Coordinates }
  | { kind: 'pinch'; startDistance: number; startZoom: number; anchor: Coordinates }
  | { kind: 'drag'; start: Coordinates; origins: Record<string, Coordinates> }
  | { kind: 'resize'; start: Coordinates; node: CanvasNode; handle: SectionResizeHandle };

const nodeLabel: Record<string, string> = {
  note: 'Note & Idea', claim: 'Claim & Inquiry', source: 'Document & Source', image: 'Media & Figure', group: 'Knowledge cluster',
  concept: 'Concept', hypothesis: 'Hypothesis', question: 'Question', link: 'Source', section: 'Knowledge cluster',
  research_result: 'Research result', task: 'Research task', ai_insight: 'AI insight'
};

function safeExternalHref(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch { return undefined; }
}

function NodeGlyph({ type, fileName, fileType }: { type: string; fileName?: string; fileType?: string }) {
  const props = { size: 14, strokeWidth: 1.8 };
  switch (type) {
    case 'concept': return <Lightbulb {...props} />;
    case 'claim': return <Quote {...props} />;
    case 'question': return <CircleHelp {...props} />;
    case 'source': case 'link': {
      if (fileName || fileType) {
        const meta = getFileCategory(fileName, fileType);
        const Icon = meta.icon;
        return <Icon {...props} />;
      }
      return <BookOpen {...props} />;
    }
    case 'note': return <FileText {...props} />;
    case 'image': return <Images {...props} />;
    case 'group': case 'section': return <Layers2 {...props} />;
    case 'ai_insight': case 'research_result': return <Sparkles {...props} />;
    default: return <Link2 {...props} />;
  }
}

export function membersOf(group: CanvasNode, nodes: CanvasNode[]): CanvasNode[] {
  const width = group.width || 540;
  const height = group.height || 360;
  return nodes.filter(node => {
    if (node.id === group.id || node.type === 'group' || node.type === 'section') return false;
    if (node.sectionId === group.id) return true;
    if (!node.sectionId) {
      return node.x >= group.x && node.y >= group.y && node.x < group.x + width && node.y < group.y + height;
    }
    return false;
  });
}

export function groupBounds(group: CanvasNode, members: CanvasNode[]) {
  if (group.metadata?.collapsed === true) {
    const width = Math.min(group.width || 360, 380);
    const height = 106;
    return { x: group.x, y: group.y, width, height };
  }

  // Generous padding around all enclosed items inside cluster
  const PADDING_LEFT = 36;
  const PADDING_RIGHT = 36;
  const PADDING_TOP = 58; // comfortable clearance below cluster header bar
  const PADDING_BOTTOM = 36;

  const minBaseWidth = Math.max(380, group.width || 560);
  const minBaseHeight = Math.max(260, group.height || 380);

  if (members.length === 0) {
    return { x: group.x, y: group.y, width: minBaseWidth, height: minBaseHeight };
  }

  // Calculate the encompassing bounds of all members with padding
  const memberMinX = Math.min(...members.map(n => n.x - PADDING_LEFT));
  const memberMinY = Math.min(...members.map(n => n.y - PADDING_TOP));
  const memberMaxX = Math.max(...members.map(n => n.x + (n.width || 280) + PADDING_RIGHT));
  const memberMaxY = Math.max(...members.map(n => n.y + (n.height || estimateNodeHeight(n)) + PADDING_BOTTOM));

  const left = Math.min(group.x, memberMinX);
  const top = Math.min(group.y, memberMinY);
  const right = Math.max(group.x + minBaseWidth, memberMaxX);
  const bottom = Math.max(group.y + minBaseHeight, memberMaxY);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

export function estimateNodeHeight(node: CanvasNode): number {
  if (node.height && node.height > 0) return node.height;
  if (node.type === 'group' || node.type === 'section') {
    return node.metadata?.collapsed ? 98 : (node.height || 360);
  }
  if (node.type === 'image') {
    let h = 230;
    if (node.caption || node.content) h += 36;
    return h;
  }
  let h = 51;
  const titleLines = Math.max(1, Math.ceil((node.title?.length || 10) / 26));
  h += titleLines * 22;

  const isSource = node.type === 'source' || node.type === 'link';
  const previewImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);
  if (isSource && previewImage) {
    h += 127;
  }
  if (isSource && node.fileData) {
    h += 46;
  }

  const content = node.content || node.description || node.caption || '';
  if (content) {
    const lines = Math.min(4, Math.max(1, Math.ceil(content.length / 35)));
    h += lines * 18 + 6;
  }

  if (isSource && (node.url || node.domain)) {
    h += 32;
  }
  if (node.metadata?.evidence?.length) {
    h += 24;
  }

  return Math.max(124, Math.round(h));
}

function toggleMarkdownTask(content: string, targetIndex: number) {
  let taskIndex = 0;
  return content.replace(/^([ \t]*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/gm, (match, before: string, checked: string, after: string) => {
    const currentIndex = taskIndex++;
    return currentIndex === targetIndex ? `${before}${checked === ' ' ? 'x' : ' '}${after}` : match;
  });
}

export function relationPath(
  from: CanvasNode,
  to: CanvasNode,
  style: Connection['lineStyle'] = 'curved',
  overrideFromHeight?: number,
  overrideToHeight?: number
): { path: string; mid: Coordinates } {
  const fw = from.width || 280;
  const tw = to.width || 280;
  const fh = overrideFromHeight || from.height || estimateNodeHeight(from);
  const th = overrideToHeight || to.height || estimateNodeHeight(to);

  const cxFrom = from.x + fw / 2;
  const cyFrom = from.y + fh / 2;
  const cxTo = to.x + tw / 2;
  const cyTo = to.y + th / 2;

  const dx = cxTo - cxFrom;
  const dy = cyTo - cyFrom;

  // Use aspect-weighted distance comparison for cards (wide rectangles)
  const aspectWeight = (fh + th) / (fw + tw);
  const isHorizontal = Math.abs(dx) * aspectWeight > Math.abs(dy);

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;
  let orientation: 'horizontal' | 'vertical';

  if (!isHorizontal) {
    orientation = 'vertical';
    if (dy >= 0) {
      // Exit bottom of 'from', enter top of 'to'
      startY = from.y + fh;
      endY = to.y;
    } else {
      // Exit top of 'from', enter bottom of 'to'
      startY = from.y;
      endY = to.y + th;
    }

    const overlapMin = Math.max(from.x, to.x);
    const overlapMax = Math.min(from.x + fw, to.x + tw);
    if (overlapMax - overlapMin >= 24) {
      const dockX = (overlapMin + overlapMax) / 2;
      startX = dockX;
      endX = dockX;
    } else {
      startX = Math.min(Math.max(cxTo, from.x + 28), from.x + fw - 28);
      endX = Math.min(Math.max(cxFrom, to.x + 28), to.x + tw - 28);
    }
  } else {
    orientation = 'horizontal';
    if (dx >= 0) {
      startX = from.x + fw;
      endX = to.x;
    } else {
      startX = from.x;
      endX = to.x + tw;
    }

    const overlapMin = Math.max(from.y, to.y);
    const overlapMax = Math.min(from.y + fh, to.y + th);
    if (overlapMax - overlapMin >= 20) {
      const dockY = (overlapMin + overlapMax) / 2;
      startY = dockY;
      endY = dockY;
    } else {
      startY = Math.min(Math.max(cyTo, from.y + 20), from.y + fh - 20);
      endY = Math.min(Math.max(cyFrom, to.y + 20), to.y + th - 20);
    }
  }

  let path = '';
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  if (style === 'straight') {
    path = `M ${startX} ${startY} L ${endX} ${endY}`;
  } else if (style === 'stepped') {
    if (orientation === 'horizontal') {
      path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
    } else {
      path = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    }
  } else {
    if (orientation === 'horizontal') {
      const bend = Math.min(Math.max(36, Math.abs(endX - startX) * 0.44), 140);
      const c1x = dx >= 0 ? startX + bend : startX - bend;
      const c2x = dx >= 0 ? endX - bend : endX + bend;
      path = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
    } else {
      const bend = Math.min(Math.max(34, Math.abs(endY - startY) * 0.44), 140);
      const c1y = dy >= 0 ? startY + bend : startY - bend;
      const c2y = dy >= 0 ? endY - bend : endY + bend;
      path = `M ${startX} ${startY} C ${startX} ${c1y}, ${endX} ${c2y}, ${endX} ${endY}`;
    }
  }

  return {
    path,
    mid: {
      x: orientation === 'horizontal' ? midX : midX + (dx >= 0 ? 8 : -8),
      y: orientation === 'horizontal' ? midY - 10 : midY
    }
  };
}

function GroupCard({
  node, members, relationCount, isCollapsed, selected, isGrabbed, onToggle, onOpen, onStartResize
}: {
  node: CanvasNode;
  members: CanvasNode[];
  relationCount: number;
  isCollapsed: boolean;
  selected: boolean;
  isGrabbed?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStartResize: (event: React.PointerEvent, handle: SectionResizeHandle) => void;
}) {
  const customColor = node.color;
  return (
    <article
      className={`graph-group ${isCollapsed ? 'is-folded' : ''} ${selected ? 'is-selected' : ''} ${isGrabbed ? 'is-grabbed' : ''}`}
      style={{
        transform: isGrabbed ? 'scale(1.012)' : undefined,
        transition: isGrabbed ? 'box-shadow 0.14s ease, border-color 0.14s ease' : 'transform 0.15s cubic-bezier(0.16,1,0.3,1), box-shadow 0.15s ease',
        ...(customColor ? {
          backgroundColor: hexToRgba(customColor, isCollapsed ? 0.07 : 0.09),
          borderColor: customColor,
          borderStyle: isCollapsed ? 'solid' : 'dashed',
          borderWidth: isCollapsed ? '1.5px' : '2px',
          ...(isCollapsed ? {
            boxShadow: `0 1px 3px rgba(53, 53, 53, 0.08), 0 4px 0 -1px #ffffff, 0 4px 0 0 ${customColor}, 0 8px 0 -2px #ffffff, 0 8px 0 -1px ${customColor}, 0 12px 20px -3px rgba(53, 53, 53, 0.1)`
          } : {})
        } : {})
      }}
    >
      <div className="graph-group-heading">
        <span
          className="group-mark"
          style={customColor ? {
            backgroundColor: customColor,
            borderColor: customColor,
            color: '#ffffff'
          } : undefined}
        >
          {isCollapsed ? <Sparkles size={14} /> : <Layers2 size={15} />}
        </span>
        <div className="group-title-wrap">
          <strong>{node.title}</strong>
          <span style={customColor ? { color: customColor } : undefined}>
            {isCollapsed
              ? `${members.length} ${members.length === 1 ? 'item' : 'items'} in cluster`
              : `${members.length} ${members.length === 1 ? 'node' : 'nodes'} · ${relationCount} ${relationCount === 1 ? 'relationship' : 'relationships'}`}
          </span>
        </div>
        <button
          className="icon-button group-open"
          aria-label="Open cluster sub-canvas"
          title="Open cluster sub-canvas"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); onOpen(); }}
        >
          <ExternalLink size={13} />
        </button>
        <button
          className="icon-button group-fold"
          aria-label={isCollapsed ? 'Unfold knowledge cluster' : 'Fold knowledge cluster'}
          title={isCollapsed ? 'Unfold knowledge cluster' : 'Fold knowledge cluster'}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); onToggle(); }}
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {isCollapsed ? (
        <div className="group-folded-preview">
          <div className="folded-cluster-stats">
            <span className="folded-bullet" style={customColor ? { color: customColor } : undefined}>●</span>
            <span className="folded-summary-text">
              {members.length} {members.length === 1 ? 'item' : 'items'} in cluster
              {relationCount > 0 ? ` · ${relationCount} ${relationCount === 1 ? 'connection' : 'connections'}` : ''}
            </span>
          </div>
          <div className="folded-chips" aria-label="Contained notes and sources">
            {members.slice(0, 3).map(member => (
              <span key={member.id} className={`folded-chip type-${member.type}`} title={member.title}>
                <NodeGlyph type={member.type} />
                <span className="folded-chip-title">{member.title}</span>
              </span>
            ))}
            {members.length > 3 && (
              <span className="folded-chip folded-chip-more">+{members.length - 3} more</span>
            )}
            {members.length === 0 && (
              <span className="folded-chip-empty">Empty cluster · click to open</span>
            )}
          </div>
        </div>
      ) : (
        <div className="group-crease" aria-hidden="true"><i /><i /><i /></div>
      )}

      {!isCollapsed && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as SectionResizeHandle[]).map(handle => (
        <button
          key={handle}
          className={`group-resize-handle handle-${handle}`}
          aria-label={`Resize cluster ${handle}`}
          title="Resize cluster"
          onPointerDown={event => onStartResize(event, handle)}
        />
      ))}
    </article>
  );
}

function KnowledgeCard({
  node, selected, isEditing, isGrabbed, onToggleEdit, onUpdateContent, onPointerDown, onClick, onOpenLightbox, onOpenFileModal
}: {
  node: CanvasNode;
  selected: boolean;
  isEditing: boolean;
  isGrabbed?: boolean;
  onToggleEdit: () => void;
  onUpdateContent: (content: string) => void;
  onPointerDown: (event: React.PointerEvent, node: CanvasNode) => void;
  onClick: (event: React.MouseEvent, node: CanvasNode) => void;
  onOpenLightbox?: (src: string, title?: string, caption?: string) => void;
  onOpenFileModal?: (file: { fileData?: string; fileName?: string; fileSize?: number; fileType?: string; content?: string }) => void;
}) {
  const customColor = node.color;
  const isSource = node.type === 'source' || node.type === 'link';
  const isImage = node.type === 'image';
  const hasFile = Boolean(node.fileData || node.fileName);
  const status = node.metadata?.claimStatus?.replaceAll('_', ' ');
  const safeUrl = safeExternalHref(node.url);
  const effectiveDomain = getWebsiteDomain(node.url, node.domain);
  const websiteLogo = (node.metadata?.logo as string) || (node.metadata?.favicon as string);
  const siteName = (node.metadata?.siteName as string);
  const rawImage = isImage ? (node.fileData || node.imageUrl) : (node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string));
  const previewImage = (rawImage && !rawImage.includes('Changes icon') && !rawImage.includes('stays white')) ? rawImage : undefined;
  const caption = (node.caption && !node.caption.includes('Changes icon') && !node.caption.includes('stays white')) ? node.caption : undefined;
  const author = (node.metadata?.author as string);
  const body = node.content || node.description || (!isImage ? caption : '') || '';

  return (
    <article
      data-graph-node={node.id}
      className={`knowledge-card type-${node.type} ${customColor ? 'has-custom-color' : ''} ${selected ? 'is-selected' : ''} ${isGrabbed ? 'is-grabbed' : ''}`}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0) scale(${isGrabbed ? 1.035 : 1}) translateY(${isGrabbed ? -4 : 0}px)`,
        width: node.width || (isImage ? 320 : 280),
        backgroundColor: '#ffffff',
        ...(customColor ? {
          ['--node-custom-color' as any]: customColor,
          ['--node-custom-ring' as any]: hexToRgba(customColor, 0.28),
          borderColor: customColor,
          borderWidth: '1.5px',
          borderStyle: 'solid'
        } : {}),
        transition: isGrabbed
          ? 'box-shadow 0.15s ease, border-color 0.15s ease, transform 0.06s ease-out'
          : 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onPointerDown={event => onPointerDown(event, node)}
      onClick={event => onClick(event, node)}
    >
      <div className="knowledge-card-topline">
        <span
          className="node-glyph"
          style={customColor ? (
            node.type === 'image'
              ? { backgroundColor: 'transparent', borderColor: customColor, color: customColor }
              : { backgroundColor: customColor, borderColor: customColor, color: '#ffffff' }
          ) : undefined}
        >
          {isSource && !hasFile && (safeUrl || effectiveDomain) ? (
            <WebsiteLogo url={safeUrl} domain={effectiveDomain} logo={websiteLogo} size={14} />
          ) : (
            <NodeGlyph type={node.type} fileName={node.fileName} fileType={node.fileType} />
          )}
        </span>
        <span
          className="node-kind"
          style={customColor ? { color: customColor } : undefined}
        >
          {nodeLabel[node.type] || 'Knowledge'}
        </span>
        {siteName && <span className="source-sitename-tag" title={siteName}>{siteName}</span>}
        {node.metadata?.origin === 'ai' && <span className="origin-label">AI proposal</span>}
        {node.metadata?.origin === 'example' && <span className="origin-label">Example</span>}
        {status && <span className={`claim-status status-${node.metadata?.claimStatus}`}>{status}</span>}
        {node.type === 'note' && <button className={`note-mode-toggle ${isEditing ? 'is-editing' : ''}`} aria-label={isEditing ? 'Finish editing note' : 'Edit note'} title={isEditing ? 'Finish editing note' : 'Edit note'} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onToggleEdit(); }}>{isEditing ? <Check size={13} /> : <Pencil size={12} />}<span>{isEditing ? 'Done' : 'Edit'}</span></button>}
      </div>
      <h2>{node.title}</h2>

      {/* Media & Figure preview */}
      {isImage && (
        <div className="figure-card-wrap">
          {previewImage ? (
            <div className="figure-image-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt={caption || node.title}
                className="figure-card-img"
                loading="lazy"
              />
              <button
                type="button"
                className="figure-zoom-btn"
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
            <div className="figure-placeholder-box">
              <Images size={26} className="figure-placeholder-icon" />
              <span>Select record to add image</span>
            </div>
          )}
          {/* Bottom part: image name and size */}
          {(node.fileName || node.fileSize) && (
            <div className="figure-file-meta">
              <span className="figure-filename" title={node.fileName}>{node.fileName || 'Image asset'}</span>
              {node.fileSize ? <span className="figure-filesize">{formatFileSize(node.fileSize)}</span> : null}
            </div>
          )}
          {caption && <figcaption className="figure-card-caption">{caption}</figcaption>}
        </div>
      )}

      {/* Website preview image if available */}
      {isSource && !hasFile && previewImage && (
        <WebsiteImage imageUrl={previewImage} alt={node.title} maxHeight={115} className="my-1.5" />
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

      {node.type === 'note' ? (
        isEditing ? (
          <MarkdownEditor className="card-markdown-editor" value={node.content || ''} onChange={onUpdateContent} ariaLabel="Edit note in Markdown" />
        ) : body ? (
          <MarkdownView content={body} className="node-summary note-markdown-preview" onToggleTask={index => onUpdateContent(toggleMarkdownTask(body, index))} />
        ) : (
          <p className="node-summary note-placeholder">Add a note and format it with Markdown.</p>
        )
      ) : body && !isImage ? (
        <p className="node-summary">{body}</p>
      ) : null}

      {/* Website metadata: logo, domain, author and external link */}
      {isSource && (safeUrl || effectiveDomain) && !hasFile && (
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
      {node.metadata?.evidence?.length ? <div className="evidence-count">{node.metadata.evidence.length} evidence links</div> : null}
    </article>
  );
}

export function GraphCanvas({
  graph, selectedNodeIds, viewport, setViewport, activeTool, spacePressed, linkingFromId,
  autoFitKey, editingNoteId, onSelectNode, onClearSelection, onClickAway, onCancelLinking, onMoveNodes, onConnect,
  onStartLinking, onToggleGroup, onEditNote, onUpdateNote, onUpdateRelationship, onDeleteRelationship, onResizeGroup, onOpenGroup,
  onAddRecordWithData
}: {
  graph: KnowledgeGraph;
  selectedNodeIds: string[];
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  activeTool: 'select' | 'connect' | 'hand';
  spacePressed: boolean;
  linkingFromId: string | null;
  autoFitKey: number;
  editingNoteId: string | null;
  onSelectNode: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  onClickAway: () => void;
  onCancelLinking: () => void;
  onMoveNodes: (positions: Record<string, Coordinates>) => void;
  onConnect: (from: string, to: string) => void;
  onStartLinking: (id: string) => void;
  onToggleGroup: (id: string) => void;
  onEditNote: (id: string | null) => void;
  onUpdateNote: (id: string, content: string) => void;
  onUpdateRelationship: (id: string, fields: Partial<Connection>) => void;
  onDeleteRelationship: (id: string) => void;
  onResizeGroup: (id: string, fields: Partial<CanvasNode>) => void;
  onOpenGroup: (id: string) => void;
  onAddRecordWithData?: (type: CanvasNodeType, initialData?: Partial<CanvasNode>) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const activePointers = useRef(new Map<number, Coordinates>());
  const lastFittedKey = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [cursorWorld, setCursorWorld] = useState<Coordinates | null>(null);
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState<{ src: string; title?: string; caption?: string } | null>(null);
  const [activeFile, setActiveFile] = useState<{ fileData?: string; fileName?: string; fileSize?: number; fileType?: string; content?: string } | null>(null);
  const nodes = Object.values(graph.nodesById);
  const groups = nodes.filter(node => node.type === 'group' || node.type === 'section');
  const visibleIds = new Set(nodes.filter(node => {
    if (node.type === 'group' || node.type === 'section') return true;
    return !groups.some(group => group.metadata?.collapsed === true && membersOf(group, nodes).some(member => member.id === node.id));
  }).map(node => node.id));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onAddRecordWithData) return;

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - viewport.pan.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.pan.y) / viewport.zoom;

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          onAddRecordWithData('image', {
            x: Math.round(worldX - 160),
            y: Math.round(worldY - 100),
            title: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: dataUrl,
            fileData: dataUrl,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          });
        };
        reader.readAsDataURL(file);
      } else {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
        const isText = ['json', 'txt', 'csv', 'tsv', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'sql', 'sh', 'yaml', 'yml'].includes(ext) || file.type.startsWith('text/') || file.type.includes('json');

        const readerDataUrl = new FileReader();
        readerDataUrl.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (isText) {
            const textReader = new FileReader();
            textReader.onload = (textEv) => {
              const textContent = textEv.target?.result as string;
              onAddRecordWithData('source', {
                x: Math.round(worldX - 140),
                y: Math.round(worldY - 80),
                title: file.name.replace(/\.[^/.]+$/, ''),
                content: textContent.length > 50000 ? textContent.slice(0, 50000) : textContent,
                fileData: dataUrl,
                fileName: file.name,
                fileSize: file.size,
                fileType: ext
              });
            };
            textReader.readAsText(file);
          } else {
            onAddRecordWithData('source', {
              x: Math.round(worldX - 140),
              y: Math.round(worldY - 80),
              title: file.name.replace(/\.[^/.]+$/, ''),
              fileData: dataUrl,
              fileName: file.name,
              fileSize: file.size,
              fileType: ext
            });
          }
        };
        readerDataUrl.readAsDataURL(file);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.getAttribute('contenteditable')) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              const cx = (window.innerWidth / 2 - viewport.pan.x) / viewport.zoom;
              const cy = (window.innerHeight / 2 - viewport.pan.y) / viewport.zoom;
              onAddRecordWithData('image', {
                x: Math.round(cx - 160),
                y: Math.round(cy - 100),
                title: 'Pasted figure',
                imageUrl: dataUrl,
                fileData: dataUrl
              });
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    };

    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    window.addEventListener('paste', handlePaste);
    return () => {
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
      window.removeEventListener('paste', handlePaste);
    };
  }, [onAddRecordWithData, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => setCanvasSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const measureNodes = () => {
      const elements = canvas.querySelectorAll<HTMLElement>('[data-graph-node]');
      const nextHeights: Record<string, number> = {};

      elements.forEach(el => {
        const id = el.dataset.graphNode;
        if (id) {
          const h = Math.round(el.offsetHeight);
          if (h > 0) nextHeights[id] = h;
        }
      });

      setNodeHeights(prev => {
        let changed = false;
        for (const [id, h] of Object.entries(nextHeights)) {
          if (prev[id] !== h) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...nextHeights } : prev;
      });
    };

    const observer = new ResizeObserver(measureNodes);
    const elements = canvas.querySelectorAll<HTMLElement>('[data-graph-node]');
    elements.forEach(el => observer.observe(el));
    measureNodes();

    return () => observer.disconnect();
  }, [nodes, editingNoteId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0 || canvasSize.width === 0 || canvasSize.height === 0 || lastFittedKey.current === autoFitKey) return;
    lastFittedKey.current = autoFitKey;
    const bounds = nodes.reduce((current, node) => ({
      left: Math.min(current.left, node.x),
      top: Math.min(current.top, node.y),
      right: Math.max(current.right, node.x + (node.width || 280)),
      bottom: Math.max(current.bottom, node.y + (node.height || 150))
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const width = Math.max(1, bounds.right - bounds.left);
    const height = Math.max(1, bounds.bottom - bounds.top);
    const zoom = Math.max(.2, Math.min(.85, (canvasSize.width - 56) / width, (canvasSize.height - 110) / height));
    setViewport({
      zoom,
      pan: {
        x: (canvasSize.width - width * zoom) / 2 - bounds.left * zoom,
        y: (canvasSize.height - height * zoom) / 2 - bounds.top * zoom
      }
    });
  // The caller increments this key only when a graph should be framed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitKey, canvasSize.width, canvasSize.height]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      if (current.kind === 'pan') {
        setViewport(value => ({
          ...value,
          pan: { x: current.origin.x + event.clientX - current.start.x, y: current.origin.y + event.clientY - current.start.y }
        }));
      } else if (current.kind === 'pinch') {
        activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...activePointers.current.values()];
        if (points.length < 2) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        const center = {
          x: (points[0].x + points[1].x) / 2 - rect.left,
          y: (points[0].y + points[1].y) / 2 - rect.top
        };
        setViewport(() => {
          const zoom = Math.min(1.6, Math.max(.28, current.startZoom * distance / current.startDistance));
          return { zoom, pan: { x: center.x - current.anchor.x * zoom, y: center.y - current.anchor.y * zoom } };
        });
      } else if (current.kind === 'resize') {
        const dx = (event.clientX - current.start.x) / viewport.zoom;
        const dy = (event.clientY - current.start.y) / viewport.zoom;
        const { x, y, width = 540, height = 360 } = current.node;
        const handle = current.handle;
        const nextX = handle.includes('w') ? x + dx : x;
        const nextY = handle.includes('n') ? y + dy : y;
        const nextWidth = Math.max(300, width + (handle.includes('e') ? dx : handle.includes('w') ? -dx : 0));
        const nextHeight = Math.max(220, height + (handle.includes('s') ? dy : handle.includes('n') ? -dy : 0));
        onResizeGroup(current.node.id, { x: nextX, y: nextY, width: nextWidth, height: nextHeight });
      } else {
        const dx = (event.clientX - current.start.x) / viewport.zoom;
        const dy = (event.clientY - current.start.y) / viewport.zoom;
        onMoveNodes(Object.fromEntries(Object.entries(current.origins).map(([id, point]) => [id, { x: point.x + dx, y: point.y + dy }])));
      }
    };
    const up = (event: PointerEvent) => {
      activePointers.current.delete(event.pointerId);
      if (gesture.current?.kind === 'drag') {
        setDraggedNodeIds([]);
      }
      gesture.current = null;
    };
    const cancel = () => {
      setDraggedNodeIds([]);
      gesture.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [onMoveNodes, onResizeGroup, setViewport, viewport.zoom]);

  const trackTouchPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.current.size !== 2) return;
    const points = [...activePointers.current.values()];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startDistance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
    const center = {
      x: (points[0].x + points[1].x) / 2 - rect.left,
      y: (points[0].y + points[1].y) / 2 - rect.top
    };
    gesture.current = {
      kind: 'pinch', startDistance, startZoom: viewport.zoom,
      anchor: { x: (center.x - viewport.pan.x) / viewport.zoom, y: (center.y - viewport.pan.y) / viewport.zoom }
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startPan = (event: React.PointerEvent) => {
    if (gesture.current?.kind === 'pinch') return;
    if ((event.target as HTMLElement).closest('button, input, textarea, a, .markdown-editor, .relationship-controls')) return;
    if (event.button !== 0 && event.button !== 1) return;
    gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, origin: viewport.pan };
    if (event.button === 0) { onClearSelection(); onClickAway(); }
  };

  const startGroupResize = (event: React.PointerEvent, node: CanvasNode, handle: SectionResizeHandle) => {
    event.preventDefault(); event.stopPropagation();
    gesture.current = { kind: 'resize', start: { x: event.clientX, y: event.clientY }, node, handle };
  };

  const startNodeDrag = (event: React.PointerEvent, node: CanvasNode) => {
    if (gesture.current?.kind === 'pinch') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (spacePressed || activeTool === 'hand' || event.button === 1) {
      startPan(event);
      return;
    }
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, a, .markdown-editor')) { event.stopPropagation(); return; }
    if (activeTool === 'connect' || linkingFromId) {
      event.preventDefault();
      event.stopPropagation();
      if (linkingFromId && linkingFromId !== node.id) onConnect(linkingFromId, node.id);
      else if (!linkingFromId) onStartLinking(node.id);
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    onSelectNode(node.id, additive);
    const movingIds = additive && selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
    const moveNodes = node.type === 'group' || node.type === 'section'
      ? [...new Set([...movingIds, ...membersOf(node, nodes).map(member => member.id)])]
      : movingIds;
    setDraggedNodeIds(moveNodes);
    const origins = Object.fromEntries(moveNodes.map(id => {
      const found = graph.nodesById[id];
      return [id, { x: found.x, y: found.y }];
    }));
    gesture.current = { kind: 'drag', start: { x: event.clientX, y: event.clientY }, origins };
    event.stopPropagation();
  };

  const zoomAtPointer = (event: React.WheelEvent) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    setViewport(current => {
      const zoom = Math.min(1.6, Math.max(0.28, current.zoom * factor));
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return { zoom, pan: { x: x - (x - current.pan.x) * (zoom / current.zoom), y: y - (y - current.pan.y) * (zoom / current.zoom) } };
    });
  };

  // Map member IDs to their parent group ID if that group is collapsed
  const collapsedMemberToGroup = new Map<string, string>();
  for (const group of groups) {
    if (group.metadata?.collapsed === true) {
      const mems = membersOf(group, nodes);
      for (const mem of mems) {
        collapsedMemberToGroup.set(mem.id, group.id);
      }
    }
  }

  // Pre-calculate effective bounding boxes for all visible nodes and groups
  const nodeBounds: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const group of groups) {
    const mems = membersOf(group, nodes);
    const bounds = groupBounds(group, mems);
    nodeBounds[group.id] = bounds;
  }
  for (const node of nodes) {
    if (node.type !== 'group' && node.type !== 'section') {
      const h = nodeHeights[node.id] || estimateNodeHeight(node);
      nodeBounds[node.id] = {
        x: node.x,
        y: node.y,
        width: node.width || 280,
        height: h
      };
    }
  }

  const edges: Array<{ edge: Connection; path: string; mid: Coordinates }> = [];
  for (const edge of Object.values(graph.edgesById)) {
    const effectiveFromId = collapsedMemberToGroup.get(edge.from) || edge.from;
    const effectiveToId = collapsedMemberToGroup.get(edge.to) || edge.to;

    // Skip internal edges if both nodes are collapsed into the same cluster
    if (effectiveFromId === effectiveToId) continue;

    // Both endpoints must be visible (or rerouted to a visible collapsed cluster)
    if (!visibleIds.has(effectiveFromId) || !visibleIds.has(effectiveToId)) continue;

    const fromBox = nodeBounds[effectiveFromId];
    const toBox = nodeBounds[effectiveToId];
    if (!fromBox || !toBox) continue;

    const fromNode = graph.nodesById[effectiveFromId];
    const toNode = graph.nodesById[effectiveToId];
    if (!fromNode || !toNode) continue;

    const virtualFrom: CanvasNode = { ...fromNode, ...fromBox };
    const virtualTo: CanvasNode = { ...toNode, ...toBox };

    const calculated = relationPath(virtualFrom, virtualTo, edge.lineStyle, fromBox.height, toBox.height);
    edges.push({ edge, ...calculated });
  }

  return (
    <div
      className={`graph-canvas ${spacePressed || activeTool === 'hand' ? 'is-hand-tool' : ''} ${activeTool === 'connect' ? 'is-link-tool' : ''}`}
      ref={canvasRef}
      onPointerDownCapture={trackTouchPointer}
      onWheel={zoomAtPointer}
      onPointerDown={startPan}
      onPointerMove={event => {
        if (!linkingFromId) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        setCursorWorld({ x: (event.clientX - rect.left - viewport.pan.x) / viewport.zoom, y: (event.clientY - rect.top - viewport.pan.y) / viewport.zoom });
      }}
      style={{
        backgroundSize: `${22 * viewport.zoom}px ${22 * viewport.zoom}px`,
        backgroundPosition: `${viewport.pan.x}px ${viewport.pan.y}px`
      }}
    >
      <div className="canvas-rules" aria-hidden="true"><span>KNOWLEDGE PLANE</span><span>FOLD TO FOCUS</span></div>
      <div className="graph-world" style={{ transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})` }}>
        <svg className="relationship-layer" width="100000" height="100000">
          <defs>
            {(['neutral', 'indigo', 'emerald', 'rose', 'amber', 'sky', 'purple'] as const).map((color, index) => <marker key={color} id={`relation-arrow-${color}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L0,6 L7,3 z" fill={['#284b63', '#284b63', '#3c6e71', '#353535', '#353535', '#3c6e71', '#284b63'][index]} /></marker>)}
            <marker id="relation-preview-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#3c6e71" /></marker>
          </defs>
          {edges.map(({ edge, path, mid }) => (
            <g key={edge.id} className="relationship-mark">
              <path className="relationship-hit" d={path} />
              <path className={`relationship-stroke ${edge.animated && edge.strokePattern !== 'solid' ? 'relationship-animated' : ''}`} d={path}
                stroke={(['neutral', 'indigo', 'emerald', 'rose', 'amber', 'sky', 'purple'] as string[]).includes(edge.color || 'neutral') ? ({ neutral: '#284b63', indigo: '#284b63', emerald: '#3c6e71', rose: '#353535', amber: '#353535', sky: '#3c6e71', purple: '#284b63' }[edge.color || 'neutral']) : '#284b63'}
                strokeDasharray={edge.strokePattern === 'dotted' ? '2 5' : edge.strokePattern === 'dashed' ? '8 6' : undefined}
                markerEnd={edge.arrowhead === 'none' || edge.arrowhead === 'start' ? undefined : `url(#relation-arrow-${edge.color || 'neutral'})`}
                markerStart={edge.arrowhead === 'both' || edge.arrowhead === 'start' ? `url(#relation-arrow-${edge.color || 'neutral'})` : undefined} />
              <RelationshipControls connection={edge} x={mid.x} y={mid.y} onUpdate={fields => onUpdateRelationship(edge.id, fields)} onDelete={() => onDeleteRelationship(edge.id)} />
            </g>
          ))}
          {linkingFromId && cursorWorld && graph.nodesById[linkingFromId] && (() => {
            const from = graph.nodesById[linkingFromId];
            const fromBox = nodeBounds[from.id] || {
              x: from.x,
              y: from.y,
              width: from.width || 280,
              height: nodeHeights[from.id] || estimateNodeHeight(from)
            };
            const sx = fromBox.x + fromBox.width / 2;
            const sy = cursorWorld.y >= fromBox.y + fromBox.height / 2 ? fromBox.y + fromBox.height : fromBox.y;
            return <path className="relationship-preview" d={`M ${sx} ${sy} Q ${(sx + cursorWorld.x) / 2} ${(sy + cursorWorld.y) / 2 - 24} ${cursorWorld.x} ${cursorWorld.y}`} markerEnd="url(#relation-preview-arrow)" />;
          })()}
        </svg>
        {groups.map(group => {
          const members = membersOf(group, nodes);
          const bounds = groupBounds(group, members);
          const relationshipCount = Object.values(graph.edgesById).filter(edge => members.some(member => member.id === edge.from || member.id === edge.to)).length;
          return (
            <div
              key={group.id}
              data-graph-node={group.id}
              className={`graph-group-position ${group.metadata?.collapsed ? 'is-folded-position' : ''}`}
              style={{ transform: `translate3d(${bounds.x}px, ${bounds.y}px, 0)`, width: bounds.width, height: bounds.height }}
              onPointerDown={event => startNodeDrag(event, group)}
              onClick={event => { event.stopPropagation(); onEditNote(null); onSelectNode(group.id, event.ctrlKey || event.metaKey); }}
              onDoubleClick={event => { event.stopPropagation(); onOpenGroup(group.id); }}
            >
              <GroupCard
                node={group}
                members={members}
                relationCount={relationshipCount}
                isCollapsed={group.metadata?.collapsed === true}
                selected={selectedNodeIds.includes(group.id)}
                isGrabbed={draggedNodeIds.includes(group.id)}
                onToggle={() => onToggleGroup(group.id)}
                onOpen={() => onOpenGroup(group.id)}
                onStartResize={(event, handle) => startGroupResize(event, group, handle)}
              />
            </div>
          );
        })}
        {nodes.filter(node => node.type !== 'group' && node.type !== 'section' && visibleIds.has(node.id)).map(node => (
          <KnowledgeCard
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            isGrabbed={draggedNodeIds.includes(node.id)}
            isEditing={editingNoteId === node.id}
            onToggleEdit={() => onEditNote(editingNoteId === node.id ? null : node.id)}
            onUpdateContent={content => onUpdateNote(node.id, content)}
            onOpenLightbox={(src, title, caption) => setActiveImage({ src, title, caption })}
            onOpenFileModal={file => setActiveFile(file)}
            onPointerDown={startNodeDrag}
            onClick={(event, current) => {
              event.stopPropagation();
              onSelectNode(current.id, event.ctrlKey || event.metaKey);
              if (current.type !== 'note' || editingNoteId !== current.id) onEditNote(null);
            }}
          />
        ))}
      </div>
      {linkingFromId && <div className="canvas-instruction">Choose a node to create a relationship <button onClick={onCancelLinking}>Cancel</button></div>}
      {activeTool === 'connect' && !linkingFromId && <div className="canvas-instruction">Select two nodes to describe their relationship</div>}

      {activeImage && (
        <ImageViewerModal
          src={activeImage.src}
          title={activeImage.title}
          caption={activeImage.caption}
          onClose={() => setActiveImage(null)}
        />
      )}

      {activeFile && (
        <FileViewerModal
          fileData={activeFile.fileData}
          fileName={activeFile.fileName}
          fileSize={activeFile.fileSize}
          fileType={activeFile.fileType}
          content={activeFile.content}
          onClose={() => setActiveFile(null)}
        />
      )}
    </div>
  );
}
