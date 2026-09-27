import { NextResponse } from 'next/server';

function isPrivateIp(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return true;
  }
  // IPv4 private ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true; // link-local
  return false;
}

function resolveUrl(relativeOrAbsolute: string | undefined, baseUrl: string): string | undefined {
  if (!relativeOrAbsolute) return undefined;
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return undefined;
  }
}

function extractMeta(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  if (!match || !match[1]) return undefined;
  // Decode basic HTML entities
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl || typeof targetUrl !== 'string') {
      return NextResponse.json({ error: 'URL parameter is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format.' }, { status: 400 });
    }

    const domain = parsedUrl.hostname.replace(/^www\./i, '');
    const googleFavicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

    if (isPrivateIp(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Access to private network addresses is forbidden.' }, { status: 403 });
    }

    // Default metadata with fallback favicon
    const result = {
      url: parsedUrl.href,
      domain,
      siteName: domain,
      title: domain,
      description: '',
      image: undefined as string | undefined,
      logo: googleFavicon
    };

    // Special handling for YouTube video URLs via official oEmbed API
    const isYouTube = domain === 'youtube.com' || domain === 'm.youtube.com' || domain === 'youtu.be';
    if (isYouTube) {
      result.siteName = 'YouTube';
      let videoId: string | null = null;
      if (domain === 'youtu.be') {
        videoId = parsedUrl.pathname.slice(1).split('/')[0] || null;
      } else if (parsedUrl.pathname === '/watch') {
        videoId = parsedUrl.searchParams.get('v');
      } else if (parsedUrl.pathname.startsWith('/embed/') || parsedUrl.pathname.startsWith('/shorts/')) {
        videoId = parsedUrl.pathname.split('/')[2] || null;
      }

      if (videoId) {
        result.image = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }

      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(parsedUrl.href)}&format=json`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(3500)
        });
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData.title) result.title = oembedData.title;
          if (oembedData.author_name) {
            result.description = `Video by ${oembedData.author_name}`;
            (result as { author?: string }).author = oembedData.author_name;
          }
          if (oembedData.thumbnail_url) {
            result.image = oembedData.thumbnail_url;
          }
          return NextResponse.json(result);
        }
      } catch {
        // Fallback to videoId thumbnail if oembed fails or times out
        if (videoId) {
          return NextResponse.json(result);
        }
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(parsedUrl.href, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(result);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return NextResponse.json(result);
      }

      // Read at most first 250KB of HTML
      const reader = response.body?.getReader();
      let html = '';
      if (reader) {
        const decoder = new TextDecoder();
        let bytesRead = 0;
        while (bytesRead < 256 * 1024) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value.byteLength;
          html += decoder.decode(value, { stream: true });
        }
        reader.cancel().catch(() => {});
      } else {
        html = await response.text();
      }

      // Extract Open Graph & Meta Tags
      const ogTitle = extractMeta(html, /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);

      const twitterTitle = extractMeta(html, /<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
                           extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:title["']/i);

      const docTitle = extractMeta(html, /<title[^>]*>([^<]+)<\/title>/i);

      const ogDesc = extractMeta(html, /<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                     extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);

      const metaDesc = extractMeta(html, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                       extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);

      const ogImage = extractMeta(html, /<meta\s+[^>]*property=["']og:image(?::(?:url|secure_url))?["'][^>]*content=["']([^"']+)["']/i) ||
                      extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::(?:url|secure_url))?["']/i);

      const twitterImage = extractMeta(html, /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                           extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

      const ogSiteName = extractMeta(html, /<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
                         extractMeta(html, /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);

      const iconHref = extractMeta(html, /<link\s+[^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i) ||
                       extractMeta(html, /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["']/i);

      if (ogTitle || twitterTitle || docTitle) {
        result.title = (ogTitle || twitterTitle || docTitle)!.slice(0, 300);
      }
      if (ogDesc || metaDesc) {
        result.description = (ogDesc || metaDesc)!.slice(0, 1000);
      }
      if (ogSiteName) {
        result.siteName = ogSiteName.slice(0, 100);
      }

      const rawImage = ogImage || twitterImage;
      if (rawImage) {
        result.image = resolveUrl(rawImage, parsedUrl.href);
      }

      if (iconHref) {
        const resolvedIcon = resolveUrl(iconHref, parsedUrl.href);
        if (resolvedIcon) {
          result.logo = resolvedIcon;
        }
      }

      return NextResponse.json(result);
    } catch {
      // In case of timeout or connection errors, return default metadata with favicon
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Failed to extract metadata:', error);
    return NextResponse.json({ error: 'Failed to extract website metadata.' }, { status: 500 });
  }
}
