import crypto from 'crypto';

export interface EmbeddingResult {
  nodeId: string;
  embedding: Float32Array;
  contentHash: string;
  provider: 'openai' | 'gemini';
}

export const EMBEDDING_DIMENSION = 1536;

function openAiKey(): string {
  return (process.env.OPENAI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim().replace(/^["']|["']$/g, '');
}

export function computeContentHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Generate 1536-dimensional vector embedding for a single text query using OpenAI text-embedding-3-small,
 * with automatic fallback to Gemini text-embedding-004 (normalized & padded to 1536d) if OpenAI is unavailable or fails.
 */
export async function getQueryEmbedding(query: string): Promise<{
  embedding: Float32Array;
  provider: 'openai' | 'gemini';
}> {
  const oKey = openAiKey();
  const gKey = geminiKey();

  if (oKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${oKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: query
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const json = await response.json();
        const raw = json.data?.[0]?.embedding;
        if (Array.isArray(raw) && raw.length === EMBEDDING_DIMENSION) {
          return { embedding: new Float32Array(raw), provider: 'openai' };
        }
      }
      console.warn('OpenAI embedding failed with status:', response.status, 'Falling back to Gemini if available.');
    } catch (err) {
      console.warn('OpenAI embedding request error, falling back:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback to Gemini text-embedding-004 (Google AI Studio Free Tier)
  if (gKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': gKey
        },
        body: JSON.stringify({
          content: { parts: [{ text: query }] }
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const json = await response.json();
        const raw = json.embedding?.values;
        if (Array.isArray(raw)) {
          // Pad 768 to 1536 to maintain unified sqlite-vec table compatibility
          const padded = new Float32Array(EMBEDDING_DIMENSION);
          for (let i = 0; i < raw.length && i < EMBEDDING_DIMENSION; i++) {
            padded[i] = raw[i];
          }
          return { embedding: padded, provider: 'gemini' };
        }
      }
    } catch (err) {
      console.warn('Gemini embedding fallback error:', err instanceof Error ? err.message : err);
    }
  }

  throw new Error('NO_EMBEDDING_PROVIDER_AVAILABLE');
}

/**
 * Batch generate embeddings for multiple texts using OpenAI text-embedding-3-small,
 * falling back to Gemini text-embedding-004 if needed.
 */
export async function getBatchEmbeddings(
  items: Array<{ id: string; text: string; contentHash: string }>
): Promise<EmbeddingResult[]> {
  if (items.length === 0) return [];

  const oKey = openAiKey();
  const gKey = geminiKey();

  if (oKey) {
    try {
      // Chunk into batches of up to 16 items for fast, reliable serverless execution
      const batchSize = 16;
      const results: EmbeddingResult[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${oKey}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk.map(c => c.text)
          }),
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
          throw new Error(`OpenAI batch embedding HTTP ${response.status}`);
        }

        const json = await response.json();
        const rawList = json.data;
        if (!Array.isArray(rawList) || rawList.length !== chunk.length) {
          throw new Error('OpenAI batch embedding size mismatch');
        }

        for (let j = 0; j < chunk.length; j++) {
          const raw = rawList[j].embedding;
          results.push({
            nodeId: chunk[j].id,
            embedding: new Float32Array(raw),
            contentHash: chunk[j].contentHash,
            provider: 'openai'
          });
        }
      }

      return results;
    } catch (err) {
      console.warn('OpenAI batch embeddings failed, trying Gemini fallback:', err instanceof Error ? err.message : err);
    }
  }

  // Gemini Free Tier Fallback (text-embedding-004)
  if (gKey) {
    try {
      const results: EmbeddingResult[] = [];
      for (const item of items) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': gKey
          },
          body: JSON.stringify({
            content: { parts: [{ text: item.text }] }
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
          const json = await response.json();
          const raw = json.embedding?.values;
          if (Array.isArray(raw)) {
            const padded = new Float32Array(EMBEDDING_DIMENSION);
            for (let k = 0; k < raw.length && k < EMBEDDING_DIMENSION; k++) {
              padded[k] = raw[k];
            }
            results.push({
              nodeId: item.id,
              embedding: padded,
              contentHash: item.contentHash,
              provider: 'gemini'
            });
          }
        }
      }
      return results;
    } catch (err) {
      console.warn('Gemini batch embeddings fallback failed:', err instanceof Error ? err.message : err);
    }
  }

  throw new Error('NO_EMBEDDING_PROVIDER_AVAILABLE');
}
