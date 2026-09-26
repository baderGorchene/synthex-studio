import React, { useState } from 'react';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { Connection, ConnectionPath, ThemeTokens } from '@/types/canvas';
import { ArrowOptionsToolbar } from './ArrowOptionsToolbar';

interface ConnectorLayerProps {
  connectionPaths: ConnectionPath[];
  selectedConnectionId?: string | null;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onSelectConnection?: (id: string | null) => void;
  onUpdateConnection?: (id: string, fields: Partial<Connection>) => void;
  onReverseConnection?: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  rubberBandPath?: string | null;
}

const ARROW_COLORS = [
  { id: 'indigo', hex: '#6366f1' },
  { id: 'emerald', hex: '#10b981' },
  { id: 'rose', hex: '#f43f5e' },
  { id: 'amber', hex: '#f59e0b' },
  { id: 'sky', hex: '#0ea5e9' },
  { id: 'purple', hex: '#a855f7' },
  { id: 'neutral', hex: '#64748b' }
];

export const ConnectorLayer: React.FC<ConnectorLayerProps> = ({
  connectionPaths,
  selectedConnectionId = null,
  themeTokens,
  isLight,
  onSelectConnection,
  onUpdateConnection,
  onReverseConnection,
  onDeleteConnection,
  rubberBandPath = null
}) => {
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-20">
      <defs>
        <style>{`
          @keyframes connectorFlow {
            from {
              stroke-dashoffset: 26;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
          .connector-flow {
            animation: connectorFlow 1.6s linear infinite;
          }
        `}</style>

        {/* Dynamic Arrowhead Markers for every palette color (End and Start) */}
        {ARROW_COLORS.map((col) => (
          <React.Fragment key={col.id}>
            {/* End marker (pointing forward) */}
            <marker
              id={`arrow-end-${col.id}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={col.hex} />
            </marker>

            {/* Start marker (pointing reverse toward source) */}
            <marker
              id={`arrow-start-${col.id}`}
              viewBox="0 0 10 10"
              refX="0"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill={col.hex} />
            </marker>
          </React.Fragment>
        ))}

        {/* Default / Fallback markers */}
        <marker
          id="studio-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={themeTokens.connectorStroke} />
        </marker>

        <marker
          id="studio-arrow-rubber"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
        </marker>
      </defs>

      {/* Existing connections with multiple options, custom labels, and floating toolbar */}
      {connectionPaths.map((conn) => {
        const isSelected = selectedConnectionId === conn.id;
        const colorEntry = ARROW_COLORS.find((c) => c.id === conn.color);
        const strokeColor = colorEntry ? colorEntry.hex : themeTokens.connectorStroke;

        // Compute stroke-dasharray
        let dashArray = '7 6';
        if (conn.strokePattern === 'solid') {
          dashArray = 'none';
        } else if (conn.strokePattern === 'dotted') {
          dashArray = '3 5';
        }

        // Compute marker attributes
        const markerEnd =
          conn.arrowhead === 'none' || conn.arrowhead === 'start'
            ? undefined
            : `url(#arrow-end-${conn.color || 'indigo'})`;

        const markerStart =
          conn.arrowhead === 'both' || conn.arrowhead === 'start'
            ? `url(#arrow-start-${conn.color || 'indigo'})`
            : undefined;

        const isAnimated = conn.animated !== false && conn.strokePattern !== 'solid';

        return (
          <g key={conn.id} className="pointer-events-auto group">
            {/* Thick invisible hit area for easy clicking & selection */}
            <path
              d={conn.path}
              fill="none"
              stroke="transparent"
              strokeWidth="32"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectConnection?.(conn.id);
              }}
            />

            {/* Glowing neon aura when selected */}
            {isSelected && (
              <path
                d={conn.path}
                fill="none"
                stroke={strokeColor}
                strokeWidth="7"
                strokeOpacity="0.35"
                className="pointer-events-none animate-pulse"
              />
            )}

            {/* Visible vector connector */}
            <path
              d={conn.path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 2}
              strokeDasharray={dashArray}
              markerEnd={markerEnd}
              markerStart={markerStart}
              className={`transition-all cursor-pointer ${
                isAnimated ? 'connector-flow' : ''
              } ${isSelected ? 'brightness-110 drop-shadow-md' : 'group-hover:stroke-indigo-400'}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectConnection?.(conn.id);
              }}
            />

            {/* Midpoint Interactive Controls: [ ⚙ Gear | Label / Input | ✕ Delete ] */}
            {!isSelected && (
              <foreignObject
                x={conn.mid.x - 140}
                y={conn.mid.y - 18}
                width="280"
                height="36"
                className="overflow-visible pointer-events-auto"
              >
                <div className="flex items-center justify-center w-full h-full">
                  {editingLabelId === conn.id ? (
                    /* Inline Label Editing Input Mode */
                    <div
                      className={`inline-flex items-center rounded-full border shadow-lg transition-all duration-150 backdrop-blur-md ring-2 ring-indigo-500/40 ${
                        isLight
                          ? 'bg-white border-indigo-400 text-slate-800 shadow-indigo-100/50'
                          : 'bg-zinc-900 border-indigo-500 text-zinc-100 shadow-black/60'
                      }`}
                    >
                      {/* 1. Gear Icon (Left): Show actual menu */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLabelId(null);
                          onSelectConnection?.(conn.id);
                        }}
                        className={`p-1.5 pl-2.5 transition-colors cursor-pointer flex items-center justify-center rounded-l-full ${
                          isLight
                            ? 'text-slate-400 hover:text-indigo-600'
                            : 'text-zinc-500 hover:text-indigo-400'
                        }`}
                        title="Arrow Options Menu"
                      >
                        <Settings className="w-3 h-3 hover:rotate-45 transition-transform duration-200" />
                      </button>

                      {/* Hairline Divider */}
                      <span
                        className={`w-px h-3.5 ${
                          isLight ? 'bg-slate-200' : 'bg-zinc-700'
                        }`}
                      />

                      {/* 2. Text Input (Center): Change label directly */}
                      <div className="flex items-center px-2 py-0.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1.5"
                          style={{ backgroundColor: strokeColor }}
                        />
                        <input
                          autoFocus
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              onUpdateConnection?.(conn.id, { label: editingText.trim() });
                              setEditingLabelId(null);
                            } else if (e.key === 'Escape') {
                              setEditingLabelId(null);
                            }
                          }}
                          onBlur={() => {
                            onUpdateConnection?.(conn.id, { label: editingText.trim() });
                            setEditingLabelId(null);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          placeholder="Type label..."
                          className={`w-28 text-[10px] font-medium bg-transparent border-none outline-none font-sans ${
                            isLight ? 'text-slate-800' : 'text-zinc-100'
                          } placeholder:text-slate-400`}
                        />
                      </div>

                      {/* Hairline Divider */}
                      <span
                        className={`w-px h-3.5 ${
                          isLight ? 'bg-slate-200' : 'bg-zinc-700'
                        }`}
                      />

                      {/* 3. Delete Trash Button (Right) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLabelId(null);
                          onDeleteConnection(conn.id);
                        }}
                        className={`p-1.5 pr-2.5 transition-colors cursor-pointer flex items-center justify-center rounded-r-full ${
                          isLight
                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40'
                        }`}
                        title="Delete connection"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : conn.label ? (
                    /* Resting Labeled Badge: [ ⚙ Gear (hover) | Label Text | 🗑 Trash (hover) ] */
                    <div
                      className={`inline-flex items-center rounded-full border shadow-sm transition-all duration-200 backdrop-blur-md ${
                        isLight
                          ? 'bg-white/95 border-slate-300/80 text-slate-700 shadow-slate-200/50 hover:border-slate-400'
                          : 'bg-zinc-900/95 border-zinc-700/80 text-zinc-200 shadow-black/40 hover:border-zinc-600'
                      }`}
                    >
                      {/* 1. Gear Icon: Only shown when hovering the arrow/pill */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectConnection?.(conn.id);
                        }}
                        className={`overflow-hidden transition-all duration-200 max-w-0 opacity-0 group-hover:max-w-[32px] group-hover:opacity-100 group-hover:pl-2.5 group-hover:pr-1.5 py-1 cursor-pointer flex items-center justify-center rounded-l-full ${
                          isLight
                            ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                            : 'text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/15'
                        }`}
                        title="Arrow Options Menu (Line style, colors, arrows)"
                      >
                        <Settings className="w-3 h-3 hover:rotate-45 transition-transform duration-200 flex-shrink-0" />
                      </button>

                      {/* Hairline Divider (Left): Only shown when hovering */}
                      <span
                        className={`overflow-hidden transition-all duration-200 w-0 group-hover:w-px h-3 flex-shrink-0 ${
                          isLight ? 'bg-slate-200' : 'bg-zinc-700'
                        }`}
                      />

                      {/* 2. Label Text: Click only gives text input to change label */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLabelId(conn.id);
                          setEditingText(conn.label || '');
                        }}
                        className={`flex items-center space-x-1.5 px-2.5 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
                          isLight
                            ? 'hover:text-indigo-600'
                            : 'hover:text-indigo-400'
                        }`}
                        title="Click to edit label text"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: strokeColor }}
                        />
                        <span className="truncate max-w-[120px] select-none font-sans">
                          {conn.label}
                        </span>
                      </button>

                      {/* Hairline Divider (Right): Only shown when hovering */}
                      <span
                        className={`overflow-hidden transition-all duration-200 w-0 group-hover:w-px h-3 flex-shrink-0 ${
                          isLight ? 'bg-slate-200' : 'bg-zinc-700'
                        }`}
                      />

                      {/* 3. Delete Trash Button: Only shown when hovering */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConnection(conn.id);
                        }}
                        className={`overflow-hidden transition-all duration-200 max-w-0 opacity-0 group-hover:max-w-[32px] group-hover:opacity-100 group-hover:pr-2.5 group-hover:pl-1.5 py-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-r-full cursor-pointer flex items-center justify-center flex-shrink-0`}
                        title="Delete connection"
                      >
                        <Trash2 className="w-3 h-3 flex-shrink-0" />
                      </button>
                    </div>
                  ) : (
                    /* Unlabeled Connection: Hover Pill [ ⚙ Gear | + Label | 🗑 Trash ] */
                    <div
                      className={`inline-flex items-center rounded-full border shadow-xs transition-all duration-150 backdrop-blur-md opacity-0 group-hover:opacity-100 ${
                        isLight
                          ? 'bg-white/95 border-slate-300 text-slate-600 shadow-slate-200/50 hover:border-slate-400'
                          : 'bg-zinc-900/95 border-zinc-700 text-zinc-300 shadow-black/40 hover:border-zinc-600'
                      }`}
                    >
                      {/* 1. Gear Icon: Click to open full options menu */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectConnection?.(conn.id);
                        }}
                        className={`p-1.5 pl-2 transition-colors cursor-pointer flex items-center justify-center rounded-l-full ${
                          isLight
                            ? 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100/80'
                            : 'text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800/80'
                        }`}
                        title="Arrow Options Menu (Line style, colors, arrows)"
                      >
                        <Settings className="w-3 h-3 hover:rotate-45 transition-transform duration-200" />
                      </button>

                      {/* Hairline Divider */}
                      <span
                        className={`w-px h-2.5 ${
                          isLight ? 'bg-slate-200' : 'bg-zinc-700'
                        }`}
                      />

                      {/* 2. + Label Button: Click directly opens inline text input */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLabelId(conn.id);
                          setEditingText('');
                        }}
                        className={`flex items-center space-x-1 px-2 py-0.5 text-[9px] font-medium cursor-pointer transition-colors ${
                          isLight
                            ? 'hover:text-indigo-600 hover:bg-indigo-50/50'
                            : 'hover:text-indigo-400 hover:bg-indigo-950/20'
                        }`}
                        title="Click to add label text"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Label</span>
                      </button>

                      {/* Hairline Divider */}
                      <span
                        className={`w-px h-2.5 ${
                          isLight ? 'bg-slate-200' : 'bg-zinc-700'
                        }`}
                      />

                      {/* 3. Delete Trash Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConnection(conn.id);
                        }}
                        className={`p-1.5 pr-2 text-slate-400 transition-colors cursor-pointer flex items-center justify-center rounded-r-full ${
                          isLight
                            ? 'hover:text-rose-600 hover:bg-rose-50'
                            : 'hover:text-rose-400 hover:bg-rose-950/40'
                        }`}
                        title="Delete connection"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </foreignObject>
            )}

            {/* Selected Connection Floating Quick Options Studio */}
            {isSelected && (
              <foreignObject
                x={conn.mid.x - 160}
                y={conn.mid.y - 185}
                width="320"
                height="350"
                className="overflow-visible pointer-events-auto z-50"
              >
                <ArrowOptionsToolbar
                  connection={conn}
                  isLight={isLight}
                  themeTokens={themeTokens}
                  onUpdate={(fields) => onUpdateConnection?.(conn.id, fields)}
                  onReverse={() => onReverseConnection?.(conn.id)}
                  onDelete={() => onDeleteConnection(conn.id)}
                  onClose={() => onSelectConnection?.(null)}
                />
              </foreignObject>
            )}
          </g>
        );
      })}

      {/* Live interactive rubber band path following cursor */}
      {rubberBandPath && (
        <g className="pointer-events-none">
          <path
            d={rubberBandPath}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            markerEnd="url(#studio-arrow-rubber)"
            className="animate-pulse"
          />
        </g>
      )}
    </svg>
  );
};
