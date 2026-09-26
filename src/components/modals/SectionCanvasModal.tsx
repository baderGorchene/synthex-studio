'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Minimize2,
  Layers,
  Link2,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import {
  CanvasNode,
  CanvasNodeType,
  CanvasTool,
  Connection,
  Coordinates,
  ThemeTokens
} from '@/types/canvas';
import { calculateConnectionPaths, calculateRubberBandPath, getNodeHeight, screenToCanvas, snapCoord } from '@/utils/canvasMath';
import { CanvasCard } from '../canvas/CanvasCard';
import { ConnectorLayer } from '../canvas/ConnectorLayer';

interface SectionCanvasModalProps {
  isOpen: boolean;
  section: CanvasNode | null;
  allNodes: CanvasNode[];
  allConnections: Connection[];
  themeTokens: ThemeTokens;
  isLight: boolean;
  onClose: () => void;
  onUpdateNode: (id: string, fields: Partial<CanvasNode>) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (node: CanvasNode) => void;
  onAddNode: (type: CanvasNodeType, customProps?: Partial<CanvasNode>) => void;
  onAddConnection: (fromId: string, toId: string, label?: string) => void;
  onUpdateConnection?: (id: string, fields: Partial<Connection>) => void;
  onDeleteConnection: (id: string) => void;
  onOpenImageGen: (id: string, caption?: string) => void;
}

