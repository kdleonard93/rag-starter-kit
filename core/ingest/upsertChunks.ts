import { createHash } from 'node:crypto';
import type { Collection, Metadata } from 'chromadb';
import type { Document } from '@langchain/core/documents';

export function chunkId(source: string, chunkIndex: number, text: string): string {
  return createHash('sha256')
    .update(`${source}:${chunkIndex}:${text}`)
    .digest('hex');
}

// Chroma only stores flat scalar metadata. LangChain loaders attach nested
// objects (e.g. `loc`), so scalars pass through and objects are JSON-stringified.
function toChromaMetadata(metadata: Document['metadata']): Metadata {
  const out: Metadata = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

export async function upsertChunks(collection: Collection, chunks: Document[]): Promise<void> {
  await collection.upsert({
    ids: chunks.map((c, i) => chunkId(c.metadata?.source ?? 'unknown', i, c.pageContent)),
    documents: chunks.map((c) => c.pageContent),
    metadatas: chunks.map((c) => toChromaMetadata(c.metadata)),
  });
}