import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';
import type { RagConfig } from '../config.js';

export async function chunkDocs(docs: Document[], cfg: Pick<RagConfig, 'chunking'>) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: cfg.chunking.chunkSize,
    chunkOverlap: cfg.chunking.chunkOverlap,
  });
  return splitter.splitDocuments(docs);
}