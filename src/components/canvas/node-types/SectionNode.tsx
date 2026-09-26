import React from 'react';
import { GripVertical, Maximize2, Layers, X, Sparkles } from 'lucide-react';
import { CanvasNode, SectionResizeHandle, hexToRgba } from '@/types/canvas';

interface SectionNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  isLight: boolean;
  isSpacePressed?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  containedCount?: number;
  isTargetedForDrop?: boolean;
  onStartDrag: (e: React.PointerEvent, node: CanvasNode) => void;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
  onDelete: (id: string) => void;
  onOpenSectionModal?: (sectionId: string) => void;
  onStartResize?: (e: React.PointerEvent, node: CanvasNode, handle: SectionResizeHandle) => void;
}

export const SectionNode: React.FC<SectionNodeProps> = ({
  node,
  isSelected,
  isLight,
  isSpacePressed = false,
  isDragging = false,
  isResizing = false,
  containedCount = 0,
  isTargetedForDrop = false,
  onStartDrag,
  onUpdate,
  onDelete,
  onOpenSectionModal,
  onStartResize
}) => {
  const showHandles = isSelected || isResizing;

  return (
    <div
      onPointerDown={(e) => onStartDrag(e, node)}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        width: `${node.width || 640}px`,
        height: `${node.height || 420}px`,
        transition: isDragging || isResizing
          ? 'none'
          : 'width 200ms cubic-bezier(0.16, 1, 0.3, 1), height 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease, box-shadow 200ms ease, transform 100ms ease-out',
        zIndex: isDragging || isResizing ? 25 : isSelected ? 15 : 1,
        ...(node.color ? {
          borderColor: node.color,
          backgroundColor: hexToRgba(node.color, 0.08)
        } : {})
      }}
      className={`absolute pointer-events-auto rounded-3xl border-2 transition-all select-none group/section ${
        isTargetedForDrop
          ? isLight
            ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.2)] scale-[1.008]'
            : 'border-indigo-400 bg-indigo-950/20 ring-4 ring-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.3)] scale-[1.008]'
          : isResizing
          ? isLight
            ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500 shadow-xl'
            : 'border-indigo-400 bg-indigo-950/30 ring-2 ring-indigo-500 shadow-2xl'
          : isSelected
          ? isLight
            ? 'border-indigo-400/90 bg-indigo-500/[0.03] ring-2 ring-indigo-500/25 shadow-md'
            : 'border-indigo-500 bg-indigo-500/[0.04] ring-2 ring-indigo-500/25 shadow-md'
          : isLight
          ? 'border-slate-300/70 bg-transparent hover:border-indigo-400/50 hover:bg-indigo-500/[0.02]'
          : 'border-zinc-800/70 bg-transparent hover:border-indigo-500/40 hover:bg-indigo-500/[0.02]'
      } ${
        isDragging
          ? 'cursor-grabbing shadow-2xl ring-2 ring-indigo-500/50'
          : isSpacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-grab active:cursor-grabbing'
      } border-dashed`}
    >
      {/* Dynamic Animated Pulse Grid when an element is hovered over it */}
      {isTargetedForDrop && (
        <div className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#3c6e71_1px,transparent_1px)] [background-size:16px_16px] opacity-30 animate-pulse" />
        </div>
      )}

      {/* Top Header Bar of Section Group */}
      <div className="p-3.5 flex items-center justify-between relative z-10 border-b border-dashed border-inherit">
        <div className="flex items-center space-x-2">
          <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover/section:opacity-100 transition-opacity" />
          
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <input
              type="text"
              value={node.title}
              onChange={(e) => onUpdate(node.id, { title: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              className={`bg-transparent outline-none text-xs font-semibold uppercase tracking-wider cursor-text ${
                isLight ? 'text-slate-700' : 'text-zinc-200'
              }`}
            />
          </div>

          {/* Contained Elements Count Badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all ${
              isTargetedForDrop
                ? 'bg-indigo-500 text-white animate-bounce shadow-sm'
                : isLight
                ? 'bg-white/80 text-slate-600 border border-slate-200 shadow-xs'
                : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800'
            }`}
          >
            {isTargetedForDrop ? (
              <span className="flex items-center space-x-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Docking...</span>
              </span>
            ) : (
              `${containedCount} ${containedCount === 1 ? 'card' : 'cards'}`
            )}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Open Sub-Canvas Modal Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSectionModal?.(node.id);
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all active:scale-95 ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 shadow-xs hover:border-indigo-300'
                : 'bg-zinc-900 hover:bg-zinc-800 text-indigo-400 border border-zinc-800 shadow-xs hover:border-indigo-500/50'
            }`}
            title="Open isolated canvas modal to edit & link cards inside this section"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="font-semibold">Open Canvas</span>
          </button>

          {/* Delete Section Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors rounded-lg cursor-pointer"
            title="Delete Section"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Empty State Hint if no cards inside */}
      {containedCount === 0 && !isTargetedForDrop && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <p
            className={`text-xs font-medium tracking-wide ${
              isLight ? 'text-slate-400' : 'text-zinc-500'
            }`}
          >
            Drag and release cards here to group them inside this section
          </p>
          <p
            className={`text-[10px] mt-1 ${
              isLight ? 'text-slate-400/80' : 'text-zinc-600'
            }`}
          >
            Section automatically expands or can be manually resized from any edge or corner
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* PROFESSIONAL FIGMA-STYLE 8-POINT MANUAL RESIZE HANDLES   */}
      {/* ======================================================== */}
      <div
        className={`transition-opacity duration-150 ${
          showHandles ? 'opacity-100' : 'opacity-0 group-hover/section:opacity-90'
        }`}
      >
        {/* 1. Corner Handles (Tactile circular dots) */}
        {/* Top-Left */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'nw')}
          className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-md hover:scale-130 active:scale-95 transition-transform cursor-nwse-resize z-30"
          title="Resize Top-Left"
        />
        {/* Top-Right */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'ne')}
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-md hover:scale-130 active:scale-95 transition-transform cursor-nesw-resize z-30"
          title="Resize Top-Right"
        />
        {/* Bottom-Left */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'sw')}
          className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-md hover:scale-130 active:scale-95 transition-transform cursor-nesw-resize z-30"
          title="Resize Bottom-Left"
        />
        {/* Bottom-Right */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'se')}
          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-md hover:scale-130 active:scale-95 transition-transform cursor-nwse-resize z-30"
          title="Resize Bottom-Right"
        />

        {/* 2. Edge Bar Handles */}
        {/* Right Edge Handle */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'e')}
          className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-sm hover:scale-115 active:scale-95 transition-transform cursor-ew-resize z-30"
          title="Resize Width"
        />
        {/* Bottom Edge Handle */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 's')}
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-2 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-sm hover:scale-115 active:scale-95 transition-transform cursor-ns-resize z-30"
          title="Resize Height"
        />
        {/* Left Edge Handle */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'w')}
          className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-7 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-sm hover:scale-115 active:scale-95 transition-transform cursor-ew-resize z-30"
          title="Resize Width"
        />
        {/* Top Edge Handle */}
        <div
          onPointerDown={(e) => onStartResize?.(e, node, 'n')}
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 h-2 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-sm hover:scale-115 active:scale-95 transition-transform cursor-ns-resize z-30"
          title="Resize Height"
        />
      </div>

      {/* Live Dimension Badge while resizing or selected */}
      {showHandles && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 pointer-events-none z-30 animate-in fade-in duration-150">
          <div
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium shadow-md border ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
            }`}
          >
            {Math.round(node.width || 640)} × {Math.round(node.height || 420)} px
          </div>
        </div>
      )}
    </div>
  );
};
