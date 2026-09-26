import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Copy,
  ListPlus,
  Loader2,
  Sparkles,
  Trash2,
  Volume2,
  Wand2
} from 'lucide-react';
import { AccentColor, AiActionType, CanvasNode, ThemeTokens } from '@/types/canvas';
import { ACCENT_SWATCHES } from '@/constants/themes';

interface SelectionFloatingIslandProps {
  node: CanvasNode;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onColorChange: (id: string, color: AccentColor) => void;
  onDuplicate: (node: CanvasNode) => void;
  onDelete: (id: string) => void;
  onStartConnect?: (id: string) => void;
  onAiAction: (node: CanvasNode, actionType: AiActionType) => void;
  onTtsPlay: (node: CanvasNode) => void;
  isAiLoading: boolean;
  isTtsLoading: boolean;
}

export const SelectionFloatingIsland: React.FC<SelectionFloatingIslandProps> = ({
  node,
  themeTokens,
  isLight,
  onColorChange,
  onDuplicate,
  onDelete,
  onAiAction,
  onTtsPlay,
  isAiLoading,
  isTtsLoading
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAiDropdown, setShowAiDropdown] = useState(false);
  const islandRef = useRef<HTMLDivElement>(null);

  // Click-away: close any open dropdowns when clicking outside the island
  useEffect(() => {
    if (!showColorPicker && !showAiDropdown) return;
    const handleOutside = (e: PointerEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
        setShowAiDropdown(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside, true);
    return () => window.removeEventListener('pointerdown', handleOutside, true);
  }, [showColorPicker, showAiDropdown]);

  return (
    <div
      ref={islandRef}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-1 px-2 py-1.5 rounded-full border shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 select-none"
      style={{
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(24, 24, 27, 0.95)',
        borderColor: isLight ? '#e2e8f0' : '#27272a'
      }}
    >
      {/* Color Swatch Menu Toggle */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowAiDropdown(false);
          }}
          className={`p-1.5 rounded-full transition cursor-pointer ${themeTokens.toolHover}`}
          title="Change accent tone"
        >
          <span
            className={`block w-3.5 h-3.5 rounded-full ${
              ACCENT_SWATCHES[node.color || 'neutral']?.badge || 'bg-slate-500'
            }`}
          />
        </button>

        {showColorPicker && (
          <div
            className={`absolute bottom-9 left-1/2 -translate-x-1/2 p-1.5 rounded-xl border flex items-center space-x-1.5 shadow-2xl backdrop-blur-md z-50 ${
              isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-700'
            }`}
          >
            {(Object.keys(ACCENT_SWATCHES) as AccentColor[]).map((key) => {
              const item = ACCENT_SWATCHES[key];
              return (
                <button
                  key={key}
                  onClick={() => {
                    onColorChange(node.id, key);
                    setShowColorPicker(false);
                  }}
                  className={`w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer ${item.badge} ${
                    (node.color || 'neutral') === key ? 'ring-2 ring-offset-1 ring-indigo-500' : ''
                  }`}
                  title={item.name}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className={`w-px h-3.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

      {/* AI Assistant dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowAiDropdown(!showAiDropdown);
            setShowColorPicker(false);
          }}
          disabled={isAiLoading}
          className={`p-1.5 rounded-full transition cursor-pointer ${
            showAiDropdown ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50' : themeTokens.toolHover
          }`}
          title="Gemini AI Studio Actions"
        >
          {isAiLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          ) : (
            <Wand2 className="w-3.5 h-3.5" />
          )}
        </button>

        {showAiDropdown && (
          <div
            className={`absolute bottom-9 left-1/2 -translate-x-1/2 w-48 rounded-xl border p-1 shadow-2xl backdrop-blur-xl z-50 space-y-0.5 ${
              isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
            }`}
          >
            <button
              onClick={() => {
                onAiAction(node, 'summarize');
                setShowAiDropdown(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 flex items-center space-x-2 transition cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Summarize card</span>
            </button>
            <button
              onClick={() => {
                onAiAction(node, 'expand');
                setShowAiDropdown(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 flex items-center space-x-2 transition cursor-pointer"
            >
              <ListPlus className="w-3 h-3 text-emerald-500" />
              <span>Deepen analysis</span>
            </button>
            <button
              onClick={() => {
                onAiAction(node, 'generate-tasks');
                setShowAiDropdown(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 flex items-center space-x-2 transition cursor-pointer"
            >
              <CheckSquare className="w-3 h-3 text-amber-500" />
              <span>Extract action tasks</span>
            </button>
            <button
              onClick={() => {
                onAiAction(node, 'critique');
                setShowAiDropdown(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 flex items-center space-x-2 transition cursor-pointer"
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Architectural critique</span>
            </button>
          </div>
        )}
      </div>

      {/* Spoken TTS briefing */}
      <button
        onClick={() => onTtsPlay(node)}
        disabled={isTtsLoading}
        className={`p-1.5 rounded-full transition cursor-pointer ${themeTokens.toolHover}`}
        title="Spoken audio briefing"
      >
        <Volume2 className="w-3.5 h-3.5 text-sky-500" />
      </button>

      <div className={`w-px h-3.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

      {/* Duplicate */}
      <button
        onClick={() => onDuplicate(node)}
        className={`p-1.5 rounded-full transition cursor-pointer ${themeTokens.toolHover}`}
        title="Duplicate card"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(node.id)}
        className="p-1.5 rounded-full transition cursor-pointer text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
