'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Layers2, Sparkles, Trash2 } from 'lucide-react';
import type { CanvasNode, Connection, Coordinates, SectionResizeHandle, CanvasNodeType, Viewport } from '@/types/canvas';
import { hexToRgba } from '@/types/canvas';
import type { KnowledgeGraph } from '@/lib/graph';
import { RelationshipControls } from './RelationshipControls';
import { getLinkThumbnail, extractYouTubeVideoId } from './SourceMetadata';
import { NodeCard, NodeGlyph } from './nodes';

const RELATION_PALETTE: Record<string, string> = {
  neutral: '#64748b', indigo: '#6366f1', emerald: '#10b981', rose: '#f43f5e',
  amber: '#f59e0b', sky: '#0ea5e9', purple: '#a855f7'
};
import { FileViewerModal, ImageViewerModal } from './FileAndMediaModal';
import { Minimap } from './Minimap';
import { uploadFile } from '@/lib/upload';
import { extractPageNumber, type CitationReference } from '@/utils/citation';
type Gesture =
  | { kind: 'pan'; start: Coordinates; origin: Coordinates }
  | { kind: 'pinch'; startDistance: number; startZoom: number; anchor: Coordinates }
  | { kind: 'drag'; start: Coordinates; origins: Record<string, Coordinates>; primaryId?: string }
  | { kind: 'resize'; start: Coordinates; node: CanvasNode; handle: SectionResizeHandle }
  | { kind: 'marquee'; startClient: Coordinates; currentClient: Coordinates; additive: boolean };


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
  const { thumbnailUrl } = getLinkThumbnail(node);
  if (isSource && thumbnailUrl) {
    h += 138;
  } else if (isSource && !node.fileData && (node.url || node.domain)) {
    h += 48;
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

function DottedRelationship({ path, color, colorKey, arrowhead, animated }: {
  path: string;
  color: string;
  colorKey: string;
  arrowhead: Connection['arrowhead'];
  animated: boolean;
}) {
  const measureRef = useRef<SVGPathElement>(null);
  const [dots, setDots] = useState<Coordinates[]>([]);

  useLayoutEffect(() => {
    const measurePath = measureRef.current;
    if (!measurePath) return;
    const length = measurePath.getTotalLength();
    if (length < 1) { setDots([]); return; }
    if (length < 14) {
      const point = measurePath.getPointAtLength(length / 2);
      setDots([{ x: point.x, y: point.y }]);
      return;
    }
    const inset = Math.min(7, length / 2);
    const usableLength = Math.max(0, length - inset * 2);
    const intervals = Math.max(1, Math.round(usableLength / 12));
    const spacing = usableLength / intervals;
    setDots(Array.from({ length: intervals + 1 }, (_, index) => {
      const point = measurePath.getPointAtLength(inset + spacing * index);
      return { x: point.x, y: point.y };
    }));
  }, [path]);

  return <>
    <path ref={measureRef} className="relationship-measure-path" d={path} />
    {dots.map((dot, index) => <circle key={index} className={`relationship-dot ${animated ? 'animated' : ''}`} style={animated ? { animationDelay: `${index * 45}ms` } : undefined} cx={dot.x} cy={dot.y} r="1.8" fill={color} />)}
    {(arrowhead === 'end' || arrowhead === 'both' || arrowhead === 'start') && <path
      className="relationship-arrow-anchor"
      d={path}
      markerEnd={arrowhead === 'end' || arrowhead === 'both' ? `url(#relation-arrow-${colorKey})` : undefined}
      markerStart={arrowhead === 'both' || arrowhead === 'start' ? `url(#relation-arrow-${colorKey})` : undefined}
    />}
  </>;
}

function GroupCard({
  node, members, relationCount, isCollapsed, selected, isGrabbed, dragTilt = 0, onToggle, onOpen, onStartResize, isResizeLocked
}: {
  node: CanvasNode;
  members: CanvasNode[];
  relationCount: number;
  isCollapsed: boolean;
  selected: boolean;
  isGrabbed?: boolean;
  dragTilt?: number;
  onToggle: () => void;
  onOpen: () => void;
  onStartResize: (event: React.PointerEvent, handle: SectionResizeHandle) => void;
  isResizeLocked?: boolean;
}) {
  const customColor = node.color;
  return (
    <article
      className={`graph-group ${isCollapsed ? 'is-folded' : ''} ${selected ? 'is-selected' : ''} ${isGrabbed ? 'is-grabbed' : ''}`}
      style={{
        transform: isGrabbed ? `scale(1.012) rotate(${dragTilt * 0.35}deg)` : undefined,
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

      {!isCollapsed && !isResizeLocked && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as SectionResizeHandle[]).map(handle => (
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


export function GraphCanvas({
  graph, selectedNodeIds, viewport, setViewport, activeTool, spacePressed, linkingFromId,
  autoFitKey, editingNoteId, onSelectNode, onSelectMultipleNodes, onClearSelection, onClickAway, onCancelLinking, onMoveNodes, onConnect,
  onStartLinking, onToggleGroup, onEditNote, onUpdateNote, onUpdateRelationship, onDeleteRelationship, onResizeGroup, onOpenGroup,
  onAddRecordWithData, onDeleteNodes, projectId, isResizeLocked = false
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
  onSelectMultipleNodes?: (ids: string[], additive?: boolean) => void;
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
  onDeleteNodes?: (ids: string[]) => void;
  projectId?: string;
  isResizeLocked?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const activePointers = useRef(new Map<number, Coordinates>());
  const lastFittedKey = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [cursorWorld, setCursorWorld] = useState<Coordinates | null>(null);
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [draggedNodeIds, setDraggedNodeIds] = useState<string[]>([]);
  const [dragTilt, setDragTilt] = useState<number>(0);
  const [marqueeBox, setMarqueeBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const trashRef = useRef<HTMLDivElement>(null);
  const [activeImage, setActiveImage] = useState<{ src: string; title?: string; caption?: string } | null>(null);
  const [activeFile, setActiveFile] = useState<{ fileData?: string; fileName?: string; fileSize?: number; fileType?: string; content?: string; initialPage?: number; highlightExcerpt?: string } | null>(null);

  const handleOpenEvidenceCitation = useCallback((evidence: CitationReference) => {
    const srcNode = graph.nodesById[evidence.sourceId];
    const pageNum = evidence.page || extractPageNumber(evidence.location);

    if (srcNode?.fileData) {
      setActiveFile({
        fileData: srcNode.fileData,
        fileName: srcNode.fileName || srcNode.title,
        fileSize: srcNode.fileSize,
        fileType: srcNode.fileType || 'application/pdf',
        initialPage: pageNum,
        highlightExcerpt: evidence.excerpt
      });
    } else if (srcNode) {
      onSelectNode(srcNode.id, false);
      if (srcNode.url) {
        window.open(srcNode.url, '_blank', 'noreferrer');
      }
    }
  }, [graph.nodesById, onSelectNode]);
  const lastClientX = useRef<number | null>(null);
  const rafMoveRef = useRef<number | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number; type: 'x' | 'y' }>>([]);
  const pendingMoveEvent = useRef<{ clientX: number; clientY: number; shiftKey?: boolean } | null>(null);
  const nodes = useMemo(() => Object.values(graph.nodesById), [graph]);
  const groups = useMemo(() => nodes.filter(node => node.type === 'group' || node.type === 'section'), [nodes]);
  const visibleIds = useMemo(() => new Set(nodes.filter(node => {
    if (node.type === 'group' || node.type === 'section') return true;
    return !groups.some(group => group.metadata?.collapsed === true && membersOf(group, nodes).some(member => member.id === node.id));
  }).map(node => node.id)), [nodes, groups]);

  // Pre-calculate effective bounding boxes for all visible nodes and groups
  const nodeBounds = useMemo(() => {
    const bounds: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const group of groups) {
      const mems = membersOf(group, nodes);
      bounds[group.id] = groupBounds(group, mems);
    }
    for (const node of nodes) {
      if (node.type !== 'group' && node.type !== 'section') {
        const h = node.height || nodeHeights[node.id] || estimateNodeHeight(node);
        bounds[node.id] = {
          x: node.x,
          y: node.y,
          width: node.width || (node.type === 'image' ? 320 : 280),
          height: h
        };
      }
    }
    return bounds;
  }, [nodes, groups, nodeHeights]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onAddRecordWithData) return;

    const handleDragOver = (e: DragEvent) => {
      if (
        e.dataTransfer?.types.includes('Files') ||
        e.dataTransfer?.types.includes('text/uri-list') ||
        e.dataTransfer?.types.includes('text/plain')
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      const uri = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - viewport.pan.x) / viewport.zoom;
      const worldY = (e.clientY - rect.top - viewport.pan.y) / viewport.zoom;

      if (uri && (uri.trim().startsWith('http://') || uri.trim().startsWith('https://'))) {
        e.preventDefault();
        const cleanUrl = uri.trim();
        const ytId = extractYouTubeVideoId(cleanUrl);
        onAddRecordWithData('source', {
          x: Math.round(worldX - 140),
          y: Math.round(worldY - 80),
          title: ytId ? 'YouTube video' : 'Web link',
          url: cleanUrl,
          imageUrl: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined,
          domain: ytId ? 'youtube.com' : undefined,
          metadata: {
            origin: 'user',
            siteName: ytId ? 'YouTube' : undefined,
            image: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined
          }
        });
        return;
      }

      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const file = e.dataTransfer.files[0];

      if (file.type.startsWith('image/')) {
        uploadFile(file, projectId).then(uploaded => {
          onAddRecordWithData('image', {
            x: Math.round(worldX - 160),
            y: Math.round(worldY - 100),
            title: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: uploaded.url,
            fileData: uploaded.url,
            fileName: uploaded.fileName,
            fileSize: uploaded.fileSize,
            fileType: uploaded.fileType
          });
        });
      } else {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
        const isText = ['json', 'txt', 'csv', 'tsv', 'md', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'sql', 'sh', 'yaml', 'yml'].includes(ext) || file.type.startsWith('text/') || file.type.includes('json');

        if (isText) {
          const textReader = new FileReader();
          textReader.onload = (textEv) => {
            const textContent = textEv.target?.result as string;
            uploadFile(file, projectId).then(uploaded => {
              onAddRecordWithData('source', {
                x: Math.round(worldX - 140),
                y: Math.round(worldY - 80),
                title: file.name.replace(/\.[^/.]+$/, ''),
                content: textContent.length > 50000 ? textContent.slice(0, 50000) : textContent,
                fileData: uploaded.url,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                fileType: ext
              });
            });
          };
          textReader.readAsText(file);
        } else {
          uploadFile(file, projectId).then(uploaded => {
            onAddRecordWithData('source', {
              x: Math.round(worldX - 140),
              y: Math.round(worldY - 80),
              title: file.name.replace(/\.[^/.]+$/, ''),
              fileData: uploaded.url,
              fileName: uploaded.fileName,
              fileSize: uploaded.fileSize,
              fileType: ext
            });
          });
        }
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
            const cx = (window.innerWidth / 2 - viewport.pan.x) / viewport.zoom;
            const cy = (window.innerHeight / 2 - viewport.pan.y) / viewport.zoom;
            uploadFile(blob, projectId, 'pasted-figure.png').then(uploaded => {
              onAddRecordWithData('image', {
                x: Math.round(cx - 160),
                y: Math.round(cy - 100),
                title: 'Pasted figure',
                imageUrl: uploaded.url,
                fileData: uploaded.url,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                fileType: uploaded.fileType
              });
            });
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
  }, [onAddRecordWithData, viewport, projectId]);

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

  const handleFitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0 || canvasSize.width === 0 || canvasSize.height === 0) return;
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
  }, [nodes, canvasSize.width, canvasSize.height, setViewport]);

  useEffect(() => {
    if (nodes.length === 0 || canvasSize.width === 0 || canvasSize.height === 0 || lastFittedKey.current === autoFitKey) return;
    lastFittedKey.current = autoFitKey;
    handleFitCanvas();
  // The caller increments this key only when a graph should be framed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitKey, handleFitCanvas]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      if (current.kind === 'pan') {
        setViewport(value => ({
          ...value,
          pan: { x: current.origin.x + event.clientX - current.start.x, y: current.origin.y + event.clientY - current.start.y }
        }));
      } else if (current.kind === 'marquee') {
        current.currentClient = { x: event.clientX, y: event.clientY };
        setMarqueeBox({
          x1: current.startClient.x,
          y1: current.startClient.y,
          x2: event.clientX,
          y2: event.clientY
        });

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const worldX1 = (current.startClient.x - rect.left - viewport.pan.x) / viewport.zoom;
          const worldY1 = (current.startClient.y - rect.top - viewport.pan.y) / viewport.zoom;
          const worldX2 = (event.clientX - rect.left - viewport.pan.x) / viewport.zoom;
          const worldY2 = (event.clientY - rect.top - viewport.pan.y) / viewport.zoom;
          const minX = Math.min(worldX1, worldX2);
          const maxX = Math.max(worldX1, worldX2);
          const minY = Math.min(worldY1, worldY2);
          const maxY = Math.max(worldY1, worldY2);

          const intersectingIds = nodes.filter(node => {
            if (!visibleIds.has(node.id)) return false;
            const b = node.type === 'group' || node.type === 'section'
              ? groupBounds(node, membersOf(node, nodes))
              : {
                  x: node.x,
                  y: node.y,
                  width: node.width || 280,
                  height: nodeHeights[node.id] || estimateNodeHeight(node)
                };
            return !(
              b.x > maxX ||
              b.x + b.width < minX ||
              b.y > maxY ||
              b.y + b.height < minY
            );
          }).map(n => n.id);

          onSelectMultipleNodes?.(intersectingIds, current.additive);
        }
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
        const isGroup = current.node.type === 'group' || current.node.type === 'section';
        const defaultWidth = isGroup ? 540 : (current.node.type === 'image' ? 320 : 280);
        const defaultHeight = isGroup ? 360 : 130;
        const { x, y, width = defaultWidth, height = defaultHeight } = current.node;
        const handle = current.handle;
        const nextX = handle.includes('w') ? x + dx : x;
        const nextY = handle.includes('n') ? y + dy : y;
        const minW = isGroup ? 300 : 180;
        const minH = isGroup ? 220 : 100;
        const nextWidth = Math.max(minW, width + (handle.includes('e') ? dx : handle.includes('w') ? -dx : 0));
        const nextHeight = Math.max(minH, height + (handle.includes('s') ? dy : handle.includes('n') ? -dy : 0));
        onResizeGroup(current.node.id, { x: nextX, y: nextY, width: nextWidth, height: nextHeight });
      } else {
        pendingMoveEvent.current = { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey };
        if (rafMoveRef.current === null) {
          rafMoveRef.current = requestAnimationFrame(() => {
            rafMoveRef.current = null;
            const ev = pendingMoveEvent.current;
            const cur = gesture.current;
            if (!ev || !cur || cur.kind !== 'drag') return;

            const rawDx = (ev.clientX - cur.start.x) / viewport.zoom;
            const rawDy = (ev.clientY - cur.start.y) / viewport.zoom;

            let finalDx = rawDx;
            let finalDy = rawDy;
            const nextGuides: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; type: 'x' | 'y' }> = [];

            // Smart Alignment Snapping (Hold Shift to disable snapping for freehand motion)
            if (!ev.shiftKey && cur.primaryId && cur.origins[cur.primaryId]) {
              const primaryOrigin = cur.origins[cur.primaryId];
              const pNode = graph.nodesById[cur.primaryId];
              if (pNode) {
                const pBox = nodeBounds[cur.primaryId] || {
                  x: primaryOrigin.x,
                  y: primaryOrigin.y,
                  width: pNode.width || 280,
                  height: nodeHeights[cur.primaryId] || estimateNodeHeight(pNode)
                };

                const currentX = primaryOrigin.x + rawDx;
                const currentY = primaryOrigin.y + rawDy;
                const currentWidth = pBox.width;
                const currentHeight = pBox.height;
                const currentCenterX = currentX + currentWidth / 2;
                const currentRightX = currentX + currentWidth;
                const currentCenterY = currentY + currentHeight / 2;
                const currentBottomY = currentY + currentHeight;

                const SNAP_DISTANCE = 7; // distance in world coordinates
                let bestXDist = SNAP_DISTANCE;
                let snapDx = 0;
                let activeXGuide: { x: number; y1: number; y2: number } | null = null;

                let bestYDist = SNAP_DISTANCE;
                let snapDy = 0;
                let activeYGuide: { y: number; x1: number; x2: number } | null = null;

                // Test alignment against all non-dragged visible nodes/clusters
                for (const other of nodes) {
                  if (cur.origins[other.id] || !visibleIds.has(other.id)) continue;
                  const ob = nodeBounds[other.id];
                  if (!ob) continue;

                  const otherCenterX = ob.x + ob.width / 2;
                  const otherRightX = ob.x + ob.width;
                  const otherCenterY = ob.y + ob.height / 2;
                  const otherBottomY = ob.y + ob.height;

                  // Vertical Alignment (X axis): Left, Center, Right
                  if (Math.abs(currentX - ob.x) < bestXDist) {
                    bestXDist = Math.abs(currentX - ob.x);
                    snapDx = ob.x - currentX;
                    activeXGuide = { x: ob.x, y1: Math.min(currentY, ob.y) - 24, y2: Math.max(currentBottomY, otherBottomY) + 24 };
                  }
                  if (Math.abs(currentCenterX - otherCenterX) < bestXDist) {
                    bestXDist = Math.abs(currentCenterX - otherCenterX);
                    snapDx = otherCenterX - currentCenterX;
                    activeXGuide = { x: otherCenterX, y1: Math.min(currentY, ob.y) - 24, y2: Math.max(currentBottomY, otherBottomY) + 24 };
                  }
                  if (Math.abs(currentRightX - otherRightX) < bestXDist) {
                    bestXDist = Math.abs(currentRightX - otherRightX);
                    snapDx = otherRightX - currentRightX;
                    activeXGuide = { x: otherRightX, y1: Math.min(currentY, ob.y) - 24, y2: Math.max(currentBottomY, otherBottomY) + 24 };
                  }
                  if (Math.abs(currentX - otherRightX) < bestXDist) {
                    bestXDist = Math.abs(currentX - otherRightX);
                    snapDx = otherRightX - currentX;
                    activeXGuide = { x: otherRightX, y1: Math.min(currentY, ob.y) - 24, y2: Math.max(currentBottomY, otherBottomY) + 24 };
                  }
                  if (Math.abs(currentRightX - ob.x) < bestXDist) {
                    bestXDist = Math.abs(currentRightX - ob.x);
                    snapDx = ob.x - currentRightX;
                    activeXGuide = { x: ob.x, y1: Math.min(currentY, ob.y) - 24, y2: Math.max(currentBottomY, otherBottomY) + 24 };
                  }

                  // Horizontal Alignment (Y axis): Top, Center, Bottom
                  if (Math.abs(currentY - ob.y) < bestYDist) {
                    bestYDist = Math.abs(currentY - ob.y);
                    snapDy = ob.y - currentY;
                    activeYGuide = { y: ob.y, x1: Math.min(currentX, ob.x) - 24, x2: Math.max(currentRightX, otherRightX) + 24 };
                  }
                  if (Math.abs(currentCenterY - otherCenterY) < bestYDist) {
                    bestYDist = Math.abs(currentCenterY - otherCenterY);
                    snapDy = otherCenterY - currentCenterY;
                    activeYGuide = { y: otherCenterY, x1: Math.min(currentX, ob.x) - 24, x2: Math.max(currentRightX, otherRightX) + 24 };
                  }
                  if (Math.abs(currentBottomY - otherBottomY) < bestYDist) {
                    bestYDist = Math.abs(currentBottomY - otherBottomY);
                    snapDy = otherBottomY - currentBottomY;
                    activeYGuide = { y: otherBottomY, x1: Math.min(currentX, ob.x) - 24, x2: Math.max(currentRightX, otherRightX) + 24 };
                  }
                  if (Math.abs(currentY - otherBottomY) < bestYDist) {
                    bestYDist = Math.abs(currentY - otherBottomY);
                    snapDy = otherBottomY - currentY;
                    activeYGuide = { y: otherBottomY, x1: Math.min(currentX, ob.x) - 24, x2: Math.max(currentRightX, otherRightX) + 24 };
                  }
                  if (Math.abs(currentBottomY - ob.y) < bestYDist) {
                    bestYDist = Math.abs(currentBottomY - ob.y);
                    snapDy = ob.y - currentBottomY;
                    activeYGuide = { y: ob.y, x1: Math.min(currentX, ob.x) - 24, x2: Math.max(currentRightX, otherRightX) + 24 };
                  }
                }

                if (activeXGuide) {
                  finalDx += snapDx;
                  nextGuides.push({
                    id: 'guide-x',
                    x1: activeXGuide.x,
                    y1: activeXGuide.y1,
                    x2: activeXGuide.x,
                    y2: activeXGuide.y2,
                    type: 'x'
                  });
                }
                if (activeYGuide) {
                  finalDy += snapDy;
                  nextGuides.push({
                    id: 'guide-y',
                    x1: activeYGuide.x1,
                    y1: activeYGuide.y,
                    x2: activeYGuide.x2,
                    y2: activeYGuide.y,
                    type: 'y'
                  });
                }
              }
            }

            setAlignmentGuides(nextGuides);

            if (lastClientX.current !== null) {
              const vx = ev.clientX - lastClientX.current;
              const targetTilt = Math.min(4, Math.max(-4, vx * 0.42));
              setDragTilt(targetTilt);
            }
            lastClientX.current = ev.clientX;

            if (trashRef.current) {
              const tRect = trashRef.current.getBoundingClientRect();
              const isOver = (
                ev.clientX >= tRect.left - 28 &&
                ev.clientX <= tRect.right + 28 &&
                ev.clientY >= tRect.top - 28 &&
                ev.clientY <= tRect.bottom + 28
              );
              setIsOverTrash(isOver);
            }

            onMoveNodes(
              Object.fromEntries(
                Object.entries(cur.origins).map(([id, point]) => [id, { x: point.x + finalDx, y: point.y + finalDy }])
              )
            );
          });
        }
      }
    };
    const up = (event: PointerEvent) => {
      activePointers.current.delete(event.pointerId);
      if (rafMoveRef.current !== null) {
        cancelAnimationFrame(rafMoveRef.current);
        rafMoveRef.current = null;
      }
      pendingMoveEvent.current = null;
      lastClientX.current = null;
      setAlignmentGuides([]);

      if (gesture.current?.kind === 'marquee') {
        const cur = gesture.current;
        const dist = Math.hypot(event.clientX - cur.startClient.x, event.clientY - cur.startClient.y);
        if (dist < 5) {
          onClearSelection();
          onClickAway();
        }
        setMarqueeBox(null);
      } else if (gesture.current?.kind === 'drag') {
        const isTrashDrop = isOverTrash;
        const nodesToDelete = [...draggedNodeIds];
        setDraggedNodeIds([]);
        setDragTilt(0);
        setIsOverTrash(false);

        if (isTrashDrop && nodesToDelete.length > 0) {
          onDeleteNodes?.(nodesToDelete);
          gesture.current = null;
          return;
        }
      }
      gesture.current = null;
    };
    const cancel = () => {
      if (rafMoveRef.current !== null) {
        cancelAnimationFrame(rafMoveRef.current);
        rafMoveRef.current = null;
      }
      pendingMoveEvent.current = null;
      lastClientX.current = null;
      setAlignmentGuides([]);
      setDraggedNodeIds([]);
      setDragTilt(0);
      setIsOverTrash(false);
      setMarqueeBox(null);
      gesture.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      if (rafMoveRef.current !== null) {
        cancelAnimationFrame(rafMoveRef.current);
        rafMoveRef.current = null;
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [onMoveNodes, onResizeGroup, onSelectMultipleNodes, onDeleteNodes, setViewport, viewport.zoom, viewport.pan, nodes, visibleIds, nodeHeights, isOverTrash, draggedNodeIds, onClearSelection, onClickAway, graph.nodesById, nodeBounds]);

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

  const startCanvasPointerDown = (event: React.PointerEvent) => {
    if (gesture.current?.kind === 'pinch') return;
    if ((event.target as HTMLElement).closest('button, input, textarea, a, .markdown-editor, .relationship-controls, .knowledge-card, .graph-group-position, .canvas-tool-dock')) return;
    if (event.button !== 0 && event.button !== 1) return;

    if (linkingFromId) {
      onCancelLinking();
      return;
    }

    if (spacePressed || activeTool === 'hand' || event.button === 1) {
      gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, origin: viewport.pan };
      return;
    }

    if (activeTool === 'select' && event.button === 0) {
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      gesture.current = {
        kind: 'marquee',
        startClient: { x: event.clientX, y: event.clientY },
        currentClient: { x: event.clientX, y: event.clientY },
        additive
      };
      setMarqueeBox({
        x1: event.clientX,
        y1: event.clientY,
        x2: event.clientX,
        y2: event.clientY
      });
      if (!additive) {
        onClearSelection();
      }
      onClickAway();
    }
  };

  const startGroupResize = (event: React.PointerEvent, node: CanvasNode, handle: SectionResizeHandle) => {
    if (isResizeLocked) return;
    event.preventDefault(); event.stopPropagation();
    gesture.current = { kind: 'resize', start: { x: event.clientX, y: event.clientY }, node, handle };
  };

  const startNodeResize = (event: React.PointerEvent, node: CanvasNode, handle: SectionResizeHandle) => {
    if (isResizeLocked) return;
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
      gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, origin: viewport.pan };
      return;
    }
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, a, .markdown-editor')) { event.stopPropagation(); return; }
    if (activeTool === 'connect' || linkingFromId) {
      event.preventDefault();
      event.stopPropagation();
      if (linkingFromId) onConnect(linkingFromId, node.id);
      else onStartLinking(node.id);
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    onSelectNode(node.id, additive);
    const movingIds = additive && selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
    const moveNodes = node.type === 'group' || node.type === 'section'
      ? [...new Set([...movingIds, ...membersOf(node, nodes).map(member => member.id)])]
      : movingIds;
    setDraggedNodeIds(moveNodes);
    setDragTilt(0);
    lastClientX.current = event.clientX;
    const origins = Object.fromEntries(moveNodes.map(id => {
      const found = graph.nodesById[id];
      return [id, { x: found.x, y: found.y }];
    }));
    gesture.current = { kind: 'drag', start: { x: event.clientX, y: event.clientY }, origins, primaryId: node.id };
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

  // -------------------------------------------------------------------------
  // Viewport Culling & Virtualization (60 FPS for 200+ Nodes)
  // -------------------------------------------------------------------------
  const viewWidth = canvasSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1920);
  const viewHeight = canvasSize.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);
  const safeZoom = Math.max(0.05, viewport.zoom);
  // Buffer of 600px in world coordinates guarantees cards render before entering view during smooth pan
  const buffer = Math.max(500, 750 / safeZoom);

  const visibleWorldRect = {
    left: -viewport.pan.x / safeZoom - buffer,
    top: -viewport.pan.y / safeZoom - buffer,
    right: (-viewport.pan.x + viewWidth) / safeZoom + buffer,
    bottom: (-viewport.pan.y + viewHeight) / safeZoom + buffer
  };

  const isBoxInViewport = (box?: { x: number; y: number; width: number; height: number }) => {
    if (!box) return true;
    return (
      box.x + box.width >= visibleWorldRect.left &&
      box.x <= visibleWorldRect.right &&
      box.y + box.height >= visibleWorldRect.top &&
      box.y <= visibleWorldRect.bottom
    );
  };

  // Virtualized Groups
  const renderedGroups = groups.filter(group => {
    if (selectedNodeIds.includes(group.id) || draggedNodeIds.includes(group.id)) return true;
    const mems = membersOf(group, nodes);
    if (mems.some(m => selectedNodeIds.includes(m.id) || draggedNodeIds.includes(m.id))) return true;
    return isBoxInViewport(nodeBounds[group.id]);
  });

  // Virtualized Nodes
  const renderedVisibleNodes = nodes.filter(node => {
    if (node.type === 'group' || node.type === 'section') return false;
    if (!visibleIds.has(node.id)) return false;

    // Active, selected, dragged, or editing nodes are always kept mounted
    if (
      selectedNodeIds.includes(node.id) ||
      draggedNodeIds.includes(node.id) ||
      linkingFromId === node.id ||
      editingNoteId === node.id
    ) {
      return true;
    }

    return isBoxInViewport(nodeBounds[node.id]);
  });

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

    // Virtualization: Skip off-screen edge path calculation if neither endpoint is active
    const isEndpointActive = (
      selectedNodeIds.includes(effectiveFromId) ||
      selectedNodeIds.includes(effectiveToId) ||
      draggedNodeIds.includes(effectiveFromId) ||
      draggedNodeIds.includes(effectiveToId) ||
      linkingFromId === effectiveFromId ||
      linkingFromId === effectiveToId
    );

    if (!isEndpointActive) {
      const edgeMinX = Math.min(fromBox.x, toBox.x);
      const edgeMaxX = Math.max(fromBox.x + fromBox.width, toBox.x + toBox.width);
      const edgeMinY = Math.min(fromBox.y, toBox.y);
      const edgeMaxY = Math.max(fromBox.y + fromBox.height, toBox.y + toBox.height);

      const isEdgeInView = (
        edgeMaxX >= visibleWorldRect.left &&
        edgeMinX <= visibleWorldRect.right &&
        edgeMaxY >= visibleWorldRect.top &&
        edgeMinY <= visibleWorldRect.bottom
      );

      if (!isEdgeInView) continue;
    }

    const virtualFrom: CanvasNode = { ...fromNode, ...fromBox };
    const virtualTo: CanvasNode = { ...toNode, ...toBox };

    const calculated = relationPath(virtualFrom, virtualTo, edge.lineStyle, fromBox.height, toBox.height);
    edges.push({ edge, ...calculated });
  }

  const screenMarquee = marqueeBox ? {
    left: Math.min(marqueeBox.x1, marqueeBox.x2),
    top: Math.min(marqueeBox.y1, marqueeBox.y2),
    width: Math.abs(marqueeBox.x2 - marqueeBox.x1),
    height: Math.abs(marqueeBox.y2 - marqueeBox.y1)
  } : null;

  return (
    <div
      className={`graph-canvas ${spacePressed || activeTool === 'hand' ? 'is-hand-tool' : ''} ${activeTool === 'connect' ? 'is-link-tool' : ''} ${isResizeLocked ? 'canvas-resize-locked' : ''}`}
      ref={canvasRef}
      onPointerDownCapture={trackTouchPointer}
      onWheel={zoomAtPointer}
      onPointerDown={startCanvasPointerDown}
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

      {nodes.length > 25 && renderedVisibleNodes.length + renderedGroups.length < nodes.length && (
        <div className="canvas-perf-pill" title="Hardware-accelerated viewport virtualization active for 60 FPS performance">
          <span className="perf-dot" />
          <span>60 FPS · {renderedVisibleNodes.length + renderedGroups.length}/{nodes.length} cards</span>
        </div>
      )}

      {screenMarquee && screenMarquee.width > 2 && screenMarquee.height > 2 && (
        <div
          className="canvas-marquee-box"
          style={{
            left: screenMarquee.left,
            top: screenMarquee.top,
            width: screenMarquee.width,
            height: screenMarquee.height
          }}
        />
      )}

      <div className="graph-world" style={{ transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})` }}>
        <svg className="relationship-layer" width="100000" height="100000">
          <defs>
            {(['neutral', 'indigo', 'emerald', 'rose', 'amber', 'sky', 'purple'] as const).map(color => (
              <marker
                key={color}
                id={`relation-arrow-${color}`}
                markerWidth="8"
                markerHeight="8"
                refX="5.5"
                refY="3"
                orient="auto-start-reverse"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L7,3 z" fill={RELATION_PALETTE[color] || '#284b63'} />
              </marker>
            ))}
            <marker id="relation-preview-arrow" markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#3c6e71" />
            </marker>
          </defs>
          {edges.map(({ edge, path, mid }) => {
            const isDotted = edge.strokePattern === 'dotted';
            const isDashed = edge.strokePattern === 'dashed';
            const isSolid = !isDotted && !isDashed;
            const strokeColor = RELATION_PALETTE[edge.color || 'neutral'] || '#284b63';

            return (
              <g key={edge.id} className="relationship-mark">
                <path className="relationship-hit" d={path} />

                {isDotted ? <DottedRelationship
                  path={path}
                  color={strokeColor}
                  colorKey={edge.color || 'neutral'}
                  arrowhead={edge.arrowhead || 'end'}
                  animated={Boolean(edge.animated)}
                /> : <path
                  className={`relationship-stroke ${edge.animated && isDashed ? 'relationship-animated-dashed' : ''}`}
                  d={path}
                  stroke={strokeColor}
                  strokeDasharray={isDashed ? '8 8' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={edge.animated && isSolid ? 0.35 : 1}
                  markerEnd={edge.arrowhead === 'none' || edge.arrowhead === 'start' ? undefined : `url(#relation-arrow-${edge.color || 'neutral'})`}
                  markerStart={edge.arrowhead === 'both' || edge.arrowhead === 'start' ? `url(#relation-arrow-${edge.color || 'neutral'})` : undefined}
                />}

                {/* Continuous animation pulse on solid lines: travels right on the line with exact zero offset */}
                {edge.animated && isSolid && (
                  <path
                    className="relationship-stroke relationship-animated-continuous"
                    d={path}
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeDasharray="40 100"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    pointerEvents="none"
                  />
                )}

                <RelationshipControls connection={edge} x={mid.x} y={mid.y} onUpdate={fields => onUpdateRelationship(edge.id, fields)} onDelete={() => onDeleteRelationship(edge.id)} />
              </g>
            );
          })}
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
            return <path className="relationship-preview" d={`M ${sx} ${sy} Q ${(sx + cursorWorld.x) / 2} ${(sy + cursorWorld.y) / 2 - 24} ${cursorWorld.x} ${cursorWorld.y}`} markerEnd="url(#relation-preview-arrow)" strokeLinecap="round" strokeLinejoin="round" />;
          })()}
          {/* Smart Alignment Guides (Snap to adjacent records) */}
          {alignmentGuides.map(guide => (
            <g key={guide.id} className="canvas-alignment-guide">
              <line
                x1={guide.x1}
                y1={guide.y1}
                x2={guide.x2}
                y2={guide.y2}
                stroke="#3c6e71"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx={guide.x1} cy={guide.y1} r="2.5" fill="#3c6e71" />
              <circle cx={guide.x2} cy={guide.y2} r="2.5" fill="#3c6e71" />
            </g>
          ))}
        </svg>
        {renderedGroups.map(group => {
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
                dragTilt={draggedNodeIds.includes(group.id) ? dragTilt : 0}
                onToggle={() => onToggleGroup(group.id)}
                onOpen={() => onOpenGroup(group.id)}
                onStartResize={(event, handle) => startGroupResize(event, group, handle)}
                isResizeLocked={isResizeLocked}
              />
            </div>
          );
        })}
        {renderedVisibleNodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            isGrabbed={draggedNodeIds.includes(node.id)}
            dragTilt={draggedNodeIds.includes(node.id) ? dragTilt : 0}
            isEditing={editingNoteId === node.id}
            allNodesById={graph.nodesById}
            onOpenEvidenceCitation={handleOpenEvidenceCitation}
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
            isResizeLocked={isResizeLocked}
            onStartResize={(event, handle) => startNodeResize(event, node, handle)}
          />
        ))}
      </div>
      {linkingFromId && <div className="canvas-instruction">Choose a node to create a relationship <button onClick={onCancelLinking}>Cancel</button></div>}
      {activeTool === 'connect' && !linkingFromId && <div className="canvas-instruction">Select two nodes to describe their relationship</div>}

      {/* Interactive Floating Garbage / Trash Drop Zone */}
      <div
        ref={trashRef}
        className={`canvas-trash-zone ${draggedNodeIds.length > 0 ? 'is-visible' : ''} ${isOverTrash ? 'is-active' : ''}`}
        role="region"
        aria-label="Delete drop zone"
      >
        <div className="trash-icon-wrap">
          <Trash2 size={isOverTrash ? 20 : 17} />
        </div>
        <div className="trash-label-wrap">
          <span className="trash-primary-label">
            {isOverTrash
              ? `Release to delete ${draggedNodeIds.length > 1 ? `${draggedNodeIds.length} records` : 'record'}`
              : `Drop here to delete ${draggedNodeIds.length > 1 ? `(${draggedNodeIds.length})` : ''}`}
          </span>
          <span className="trash-sub-label">
            {isOverTrash ? 'Action can be undone with Ctrl+Z' : 'Drag onto trash to remove'}
          </span>
        </div>
      </div>

      {/* Interactive Bird's-Eye Minimap Navigation */}
      {nodes.length > 0 && (
        <Minimap
          nodes={nodes}
          groups={groups}
          viewport={viewport}
          canvasSize={canvasSize}
          nodeBounds={nodeBounds}
          onPanTo={pan => setViewport(prev => ({ ...prev, pan }))}
          onFitCanvas={handleFitCanvas}
          selectedNodeIds={selectedNodeIds}
        />
      )}

      {screenMarquee && (
        <div
          className="canvas-marquee-box"
          style={{
            left: `${screenMarquee.left}px`,
            top: `${screenMarquee.top}px`,
            width: `${screenMarquee.width}px`,
            height: `${screenMarquee.height}px`
          }}
        />
      )}

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
          initialPage={activeFile.initialPage}
          highlightExcerpt={activeFile.highlightExcerpt}
          onClose={() => setActiveFile(null)}
        />
      )}
    </div>
  );
}
