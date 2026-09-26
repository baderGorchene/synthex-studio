'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, CircleHelp, ExternalLink, FileText, Layers2, Lightbulb, Link2, Pencil, Quote, Sparkles } from 'lucide-react';
import type { CanvasNode, Connection, Coordinates, SectionResizeHandle } from '@/types/canvas';
import type { KnowledgeGraph } from '@/lib/graph';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownView } from './MarkdownView';
import { RelationshipControls } from './RelationshipControls';

type Viewport = { zoom: number; pan: Coordinates };
type Gesture =
  | { kind: 'pan'; start: Coordinates; origin: Coordinates }
  | { kind: 'pinch'; startDistance: number; startZoom: number; anchor: Coordinates }
  | { kind: 'drag'; start: Coordinates; origins: Record<string, Coordinates> }
  | { kind: 'resize'; start: Coordinates; node: CanvasNode; handle: SectionResizeHandle };

const nodeLabel: Record<string, string> = {
  concept: 'Concept', note: 'Note', source: 'Source', link: 'Source', claim: 'Claim',
  question: 'Question', hypothesis: 'Hypothesis', group: 'Knowledge cluster', section: 'Knowledge cluster',
  research_result: 'Research result', task: 'Research task', ai_insight: 'AI insight', image: 'Visual source'
};

function safeExternalHref(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch { return undefined; }
}

function NodeGlyph({ type }: { type: string }) {
  const props = { size: 14, strokeWidth: 1.8 };
  switch (type) {
    case 'concept': return <Lightbulb {...props} />;
    case 'claim': return <Quote {...props} />;
    case 'question': return <CircleHelp {...props} />;
    case 'source': case 'link': return <BookOpen {...props} />;
    case 'note': return <FileText {...props} />;
    case 'group': case 'section': return <Layers2 {...props} />;
    case 'ai_insight': case 'research_result': return <Sparkles {...props} />;
    default: return <Link2 {...props} />;
  }
}

function membersOf(group: CanvasNode, nodes: CanvasNode[]): CanvasNode[] {
  const width = group.width || 540;
  const height = group.height || 360;
  return nodes.filter(node => {
    if (node.id === group.id || node.type === 'group' || node.type === 'section') return false;
    if (node.sectionId === group.id) return true;
    return node.x >= group.x && node.y >= group.y && node.x < group.x + width && node.y < group.y + height;
  });
}

