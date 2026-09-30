import { neon } from '@neondatabase/serverless';
import { EMBEDDING_DIMENSION, type EmbeddingProvider } from './embeddings.ts';
import type { IndexStateRow, SearchIndexBackend } from './vector-store.ts';

/**
 * Postgres search index for Neon mode: tsvector for keyword search and pgvector
 * for dense search, stored next to the graph so it survives cold starts.
 * If the pgvector extension is unavailable, keyword search still works.
 */

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
  if (!url) throw new Error('Neon database connection string is not set.');
  return neon(url);
}

let schemaPromise: Promise<boolean> | null = null;

/** Creates the index table; resolves to whether pgvector is available. Mirrors scripts/schema-postgres.sql. */
function ensureSchema(): Promise<boolean> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS node_search_index (
          project_id VARCHAR(128) NOT NULL,
          node_id VARCHAR(128) NOT NULL,
          text_hash CHAR(64) NOT NULL,
          embedding_hash CHAR(64),
          provider VARCHAR(16),
          title TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          node_type VARCHAR(32) NOT NULL,
          search TSVECTOR GENERATED ALWAYS AS (
            setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(body, '')), 'B')
          ) STORED,
          updated_at BIGINT NOT NULL,
          PRIMARY KEY (project_id, node_id)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_node_search_index_fts ON node_search_index USING GIN (search)`;
      try {
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;
        await sql.query(`ALTER TABLE node_search_index ADD COLUMN IF NOT EXISTS embedding vector(${EMBEDDING_DIMENSION})`);
        return true;
      } catch (err) {
        console.warn('pgvector unavailable; search index will use keyword search only:', err instanceof Error ? err.message : err);
        return false;
      }
    })().catch(err => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function toVectorLiteral(embedding: Float32Array): string {
  return `[${Array.from(embedding).join(',')}]`;
}

export const neonSearchIndex: SearchIndexBackend = {
  async listIndexState(projectId) {
    await ensureSchema();
    const rows = await getSql()`
      SELECT node_id, text_hash, embedding_hash, provider
      FROM node_search_index WHERE project_id = ${projectId}
    `;
    return rows.map((r): IndexStateRow => ({
      nodeId: String(r.node_id),
      textHash: String(r.text_hash),
      embeddingHash: r.embedding_hash ? String(r.embedding_hash) : null,
      provider: (r.provider as EmbeddingProvider | null) ?? null
    }));
  },

  async listEmbeddingProviders(projectId) {
    if (!(await ensureSchema())) return [];
    const rows = await getSql()`
      SELECT DISTINCT provider FROM node_search_index
      WHERE project_id = ${projectId} AND provider IS NOT NULL
    `;
    return rows.map(r => r.provider as EmbeddingProvider);
  },

  async deleteNodes(projectId, nodeIds) {
    await ensureSchema();
    await getSql()`
      DELETE FROM node_search_index WHERE project_id = ${projectId} AND node_id = ANY(${nodeIds})
    `;
  },

  async upsertKeywordDocuments(projectId, docs) {
    await ensureSchema();
    const sql = getSql();
    const now = Date.now();
    await sql.transaction(docs.map(doc => sql`
      INSERT INTO node_search_index (project_id, node_id, text_hash, title, body, node_type, updated_at)
      VALUES (${projectId}, ${doc.nodeId}, ${doc.textHash}, ${doc.title}, ${doc.body}, ${doc.nodeType}, ${now})
      ON CONFLICT (project_id, node_id) DO UPDATE SET
        text_hash = EXCLUDED.text_hash,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        node_type = EXCLUDED.node_type,
        updated_at = EXCLUDED.updated_at
    `));
  },

  async saveEmbeddings(projectId, embeddings) {
    if (!(await ensureSchema())) return false;
    const sql = getSql();
    const now = Date.now();
    await sql.transaction(embeddings.map(item => sql`
      UPDATE node_search_index SET
        embedding = ${toVectorLiteral(item.embedding)}::vector,
        embedding_hash = ${item.contentHash},
        provider = ${item.provider},
        updated_at = ${now}
      WHERE project_id = ${projectId} AND node_id = ${item.nodeId}
    `));
    return true;
  },

  async denseSearch(projectId, provider, embedding, k) {
    if (!(await ensureSchema())) return [];
    const rows = await getSql()`
      SELECT node_id FROM node_search_index
      WHERE project_id = ${projectId} AND provider = ${provider} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${toVectorLiteral(embedding)}::vector
      LIMIT ${k}
    `;
    return rows.map(r => String(r.node_id));
  },

  async sparseSearch(projectId, tokens, k) {
    await ensureSchema();
    const tsQuery = tokens.map(t => `${t}:*`).join(' | ');
    const rows = await getSql()`
      SELECT node_id FROM node_search_index
      WHERE project_id = ${projectId} AND search @@ to_tsquery('simple', ${tsQuery})
      ORDER BY ts_rank(search, to_tsquery('simple', ${tsQuery})) DESC
      LIMIT ${k}
    `;
    return rows.map(r => String(r.node_id));
  }
};
