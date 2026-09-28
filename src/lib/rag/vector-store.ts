import * as sqliteVec from 'sqlite-vec';
import { getDb } from '../db.ts';
import type { CanvasNode } from '../../types/canvas';
import {
  computeContentHash,
  getBatchEmbeddings,
  getQueryEmbedding,
  EMBEDDING_DIMENSION
} from './embeddings.ts';

let isVecLoaded = false;

function ensureVectorStore() {
  const db = getDb();
  if (!isVecLoaded) {
    try {
      sqliteVec.load(db);
      isVecLoaded = true;
    } catch (err) {
      console.error('Failed to load sqlite-vec:', err);
    }
  }

  // 1. Metadata tracking table for cached embeddings
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_embeddings (
      projectId TEXT NOT NULL,
      nodeId TEXT NOT NULL,
      contentHash TEXT NOT NULL,
      provider TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (projectId, nodeId)
    );
    CREATE INDEX IF NOT EXISTS node_embeddings_proj_idx ON node_embeddings(projectId);
  `);

  // 2. FTS5 Virtual table for lexical BM25 search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
      node_key UNINDEXED,
      projectId UNINDEXED,
      nodeId UNINDEXED,
      title,
      content,
      nodeType
    );
  `);

  // 3. sqlite-vec virtual table for 1536-dimensional dense vectors
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_nodes USING vec0(
        node_key TEXT PRIMARY KEY,
        embedding float[${EMBEDDING_DIMENSION}]
      );
    `);
  } catch (err) {
    console.error('Error creating vec_nodes virtual table:', err);
  }
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
 * Synchronize node embeddings and FTS5 search index with the latest graph nodes.
 * Uses content hashing to only generate embeddings for new or modified nodes.
 */
export async function syncGraphVectors(projectId: string, nodes: CanvasNode[]): Promise<{
  indexedCount: number;
  skippedCount: number;
  deletedCount: number;
}> {
  ensureVectorStore();
  const db = getDb();

  const validNodes = nodes.filter(n => n.id && n.title);
  const activeIds = new Set(validNodes.map(n => n.id));

  // 1. Check existing embeddings
  const existingRows = db.prepare<[string], { nodeId: string; contentHash: string }>(
    'SELECT nodeId, contentHash FROM node_embeddings WHERE projectId = ?'
  ).all(projectId);
  const existingMap = new Map(existingRows.map(r => [r.nodeId, r.contentHash]));

  // 2. Find deleted nodes
  const toDelete = existingRows.filter(r => !activeIds.has(r.nodeId));
  if (toDelete.length > 0) {
    const delMeta = db.prepare('DELETE FROM node_embeddings WHERE projectId = ? AND nodeId = ?');
    const delFts = db.prepare('DELETE FROM nodes_fts WHERE node_key = ?');
    const delVec = db.prepare('DELETE FROM vec_nodes WHERE node_key = ?');

    db.transaction(() => {
      for (const item of toDelete) {
        const key = `${projectId}:${item.nodeId}`;
        delMeta.run(projectId, item.nodeId);
        try { delFts.run(key); } catch {}
        try { delVec.run(key); } catch {}
      }
    })();
  }

  // 3. Find modified or new nodes
  const needsEmbedding: Array<{ id: string; text: string; contentHash: string; node: CanvasNode }> = [];
  let skippedCount = 0;

  for (const node of validNodes) {
    const text = getNodeText(node);
    const hash = computeContentHash(text);
    if (existingMap.get(node.id) === hash) {
      skippedCount++;
    } else {
      needsEmbedding.push({ id: node.id, text, contentHash: hash, node });
    }
  }

  if (needsEmbedding.length === 0) {
    return { indexedCount: 0, skippedCount, deletedCount: toDelete.length };
  }

  // 4. Batch generate embeddings for changed nodes
  try {
    const embeddings = await getBatchEmbeddings(
      needsEmbedding.map(n => ({ id: n.id, text: n.text, contentHash: n.contentHash }))
    );

    const upsertMeta = db.prepare(`
      INSERT OR REPLACE INTO node_embeddings (projectId, nodeId, contentHash, provider, dimensions, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const delFts = db.prepare('DELETE FROM nodes_fts WHERE node_key = ?');
    const insertFts = db.prepare(`
      INSERT INTO nodes_fts (node_key, projectId, nodeId, title, content, nodeType)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const delVec = db.prepare('DELETE FROM vec_nodes WHERE node_key = ?');
    const insertVec = db.prepare(`
      INSERT INTO vec_nodes (node_key, embedding)
      VALUES (?, ?)
    `);

    const now = Date.now();
    const nodeMap = new Map(needsEmbedding.map(item => [item.id, item.node]));

    db.transaction(() => {
      for (const item of embeddings) {
        const key = `${projectId}:${item.nodeId}`;
        const node = nodeMap.get(item.nodeId);
        if (!node) continue;

        upsertMeta.run(projectId, item.nodeId, item.contentHash, item.provider, EMBEDDING_DIMENSION, now);

        try { delFts.run(key); } catch {}
        try {
          insertFts.run(key, projectId, item.nodeId, node.title, node.content || '', node.type);
        } catch {}

        try { delVec.run(key); } catch {}
        try {
          insertVec.run(key, item.embedding);
        } catch (err) {
          console.error('Failed to insert into vec_nodes:', err);
        }
      }
    })();

    return { indexedCount: embeddings.length, skippedCount, deletedCount: toDelete.length };
  } catch (err) {
    console.warn('Embedding generation skipped during sync:', err instanceof Error ? err.message : err);
    return { indexedCount: 0, skippedCount, deletedCount: toDelete.length };
  }
}

/**
 * Hybrid Search combining dense vector cosine similarity and sparse BM25 (FTS5)
 * using Reciprocal Rank Fusion (RRF).
 */
export async function hybridSearch(
  projectId: string,
  query: string,
  topK = 10
): Promise<HybridSearchResult[]> {
  ensureVectorStore();
  const db = getDb();
  const denseRanks = new Map<string, number>();
  const sparseRanks = new Map<string, number>();

  // 1. Dense Vector Search (sqlite-vec KNN)
  try {
    const { embedding } = await getQueryEmbedding(query);
    // Request up to topK * 4 candidates to account for other projects
    const vecRows = db.prepare<[Float32Array, number], { node_key: string; distance: number }>(`
      SELECT node_key, distance
      FROM vec_nodes
      WHERE embedding MATCH ? AND k = ?
    `).all(embedding, topK * 4);

    let rank = 1;
    for (const row of vecRows) {
      if (row.node_key.startsWith(`${projectId}:`)) {
        const nodeId = row.node_key.slice(projectId.length + 1);
        denseRanks.set(nodeId, rank++);
        if (rank > topK * 2) break;
      }
    }
  } catch (err) {
    console.warn('Dense vector search step failed or unconfigured:', err instanceof Error ? err.message : err);
  }

  // 2. Sparse Lexical Search (FTS5 BM25)
  try {
    // Sanitize query for FTS5 tokens
    const tokens = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 1);

    if (tokens.length > 0) {
      const ftsQuery = tokens.map(t => `"${t}"*`).join(' OR ');
      const ftsRows = db.prepare<[string, string, number], { nodeId: string; rank: number }>(`
        SELECT nodeId, rank
        FROM nodes_fts
        WHERE nodes_fts MATCH ? AND projectId = ?
        ORDER BY rank
        LIMIT ?
      `).all(ftsQuery, projectId, topK * 2);

      let rank = 1;
      for (const row of ftsRows) {
        sparseRanks.set(row.nodeId, rank++);
      }
    }
  } catch (err) {
    console.warn('Sparse lexical search step failed:', err instanceof Error ? err.message : err);
  }

  // 3. Reciprocal Rank Fusion (RRF) with constant k=60
  const RRF_K = 60;
  const allNodeIds = new Set([...denseRanks.keys(), ...sparseRanks.keys()]);
  const results: HybridSearchResult[] = [];

  for (const nodeId of allNodeIds) {
    const dRank = denseRanks.get(nodeId) ?? null;
    const sRank = sparseRanks.get(nodeId) ?? null;

    let rrfScore = 0;
    if (dRank !== null) {
      rrfScore += 1 / (RRF_K + dRank);
    }
    if (sRank !== null) {
      rrfScore += 1 / (RRF_K + sRank);
    }

    results.push({
      nodeId,
      rrfScore,
      denseRank: dRank,
      sparseRank: sRank
    });
  }

  results.sort((a, b) => b.rrfScore - a.rrfScore);
  return results.slice(0, topK);
}
