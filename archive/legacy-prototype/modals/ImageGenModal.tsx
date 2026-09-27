import React from 'react';
import { Loader2, Wand2, X } from 'lucide-react';

interface ImageGenModalProps {
  isOpen: boolean;
  prompt: string;
  aspectRatio: string;
  isGenerating: boolean;
  isLight: boolean;
  onPromptChange: (p: string) => void;
  onAspectRatioChange: (r: string) => void;
  onClose: () => void;
  onGenerate: () => void;
}

export const ImageGenModal: React.FC<ImageGenModalProps> = ({
  isOpen,
  prompt,
  aspectRatio,
  isGenerating,
  isLight,
  onPromptChange,
  onAspectRatioChange,
  onClose,
  onGenerate
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#141519] border-zinc-800 text-zinc-100'
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-xs font-semibold">Gemini Flash Image Generator</h3>
          <button
            onClick={() => !isGenerating && onClose()}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Prompt / Concept</label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Architectural studio layout with soft natural daylight..."
              rows={3}
              disabled={isGenerating}
              className={`w-full p-2.5 rounded-lg border text-xs outline-none ${
                isLight
                  ? 'bg-slate-50 border-slate-200 focus:border-indigo-500'
                  : 'bg-zinc-900 border-zinc-700 focus:border-indigo-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Aspect Ratio</label>
            <div className="flex space-x-1.5">
              {['1:1', '16:9', '4:3'].map(ratio => (
                <button
                  key={ratio}
                  onClick={() => onAspectRatioChange(ratio)}
                  className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer transition ${
                    aspectRatio === ratio
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t flex justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            <span>{isGenerating ? 'Rendering...' : 'Generate Asset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
