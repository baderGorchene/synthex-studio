import React from 'react';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { ThemeTokens } from '@/types/canvas';

interface CanvasControlsProps {
  zoom: number;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  onResetZoom: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  zoom,
  themeTokens,
  isLight,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onResetZoom
}) => {
  return (
    <div
      className={`absolute right-5 bottom-5 z-20 flex items-center space-x-1 p-1 rounded-xl border shadow-xl backdrop-blur-xl text-xs select-none ${
        themeTokens.panelBg
      }`}
    >
      <button
        onClick={onZoomOut}
        className={`p-1.5 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Zoom Out (-)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <span className={`font-mono text-[11px] w-12 text-center select-none ${themeTokens.headerText}`}>
        {Math.round(zoom * 100)}%
      </span>

      <button
        onClick={onZoomIn}
        className={`p-1.5 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Zoom In (+)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <div className={`w-px h-3.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

      <button
        onClick={onZoomToFit}
        className={`p-1.5 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Zoom to Fit All"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={onResetZoom}
        className={`p-1.5 rounded-lg transition cursor-pointer ${themeTokens.toolHover}`}
        title="Reset to 100%"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
