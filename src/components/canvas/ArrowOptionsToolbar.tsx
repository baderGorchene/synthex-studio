import React, { useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CornerDownRight,
  Minus,
  Repeat,
  Slash,
  Spline,
  Tag,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import {
  ArrowheadType,
  ConnectionColor,
  ConnectionLineStyle,
  ConnectionPath,
  ConnectionStrokePattern,
  ThemeTokens
} from '@/types/canvas';

interface ArrowOptionsToolbarProps {
  connection: ConnectionPath;
  isLight: boolean;
  themeTokens: ThemeTokens;
  onUpdate: (fields: Partial<ConnectionPath>) => void;
  onReverse?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRESET_LABELS = [
  'Relates to',
  'Depends on',
  'Leads to',
  'Causes',
  'Produces',
  'Cites',
  'Blocks'
];

const COLOR_OPTIONS: { id: ConnectionColor; label: string; hex: string; bgClass: string }[] = [
  { id: 'indigo', label: 'Indigo', hex: '#6366f1', bgClass: 'bg-indigo-500' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981', bgClass: 'bg-emerald-500' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e', bgClass: 'bg-rose-500' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b', bgClass: 'bg-amber-500' },
  { id: 'sky', label: 'Sky', hex: '#0ea5e9', bgClass: 'bg-sky-500' },
  { id: 'purple', label: 'Purple', hex: '#a855f7', bgClass: 'bg-purple-500' },
  { id: 'neutral', label: 'Slate', hex: '#64748b', bgClass: 'bg-slate-500' }
];

export const ArrowOptionsToolbar: React.FC<ArrowOptionsToolbarProps> = ({
  connection,
  isLight,
  themeTokens,
  onUpdate,
  onReverse,
  onDelete,
  onClose
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeColor = connection.color || 'indigo';
  const activeArrowhead = connection.arrowhead || 'end';
  const activeLineStyle = connection.lineStyle || 'curved';
  const activeStrokePattern = connection.strokePattern || 'dashed';
  const isAnimated = connection.animated !== false;

  useEffect(() => {
    // Auto-focus the text input if opened
    inputRef.current?.focus();
  }, []);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`w-80 rounded-2xl border p-3 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-150 select-none ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-800'
          : 'bg-[#15161c]/95 border-zinc-800 text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.6)]'
      }`}
    >
      {/* 1. Header with Title & Quick Action Buttons */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800/80 mb-2.5">
        <div className="flex items-center space-x-1.5">
          <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <ArrowRight className="w-3 h-3 stroke-[2.5]" />
          </div>
          <span className={`text-xs font-bold ${themeTokens.headerText}`}>
            Arrow Options
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Reverse connection direction */}
          {onReverse && (
            <button
              onClick={onReverse}
              className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-zinc-800 text-zinc-300'
              }`}
              title="Reverse Arrow Direction"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Toggle dash animation flow */}
          <button
            onClick={() => onUpdate({ animated: !isAnimated })}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              isAnimated
                ? 'bg-indigo-500/15 text-indigo-500 font-medium'
                : isLight
                ? 'hover:bg-slate-100 text-slate-400'
                : 'hover:bg-zinc-800 text-zinc-500'
            }`}
            title={isAnimated ? 'Flow animation active (click to stop)' : 'Click to enable flow animation'}
          >
            <Zap className={`w-3.5 h-3.5 ${isAnimated ? 'fill-current' : ''}`} />
          </button>

          {/* Delete connection */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
            title="Delete Connection"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Close toolbar */}
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
            title="Done (Esc)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Text / Label Input with Quick Preset Chips */}
      <div className="space-y-1.5 mb-3">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Tag className="w-2.5 h-2.5" /> Text / Label
        </label>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={connection.label || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Type custom arrow label..."
            className={`w-full px-2.5 py-1.5 text-xs rounded-xl border outline-none transition pr-7 ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500'
                : 'bg-zinc-900 border-zinc-700/80 text-zinc-100 focus:border-indigo-500'
            }`}
          />
          {connection.label && (
            <button
              onClick={() => onUpdate({ label: '' })}
              className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer rounded"
              title="Clear label"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {PRESET_LABELS.map((preset) => {
            const isCurrent = connection.label === preset;
            return (
              <button
                key={preset}
                onClick={() => onUpdate({ label: isCurrent ? '' : preset })}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer border ${
                  isCurrent
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : isLight
                    ? 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 border-slate-200'
                    : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Arrowhead Direction & Line Style Row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Arrowhead Direction */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Arrowhead
          </span>
          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            {(
              [
                { id: 'end', icon: ArrowRight, tip: 'Directed (→)' },
                { id: 'both', icon: ArrowLeftRight, tip: 'Bi-directional (↔)' },
                { id: 'start', icon: ArrowLeft, tip: 'Reverse (←)' },
                { id: 'none', icon: Minus, tip: 'Plain Line (—)' }
              ] as { id: ArrowheadType; icon: React.FC<{ className?: string }>; tip: string }[]
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = activeArrowhead === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onUpdate({ arrowhead: item.id })}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-500 hover:text-slate-800'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={item.tip}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Line Geometry Style */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Line Style
          </span>
          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            {(
              [
                { id: 'curved', icon: Spline, tip: 'Curved (Bezier)' },
                { id: 'straight', icon: Slash, tip: 'Straight Line' },
                { id: 'stepped', icon: CornerDownRight, tip: 'Orthogonal Elbow' }
              ] as { id: ConnectionLineStyle; icon: React.FC<{ className?: string }>; tip: string }[]
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = activeLineStyle === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onUpdate({ lineStyle: item.id })}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-500 hover:text-slate-800'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={item.tip}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Stroke Pattern & Color Swatches */}
      <div className="space-y-2">
        {/* Stroke Pattern: Solid, Dashed, Dotted */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Pattern
          </span>
          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            {(
              [
                { id: 'solid', label: 'Solid', sample: '———' },
                { id: 'dashed', label: 'Dashed', sample: '- - -' },
                { id: 'dotted', label: 'Dotted', sample: '····' }
              ] as { id: ConnectionStrokePattern; label: string; sample: string }[]
            ).map((item) => {
              const isSelected = activeStrokePattern === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onUpdate({ strokePattern: item.id })}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-lg transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                  title={`${item.label} Stroke`}
                >
                  {item.sample}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Palette */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Color
          </span>
          <div className="flex items-center space-x-1.5">
            {COLOR_OPTIONS.map((col) => {
              const isSelected = activeColor === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => onUpdate({ color: col.id })}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                    col.bgClass
                  } ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  title={col.label}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
