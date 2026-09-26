import React, { useMemo } from 'react';
import {
  AiActionType,
  CanvasNode,
  CanvasTool,
  Connection,
  ConnectionPath,
  Coordinates,
  SectionResizeHandle,
  ThemeTokens
} from '@/types/canvas';
import { isNodeInsideSection } from '@/utils/canvasMath';
import { ConnectorLayer } from './ConnectorLayer';
import { CanvasCard } from './CanvasCard';
import { MousePointer2 } from 'lucide-react';

interface InfiniteCanvasProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodes: CanvasNode[];
  connections: Connection[];
  connectionPaths: ConnectionPath[];
  liveRubberBandPath?: string | null;
  selectedNodeId: string | null;
  selectedConnectionId?: string | null;
  connectingFromId: string | null;
  draggedNodeId?: string | null;
  hoveredSectionId?: string | null;
  resizingSectionId?: string | null;
  pan: Coordinates;
  zoom: number;
  isPanning: boolean;
  isSpacePressed: boolean;
  activeTool?: CanvasTool;
  themeTokens: ThemeTokens;
  isLight: boolean;
  activeAiNodeId: string | null;
  isNodeAiLoading: boolean;
  activeTtsNodeId: string | null;
  isTtsLoading: boolean;
  onWheel: (e: React.WheelEvent) => void;
  onCanvasPointerDown: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: () => void;
  onSelectNode: (id: string | null) => void;
  onSelectConnection?: (id: string | null) => void;
  onStartDragNode: (e: React.PointerEvent, node: CanvasNode) => void;
  onUpdateNode: (id: string, fields: Partial<CanvasNode>) => void;
  onUpdateConnection?: (id: string, fields: Partial<Connection>) => void;
  onReverseConnection?: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (node: CanvasNode) => void;
  onStartConnect: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  onAiAction: (node: CanvasNode, actionType: AiActionType) => void;
  onTtsPlay: (node: CanvasNode) => void;
  onOpenImageGen: (id: string, caption?: string) => void;
  onOpenSectionModal?: (sectionId: string) => void;
  onStartResizeSection?: (e: React.PointerEvent, node: CanvasNode, handle: SectionResizeHandle) => void;
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  canvasRef,
  nodes,
  connectionPaths,
  liveRubberBandPath = null,
  selectedNodeId,
  selectedConnectionId = null,
  connectingFromId,
  draggedNodeId = null,
  hoveredSectionId = null,
  resizingSectionId = null,
  pan,
  zoom,
  isPanning,
  isSpacePressed,
  activeTool = 'select',
  themeTokens,
  isLight,
  activeAiNodeId,
  isNodeAiLoading,
  activeTtsNodeId,
  isTtsLoading,
  onWheel,
  onCanvasPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectNode,
  onSelectConnection,
  onStartDragNode,
  onUpdateNode,
  onUpdateConnection,
  onReverseConnection,
  onDeleteNode,
  onDuplicateNode,
  onStartConnect,
  onDeleteConnection,
  onAiAction,
  onTtsPlay,
  onOpenImageGen,
  onOpenSectionModal,
  onStartResizeSection
}) => {
  const isHandMode = isSpacePressed || activeTool === 'hand';
  const isConnectMode = activeTool === 'connect';

  // Explicit separation: Sections are ALWAYS rendered in the background layer
  const sectionNodes = useMemo(() => nodes.filter(n => n.type === 'section'), [nodes]);
  const contentNodes = useMemo(() => nodes.filter(n => n.type !== 'section'), [nodes]);

  // Compute count of member cards inside each section
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sec of sectionNodes) {
      counts[sec.id] = contentNodes.filter(
        n => n.sectionId === sec.id || isNodeInsideSection(n, sec)
      ).length;
    }
    return counts;
  }, [sectionNodes, contentNodes]);

  return (
    <div
      ref={canvasRef}
      onWheel={onWheel}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`relative flex-1 w-full h-full overflow-hidden canvas-surface select-none ${
        isHandMode
          ? isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : isConnectMode
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
      style={{
        backgroundImage: `radial-gradient(circle, ${themeTokens.dotColor} 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
    >
      {/* Arrow Linker Interactive Top Floating Bar */}
      {isConnectMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-2.5 px-4 py-2 rounded-full bg-indigo-600/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3">
          <MousePointer2 className="w-4 h-4 animate-pulse text-indigo-200" />
          <span>
            {connectingFromId
              ? 'Click a target card to complete connection (Press Esc to cancel)'
              : 'Arrow Linker: Click cards to connect them • Press Esc to return to Hand'}
          </span>
        </div>
      )}

      {/* Transform container for pan and zoom */}
      <div
        className="absolute inset-0 origin-top-left pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: '100000px',
          height: '100000px'
        }}
      >
        {/* Layer 1: Background Section Groups (Always in the background) */}
        <div className="absolute inset-0 pointer-events-none z-1">
          {sectionNodes.map(node => (
            <CanvasCard
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnectingSource={connectingFromId === node.id}
              isDragging={draggedNodeId === node.id}
              isResizing={resizingSectionId === node.id}
              containedCount={sectionCounts[node.id] || 0}
              isTargetedForDrop={hoveredSectionId === node.id}
              activeTool={activeTool}
              themeTokens={themeTokens}
              isLight={isLight}
              isSpacePressed={isSpacePressed}
              onSelect={onSelectNode}
              onStartDrag={onStartDragNode}
              onUpdate={onUpdateNode}
              onDelete={onDeleteNode}
              onDuplicate={onDuplicateNode}
              onStartConnect={onStartConnect}
              onAiAction={onAiAction}
              onTtsPlay={onTtsPlay}
              isAiLoading={false}
              isTtsLoading={false}
              onOpenImageGen={onOpenImageGen}
              onOpenSectionModal={onOpenSectionModal}
              onStartResize={onStartResizeSection}
            />
          ))}
        </div>

        {/* Layer 2: Architectural SVG Vector Connectors & Live Rubber Band */}
        <ConnectorLayer
          connectionPaths={connectionPaths}
          selectedConnectionId={selectedConnectionId}
          themeTokens={themeTokens}
          isLight={isLight}
          onSelectConnection={onSelectConnection}
          onUpdateConnection={onUpdateConnection}
          onReverseConnection={onReverseConnection}
          onDeleteConnection={onDeleteConnection}
          rubberBandPath={liveRubberBandPath}
        />

        {/* Layer 3: Foreground Content Cards (Notes, Tasks, Images, Links) */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {contentNodes.map(node => (
            <CanvasCard
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnectingSource={connectingFromId === node.id}
              isDragging={draggedNodeId === node.id}
              activeTool={activeTool}
              themeTokens={themeTokens}
              isLight={isLight}
              isSpacePressed={isSpacePressed}
              onSelect={onSelectNode}
              onStartDrag={onStartDragNode}
              onUpdate={onUpdateNode}
              onDelete={onDeleteNode}
              onDuplicate={onDuplicateNode}
              onStartConnect={onStartConnect}
              onAiAction={onAiAction}
              onTtsPlay={onTtsPlay}
              isAiLoading={isNodeAiLoading && activeAiNodeId === node.id}
              isTtsLoading={isTtsLoading && activeTtsNodeId === node.id}
              onOpenImageGen={onOpenImageGen}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