function groupBounds(group: CanvasNode, members: CanvasNode[]) {
  const right = Math.max(group.x + (group.width || 540), ...members.map(node => node.x + (node.width || 280) + (node.sectionId === group.id ? 22 : 0)));
  const bottom = Math.max(group.y + (group.height || 360), ...members.map(node => node.y + (node.height || 150) + (node.sectionId === group.id ? 28 : 0)));
  const left = Math.min(group.x, ...members.filter(node => node.sectionId === group.id).map(node => node.x - 22));
  const top = Math.min(group.y, ...members.filter(node => node.sectionId === group.id).map(node => node.y - 28));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function toggleMarkdownTask(content: string, targetIndex: number) {
  let taskIndex = 0;
  return content.replace(/^([ \t]*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/gm, (match, before: string, checked: string, after: string) => {
    const currentIndex = taskIndex++;
    return currentIndex === targetIndex ? `${before}${checked === ' ' ? 'x' : ' '}${after}` : match;
  });
}

function relationPath(from: CanvasNode, to: CanvasNode, style: Connection['lineStyle'] = 'curved') {
  const fw = from.width || 280;
  const tw = to.width || 280;
  const fh = from.height || 150;
  const th = to.height || 150;
  const dx = to.x + tw / 2 - (from.x + fw / 2);
  const dy = to.y + th / 2 - (from.y + fh / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    const startX = dx >= 0 ? from.x + fw : from.x;
    const endX = dx >= 0 ? to.x : to.x + tw;
    const startY = from.y + fh / 2;
    const endY = to.y + th / 2;
    const bend = Math.max(54, Math.abs(endX - startX) * 0.42);
    const midX = (startX + endX) / 2;
    const path = style === 'straight' ? `M ${startX} ${startY} L ${endX} ${endY}`
      : style === 'stepped' ? `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
        : `M ${startX} ${startY} C ${startX + (dx >= 0 ? bend : -bend)} ${startY}, ${endX - (dx >= 0 ? bend : -bend)} ${endY}, ${endX} ${endY}`;
    return {
      path,
      mid: { x: midX, y: (startY + endY) / 2 - 9 }
    };
  }
  const startX = from.x + fw / 2;
  const endX = to.x + tw / 2;
  const startY = dy >= 0 ? from.y + fh : from.y;
  const endY = dy >= 0 ? to.y : to.y + th;
  const bend = Math.max(48, Math.abs(endY - startY) * 0.4);
  const midY = (startY + endY) / 2;
  const path = style === 'straight' ? `M ${startX} ${startY} L ${endX} ${endY}`
    : style === 'stepped' ? `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`
      : `M ${startX} ${startY} C ${startX} ${startY + (dy >= 0 ? bend : -bend)}, ${endX} ${endY - (dy >= 0 ? bend : -bend)}, ${endX} ${endY}`;
  return {
    path,
    mid: { x: (startX + endX) / 2 + 9, y: midY }
  };
}

function GroupCard({
  node, members, relationCount, isCollapsed, selected, onToggle, onOpen, onStartResize
}: {
  node: CanvasNode;
  members: CanvasNode[];
  relationCount: number;
  isCollapsed: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStartResize: (event: React.PointerEvent, handle: SectionResizeHandle) => void;
}) {
  return (
    <article className={`graph-group ${isCollapsed ? 'is-folded' : ''} ${selected ? 'is-selected' : ''}`}>
      <div className="graph-group-heading">
        <span className="group-mark"><Layers2 size={15} /></span>
        <div className="group-title-wrap">
          <strong>{node.title}</strong>
          <span>{members.length} {members.length === 1 ? 'node' : 'nodes'} · {relationCount} {relationCount === 1 ? 'relationship' : 'relationships'}</span>
        </div>
        <button className="icon-button group-open" aria-label="Open cluster sub-canvas" title="Open cluster sub-canvas" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onOpen(); }}><ExternalLink size={13} /></button>
        <button className="icon-button group-fold" aria-label={isCollapsed ? 'Unfold knowledge cluster' : 'Fold knowledge cluster'} onPointerDown={event => event.stopPropagation()} onClick={onToggle}>
          <ChevronDown size={15} />
        </button>
      </div>
      {isCollapsed ? (
        <div className="group-folded-preview">
          <div className="folded-cells" aria-hidden="true">
            {members.slice(0, 8).map(member => <span key={member.id} className={`fold-cell type-${member.type}`} />)}
          </div>
          <span>Folded knowledge · select to unfold</span>
        </div>
      ) : (
        <div className="group-crease" aria-hidden="true"><i /><i /><i /></div>
      )}
      {!isCollapsed && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as SectionResizeHandle[]).map(handle => <button key={handle} className={`group-resize-handle handle-${handle}`} aria-label={`Resize cluster ${handle}`} title="Resize cluster" onPointerDown={event => onStartResize(event, handle)} />)}
    </article>
  );
}

function KnowledgeCard({
  node, selected, isEditing, onToggleEdit, onUpdateContent, onPointerDown, onClick
}: {
  node: CanvasNode;
  selected: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdateContent: (content: string) => void;
  onPointerDown: (event: React.PointerEvent, node: CanvasNode) => void;
  onClick: (event: React.MouseEvent, node: CanvasNode) => void;
}) {
  const isSource = node.type === 'source' || node.type === 'link';
  const status = node.metadata?.claimStatus?.replaceAll('_', ' ');
  const body = node.content || node.description || node.caption || (isSource ? node.url : '');
  const safeUrl = safeExternalHref(node.url);

  return (
    <article
      data-graph-node={node.id}
      className={`knowledge-card type-${node.type} ${selected ? 'is-selected' : ''}`}
      style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)`, width: node.width || 280 }}
      onPointerDown={event => onPointerDown(event, node)}
      onClick={event => onClick(event, node)}
    >
      <div className="knowledge-card-topline">
        <span className="node-glyph"><NodeGlyph type={node.type} /></span>
        <span className="node-kind">{nodeLabel[node.type] || 'Knowledge'}</span>
        {node.metadata?.origin === 'ai' && <span className="origin-label">AI proposal</span>}
        {node.metadata?.origin === 'example' && <span className="origin-label">Example</span>}
        {status && <span className={`claim-status status-${node.metadata?.claimStatus}`}>{status}</span>}
        {node.type === 'note' && <button className={`note-mode-toggle ${isEditing ? 'is-editing' : ''}`} aria-label={isEditing ? 'Finish editing note' : 'Edit note'} title={isEditing ? 'Finish editing note' : 'Edit note'} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onToggleEdit(); }}>{isEditing ? <Check size={13} /> : <Pencil size={12} />}<span>{isEditing ? 'Done' : 'Edit'}</span></button>}
      </div>
      <h2>{node.title}</h2>
      {node.type === 'note' ? isEditing ? <MarkdownEditor className="card-markdown-editor" value={node.content || ''} onChange={onUpdateContent} ariaLabel="Edit note in Markdown" /> : body ? <MarkdownView content={body} className="node-summary note-markdown-preview" onToggleTask={index => onUpdateContent(toggleMarkdownTask(body, index))} /> : <p className="node-summary note-placeholder">Add a note and format it with Markdown.</p> : body && <p className="node-summary">{body}</p>}
      {isSource && safeUrl && (
        <a className="source-domain" href={safeUrl} target="_blank" rel="noreferrer" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
          <ExternalLink size={12} /> {node.domain || new URL(safeUrl).hostname}
        </a>
      )}
      {node.metadata?.evidence?.length ? <div className="evidence-count">{node.metadata.evidence.length} evidence links</div> : null}
    </article>
  );
}

