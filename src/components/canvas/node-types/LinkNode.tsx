import React from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { CanvasNode, ThemeTokens } from '@/types/canvas';

interface LinkNodeProps {
  node: CanvasNode;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
}

export const LinkNode: React.FC<LinkNodeProps> = ({ node, themeTokens, isLight, onUpdate }) => {
  return (
    <div className="space-y-2">
      <div
        className={`p-2.5 rounded-lg border flex items-start space-x-2.5 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-900/50 border-zinc-800'
        }`}
      >
        <div className="p-1.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900/40">
          <Link2 className="w-3 h-3" />
        </div>
        <div className="overflow-hidden flex-1">
          <span className="text-[10px] font-mono block truncate text-sky-600 dark:text-sky-400 font-medium">
            {node.domain || 'web-source.org'}
          </span>
          <p className={`text-xs font-medium truncate mt-0.5 ${themeTokens.headerText}`}>
            {node.title}
          </p>
        </div>
        {node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200 transition"
            title="Open external link"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <textarea
        value={node.description || ''}
        onChange={(e) => onUpdate(node.id, { description: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        rows={2}
        className={`w-full bg-transparent border-none outline-none text-xs resize-none ${themeTokens.bodyText} placeholder:text-slate-400`}
        placeholder="Source context or synthesis..."
      />
    </div>
  );
};
