/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo } from 'react';
import { Globe, ExternalLink } from 'lucide-react';

export function getWebsiteDomain(url?: string, domain?: string): string {
  if (domain && domain.trim()) {
    return domain.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  }
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').replace(/^m\./i, '');
    if (host === 'youtube.com') {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] || null;
      }
    } else if (host === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] || null;
    }
  } catch {
    // Ignore URL parse error and fallback to regex
  }
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export function getYouTubeThumbnailUrl(url?: string): string | null {
  const id = extractYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function getLinkThumbnail(node: { url?: string; imageUrl?: string; metadata?: Record<string, unknown> }): {
  thumbnailUrl?: string;
  isYouTube: boolean;
  videoId?: string;
} {
  const ytId = extractYouTubeVideoId(node.url);
  if (ytId) {
    const customImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);
    const validCustom = customImage && !customImage.includes('Changes icon') && !customImage.includes('stays white') ? customImage : undefined;
    return {
      thumbnailUrl: validCustom || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      isYouTube: true,
      videoId: ytId
    };
  }
  const rawImage = node.imageUrl || (node.metadata?.image as string) || (node.metadata?.ogImage as string);
  const isValid = rawImage && !rawImage.includes('Changes icon') && !rawImage.includes('stays white') ? rawImage : undefined;
  return {
    thumbnailUrl: isValid,
    isYouTube: false
  };
}

export function getWebsiteLogoUrl(url?: string, domain?: string, customLogo?: string): string | null {
  if (customLogo && customLogo.trim()) return customLogo.trim();
  const effectiveDomain = getWebsiteDomain(url, domain);
  if (!effectiveDomain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`;
}

interface WebsiteLogoProps {
  url?: string;
  domain?: string;
  logo?: string;
  size?: number;
  className?: string;
}

export const WebsiteLogo: React.FC<WebsiteLogoProps> = ({
  url,
  domain,
  logo,
  size = 15,
  className = ''
}) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = useMemo(() => getWebsiteLogoUrl(url, domain, logo), [url, domain, logo]);

  if (!logoUrl || hasError) {
    return (
      <span
        style={{ width: size, height: size, background: 'transparent' }}
        className={`inline-flex items-center justify-center flex-shrink-0 text-slate-400 dark:text-zinc-500 ${className}`}
      >
        <Globe size={Math.max(10, size - 2)} />
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`inline-block object-contain flex-shrink-0 select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, backgroundColor: 'transparent' }}
    />
  );
};

interface WebsiteImageProps {
  imageUrl?: string;
  alt?: string;
  className?: string;
  maxHeight?: number;
  isYouTube?: boolean;
  linkUrl?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const WebsiteImage: React.FC<WebsiteImageProps> = ({
  imageUrl,
  alt = 'Website preview',
  className = '',
  maxHeight = 135,
  isYouTube = false,
  linkUrl,
  onClick
}) => {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) return null;

  if (isYouTube) {
    return (
      <div
        onClick={onClick || ((e) => {
          if (linkUrl) {
            e.stopPropagation();
            window.open(linkUrl, '_blank', 'noopener,noreferrer');
          }
        })}
        onPointerDown={(e) => {
          if (linkUrl) e.stopPropagation();
        }}
        style={{ maxHeight: `${maxHeight}px` }}
        className={`youtube-thumbnail-wrap ${className}`}
        title={linkUrl ? `Watch video: ${alt}` : alt}
      >
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="youtube-thumbnail-img"
        />
        <div className="youtube-play-btn" aria-label="Play video">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="youtube-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="youtube-badge-icon">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          YouTube
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick || ((e) => {
        if (linkUrl) {
          e.stopPropagation();
          window.open(linkUrl, '_blank', 'noopener,noreferrer');
        }
      })}
      onPointerDown={(e) => {
        if (linkUrl) e.stopPropagation();
      }}
      style={{ maxHeight: `${maxHeight}px` }}
      className={`relative w-full overflow-hidden rounded-md border border-slate-200/80 dark:border-zinc-800/80 bg-slate-100/60 dark:bg-zinc-900/60 transition group/img cursor-pointer ${className}`}
    >
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover object-center max-h-[135px] transition-transform duration-300 ease-out group-hover/img:scale-[1.03]"
      />
    </div>
  );
};

interface WebsiteBadgeProps {
  url?: string;
  domain?: string;
  siteName?: string;
  logo?: string;
  className?: string;
  showLink?: boolean;
}

export const WebsiteBadge: React.FC<WebsiteBadgeProps> = ({
  url,
  domain,
  siteName,
  logo,
  className = '',
  showLink = true
}) => {
  const effectiveDomain = getWebsiteDomain(url, domain);
  const displayText = siteName || effectiveDomain;

  if (!effectiveDomain && !url) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors border select-none ${
        url ? 'hover:bg-slate-100 dark:hover:bg-zinc-800/80' : ''
      } ${className}`}
    >
      <WebsiteLogo url={url} domain={domain} logo={logo} size={14} />
      {displayText && (
        <span className="truncate max-w-[170px]" title={displayText}>
          {displayText}
        </span>
      )}
      {showLink && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 ml-0.5 p-0.5"
          title="Open external website"
          aria-label="Open website"
        >
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
};
