import { createHash } from 'node:crypto';
import type { Collection, Metadata } from 'chromadb';
import type { Document } from '@langchain/core/documents';

// Index is per-source, not global, so re-ingesting unchanged documents yields
// identical IDs even when another document's chunk count changes.
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
  const bySource = new Map<string, Document[]>();
  for (const chunk of chunks) {
    const source = chunk.metadata?.source ?? 'unknown';
    const group = bySource.get(source);
    if (group) group.push(chunk);
    else bySource.set(source, [chunk]);
  }

  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Metadata[] = [];
  for (const [source, group] of bySource) {
    group.forEach((chunk, i) => {
      ids.push(chunkId(source, i, chunk.pageContent));
      documents.push(chunk.pageContent);
      metadatas.push(toChromaMetadata(chunk.metadata));
    });
  }

  // Upsert alone never removes anything, so edited or deleted documents would
  // leave stale chunks in the collection forever. Delete IDs that the new
  // ingestion no longer produces before writing the current set.
  const existing = await collection.get({ include: [] });
  const currentIds = new Set(ids);
  const staleIds = existing.ids.filter((id) => !currentIds.has(id));
  if (staleIds.length > 0) {
    await collection.delete({ ids: staleIds });
  }

  await collection.upsert({ ids, documents, metadatas });
}