import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, PenLine, Eye } from 'lucide-react';
import { AccentColor, AiActionType, CanvasNode, CanvasTool, SectionResizeHandle, ThemeTokens } from '@/types/canvas';
import { ACCENT_SWATCHES } from '@/constants/themes';
import { SectionNode } from './node-types/SectionNode';
import { NoteNode } from './node-types/NoteNode';
import { TaskNode } from './node-types/TaskNode';
import { ImageNode } from './node-types/ImageNode';
import { LinkNode } from './node-types/LinkNode';
import { SelectionFloatingIsland } from './SelectionFloatingIsland';

interface CanvasCardProps {
  node: CanvasNode;
  isSelected: boolean;
  isConnectingSource: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  activeTool?: CanvasTool;
  themeTokens: ThemeTokens;
  isLight: boolean;
  isSpacePressed?: boolean;
  onSelect: (id: string | null) => void;
  onStartDrag: (e: React.PointerEvent, node: CanvasNode) => void;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: CanvasNode) => void;
  onStartConnect: (id: string) => void;
  onAiAction: (node: CanvasNode, actionType: AiActionType) => void;
  onTtsPlay: (node: CanvasNode) => void;
  isAiLoading: boolean;
  isTtsLoading: boolean;
  onOpenImageGen: (id: string, caption?: string) => void;
  onOpenSectionModal?: (sectionId: string) => void;
  containedCount?: number;
  isTargetedForDrop?: boolean;
  onStartResize?: (e: React.PointerEvent, node: CanvasNode, handle: SectionResizeHandle) => void;
}

