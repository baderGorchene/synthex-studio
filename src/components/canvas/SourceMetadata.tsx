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
        style={{ width: size, height: size }}
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
      className={`inline-block object-contain flex-shrink-0 rounded-xs select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};

interface WebsiteImageProps {
  imageUrl?: string;
  alt?: string;
  className?: string;
  maxHeight?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export const WebsiteImage: React.FC<WebsiteImageProps> = ({
  imageUrl,
  alt = 'Website preview',
  className = '',
  maxHeight = 130,
  onClick
}) => {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) return null;

  return (
    <div
      onClick={onClick}
      style={{ maxHeight: `${maxHeight}px` }}
      className={`relative w-full overflow-hidden rounded-md border border-slate-200/80 dark:border-zinc-800/80 bg-slate-100/60 dark:bg-zinc-900/60 transition group/img ${className}`}
    >
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover object-center max-h-[130px] transition-transform duration-300 ease-out group-hover/img:scale-[1.03]"
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