export const SectionCanvasModal: React.FC<SectionCanvasModalProps> = ({
  isOpen,
  section,
  allNodes,
  allConnections,
  themeTokens,
  isLight,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onAddNode,
  onAddConnection,
  onUpdateConnection,
  onDeleteConnection,
  onOpenImageGen
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Local canvas transform for sub-canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Coordinates>({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Coordinates>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Interaction states
  const [activeTool, setActiveTool] = useState<CanvasTool>('hand');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<Coordinates | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Coordinates>({ x: 0, y: 0 });

  // Filter nodes belonging to this section
  const sectionNodes = useMemo(() => {
    if (!section) return [];
    const secW = section.width || 640;
    const secH = section.height || 420;

    return allNodes.filter(n => {
      if (n.id === section.id || n.type === 'section') return false;
      // Either tagged with sectionId or physically inside the section bounding box
      if (n.sectionId === section.id) return true;
      const nodeW = n.width || 300;
      const nodeH = getNodeHeight(n);
      const cx = n.x + nodeW / 2;
      const cy = n.y + nodeH / 2;
      return cx >= section.x && cx <= section.x + secW && cy >= section.y && cy <= section.y + secH;
    });
  }, [section, allNodes]);

  const memberIds = useMemo(() => new Set(sectionNodes.map(n => n.id)), [sectionNodes]);

  // Filter connections where both source and target belong to this section
  const sectionConnections = useMemo(() => {
    return allConnections.filter(c => memberIds.has(c.from) && memberIds.has(c.to));
  }, [allConnections, memberIds]);

  const connectionPaths = useMemo(() => {
    return calculateConnectionPaths(sectionNodes, sectionConnections);
  }, [sectionNodes, sectionConnections]);

  // Center & fit to elements when opening modal
  useEffect(() => {
    if (!isOpen || !section) return;

    const frameId = requestAnimationFrame(() => {
      if (sectionNodes.length > 0) {
        const minX = Math.min(...sectionNodes.map(n => n.x));
        const minY = Math.min(...sectionNodes.map(n => n.y));
        const maxX = Math.max(...sectionNodes.map(n => n.x + (n.width || 300)));
        const maxY = Math.max(...sectionNodes.map(n => n.y + getNodeHeight(n)));
        const boxW = Math.max(maxX - minX, 400);

        const targetZoom = Math.min(Math.max(700 / (boxW + 120), 0.65), 1.1);
        setZoom(targetZoom);
        setPan({
          x: 450 - ((minX + maxX) / 2) * targetZoom,
          y: 280 - ((minY + maxY) / 2) * targetZoom
        });
      } else {
        setZoom(1);
        setPan({ x: -section.x + 100, y: -section.y + 100 });
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [isOpen, section, sectionNodes]);

  // Sub-canvas coordinate conversion
  const screenToSubCanvas = useCallback(
    (screenX: number, screenY: number): Coordinates => {
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const localX = screenX - rect.left;
      const localY = screenY - rect.top;
      return screenToCanvas(localX, localY, pan, zoom);
    },
    [pan, zoom]
  );

  // Handle pointer down on sub-canvas background
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const isHandMode = isSpacePressed || activeTool === 'hand' || e.button === 1;
    if (isHandMode || (e.target as HTMLElement).classList.contains('subcanvas-bg')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (!isHandMode) {
        setSelectedNodeId(null);
      }
      setConnectingFromId(null);
      setConnectingMousePos(null);
    }
  };

  // Node drag inside section sub-canvas
  const handleStartDragNode = (e: React.PointerEvent, node: CanvasNode) => {
    if (isSpacePressed || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    e.stopPropagation();

    if (activeTool === 'connect' || connectingFromId) {
      if (connectingFromId && connectingFromId !== node.id) {
        onAddConnection(connectingFromId, node.id);
        setConnectingFromId(null);
        setConnectingMousePos(null);
      } else {
        setConnectingFromId(node.id);
      }
      return;
    }

    setSelectedNodeId(node.id);
    const canvasCoords = screenToSubCanvas(e.clientX, e.clientY);
    setDragOffset({
      x: canvasCoords.x - node.x,
      y: canvasCoords.y - node.y
    });
    setDraggedNodeId(node.id);
  };

  // Window drag tracker for sub-canvas
  useEffect(() => {
    if (!draggedNodeId && !isPanning && !connectingFromId) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
        return;
      }

      if (draggedNodeId) {
        window.getSelection()?.removeAllRanges();
        const coords = screenToSubCanvas(e.clientX, e.clientY);
        const newX = snapCoord(coords.x - dragOffset.x, 20);
        const newY = snapCoord(coords.y - dragOffset.y, 20);
        onUpdateNode(draggedNodeId, { x: newX, y: newY });
      }

      if (connectingFromId) {
        const coords = screenToSubCanvas(e.clientX, e.clientY);
        setConnectingMousePos(coords);
      }
    };

    const handlePointerUp = () => {
      setIsPanning(false);
      setDraggedNodeId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggedNodeId, isPanning, connectingFromId, panStart, dragOffset, screenToSubCanvas, onUpdateNode]);

  // Space key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (e.key === 'Escape') {
        if (connectingFromId) {
          setConnectingFromId(null);
          setConnectingMousePos(null);
        } else {
          onClose();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, connectingFromId, onClose]);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    let newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    newZoom = Math.min(Math.max(newZoom, 0.35), 2.0);

    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Add node directly inside this section's coordinates
  const handleAddMemberCard = (type: CanvasNodeType) => {
    if (!section) return;
    const targetX = section.x + 40 + (sectionNodes.length % 3) * 60;
    const targetY = section.y + 70 + Math.floor(sectionNodes.length / 3) * 60;

    onAddNode(type, {
      x: targetX,
      y: targetY,
      sectionId: section.id
    });
  };

  const connectingSourceNode = useMemo(() => {
    return connectingFromId ? sectionNodes.find(n => n.id === connectingFromId) : null;
  }, [connectingFromId, sectionNodes]);

  const liveRubberBandPath = useMemo(() => {
    if (!connectingSourceNode || !connectingMousePos) return null;
    return calculateRubberBandPath(connectingSourceNode, connectingMousePos);
  }, [connectingSourceNode, connectingMousePos]);

  if (!isOpen || !section) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
      <div
        className={`relative w-full h-full max-w-7xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
          isLight ? 'bg-slate-50/95 border-slate-200 text-slate-800' : 'bg-zinc-950/95 border-zinc-800 text-zinc-100'
        }`}
      >
        {/* Top Header of Section Sub-Canvas */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${
            isLight ? 'bg-white/80 border-slate-200' : 'bg-zinc-900/80 border-zinc-800'
          }`}
        >
          {/* Section Info & Editable Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 text-[11px] font-mono mb-0.5">
                <span className="text-slate-400 dark:text-zinc-500">Main Canvas</span>
                <span className="text-slate-300 dark:text-zinc-600">/</span>
                <span className="text-indigo-500 font-semibold">{section.title || 'Untitled Section'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => onUpdateNode(section.id, { title: e.target.value })}
                  className={`text-base font-bold bg-transparent outline-none border-b border-transparent focus:border-indigo-500 transition-colors ${
                    isLight ? 'text-slate-900' : 'text-zinc-100'
                  }`}
                  placeholder="Section Title"
                />
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  {sectionNodes.length} {sectionNodes.length === 1 ? 'element' : 'elements'}
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Isolated Sub-Canvas Studio • Edit positions, content, and edge connections freely
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-2">
            {/* Quick Add Card Buttons */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <button
                onClick={() => handleAddMemberCard('note')}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Add Note to Section"
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">Note</span>
              </button>
              <button
                onClick={() => handleAddMemberCard('task')}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Add Tasks to Section"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Tasks</span>
              </button>
              <button
                onClick={() => handleAddMemberCard('image')}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Add Image to Section"
              >
                <ImageIcon className="w-3.5 h-3.5 text-violet-500" />
                <span className="hidden sm:inline">Image</span>
              </button>
              <button
                onClick={() => handleAddMemberCard('link')}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Add Link to Section"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Link</span>
              </button>
            </div>

            {/* Tool Selection */}
            <div className={`flex items-center space-x-1 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-900 border-zinc-800'
            }`}>
              <button
                onClick={() => setActiveTool('hand')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  activeTool === 'hand'
                    ? 'bg-indigo-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
                title="Hand Tool: Grab Cards & Pan (H)"
              >
                <Hand className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTool('connect')}
                className={`flex items-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTool === 'connect'
                    ? 'bg-indigo-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
                title="Arrow Tool: Link Elements (V / C)"
              >
                <MousePointer2 className="w-4 h-4" />
                <span className="hidden sm:inline">Link</span>
              </button>
            </div>

            {/* Close Sub-Canvas Modal */}
            <button
              onClick={onClose}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300'
                  : 'bg-zinc-900 hover:bg-zinc-800/60 border-zinc-800 text-zinc-200 hover:border-indigo-500/50'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Back to Canvas</span>
            </button>
          </div>
        </div>

        {/* Sub-Canvas Workspace Area */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handleCanvasPointerDown}
          className={`relative flex-1 w-full h-full overflow-hidden subcanvas-bg select-none ${
            isSpacePressed || activeTool === 'hand'
              ? isPanning
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : activeTool === 'connect'
              ? 'cursor-crosshair'
              : 'cursor-default'
          }`}
          style={{
            backgroundImage: `radial-gradient(circle, ${themeTokens.dotColor} 1.2px, transparent 1.2px)`,
            backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundColor: themeTokens.canvasBg
          }}
        >
          {/* Active Tool Banner for Linking */}
          {activeTool === 'connect' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500 text-white text-xs font-medium shadow-xl animate-in slide-in-from-top-2">
              <Link2 className="w-3.5 h-3.5 animate-pulse" />
              <span>
                {connectingFromId
                  ? 'Click a target card to complete edge link (Esc to cancel)'
                  : 'Click any card to start edge connection'}
              </span>
            </div>
          )}

          {/* Canvas Transform Space */}
          <div
            className="absolute inset-0 origin-top-left pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: '50000px',
              height: '50000px'
            }}
          >
            {/* SVG Connectors */}
            <ConnectorLayer
              connectionPaths={connectionPaths}
              selectedConnectionId={selectedConnectionId}
              themeTokens={themeTokens}
              isLight={isLight}
              onSelectConnection={setSelectedConnectionId}
              onUpdateConnection={onUpdateConnection}
              onDeleteConnection={onDeleteConnection}
            />

            {/* Live Interactive Rubber-Band Line */}
            {liveRubberBandPath && (
              <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-50">
                <path
                  d={liveRubberBandPath}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
              </svg>
            )}

            {/* Member Cards */}
            {sectionNodes.map(node => (
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
                onSelect={setSelectedNodeId}
                onStartDrag={handleStartDragNode}
                onUpdate={onUpdateNode}
                onDelete={onDeleteNode}
                onDuplicate={onDuplicateNode}
                onStartConnect={(id) => {
                  if (connectingFromId && connectingFromId !== id) {
                    onAddConnection(connectingFromId, id);
                    setConnectingFromId(null);
                    setConnectingMousePos(null);
                  } else {
                    setConnectingFromId(id);
                  }
                }}
                onAiAction={() => {}}
                onTtsPlay={() => {}}
                isAiLoading={false}
                isTtsLoading={false}
                onOpenImageGen={onOpenImageGen}
              />
            ))}
          </div>

          {/* Empty Section State */}
          {sectionNodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold mb-1">No Elements in this Section Yet</h3>
              <p className={`text-xs max-w-sm mb-4 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Add elements using the toolbar above, or drag existing cards into this section from the main canvas.
              </p>
              <div className="flex items-center space-x-2 pointer-events-auto">
                <button
                  onClick={() => handleAddMemberCard('note')}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-500 text-white text-xs font-semibold shadow-md hover:bg-indigo-600 cursor-pointer active:scale-95 transition-all"
                >
                  Create First Card
                </button>
              </div>
            </div>
          )}

          {/* Sub-Canvas Zoom Controls */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-1.5 p-1 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setZoom(z => Math.max(z - 0.15, 0.35))}
              className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-indigo-500 transition-colors rounded-lg cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1 font-medium text-slate-600 dark:text-zinc-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.15, 2.0))}
              className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-indigo-500 transition-colors rounded-lg cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
