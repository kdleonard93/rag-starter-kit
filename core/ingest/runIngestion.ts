import cfg from '../config.js';
import { loadDocs } from './loadDocs.js';
import { chunkDocs } from './chunkDocs.js';
import { upsertChunks } from './upsertChunks.js';
import { getCollection } from '../store/vectorStore.js';

export async function runIngestion(): Promise<number> {
  const docs = await loadDocs(cfg.sources);
  const chunks = await chunkDocs(docs, cfg);
  const collection = await getCollection(cfg);
  await upsertChunks(collection, chunks);
  return chunks.length;
}