import { deflateRawSync, crc32 } from 'node:zlib';
import type { KnowledgeGraph } from './graph';
import type { CanvasNode, Connection } from '@/types/canvas';

export interface VaultFile {
  path: string;
  content: string;
}

export function sanitizeVaultFilename(name: string): string {
  const sanitized = name
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return sanitized || 'Untitled Note';
}

function formatDate(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Generates an Obsidian / Logseq compatible vault containing:
 * - Markdown files per node organized in folders with YAML frontmatter & [[wikilinks]]
 * - Directional semantic relationships
 * - Epistemic status & evidence quotes
 * - Master Overview.md index note
 * - Native Obsidian Canvas (.canvas) JSON graph layout
 */
export function buildVaultFiles(graph: KnowledgeGraph, projectTitle: string = 'Research Workspace'): VaultFile[] {
  const files: VaultFile[] = [];
  const nodes = Object.values(graph.nodesById);
  const edges = Object.values(graph.edgesById);

  const safeVaultName = sanitizeVaultFilename(projectTitle) || 'synthex-vault';

  // Map each node to its safe note title and unique path to avoid collisions
  const noteTitlesById = new Map<string, string>();
  const notePathsById = new Map<string, string>();
  const usedTitles = new Set<string>();

  for (const node of nodes) {
    const baseTitle = sanitizeVaultFilename(node.title || node.id);
    let title = baseTitle;
    let counter = 2;
    while (usedTitles.has(title.toLowerCase())) {
      title = `${baseTitle} (${counter++})`;
    }
    usedTitles.add(title.toLowerCase());
    noteTitlesById.set(node.id, title);

    const folder = getNodeFolder(node.type);
    notePathsById.set(node.id, `${folder}/${title}.md`);
  }

  // Pre-calculate incoming and outgoing relationships
  const outgoingByFrom = new Map<string, Connection[]>();
  const incomingByTo = new Map<string, Connection[]>();

  for (const edge of edges) {
    if (!outgoingByFrom.has(edge.from)) outgoingByFrom.set(edge.from, []);
    outgoingByFrom.get(edge.from)!.push(edge);

    if (!incomingByTo.has(edge.to)) incomingByTo.set(edge.to, []);
    incomingByTo.get(edge.to)!.push(edge);
  }

  // Generate individual Markdown files
  for (const node of nodes) {
    const title = noteTitlesById.get(node.id)!;
    const filePath = `${safeVaultName}/${notePathsById.get(node.id)!}`;

    const md = buildNodeMarkdown(node, title, noteTitlesById, outgoingByFrom.get(node.id) || [], incomingByTo.get(node.id) || []);
    files.push({ path: filePath, content: md });
  }

  // Generate Master Overview Index Note
  const overviewPath = `${safeVaultName}/Overview.md`;
  const overviewContent = buildOverviewMarkdown(projectTitle, nodes, noteTitlesById);
  files.push({ path: overviewPath, content: overviewContent });

  // Generate Native Obsidian Canvas file (.canvas)
  const canvasPath = `${safeVaultName}/Synthex Knowledge Canvas.canvas`;
  const canvasContent = buildObsidianCanvas(nodes, edges, notePathsById);
  files.push({ path: canvasPath, content: canvasContent });

  return files;
}

function getNodeFolder(type: string): string {
  switch (type) {
    case 'concept': return 'concepts';
    case 'claim': return 'claims';
    case 'source': case 'link': return 'sources';
    case 'question': return 'questions';
    case 'hypothesis': return 'hypotheses';
    case 'task': return 'tasks';
    case 'group': case 'section': return 'clusters';
    default: return 'notes';
  }
}

function buildNodeMarkdown(
  node: CanvasNode,
  title: string,
  noteTitlesById: Map<string, string>,
  outgoing: Connection[],
  incoming: Connection[]
): string {
  const lines: string[] = [];

  // YAML Frontmatter
  lines.push('---');
  lines.push(`id: "${node.id}"`);
  lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  lines.push(`type: "${node.type}"`);
  lines.push(`created: "${formatDate(node.createdAt)}"`);
  if (node.metadata?.claimStatus) {
    lines.push(`claimStatus: "${node.metadata.claimStatus}"`);
  }
  if (typeof node.metadata?.confidence === 'number') {
    lines.push(`confidence: ${node.metadata.confidence}`);
  }
  if (node.url) {
    lines.push(`url: "${node.url.replace(/"/g, '\\"')}"`);
  }
  lines.push('tags:');
  lines.push('  - synthex');
  lines.push(`  - synthex/${node.type}`);
  if (node.metadata?.claimStatus) {
    lines.push(`  - epistemic/${node.metadata.claimStatus}`);
  }
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${title}`);
  lines.push('');

  // Description / Content
  if (node.content && node.content.trim()) {
    lines.push('## Notes & Summary');
    lines.push('');
    lines.push(node.content.trim());
    lines.push('');
  } else if (node.description && node.description.trim()) {
    lines.push('## Description');
    lines.push('');
    lines.push(node.description.trim());
    lines.push('');
  }

  // Source / Link References
  if (node.url) {
    lines.push('## Reference Link');
    lines.push(`- **URL**: [${node.domain || node.url}](${node.url})`);
    if (node.caption) lines.push(`- **Caption**: ${node.caption}`);
    lines.push('');
  }

  // Checklist items for task notes
  if (node.items && node.items.length > 0) {
    lines.push('## Checklist');
    for (const item of node.items) {
      lines.push(`- [${item.completed ? 'x' : ' '}] ${item.text}`);
    }
    lines.push('');
  }

  // Epistemic Provenance for claims
  if (node.metadata?.claimStatus || (node.metadata?.evidence && node.metadata.evidence.length > 0)) {
    lines.push('## Epistemic Provenance');
    if (node.metadata.claimStatus) {
      lines.push(`- **Status**: \`${node.metadata.claimStatus}\``);
    }
    if (typeof node.metadata.confidence === 'number') {
      lines.push(`- **Confidence**: ${(node.metadata.confidence * 100).toFixed(0)}%`);
    }
    if (node.metadata.rationale) {
      lines.push(`- **Rationale**: ${node.metadata.rationale}`);
    }
    if (node.metadata.evidence && node.metadata.evidence.length > 0) {
      lines.push('');
      lines.push('### Supporting Evidence & Citations');
      for (const ev of node.metadata.evidence) {
        const sourceTitle = noteTitlesById.get(ev.sourceId) || ev.sourceId;
        const excerpt = ev.excerpt ? `> "${ev.excerpt}"` : '';
        lines.push(`- **${ev.relation || 'supports'}** [[${sourceTitle}]]`);
        if (excerpt) lines.push(`  ${excerpt}`);
        if (ev.location) lines.push(`  *(location: ${ev.location})*`);
      }
    }
    lines.push('');
  }

  // Directional Semantic Relationships with [[wikilinks]]
  if (outgoing.length > 0 || incoming.length > 0) {
    lines.push('## Semantic Network');
    if (outgoing.length > 0) {
      lines.push('### Outgoing Relationships');
      for (const edge of outgoing) {
        const targetTitle = noteTitlesById.get(edge.to) || edge.to;
        const label = edge.label ? `**${edge.label}**` : 'links to';
        lines.push(`- ${label} → [[${targetTitle}]]`);
      }
      lines.push('');
    }
    if (incoming.length > 0) {
      lines.push('### Incoming Relationships');
      for (const edge of incoming) {
        const sourceTitle = noteTitlesById.get(edge.from) || edge.from;
        const label = edge.label ? `**${edge.label}**` : 'linked from';
        lines.push(`- ${label} ← [[${sourceTitle}]]`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildOverviewMarkdown(projectTitle: string, nodes: CanvasNode[], noteTitlesById: Map<string, string>): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`title: "${projectTitle.replace(/"/g, '\\"')}"`);
  lines.push('type: "overview"');
  lines.push('tags:');
  lines.push('  - synthex');
  lines.push('  - synthex/overview');
  lines.push('---');
  lines.push('');
  lines.push(`# ${projectTitle}`);
  lines.push('');
  lines.push('> Semantic knowledge vault exported from **Synthex Studio**.');
  lines.push('');

  const typeGroups: Record<string, CanvasNode[]> = {};
  for (const node of nodes) {
    if (!typeGroups[node.type]) typeGroups[node.type] = [];
    typeGroups[node.type].push(node);
  }

  const categoryOrder = [
    { type: 'concept', label: 'Concepts' },
    { type: 'claim', label: 'Claims & Assertions' },
    { type: 'question', label: 'Research Questions' },
    { type: 'hypothesis', label: 'Hypotheses' },
    { type: 'source', label: 'Sources & Evidence' },
    { type: 'link', label: 'External Links' },
    { type: 'task', label: 'Research Tasks' },
    { type: 'note', label: 'Notes & Ideas' },
    { type: 'group', label: 'Knowledge Clusters' }
  ];

  for (const { type, label } of categoryOrder) {
    const groupNodes = typeGroups[type];
    if (groupNodes && groupNodes.length > 0) {
      lines.push(`## ${label} (${groupNodes.length})`);
      lines.push('');
      for (const n of groupNodes) {
        const title = noteTitlesById.get(n.id) || n.title || n.id;
        const preview = n.content ? ` — *${n.content.slice(0, 90).replace(/\n/g, ' ')}...*` : '';
        lines.push(`- [[${title}]]${preview}`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Generated by Synthex Studio on ${new Date().toLocaleString()}*`);
  return lines.join('\n');
}

/**
 * Builds an Obsidian Canvas (.canvas) JSON structure so the exact spatial
 * layout and connectors can be inspected visually in Obsidian.
 */
function buildObsidianCanvas(
  nodes: CanvasNode[],
  edges: Connection[],
  notePathsById: Map<string, string>
): string {
  const canvasNodes = nodes.map(node => {
    const relativePath = notePathsById.get(node.id);
    return {
      id: node.id,
      type: 'file',
      file: relativePath,
      x: Math.round(node.x),
      y: Math.round(node.y),
      width: Math.round(node.width || 280),
      height: Math.round(node.height || 160)
    };
  });

  const canvasEdges = edges.map(edge => ({
    id: edge.id,
    fromNode: edge.from,
    toNode: edge.to,
    label: edge.label || '',
    toEnd: edge.arrowhead === 'none' ? 'none' : 'arrow'
  }));

  return JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2);
}

/**
 * Generates a valid PKWARE ZIP file archive entirely with native Node.js built-ins.
 * Uses node:zlib deflateRawSync and crc32 with 0 external dependencies.
 */
export function createZipArchive(files: Array<{ path: string; content: string | Buffer }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const rawData = typeof file.content === 'string' ? Buffer.from(file.content, 'utf8') : file.content;
    const compressed = deflateRawSync(rawData);
    const checksum = crc32(rawData);
    const pathBuf = Buffer.from(file.path, 'utf8');

    // Local file header (30 bytes + path length)
    const lh = Buffer.alloc(30 + pathBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Local header signature
    lh.writeUInt16LE(20, 4);         // Version needed: 2.0
    lh.writeUInt16LE(0x0800, 6);      // General purpose bit flag (bit 11 = UTF-8)
    lh.writeUInt16LE(8, 8);           // Compression method: DEFLATE (8)
    lh.writeUInt16LE(0, 10);          // Last mod time
    lh.writeUInt16LE(0, 12);          // Last mod date
    lh.writeUInt32LE(checksum, 14);   // CRC-32
    lh.writeUInt32LE(compressed.length, 18); // Compressed size
    lh.writeUInt32LE(rawData.length, 22);    // Uncompressed size
    lh.writeUInt16LE(pathBuf.length, 26);    // Filename length
    lh.writeUInt16LE(0, 28);                 // Extra field length
    pathBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    // Central directory header (46 bytes + path length)
    const ch = Buffer.alloc(46 + pathBuf.length);
    ch.writeUInt32LE(0x02014b50, 0); // Central directory signature
    ch.writeUInt16LE(20, 4);         // Version made by: 2.0
    ch.writeUInt16LE(20, 6);         // Version needed: 2.0
    ch.writeUInt16LE(0x0800, 8);      // General purpose bit flag (UTF-8)
    ch.writeUInt16LE(8, 10);          // Compression method: DEFLATE
    ch.writeUInt16LE(0, 12);          // Last mod time
    ch.writeUInt16LE(0, 14);          // Last mod date
    ch.writeUInt32LE(checksum, 16);   // CRC-32
    ch.writeUInt32LE(compressed.length, 20); // Compressed size
    ch.writeUInt32LE(rawData.length, 24);    // Uncompressed size
    ch.writeUInt16LE(pathBuf.length, 28);    // Filename length
    ch.writeUInt16LE(0, 30);                 // Extra field length
    ch.writeUInt16LE(0, 32);                 // Comment length
    ch.writeUInt16LE(0, 34);                 // Disk number start
    ch.writeUInt16LE(0, 36);                 // Internal file attributes
    ch.writeUInt32LE(0, 38);                 // External file attributes
    ch.writeUInt32LE(offset, 42);            // Relative offset of local header
    pathBuf.copy(ch, 46);

    centralHeaders.push(ch);

    offset += lh.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirBuffer = Buffer.concat(centralHeaders);

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // EOCD signature
  eocd.writeUInt16LE(0, 4);                  // Number of this disk
  eocd.writeUInt16LE(0, 6);                  // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8);       // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10);      // Total number of central directory records
  eocd.writeUInt32LE(centralDirBuffer.length, 12); // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);   // Offset of central directory
  eocd.writeUInt16LE(0, 20);                 // ZIP comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}
