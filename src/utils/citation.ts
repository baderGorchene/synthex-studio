/**
 * Utility functions for citation parsing, page extraction, and PDF deep-linking.
 */

export interface CitationReference {
  sourceId: string;
  excerpt?: string;
  location?: string;
  page?: number;
  relation: 'supports' | 'contradicts';
}

/**
 * Extracts a numeric 1-indexed page number from a location string or number.
 * Supports: 42, "p. 42", "p.42", "page 42", "Page 15", "pp. 12-14", "Section 2, p. 8"
 */
export function extractPageNumber(location?: string | number): number | undefined {
  if (typeof location === 'number' && Number.isFinite(location) && location > 0) {
    return Math.floor(location);
  }
  if (!location || typeof location !== 'string') return undefined;

  // Explicit page prefix: "p. 42", "page 42", "pp. 12"
  const prefixMatch = location.match(/(?:p(?:age|p)?\.?\s*)(\d+)/i);
  if (prefixMatch) {
    const num = parseInt(prefixMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Standalone number or number enclosed in bounds
  const numMatch = location.match(/\b(\d+)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return undefined;
}

/**
 * Appends a #page=N fragment to a PDF URL or base64 data URI for deep-linking.
 */
export function formatPdfPageUrl(fileUrl: string, page?: number): string {
  if (!fileUrl) return '';
  const cleanUrl = fileUrl.split('#')[0];
  if (page && page > 0) {
    return `${cleanUrl}#page=${Math.floor(page)}`;
  }
  return cleanUrl;
}

/**
 * Normalizes an evidence record ensuring valid relation and extracting page if location provided.
 */
export function normalizeEvidenceItem(item: Partial<CitationReference>): CitationReference {
  const page = item.page || extractPageNumber(item.location);
  return {
    sourceId: item.sourceId || '',
    excerpt: item.excerpt?.trim(),
    location: item.location?.trim() || (page ? `p. ${page}` : undefined),
    page,
    relation: item.relation === 'contradicts' ? 'contradicts' : 'supports'
  };
}
