import React from 'react';
import { Wand2 } from 'lucide-react';
import { CanvasNode, ThemeTokens } from '@/types/canvas';
import { CURATED_ASSETS } from '@/constants/assets';

interface ImageNodeProps {
  node: CanvasNode;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
  onOpenImageGen: (id: string, caption?: string) => void;
}

export const ImageNode: React.FC<ImageNodeProps> = ({
  node,
  themeTokens,
  isLight,
  onUpdate,
  onOpenImageGen
}) => {
  return (
    <div className="space-y-2">
      <div
        className={`relative rounded-lg overflow-hidden border group/img aspect-video flex items-center justify-center ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-zinc-800 bg-zinc-950'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={node.imageUrl || CURATED_ASSETS[0]}
          alt={node.caption || node.title || 'Moodboard asset'}
          className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = CURATED_ASSETS[0];
          }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenImageGen(node.id, node.caption || node.title);
          }}
          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-zinc-900/90 text-zinc-200 text-[11px] border border-zinc-700 opacity-0 group-hover/img:opacity-100 transition shadow-lg flex items-center space-x-1.5 backdrop-blur-md cursor-pointer hover:bg-zinc-800"
        >
          <Wand2 className="w-3 h-3 text-indigo-400" />
          <span>AI Redraw</span>
        </button>
      </div>
      <input
        type="text"
        value={node.caption || ''}
        onChange={(e) => onUpdate(node.id, { caption: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Add caption or note..."
        className={`w-full bg-transparent border-none outline-none text-[11px] ${themeTokens.subText}`}
      />
    </div>
  );
};
