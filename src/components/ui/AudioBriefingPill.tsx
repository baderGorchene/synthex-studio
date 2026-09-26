import React from 'react';
import { Square, Volume2 } from 'lucide-react';

interface AudioBriefingPillProps {
  isPlaying: boolean;
  isLight: boolean;
  onStop: () => void;
}

export const AudioBriefingPill: React.FC<AudioBriefingPillProps> = ({
  isPlaying,
  isLight,
  onStop
}) => {
  if (!isPlaying) return null;

  return (
    <div
      className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-3 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-xl animate-in slide-in-from-top duration-200 select-none ${
        isLight
          ? 'bg-white/95 border-indigo-200 text-slate-800'
          : 'bg-zinc-900/95 border-indigo-900/60 text-zinc-100'
      }`}
    >
      <Volume2 className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
      <span className="text-xs font-medium">Playing spoken card briefing</span>
      <button
        onClick={onStop}
        className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
        title="Stop playback"
      >
        <Square className="w-3 h-3 fill-current" />
      </button>
    </div>
  );
};