export const CanvasCard: React.FC<CanvasCardProps> = ({
  node,
  isSelected,
  isConnectingSource,
  isDragging = false,
  isResizing = false,
  activeTool = 'select',
  themeTokens,
  isLight,
  isSpacePressed = false,
  onStartDrag,
  onUpdate,
  onDelete,
  onDuplicate,
  onStartConnect,
  onAiAction,
  onTtsPlay,
  isAiLoading,
  isTtsLoading,
  onOpenImageGen,
  onOpenSectionModal,
  containedCount = 0,
  isTargetedForDrop = false,
  onStartResize
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);

  // Click-away: exit note edit mode when clicking outside this card or pressing Escape
  useEffect(() => {
    if (!isEditingNote) return;
    const handleOutside = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsEditingNote(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditingNote(false);
    };
    window.addEventListener('pointerdown', handleOutside, true);
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('pointerdown', handleOutside, true);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [isEditingNote]);

  // Auto-measure rendered DOM height so connectors dock with zero gap to card borders
  useEffect(() => {
    if (!cardRef.current || node.type === 'section') return;

    const measureAndSync = () => {
      if (!cardRef.current) return;
      const measuredH = cardRef.current.offsetHeight;
      if (measuredH > 0 && Math.abs((node.height || 0) - measuredH) >= 1) {
        onUpdate(node.id, { height: measuredH });
      }
    };

    measureAndSync();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        measureAndSync();
      });
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }
  }, [node.id, node.height, node.type, onUpdate]);

  const swatch = ACCENT_SWATCHES[node.color || 'neutral'] || ACCENT_SWATCHES.neutral;
  const headerClass = isLight ? swatch.lightHeader : swatch.darkHeader;

  // Render section container grouping box
  if (node.type === 'section') {
    return (
      <SectionNode
        node={node}
        isSelected={isSelected}
        isLight={isLight}
        isSpacePressed={isSpacePressed}
        isDragging={isDragging}
        isResizing={isResizing}
        containedCount={containedCount}
        isTargetedForDrop={isTargetedForDrop}
        onStartDrag={onStartDrag}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onOpenSectionModal={onOpenSectionModal}
        onStartResize={onStartResize}
      />
    );
  }

  const isConnectMode = activeTool === 'connect';

  return (
    <div
      ref={cardRef}
      data-node-id={node.id}
      onPointerDown={(e) => {
        if (isConnectMode) {
          e.stopPropagation();
          onStartConnect(node.id);
          return;
        }
        onStartDrag(e, node);
      }}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        width: `${node.width || 300}px`,
        transition: isDragging ? 'none' : 'box-shadow 150ms ease, border-color 150ms ease, transform 100ms ease-out',
        zIndex: isDragging ? 50 : isConnectingSource ? 45 : isSelected ? 30 : 10
      }}
      className={`absolute pointer-events-auto rounded-xl border select-none group/node ${
        themeTokens.cardBase
      } ${themeTokens.cardBorder} ${
        isConnectingSource
          ? 'ring-2 ring-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.5)] border-indigo-500'
          : isSelected
          ? themeTokens.cardSelected
          : themeTokens.cardBorderHover
      } ${
        isConnectMode
          ? 'cursor-crosshair hover:ring-2 hover:ring-indigo-400 hover:shadow-xl'
          : isDragging
          ? 'shadow-2xl ring-2 ring-indigo-500 cursor-grabbing scale-[1.02]'
          : isSpacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Interactive Anchor Points when in Edge Linker mode */}
      {isConnectMode && (
        <>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse pointer-events-none z-50" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse pointer-events-none z-50" />
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse pointer-events-none z-50" />
          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse pointer-events-none z-50" />
        </>
      )}

      {/* Floating Action Island for selected card */}
      {isSelected && !isConnectMode && (
        <SelectionFloatingIsland
          node={node}
          themeTokens={themeTokens}
          isLight={isLight}
          onColorChange={(id, color: AccentColor) => onUpdate(id, { color })}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onAiAction={onAiAction}
          onTtsPlay={onTtsPlay}
          isAiLoading={isAiLoading}
          isTtsLoading={isTtsLoading}
        />
      )}

      {/* Card Header Bar (Photoshop-like draggable handle) */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-t-xl cursor-grab active:cursor-grabbing ${headerClass}`}
      >
        <div className="flex items-center space-x-1.5 overflow-hidden flex-1">
          <GripVertical className="w-3 h-3 text-slate-400 opacity-50 group-hover/node:opacity-100 flex-shrink-0" />
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${swatch.badge}`} />
          <input
            type="text"
            value={node.title}
            onChange={(e) => onUpdate(node.id, { title: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            className={`bg-transparent border-none outline-none text-xs font-medium w-full truncate cursor-text ${themeTokens.headerText}`}
          />
        </div>

        {/* Edit / View toggle — only on Note cards, lives in the header */}
        {node.type === 'note' && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setIsEditingNote(v => !v); }}
            title={isEditingNote ? 'Preview (click away also exits)' : 'Edit note with formatting bar'}
            className={`ml-2 flex-shrink-0 flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-all cursor-pointer ${
              isEditingNote
                ? isLight
                  ? 'bg-cyan-100 text-cyan-800 border-cyan-300 shadow-2xs font-semibold'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-2xs font-semibold'
                : isLight
                ? 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border-slate-200/80 shadow-2xs'
                : 'bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white border-zinc-700/50 shadow-2xs'
            }`}
          >
            {isEditingNote ? (
              <><Eye className="w-3 h-3" /><span>View</span></>
            ) : (
              <><PenLine className="w-3 h-3" /><span>Edit</span></>
            )}
          </button>
        )}
      </div>

      {/* Card Body by Content Type */}
      <div className="p-3.5 space-y-2">
        {node.type === 'note' && (
          <NoteNode
            node={node}
            themeTokens={themeTokens}
            isLight={isLight}
            isEditing={isEditingNote}
            onUpdate={onUpdate}
          />
        )}

        {node.type === 'task' && (
          <TaskNode node={node} themeTokens={themeTokens} isLight={isLight} onUpdate={onUpdate} />
        )}

        {node.type === 'image' && (
          <ImageNode
            node={node}
            themeTokens={themeTokens}
            isLight={isLight}
            onUpdate={onUpdate}
            onOpenImageGen={onOpenImageGen}
          />
        )}

        {node.type === 'link' && (
          <LinkNode node={node} themeTokens={themeTokens} isLight={isLight} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
};
