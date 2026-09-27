import React, { useState } from 'react';
import { Key, ShieldCheck, X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  currentKey: string;
  isLight: boolean;
  onClose: () => void;
  onSaveKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  currentKey,
  isLight,
  onClose,
  onSaveKey
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(currentKey);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKey(apiKeyInput.trim());
    onClose();
  };

  const handleClear = () => {
    setApiKeyInput('');
    onSaveKey('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#141519] border-zinc-800 text-zinc-100'
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-semibold">Gemini API Key Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Provide a Google Gemini API Key to enable live multi-modal research synthesis, image generation, and audio briefings. If omitted, Synthex Studio runs seamlessly using high-craft offline blueprints.
          </p>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className={`w-full p-2.5 rounded-lg border text-xs outline-none font-mono ${
                isLight
                  ? 'bg-slate-50 border-slate-200 focus:border-indigo-500'
                  : 'bg-zinc-900 border-zinc-700 focus:border-indigo-500'
              }`}
            />
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Stored strictly in your local browser storage</span>
          </div>
        </div>

        <div className="p-3 border-t flex justify-between items-center">
          {currentKey ? (
            <button
              onClick={handleClear}
              className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
            >
              Clear Key
            </button>
          ) : (
            <span />
          )}

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
