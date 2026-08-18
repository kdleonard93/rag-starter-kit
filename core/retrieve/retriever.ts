import type { Collection } from 'chromadb';

export interface RetrievedChunk {
  id: string;
  pageContent: string;
  metadata: Record<string, unknown> | null;
  distance?: number | null;
}

export async function retrieve(
  collection: Collection,
  question: string,
  k = 3,
): Promise<RetrievedChunk[]> {
  const result = await collection.query({
    queryTexts: [question],
    nResults: k,
  });

  const docs = result.documents[0] ?? [];
  const ids = result.ids[0] ?? [];
  const metas = result.metadatas[0] ?? [];
  const dists = result.distances?.[0] ?? [];

  return docs.map((doc, i) => ({
    id: ids[i],
    pageContent: doc ?? '',
    metadata: metas[i] ?? null,
    distance: dists[i] ?? null,
  }));
}