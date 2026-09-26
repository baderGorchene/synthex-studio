import React from 'react';
import { ChevronRight, Globe, Loader2, Sparkles, X } from 'lucide-react';
import { SUGGESTED_RESEARCH_BLUEPRINTS } from '@/constants/assets';

interface SpotlightModalProps {
  isOpen: boolean;
  query: string;
  isResearching: boolean;
  useSearchGrounding: boolean;
  isLight: boolean;
  onQueryChange: (q: string) => void;
  onToggleSearchGrounding: () => void;
  onClose: () => void;
  onRunResearch: (topic: string) => void;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  isOpen,
  query,
  isResearching,
  useSearchGrounding,
  isLight,
  onQueryChange,
  onToggleSearchGrounding,
  onClose,
  onRunResearch
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#141519] border-zinc-800 text-zinc-100'
        }`}
      >
        <div
          className={`p-4 border-b flex items-center space-x-2.5 ${
            isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-zinc-900/40 border-zinc-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim() && !isResearching) {
                onRunResearch(query);
              }
            }}
            placeholder="Topic to research (e.g. Agentic Workflow Architecture)..."
            disabled={isResearching}
            autoFocus
            className="w-full bg-transparent border-none outline-none text-sm placeholder:text-slate-400"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className={`w-3.5 h-3.5 ${useSearchGrounding ? 'text-sky-500' : 'text-slate-400'}`} />
              <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Google Search Grounding</span>
            </div>
            <button
              type="button"
              onClick={onToggleSearchGrounding}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition duration-200 cursor-pointer ${
                useSearchGrounding ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {!isResearching && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                Suggested Blueprints
              </span>
              {SUGGESTED_RESEARCH_BLUEPRINTS.map(item => (
                <button
                  key={item}
                  onClick={() => {
                    onQueryChange(item);
                    onRunResearch(item);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                    isLight ? 'hover:bg-indigo-50/80 hover:text-indigo-700 text-slate-700' : 'hover:bg-indigo-500/15 hover:text-indigo-300 text-zinc-300'
                  }`}
                >
                  <span>{item}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {isResearching && (
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center space-x-3">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-xs text-indigo-950 dark:text-indigo-200 font-medium">
                Synthesizing spatial knowledge cluster with Gemini...
              </span>
            </div>
          )}
        </div>

        <div
          className={`p-3 border-t flex justify-end space-x-2 ${
            isLight ? 'bg-slate-50/50 border-slate-100' : 'bg-zinc-900/30 border-zinc-800'
          }`}
        >
          <button
            onClick={onClose}
            disabled={isResearching}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onRunResearch(query)}
            disabled={isResearching || !query.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Run Research</span>
          </button>
        </div>
      </div>
    </div>
  );
};
