import type { CanvasNode } from '../../types/canvas';
import { isNeonConfigured } from '../neon.ts';
import {
  computeContentHash,
  configuredEmbeddingProviders,
  getBatchEmbeddings,
  getQueryEmbedding,
  type EmbeddingProvider,
  type EmbeddingResult
} from './embeddings.ts';
import { sqliteSearchIndex } from './search-index-sqlite.ts';
import { neonSearchIndex } from './search-index-neon.ts';

/** Index bookkeeping for one node: the keyword index is current when textHash matches; the vector when embeddingHash does. */
export interface IndexStateRow {
  nodeId: string;
  textHash: string;
  embeddingHash: string | null;
  provider: EmbeddingProvider | null;
}

export interface KeywordDocument {
  nodeId: string;
  textHash: string;
  title: string;
  body: string;
  nodeType: string;
}

/**
 * Storage for the hybrid search index. SQLite (FTS5 + sqlite-vec) in local mode,
 * Postgres (tsvector + pgvector) when Neon is configured, so the index is as durable
 * as the graph it describes.
 */
export interface SearchIndexBackend {
  listIndexState(projectId: string): Promise<IndexStateRow[]>;
  /** Providers that produced at least one stored vector in this project. */
  listEmbeddingProviders(projectId: string): Promise<EmbeddingProvider[]>;
  deleteNodes(projectId: string, nodeIds: string[]): Promise<void>;
  upsertKeywordDocuments(projectId: string, docs: KeywordDocument[]): Promise<void>;
  /** Returns false when the backend has no vector support (extension unavailable). */
  saveEmbeddings(projectId: string, embeddings: EmbeddingResult[]): Promise<boolean>;
  /** Nearest node IDs among vectors of this project embedded by this provider, closest first. */
  denseSearch(projectId: string, provider: EmbeddingProvider, embedding: Float32Array, k: number): Promise<string[]>;
  /** Best keyword matches for this project, best first. Tokens contain only letters, digits and underscores. */
  sparseSearch(projectId: string, tokens: string[], k: number): Promise<string[]>;
}

function getBackend(): SearchIndexBackend {
  return isNeonConfigured() ? neonSearchIndex : sqliteSearchIndex;
}

export interface HybridSearchResult {
  nodeId: string;
  rrfScore: number;
  denseRank: number | null;
  sparseRank: number | null;
}

/**
 * Clean text representation for embedding generation
 */
function getNodeText(node: CanvasNode): string {
  const parts = [
    `Title: ${node.title}`,
    `Type: ${node.type}`,
    node.content ? `Content: ${node.content}` : '',
    node.description ? `Description: ${node.description}` : '',
    node.metadata?.claimStatus ? `Status: ${node.metadata.claimStatus}` : '',
    node.url ? `URL: ${node.url}` : ''
  ];
  return parts.filter(Boolean).join('\n');
}

/**
 * Synchronize the keyword index and node embeddings with the latest graph nodes.
 * The keyword index is always written, so retrieval works without any AI key;
 * embeddings are generated only for new or changed nodes, when a provider is configured.
 */
export async function syncGraphVectors(projectId: string, nodes: CanvasNode[]): Promise<{
  indexedCount: number;
  embeddedCount: number;
  skippedCount: number;
  deletedCount: number;
}> {
  const backend = getBackend();
  const validNodes = nodes.filter(n => n.id && n.title);
  const activeIds = new Set(validNodes.map(n => n.id));

  const existingRows = await backend.listIndexState(projectId);
  const existing = new Map(existingRows.map(r => [r.nodeId, r]));

  const toDelete = existingRows.filter(r => !activeIds.has(r.nodeId)).map(r => r.nodeId);
  if (toDelete.length > 0) await backend.deleteNodes(projectId, toDelete);

  const keywordDocs: KeywordDocument[] = [];
  const needsEmbedding: Array<{ id: string; text: string; contentHash: string }> = [];
  let skippedCount = 0;

  for (const node of validNodes) {
    const text = getNodeText(node);
    const hash = computeContentHash(text);
    const row = existing.get(node.id);
    const keywordCurrent = row?.textHash === hash;
    const embeddingCurrent = row?.embeddingHash === hash;

    if (!keywordCurrent) {
      keywordDocs.push({
        nodeId: node.id,
        textHash: hash,
        title: node.title,
        body: [node.content, node.description].filter(Boolean).join('\n'),
        nodeType: node.type
      });
    }
    if (!embeddingCurrent) needsEmbedding.push({ id: node.id, text, contentHash: hash });
    if (keywordCurrent && embeddingCurrent) skippedCount++;
  }

  if (keywordDocs.length > 0) await backend.upsertKeywordDocuments(projectId, keywordDocs);

  let embeddedCount = 0;
  if (needsEmbedding.length > 0 && configuredEmbeddingProviders().length > 0) {
    try {
      const embeddings = await getBatchEmbeddings(needsEmbedding);
      if (await backend.saveEmbeddings(projectId, embeddings)) embeddedCount = embeddings.length;
    } catch (err) {
      console.warn('Embedding generation skipped during sync:', err instanceof Error ? err.message : err);
    }
  }

  return { indexedCount: keywordDocs.length, embeddedCount, skippedCount, deletedCount: toDelete.length };
}

/**
 * Hybrid Search combining dense vector cosine similarity and sparse keyword ranking
 * using Reciprocal Rank Fusion (RRF). Dense search runs once per embedding provider
 * present in the project, each against only that provider's vectors.
 */
export async function hybridSearch(
  projectId: string,
  query: string,
  topK = 10
): Promise<HybridSearchResult[]> {
  const backend = getBackend();
  const rankedLists: Array<{ kind: 'dense' | 'sparse'; ids: string[] }> = [];

  // 1. Dense vector search, per provider that has vectors in this project
  try {
    const storedProviders = new Set(await backend.listEmbeddingProviders(projectId));
    const providers = configuredEmbeddingProviders().filter(p => storedProviders.has(p));
    for (const provider of providers) {
      try {
        const embedding = await getQueryEmbedding(query, provider);
        const ids = await backend.denseSearch(projectId, provider, embedding, topK * 2);
        if (ids.length > 0) rankedLists.push({ kind: 'dense', ids });
      } catch (err) {
        console.warn(`Dense vector search (${provider}) failed:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn('Dense vector search step failed:', err instanceof Error ? err.message : err);
  }

  // 2. Sparse lexical search
  try {
    const tokens = query
      .replace(/[^\p{L}\p{N}_\s]/gu, ' ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 1)
      .slice(0, 32);
    if (tokens.length > 0) {
      const ids = await backend.sparseSearch(projectId, tokens, topK * 2);
      if (ids.length > 0) rankedLists.push({ kind: 'sparse', ids });
    }
  } catch (err) {
    console.warn('Sparse lexical search step failed:', err instanceof Error ? err.message : err);
  }

  // 3. Reciprocal Rank Fusion (RRF) with constant k=60
  const RRF_K = 60;
  const byId = new Map<string, HybridSearchResult>();
  for (const list of rankedLists) {
    list.ids.forEach((nodeId, index) => {
      const rank = index + 1;
      const entry = byId.get(nodeId) ?? { nodeId, rrfScore: 0, denseRank: null, sparseRank: null };
      entry.rrfScore += 1 / (RRF_K + rank);
      if (list.kind === 'dense') entry.denseRank = Math.min(entry.denseRank ?? rank, rank);
      else entry.sparseRank = rank;
      byId.set(nodeId, entry);
    });
  }

  return [...byId.values()].sort((a, b) => b.rrfScore - a.rrfScore).slice(0, topK);
}
