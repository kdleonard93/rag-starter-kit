import { OllamaEmbeddingFunction } from '@chroma-core/ollama';
import type { RagConfig } from '../config.js';

export function createEmbedder(cfg: Pick<RagConfig, 'embeddings'>) {
  return new OllamaEmbeddingFunction({
    model: cfg.embeddings.model,
    url: cfg.embeddings.baseUrl,
  });
}