'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, CircleHelp, ExternalLink, FileText, Layers2, Lightbulb, Link2, Quote, Sparkles } from 'lucide-react';
import type { CanvasNode, Connection, Coordinates } from '@/types/canvas';
import type { KnowledgeGraph } from '@/lib/graph';

type Viewport = { zoom: number; pan: Coordinates };
type Gesture =
  | { kind: 'pan'; start: Coordinates; origin: Coordinates }
  | { kind: 'pinch'; startDistance: number; startZoom: number; anchor: Coordinates }
  | { kind: 'drag'; start: Coordinates; origins: Record<string, Coordinates> };

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

function relationPath(from: CanvasNode, to: CanvasNode) {
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
    return {
      path: `M ${startX} ${startY} C ${startX + (dx >= 0 ? bend : -bend)} ${startY}, ${endX - (dx >= 0 ? bend : -bend)} ${endY}, ${endX} ${endY}`,
      mid: { x: (startX + endX) / 2, y: (startY + endY) / 2 - 9 }
    };
  }
  const startX = from.x + fw / 2;
  const endX = to.x + tw / 2;
  const startY = dy >= 0 ? from.y + fh : from.y;
  const endY = dy >= 0 ? to.y : to.y + th;
  const bend = Math.max(48, Math.abs(endY - startY) * 0.4);
  return {
    path: `M ${startX} ${startY} C ${startX} ${startY + (dy >= 0 ? bend : -bend)}, ${endX} ${endY - (dy >= 0 ? bend : -bend)}, ${endX} ${endY}`,
    mid: { x: (startX + endX) / 2 + 9, y: (startY + endY) / 2 }
  };
}

function GroupCard({
  node, members, relationCount, isCollapsed, selected, onToggle
}: {
  node: CanvasNode;
  members: CanvasNode[];
  relationCount: number;
  isCollapsed: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`graph-group ${isCollapsed ? 'is-folded' : ''} ${selected ? 'is-selected' : ''}`}>
      <div className="graph-group-heading">
        <span className="group-mark"><Layers2 size={15} /></span>
        <div className="group-title-wrap">
          <strong>{node.title}</strong>
          <span>{members.length} {members.length === 1 ? 'node' : 'nodes'} · {relationCount} {relationCount === 1 ? 'relationship' : 'relationships'}</span>
        </div>
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
    </article>
  );
}

function KnowledgeCard({
  node, selected, onPointerDown, onClick
}: {
  node: CanvasNode;
  selected: boolean;
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
      </div>
      <h2>{node.title}</h2>
      {body && <p className="node-summary">{body}</p>}
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
  autoFitKey, onSelectNode, onClearSelection, onCancelLinking, onMoveNodes, onConnect, onStartLinking, onToggleGroup
}: {
  graph: KnowledgeGraph;
  selectedNodeIds: string[];
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  activeTool: 'select' | 'connect' | 'hand';
  spacePressed: boolean;
  linkingFromId: string | null;
  autoFitKey: number;
  onSelectNode: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  onCancelLinking: () => void;
  onMoveNodes: (positions: Record<string, Coordinates>) => void;
  onConnect: (from: string, to: string) => void;
  onStartLinking: (id: string) => void;
  onToggleGroup: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const activePointers = useRef(new Map<number, Coordinates>());
  const lastFittedKey = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
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
  }, [onMoveNodes, setViewport, viewport.zoom]);

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
    if (event.button !== 0 && event.button !== 1) return;
    gesture.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, origin: viewport.pan };
    if (event.button === 0) onClearSelection();
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
    const calculated = relationPath(from, to);
    edges.push({ edge, ...calculated });
  }

  return (
    <div
      className={`graph-canvas ${spacePressed || activeTool === 'hand' ? 'is-hand-tool' : ''} ${activeTool === 'connect' ? 'is-link-tool' : ''}`}
      ref={canvasRef}
      onPointerDownCapture={trackTouchPointer}
      onWheel={zoomAtPointer}
      onPointerDown={startPan}
      style={{
        backgroundSize: `${22 * viewport.zoom}px ${22 * viewport.zoom}px`,
        backgroundPosition: `${viewport.pan.x}px ${viewport.pan.y}px`
      }}
    >
      <div className="canvas-rules" aria-hidden="true"><span>KNOWLEDGE PLANE</span><span>FOLD TO FOCUS</span></div>
      <div className="graph-world" style={{ transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})` }}>
        <svg className="relationship-layer" width="100000" height="100000" aria-hidden="true">
          <defs>
            <marker id="relation-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L7,3 z" fill="#8b9a9c" />
            </marker>
          </defs>
          {edges.map(({ edge, path, mid }) => (
            <g key={edge.id} className="relationship-mark">
              <path d={path} markerEnd="url(#relation-arrow)" />
              {edge.label && <text x={mid.x} y={mid.y}>{edge.label.replaceAll('_', ' ')}</text>}
            </g>
          ))}
        </svg>
        {groups.map(group => {
          const members = membersOf(group, nodes);
          const relationshipCount = Object.values(graph.edgesById).filter(edge => members.some(member => member.id === edge.from || member.id === edge.to)).length;
          return (
            <div
              key={group.id}
              data-graph-node={group.id}
              className="graph-group-position"
              style={{ transform: `translate3d(${group.x}px, ${group.y}px, 0)`, width: group.width || 540, height: group.height || 360 }}
              onPointerDown={event => startNodeDrag(event, group)}
              onClick={event => { event.stopPropagation(); onSelectNode(group.id, event.ctrlKey || event.metaKey); }}
            >
              <GroupCard
                node={group}
                members={members}
                relationCount={relationshipCount}
                isCollapsed={group.metadata?.collapsed === true}
                selected={selectedNodeIds.includes(group.id)}
                onToggle={() => onToggleGroup(group.id)}
              />
            </div>
          );
        })}
        {nodes.filter(node => node.type !== 'group' && node.type !== 'section' && visibleIds.has(node.id)).map(node => (
          <KnowledgeCard
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            onPointerDown={startNodeDrag}
            onClick={(event, current) => {
              event.stopPropagation();
              if (linkingFromId && linkingFromId !== current.id) onConnect(linkingFromId, current.id);
              else onSelectNode(current.id, event.ctrlKey || event.metaKey);
            }}
          />
        ))}
      </div>
      {linkingFromId && <div className="canvas-instruction">Choose a node to create a relationship <button onClick={onCancelLinking}>Cancel</button></div>}
      {activeTool === 'connect' && !linkingFromId && <div className="canvas-instruction">Select two nodes to describe their relationship</div>}
    </div>
  );
}
