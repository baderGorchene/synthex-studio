import type { CanvasNode } from '@/types/canvas';

export interface BibEntry {
  citationKey: string;
  type: string;
  title: string;
  authors: string[];
  year?: string;
  journal?: string;
  booktitle?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  rawFields: Record<string, string>;
}

/**
 * Strips LaTeX formatting braces and escape sequences from text:
 * e.g. "{\L}ukasz" -> "Lukasz", "{Attention Is All You Need}" -> "Attention Is All You Need"
 */
export function cleanLatex(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\\['"`^~=.](\w)/g, '$1') // Accents like \'e -> e
    .replace(/\\([a-zA-Z]+)/g, '$1')    // Commands like \L -> L
    .replace(/[{}]/g, '')               // Outer formatting braces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats BibTeX authors "Last, First and Last, First" or "First Last and First Last"
 * into a clean readable string "First Last, First Last"
 */
export function formatBibAuthors(authorsStr?: string): string[] {
  if (!authorsStr) return [];
  const rawAuthors = authorsStr.split(/\s+and\s+/i);
  return rawAuthors.map(author => {
    const clean = cleanLatex(author);
    if (clean.includes(',')) {
      const parts = clean.split(',').map(p => p.trim());
      return parts.length >= 2 ? `${parts[1]} ${parts[0]}`.trim() : clean;
    }
    return clean;
  }).filter(Boolean);
}

/**
 * Parses raw BibTeX text string into structured BibEntry objects.
 * 100% offline, zero-dependency parser handling standard BibTeX grammar.
 */
export function parseBibTeX(bibtexContent: string): BibEntry[] {
  const entries: BibEntry[] = [];
  if (!bibtexContent || typeof bibtexContent !== 'string') return entries;

  // Regex matching start of each entry: @type{citationKey,
  const entryRegex = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,/g;
  let match: RegExpExecArray | null;

  const entryIndices: Array<{ type: string; key: string; start: number; headerEnd: number }> = [];

  while ((match = entryRegex.exec(bibtexContent)) !== null) {
    entryIndices.push({
      type: match[1].toLowerCase(),
      key: match[2].trim(),
      start: match.index,
      headerEnd: match.index + match[0].length
    });
  }

  for (let i = 0; i < entryIndices.length; i++) {
    const current = entryIndices[i];
    const nextStart = i + 1 < entryIndices.length ? entryIndices[i + 1].start : bibtexContent.length;
    const bodyText = bibtexContent.slice(current.headerEnd, nextStart);

    const fields: Record<string, string> = {};

    // Tokenize field = {value} or field = "value" or field = 2024
    let pos = 0;
    while (pos < bodyText.length) {
      // Find field name
      const eqPos = bodyText.indexOf('=', pos);
      if (eqPos === -1) break;

      const rawFieldName = bodyText.slice(pos, eqPos).replace(/[\r\n\t,]/g, ' ').trim();
      if (!rawFieldName || rawFieldName.includes('}')) break;

      const fieldName = rawFieldName.toLowerCase();
      let valStart = eqPos + 1;
      while (valStart < bodyText.length && /\s/.test(bodyText[valStart])) valStart++;

      let fieldValue = '';
      let nextPos = valStart;

      if (bodyText[valStart] === '{') {
        // Brace-delimited value: count matching braces
        let depth = 1;
        let p = valStart + 1;
        while (p < bodyText.length && depth > 0) {
          if (bodyText[p] === '{' && bodyText[p - 1] !== '\\') depth++;
          else if (bodyText[p] === '}' && bodyText[p - 1] !== '\\') depth--;
          p++;
        }
        fieldValue = bodyText.slice(valStart + 1, p - 1);
        nextPos = p;
      } else if (bodyText[valStart] === '"') {
        // Quote-delimited value
        let p = valStart + 1;
        while (p < bodyText.length && (bodyText[p] !== '"' || bodyText[p - 1] === '\\')) p++;
        fieldValue = bodyText.slice(valStart + 1, p);
        nextPos = p + 1;
      } else {
        // Raw word/number up to comma or closing brace
        let p = valStart;
        while (p < bodyText.length && bodyText[p] !== ',' && bodyText[p] !== '}') p++;
        fieldValue = bodyText.slice(valStart, p).trim();
        nextPos = p;
      }

      // Advance past optional trailing comma
      while (nextPos < bodyText.length && (bodyText[nextPos] === ',' || /\s/.test(bodyText[nextPos]))) {
        nextPos++;
      }

      fields[fieldName] = cleanLatex(fieldValue);
      pos = nextPos;
    }

    const title = fields.title || current.key;
    const authors = formatBibAuthors(fields.author);
    const year = fields.year;
    const journal = fields.journal || fields.journaltitle;
    const booktitle = fields.booktitle;
    const doi = fields.doi;
    let url = fields.url;
    if (!url && doi) {
      url = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
    }
    const abstract = fields.abstract;

    entries.push({
      citationKey: current.key,
      type: current.type,
      title,
      authors,
      year,
      journal,
      booktitle,
      doi,
      url,
      abstract,
      rawFields: fields
    });
  }

  return entries;
}

/**
 * Converts parsed BibTeX entries into typed CanvasNode records ready to insert
 * into the knowledge graph.
 */
export function bibEntriesToCanvasNodes(
  entries: BibEntry[],
  startX: number = 80,
  startY: number = 80
): CanvasNode[] {
  const nodes: CanvasNode[] = [];
  const COLUMNS = 3;
  const CARD_WIDTH = 320;
  const CARD_GAP_X = 40;
  const CARD_GAP_Y = 50;
  const ESTIMATED_HEIGHT = 180;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);

    const x = startX + col * (CARD_WIDTH + CARD_GAP_X);
    const y = startY + row * (ESTIMATED_HEIGHT + CARD_GAP_Y);

    const authorSummary = entry.authors.length > 0
      ? entry.authors.length > 3
        ? `${entry.authors[0]} et al.`
        : entry.authors.join(', ')
      : undefined;

    const venue = entry.journal || entry.booktitle;
    const citeLine = [authorSummary, entry.year ? `(${entry.year})` : undefined, venue]
      .filter(Boolean)
      .join(' ');

    let domain: string | undefined;
    if (entry.url) {
      try {
        domain = new URL(entry.url).hostname.replace(/^www\./, '');
      } catch {
        domain = undefined;
      }
    }

    const id = `source-bib-${entry.citationKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const node: CanvasNode = {
      id,
      type: 'source',
      title: entry.title,
      content: entry.abstract || undefined,
      x,
      y,
      width: CARD_WIDTH,
      url: entry.url,
      domain,
      description: citeLine || undefined,
      metadata: {
        origin: 'imported',
        citationKey: entry.citationKey,
        bibType: entry.type,
        authors: entry.authors,
        year: entry.year,
        doi: entry.doi,
        journal: entry.journal,
        booktitle: entry.booktitle
      },
      createdAt: Date.now()
    };

    nodes.push(node);
  }

  return nodes;
}