export function GraphCanvas({
  graph, selectedNodeIds, viewport, setViewport, activeTool, spacePressed, linkingFromId,
  autoFitKey, editingNoteId, onSelectNode, onClearSelection, onClickAway, onCancelLinking, onMoveNodes, onConnect,
  onStartLinking, onToggleGroup, onEditNote, onUpdateNote, onUpdateRelationship, onDeleteRelationship, onResizeGroup, onOpenGroup
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
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const activePointers = useRef(new Map<number, Coordinates>());
  const lastFittedKey = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [cursorWorld, setCursorWorld] = useState<Coordinates | null>(null);
  const nodes = Object.values(graph.nodesById);
  const groups = nodes.filter(node => node.type === 'group' || node.type === 'section');
  const visibleIds = new Set(nodes.filter(node => {
    if (node.type === 'group' || node.type === 'section') return true;
    return !groups.some(group => group.metadata?.collapsed === true && membersOf(group, nodes).some(member => member.id === node.id));
  }).map(node => node.id));

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
      gesture.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
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

  const edges: Array<{ edge: Connection; path: string; mid: Coordinates }> = [];
  for (const edge of Object.values(graph.edgesById)) {
    if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;
    const from = graph.nodesById[edge.from];
    const to = graph.nodesById[edge.to];
    if (!from || !to) continue;
    const calculated = relationPath(from, to, edge.lineStyle);
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
            {(['neutral', 'indigo', 'emerald', 'rose', 'amber', 'sky', 'purple'] as const).map((color, index) => <marker key={color} id={`relation-arrow-${color}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L0,6 L7,3 z" fill={['#86948a', '#6571a6', '#53806b', '#a76e69', '#a48652', '#64859a', '#856d9a'][index]} /></marker>)}
            <marker id="relation-preview-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#607b68" /></marker>
          </defs>
          {edges.map(({ edge, path, mid }) => (
            <g key={edge.id} className="relationship-mark">
              <path className="relationship-hit" d={path} />
              <path className={`relationship-stroke ${edge.animated && edge.strokePattern !== 'solid' ? 'relationship-animated' : ''}`} d={path}
                stroke={(['neutral', 'indigo', 'emerald', 'rose', 'amber', 'sky', 'purple'] as string[]).includes(edge.color || 'neutral') ? ({ neutral: '#86948a', indigo: '#6571a6', emerald: '#53806b', rose: '#a76e69', amber: '#a48652', sky: '#64859a', purple: '#856d9a' }[edge.color || 'neutral']) : '#86948a'}
                strokeDasharray={edge.strokePattern === 'dotted' ? '2 5' : edge.strokePattern === 'dashed' ? '8 6' : undefined}
                markerEnd={edge.arrowhead === 'none' || edge.arrowhead === 'start' ? undefined : `url(#relation-arrow-${edge.color || 'neutral'})`}
                markerStart={edge.arrowhead === 'both' || edge.arrowhead === 'start' ? `url(#relation-arrow-${edge.color || 'neutral'})` : undefined} />
              <RelationshipControls connection={edge} x={mid.x} y={mid.y} onUpdate={fields => onUpdateRelationship(edge.id, fields)} onDelete={() => onDeleteRelationship(edge.id)} />
            </g>
          ))}
          {linkingFromId && cursorWorld && graph.nodesById[linkingFromId] && (() => {
            const from = graph.nodesById[linkingFromId];
            const sx = from.x + (from.width || 280) / 2; const sy = from.y + (from.height || 150) / 2;
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
              className="graph-group-position"
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
            isEditing={editingNoteId === node.id}
            onToggleEdit={() => onEditNote(editingNoteId === node.id ? null : node.id)}
            onUpdateContent={content => onUpdateNote(node.id, content)}
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
    </div>
  );
}
