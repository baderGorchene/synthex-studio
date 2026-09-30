import * as sqliteVec from 'sqlite-vec';
import { getDb } from '../db.ts';
import { EMBEDDING_DIMENSION, type EmbeddingProvider, type EmbeddingResult } from './embeddings.ts';
import type { IndexStateRow, KeywordDocument, SearchIndexBackend } from './vector-store.ts';

type SqliteDb = ReturnType<typeof getDb>;

let isVecLoaded = false;
// Tracks the connection the schema was prepared on; a backup restore swaps in a new one.
let readyDb: SqliteDb | null = null;

function nodeKey(projectId: string, nodeId: string) {
  return `${projectId}:${nodeId}`;
}

function ensureSchema() {
  const db = getDb();
  if (readyDb === db) return db;
  isVecLoaded = false;

  try {
    if (typeof sqliteVec?.load === 'function') {
      sqliteVec.load(db);
      isVecLoaded = true;
    }
  } catch (err) {
    console.warn('sqlite-vec native extension not loaded (serverless environment):', err instanceof Error ? err.message : err);
    isVecLoaded = false;
  }

  // Legacy layout mixed OpenAI and zero-padded Gemini vectors in one unpartitioned table.
  // The index is derived data, so drop it and let the next autosave rebuild it.
  const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_embeddings'").get();
  if (legacy) {
    db.exec('DROP TABLE node_embeddings');
    try { db.exec('DROP TABLE IF EXISTS vec_nodes'); } catch {}
    try { db.exec('DROP TABLE IF EXISTS nodes_fts'); } catch {}
  }

  // 1. Per-node index bookkeeping
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_search_index (
      projectId TEXT NOT NULL,
      nodeId TEXT NOT NULL,
      textHash TEXT NOT NULL,
      embeddingHash TEXT,
      provider TEXT,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (projectId, nodeId)
    );
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

  // 3. sqlite-vec table, partitioned by project and tagged with the embedding provider
  if (isVecLoaded) {
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_node_embeddings USING vec0(
          node_key TEXT PRIMARY KEY,
          projectId TEXT partition key,
          provider TEXT,
          embedding float[${EMBEDDING_DIMENSION}] distance_metric=cosine
        );
      `);
    } catch (err) {
      console.warn('Could not create vec_node_embeddings virtual table:', err);
      isVecLoaded = false;
    }
  }

  readyDb = db;
  return db;
}

export const sqliteSearchIndex: SearchIndexBackend = {
  async listIndexState(projectId) {
    const db = ensureSchema();
    return db.prepare<[string], IndexStateRow>(
      'SELECT nodeId, textHash, embeddingHash, provider FROM node_search_index WHERE projectId = ?'
    ).all(projectId);
  },

  async listEmbeddingProviders(projectId) {
    const db = ensureSchema();
    return db.prepare<[string], { provider: EmbeddingProvider }>(
      'SELECT DISTINCT provider FROM node_search_index WHERE projectId = ? AND provider IS NOT NULL'
    ).all(projectId).map(r => r.provider);
  },

  async deleteNodes(projectId, nodeIds) {
    const db = ensureSchema();
    const delMeta = db.prepare('DELETE FROM node_search_index WHERE projectId = ? AND nodeId = ?');
    const delFts = db.prepare('DELETE FROM nodes_fts WHERE node_key = ?');
    const delVec = isVecLoaded ? db.prepare('DELETE FROM vec_node_embeddings WHERE node_key = ?') : null;
    db.transaction(() => {
      for (const nodeId of nodeIds) {
        const key = nodeKey(projectId, nodeId);
        delMeta.run(projectId, nodeId);
        delFts.run(key);
        delVec?.run(key);
      }
    })();
  },

  async upsertKeywordDocuments(projectId, docs: KeywordDocument[]) {
    const db = ensureSchema();
    const upsertMeta = db.prepare(`
      INSERT INTO node_search_index (projectId, nodeId, textHash, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(projectId, nodeId) DO UPDATE SET textHash = excluded.textHash, updatedAt = excluded.updatedAt
    `);
    const delFts = db.prepare('DELETE FROM nodes_fts WHERE node_key = ?');
    const insertFts = db.prepare(`
      INSERT INTO nodes_fts (node_key, projectId, nodeId, title, content, nodeType)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    db.transaction(() => {
      for (const doc of docs) {
        const key = nodeKey(projectId, doc.nodeId);
        upsertMeta.run(projectId, doc.nodeId, doc.textHash, now);
        delFts.run(key);
        insertFts.run(key, projectId, doc.nodeId, doc.title, doc.body, doc.nodeType);
      }
    })();
  },

  async saveEmbeddings(projectId, embeddings: EmbeddingResult[]) {
    const db = ensureSchema();
    if (!isVecLoaded) return false;
    const updateMeta = db.prepare(
      'UPDATE node_search_index SET embeddingHash = ?, provider = ?, updatedAt = ? WHERE projectId = ? AND nodeId = ?'
    );
    const delVec = db.prepare('DELETE FROM vec_node_embeddings WHERE node_key = ?');
    const insertVec = db.prepare(
      'INSERT INTO vec_node_embeddings (node_key, projectId, provider, embedding) VALUES (?, ?, ?, ?)'
    );
    const now = Date.now();
    db.transaction(() => {
      for (const item of embeddings) {
        const key = nodeKey(projectId, item.nodeId);
        delVec.run(key);
        insertVec.run(key, projectId, item.provider, item.embedding);
        updateMeta.run(item.contentHash, item.provider, now, projectId, item.nodeId);
      }
    })();
    return true;
  },

  async denseSearch(projectId, provider, embedding, k) {
    const db = ensureSchema();
    if (!isVecLoaded) return [];
    const rows = db.prepare<[Float32Array, number, string, string], { node_key: string }>(`
      SELECT node_key
      FROM vec_node_embeddings
      WHERE embedding MATCH ? AND k = ? AND projectId = ? AND provider = ?
      ORDER BY distance
    `).all(embedding, k, projectId, provider);
    return rows.map(r => r.node_key.slice(projectId.length + 1));
  },

  async sparseSearch(projectId, tokens, k) {
    const db = ensureSchema();
    const ftsQuery = tokens.map(t => `"${t}"*`).join(' OR ');
    const rows = db.prepare<[string, string, number], { nodeId: string }>(`
      SELECT nodeId
      FROM nodes_fts
      WHERE nodes_fts MATCH ? AND projectId = ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, projectId, k);
    return rows.map(r => r.nodeId);
  }
};
