import crypto from 'crypto';

export type EmbeddingProvider = 'openai' | 'gemini';

export interface EmbeddingResult {
  nodeId: string;
  embedding: Float32Array;
  contentHash: string;
  provider: EmbeddingProvider;
}

/**
 * Both providers emit 1536-dimensional vectors so they fit one index schema.
 * Vectors from different providers live in different embedding spaces, so every
 * stored row is tagged with its provider and queries only compare like with like.
 */
export const EMBEDDING_DIMENSION = 1536;
export const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';

const GEMINI_EMBED_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}`;

function openAiKey(): string {
  return (process.env.OPENAI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function computeContentHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/** Providers that have an API key, in preference order. */
export function configuredEmbeddingProviders(): EmbeddingProvider[] {
  const providers: EmbeddingProvider[] = [];
  if (openAiKey()) providers.push('openai');
  if (geminiKey()) providers.push('gemini');
  return providers;
}

/** gemini-embedding-001 only returns unit vectors at its full 3072 dimensions; truncated outputs must be re-normalized. */
function normalize(values: number[]): Float32Array {
  const vector = new Float32Array(values);
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  }
  return vector;
}

async function openAiEmbed(texts: string[]): Promise<Float32Array[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey()}`
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: texts }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`OpenAI embedding HTTP ${response.status}`);

  const json = await response.json();
  const rows = json.data;
  if (!Array.isArray(rows) || rows.length !== texts.length) throw new Error('OpenAI embedding size mismatch');
  return rows.map((row: { embedding?: unknown }) => {
    if (!Array.isArray(row.embedding) || row.embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error('OpenAI embedding dimension mismatch');
    }
    return new Float32Array(row.embedding);
  });
}

async function geminiEmbed(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<Float32Array[]> {
  const response = await fetch(`${GEMINI_EMBED_BASE}:batchEmbedContents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey()
    },
    body: JSON.stringify({
      requests: texts.map(text => ({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSION
      }))
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Gemini embedding HTTP ${response.status}`);

  const json = await response.json();
  const rows = json.embeddings;
  if (!Array.isArray(rows) || rows.length !== texts.length) throw new Error('Gemini embedding size mismatch');
  return rows.map((row: { values?: unknown }) => {
    if (!Array.isArray(row.values) || row.values.length !== EMBEDDING_DIMENSION) {
      throw new Error('Gemini embedding dimension mismatch');
    }
    return normalize(row.values);
  });
}

/**
 * Embed a search query with one specific provider. The caller picks the provider
 * that produced the stored vectors it wants to compare against.
 */
export async function getQueryEmbedding(query: string, provider: EmbeddingProvider): Promise<Float32Array> {
  if (!configuredEmbeddingProviders().includes(provider)) {
    throw new Error(`EMBEDDING_PROVIDER_NOT_CONFIGURED_${provider}`);
  }
  const [embedding] = provider === 'openai'
    ? await openAiEmbed([query])
    : await geminiEmbed([query], 'RETRIEVAL_QUERY');
  return embedding;
}

/**
 * Batch-embed documents with the first configured provider that succeeds
 * (OpenAI text-embedding-3-small, then Gemini gemini-embedding-001).
 * A batch is embedded entirely by one provider.
 */
export async function getBatchEmbeddings(
  items: Array<{ id: string; text: string; contentHash: string }>
): Promise<EmbeddingResult[]> {
  if (items.length === 0) return [];

  const batchSize = 16;
  for (const provider of configuredEmbeddingProviders()) {
    try {
      const results: EmbeddingResult[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const vectors = provider === 'openai'
          ? await openAiEmbed(chunk.map(c => c.text))
          : await geminiEmbed(chunk.map(c => c.text), 'RETRIEVAL_DOCUMENT');
        chunk.forEach((item, j) => results.push({
          nodeId: item.id,
          embedding: vectors[j],
          contentHash: item.contentHash,
          provider
        }));
      }
      return results;
    } catch (err) {
      console.warn(`${provider} batch embeddings failed:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error('NO_EMBEDDING_PROVIDER_AVAILABLE');
}
