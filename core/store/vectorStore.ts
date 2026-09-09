import { ChromaClient, type Collection } from 'chromadb';
import { OllamaEmbeddingFunction } from '@chroma-core/ollama';
import type { RagConfig } from '../config.js';

export async function getCollection(cfg: Pick<RagConfig, 'vectorStore' | 'embeddings'>): Promise<Collection> {
  const url = new URL(cfg.vectorStore.url ?? 'http://localhost:8000');
  // Number('') is 0, which would override chromadb's default port — fall back
  // to the scheme default for URLs without an explicit port.
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
  const client = new ChromaClient({ host: url.hostname, port, ssl: url.protocol === 'https:' });

  // idempotent: safe to call every run — no "already exists" errors
  return client.getOrCreateCollection({
    name: cfg.vectorStore.collection,
    embeddingFunction: new OllamaEmbeddingFunction({
      model: cfg.embeddings.model,
      url: cfg.embeddings.baseUrl,
    }),
  });
}
