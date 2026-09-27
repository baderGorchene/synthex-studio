import React from 'react';
import { Download, Key, Moon, Search, Sun, Upload } from 'lucide-react';
import { LedgerState, ThemeMode, ThemeTokens } from '@/types/canvas';

interface StudioHeaderProps {
  theme: ThemeMode;
  themeTokens: ThemeTokens;
  ledger: LedgerState;
  isSpacePressed?: boolean;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onOpenSpotlight: () => void;
  onToggleTheme: () => void;
  onExportBoard: () => void;
  onImportBoard: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenApiKeyModal: () => void;
  hasCustomKey: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  theme,
  themeTokens,
  ledger,
  isSpacePressed = false,
  onHeaderPointerDown,
  onOpenSpotlight,
  onToggleTheme,
  onExportBoard,
  onImportBoard,
  onOpenApiKeyModal,
  hasCustomKey
}) => {
  const isLight = theme === 'light';
  const remainingBudget = Math.max(0, ledger.monthlyBudgetUsd - ledger.spentUsd).toFixed(2);

  return (
    <header
      onPointerDown={onHeaderPointerDown}
      className={`h-12 border-b px-4 flex items-center justify-between z-30 flex-shrink-0 select-none transition-colors ${
        isLight ? 'bg-white/80 border-slate-200/80' : 'bg-[#0e0f13]/80 border-zinc-800/80'
      } backdrop-blur-xl ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center space-x-3 pointer-events-auto">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-bold text-xs shadow-xs">
            S
          </div>
          <span className={`text-xs font-semibold tracking-tight ${themeTokens.headerText}`}>
            Synthex Studio
          </span>
        </div>

        <span className="text-slate-300 dark:text-zinc-700 text-xs">/</span>
        <span className={`text-xs ${themeTokens.subText} hidden sm:inline`}>
          Autonomous Research Canvas
        </span>
      </div>

      {/* Global Action Tools */}
      <div className="flex items-center space-x-2 pointer-events-auto">
        {/* Spotlight Search Trigger */}
        <button
          onClick={onOpenSpotlight}
          className={`flex items-center space-x-2 px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
          }`}
          title="Open AI Research Spotlight (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Research Spotlight</span>
          <kbd className="px-1 py-0.2 rounded text-[10px] font-mono bg-slate-200/60 dark:bg-zinc-800">⌘K</kbd>
        </button>

        {/* Unit-Economics Ledger Pill */}
        <div
          className={`flex items-center space-x-2 px-2.5 py-1 rounded-lg border text-xs font-mono select-none ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}
          title="Autonomous Synthesis Unit-Economics"
        >
          <span className="text-[11px]">Ledger:</span>
          <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-zinc-200'}`}>
            ${remainingBudget}
          </span>
        </div>

        {/* Gemini API Key Config */}
        <button
          onClick={onOpenApiKeyModal}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            hasCustomKey
              ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300'
              : isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
          title={hasCustomKey ? 'Gemini API Key Configured' : 'Configure Gemini API Key'}
        >
          <Key className="w-3.5 h-3.5" />
        </button>

        <div className={`w-px h-4 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

        {/* Theme switcher */}
        <button
          onClick={onToggleTheme}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
          title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
        >
          {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Export / Import */}
        <button
          onClick={onExportBoard}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
          title="Export Board JSON"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <label
          className={`p-1.5 rounded-lg border cursor-pointer transition ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
          title="Import Board JSON"
        >
          <Upload className="w-3.5 h-3.5" />
          <input type="file" accept=".json" onChange={onImportBoard} className="hidden" />
        </label>
      </div>
    </header>
  );
};
