import React from 'react';
import { ExternalLink } from 'lucide-react';
import { CanvasNode, ThemeTokens } from '@/types/canvas';
import { WebsiteLogo, WebsiteImage, getWebsiteDomain } from '../SourceMetadata';

interface LinkNodeProps {
  node: CanvasNode;
  themeTokens: ThemeTokens;
  isLight: boolean;
  onUpdate: (id: string, fields: Partial<CanvasNode>) => void;
}

export const LinkNode: React.FC<LinkNodeProps> = ({ node, themeTokens, isLight, onUpdate }) => {
  const safeUrl = node.url;
  const effectiveDomain = getWebsiteDomain(node.url, node.domain);
  const websiteLogo = (node.metadata?.logo as string) || (node.metadata?.favicon as string);
  const siteName = (node.metadata?.siteName as string);
  const previewImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);
  const author = (node.metadata?.author as string);

  return (
    <div className="space-y-2">
      <div
        className={`p-2.5 rounded-lg border space-y-2 transition-colors ${
          isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-zinc-900/60 border-zinc-800'
        }`}
      >
        <div className="flex items-start space-x-2.5">
          <div className="p-1.5 rounded bg-white dark:bg-zinc-800/90 border border-slate-200/90 dark:border-zinc-700/80 shadow-2xs flex-shrink-0 flex items-center justify-center">
            <WebsiteLogo url={safeUrl} domain={effectiveDomain} logo={websiteLogo} size={16} />
          </div>
          <div className="overflow-hidden flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono block truncate text-sky-600 dark:text-sky-400 font-medium">
                {effectiveDomain || 'web-source'}
              </span>
              {siteName && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 truncate max-w-[110px]">
                  {siteName}
                </span>
              )}
            </div>
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
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200 transition flex-shrink-0"
              title="Open external link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Website preview image if available */}
        {previewImage && (
          <WebsiteImage
            imageUrl={previewImage}
            alt={node.title || 'Website preview'}
            maxHeight={115}
            className="rounded"
          />
        )}

        {author && (
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic">
            By {author}
          </div>
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
