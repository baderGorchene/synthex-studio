import React, { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  FolderOpen,
  GripVertical,
  Hand,
  Image as ImageIcon,
  Link2,
  MousePointer2,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import { CanvasNode, CanvasNodeType, CanvasTool, Coordinates, ThemeTokens } from '@/types/canvas';
import { ACCENT_SWATCHES } from '@/constants/themes';

interface CreativeDockProps {
  themeTokens: ThemeTokens;
  isLight: boolean;
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  dockPosition: Coordinates | null;
  onUpdateDockPosition: (pos: Coordinates | null) => void;
  onNavigateToNode: (id: string) => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onCreateNode: (type: CanvasNodeType) => void;
  onOpenSpotlight: () => void;
  isSpacePressed?: boolean;
}

export const CreativeDock: React.FC<CreativeDockProps> = ({
  themeTokens,
  isLight,
  activeTool,
  onSelectTool,
  nodes,
  selectedNodeId,
  dockPosition,
  onUpdateDockPosition,
  onNavigateToNode,
  onNavigateNext,
  onNavigatePrev,
  onCreateNode,
  onOpenSpotlight,
  isSpacePressed = false
}) => {
  const [showNavigator, setShowNavigator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDraggingDock, setIsDraggingDock] = useState(false);
  const [dockDragStart, setDockDragStart] = useState<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 20,
    startY: 200
  });

  const dockRef = useRef<HTMLDivElement | null>(null);

  // Space + Drag on dock to move the whole navbar/dock
  const startDockDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const currentRect = dockRef.current?.getBoundingClientRect() || { left: 20, top: 200 };
    setIsDraggingDock(true);
    setDockDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentRect.left,
      startY: currentRect.top
    });
  };

  useEffect(() => {
    if (!isDraggingDock) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaX = e.clientX - dockDragStart.mouseX;
      const deltaY = e.clientY - dockDragStart.mouseY;
      const newX = Math.max(10, Math.min(window.innerWidth - 70, dockDragStart.startX + deltaX));
      const newY = Math.max(50, Math.min(window.innerHeight - 350, dockDragStart.startY + deltaY));
      onUpdateDockPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDraggingDock(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingDock, dockDragStart, onUpdateDockPosition]);

  // Click-away: close navigator panel when clicking outside the dock
  useEffect(() => {
    if (!showNavigator) return;
    const handleOutside = (e: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setShowNavigator(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside, true);
    return () => window.removeEventListener('pointerdown', handleOutside, true);
  }, [showNavigator]);

  const dockStyle: React.CSSProperties = dockPosition
    ? {
      position: 'absolute',
      left: `${dockPosition.x}px`,
      top: `${dockPosition.y}px`,
      transform: 'none'
    }
    : {
      position: 'absolute',
      left: '20px',
      top: '50%',
      transform: 'translateY(-50%)'
    };

  const getNodeIcon = (type: CanvasNodeType) => {
    switch (type) {
      case 'note':
        return <FileText className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />;
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-amber-500" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-sky-500" />;
      case 'section':
        return <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  return (
    <div
      ref={dockRef}
      style={dockStyle}
      className={`z-30 flex flex-col items-center p-1 rounded-2xl border shadow-2xl backdrop-blur-xl space-y-1 select-none transition-shadow ${themeTokens.panelBg
        } ${isSpacePressed ? 'cursor-grab active:cursor-grabbing ring-2 ring-indigo-500/50' : ''}`}
      onPointerDown={(e) => {
        if (isSpacePressed) {
          startDockDrag(e);
        }
      }}
    >
      {/* Move Grip Handle (drag to move navbar/dock anywhere) */}
      <div
        onPointerDown={startDockDrag}
        className="w-full py-1 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition"
        title="Drag to reposition sidebar (or hold Space and drag)"
      >
        <GripVertical className="w-3.5 h-3.5 opacity-60" />
      </div>

      {/* 1. HAND TOOL: Grab & Drop Elements + Pan Canvas (H) */}
      <button
        onClick={() => onSelectTool('hand')}
        className={`group relative p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${activeTool === 'hand'
            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
            : themeTokens.toolHover
          }`}
        title="Hand Tool: Grab Elements & Pan Canvas (H)"
      >
        <Hand className="w-4 h-4" />
        <span className="absolute left-14 px-2.5 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700/80 text-white text-[11px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-xl z-50 flex flex-col items-start gap-0.5">
          <span className="font-semibold flex items-center gap-1.5">
            Hand Grab & Pan <kbd className="px-1 py-0.2 bg-zinc-800 rounded text-[9px] text-zinc-300 font-mono">H</kbd>
          </span>
          <span className="text-[10px] text-zinc-400 font-normal">Drag cards to reorganize • Drag canvas to navigate</span>
        </span>
      </button>

      {/* 2. ARROW TOOL: Link Elements (V / C) */}
      <button
        onClick={() => onSelectTool('connect')}
        className={`group relative p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${activeTool === 'connect'
            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
            : themeTokens.toolHover
          }`}
        title="Arrow Tool: Link Elements (V / C)"
      >
        <MousePointer2 className="w-4 h-4" />
        <span className="absolute left-14 px-2.5 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700/80 text-white text-[11px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-xl z-50 flex flex-col items-start gap-0.5">
          <span className="font-semibold flex items-center gap-1.5">
            Arrow Linker Tool <kbd className="px-1 py-0.2 bg-zinc-800 rounded text-[9px] text-zinc-300 font-mono">V / C</kbd>
          </span>
          <span className="text-[10px] text-zinc-400 font-normal">Click cards to connect live edges</span>
        </span>
      </button>

      {/* 3. ELEMENT NAVIGATOR: Dedicated Button with Element Count Badge */}
      <div className="relative">
        <button
          onClick={() => setShowNavigator(prev => !prev)}
          className={`group relative p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${showNavigator
              ? 'bg-indigo-500 text-white shadow-md'
              : themeTokens.toolHover
            }`}
          title="Element Navigator: Cycle & Focus Cards"
        >
          <Compass className="w-4 h-4" />
          <span className="absolute left-14 px-2.5 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700/80 text-white text-[11px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-xl z-50 flex flex-col items-start gap-0.5">
            <span className="font-semibold flex items-center gap-1.5">
              Element Navigator <kbd className="px-1 py-0.2 bg-zinc-800 rounded text-[9px] text-zinc-300 font-mono">← / →</kbd>
            </span>
            <span className="text-[10px] text-zinc-400 font-normal">Browse & jump to individual elements</span>
          </span>
        </button>

        {/* Count Pill Badge */}
        <span
          className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold pointer-events-none shadow-xs transition ${showNavigator
              ? 'bg-white text-indigo-600 ring-2 ring-indigo-500'
              : 'bg-indigo-600 text-white'
            }`}
        >
          {nodes.length}
        </span>
      </div>

      <div className={`w-5 h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

      {/* 3. PRIMITIVES */}
      <button
        onClick={() => onCreateNode('note')}
        className={`group relative p-2 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Note (N)"
      >
        <FileText className="w-4 h-4 text-slate-700 dark:text-zinc-200" />
        <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 text-white text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
          Add Note
        </span>
      </button>

      <button
        onClick={() => onCreateNode('task')}
        className={`group relative p-2 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Checklist (T)"
      >
        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 text-white text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
          Add Checklist
        </span>
      </button>

      <button
        onClick={() => onCreateNode('image')}
        className={`group relative p-2 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Image Moodboard (I)"
      >
        <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 text-white text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
          Add Image
        </span>
      </button>

      <button
        onClick={() => onCreateNode('link')}
        className={`group relative p-2 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Web Reference (L)"
      >
        <Link2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
        <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 text-white text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
          Add Link
        </span>
      </button>

      <button
        onClick={() => onCreateNode('section')}
        className={`group relative p-2 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Grouping Section (S)"
      >
        <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 text-white text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
          Add Section Group
        </span>
      </button>

      <div className={`w-5 h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

      {/* Quick AI Research Spotlight */}
      <button
        onClick={onOpenSpotlight}
        className="group relative p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm cursor-pointer"
        title="Deep Research Agent"
      >
        <Sparkles className="w-4 h-4" />
        <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 text-white text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
          AI Deep Research (ctrl+k)
        </span>
      </button>

      {/* DEDICATED ELEMENT NAVIGATOR FLYOUT */}
      {showNavigator && (
        <div
          className={`absolute left-14 top-0 w-72 rounded-2xl border p-2.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 select-none ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#141519]/95 border-zinc-800'
            }`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Navigator Header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 dark:border-zinc-800 mb-2">
            <div className="flex items-center space-x-1.5">
              <Compass className="w-4 h-4 text-indigo-500 animate-[spin_10s_linear_infinite]" />
              <span className={`text-xs font-semibold ${themeTokens.headerText}`}>
                Element Navigator
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {nodes.length}
              </span>
            </div>
            <button
              onClick={() => setShowNavigator(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer rounded transition"
              title="Close Navigator"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Input Filter */}
          <div className="relative mb-2 px-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search canvas cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-7 pr-2 py-1 rounded-lg text-xs outline-none border transition ${isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white'
                  : 'bg-zinc-900 border-zinc-700/80 text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:bg-zinc-900/90'
                }`}
            />
          </div>

          {/* Quick Step Buttons: Previous / Next */}
          <div className="flex items-center justify-between px-1 py-1 mb-1.5 text-[11px] text-slate-500">
            <span>Cycle Elements:</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={onNavigatePrev}
                className={`p-1 rounded-md border transition cursor-pointer flex items-center gap-1 ${isLight ? 'hover:bg-slate-100 border-slate-200 text-slate-700' : 'hover:bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                title="Previous element (← or ↑)"
              >
                <ChevronLeft className="w-3 h-3" />
                <span className="text-[10px] pr-0.5">Prev</span>
              </button>
              <button
                onClick={onNavigateNext}
                className={`p-1 rounded-md border transition cursor-pointer flex items-center gap-1 ${isLight ? 'hover:bg-slate-100 border-slate-200 text-slate-700' : 'hover:bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                title="Next element (→ or ↓)"
              >
                <span className="text-[10px] pl-0.5">Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Individual Elements List */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {nodes
              .filter(node =>
                searchQuery.trim() === '' ||
                node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.type.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((node) => {
                const swatch = ACCENT_SWATCHES[node.color || 'neutral'] || ACCENT_SWATCHES.neutral;
                const isSelected = selectedNodeId === node.id;

                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      onNavigateToNode(node.id);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-xl text-xs transition flex items-center space-x-2 cursor-pointer ${isSelected
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500/40'
                        : isLight
                          ? 'hover:bg-indigo-50/80 hover:text-indigo-700 text-slate-700'
                          : 'hover:bg-indigo-500/10 hover:text-indigo-300 text-zinc-300'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${swatch.badge}`} />
                    <span className="flex-shrink-0">{getNodeIcon(node.type)}</span>
                    <span className="truncate flex-1 text-[11px] font-medium">{node.title || 'Untitled'}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-50 px-1 py-0.2 rounded bg-black/5 dark:bg-white/5 font-mono">
                      {node.type}
                    </span>
                  </button>
                );
              })}
            {nodes.filter(node =>
              searchQuery.trim() === '' ||
              node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              node.type.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching elements found
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
