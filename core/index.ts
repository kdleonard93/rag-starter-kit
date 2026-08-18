import cfg from './config.js';
import { loadDocs } from './ingest/loadDocs.js';
import { chunkDocs } from './ingest/chunkDocs.js';
import { upsertChunks } from './ingest/upsertChunks.js';
import { getCollection } from './store/vectorStore.js';
import { retrieve } from './retrieve/retriever.js';
import { generate } from './generate/chain.js';

const QUESTION = 'Give me a summary of Digital Dopamine.';

async function main() {
  // 1. Load
  const docs = await loadDocs(cfg.sources);
  console.log(`1. Documents Loaded: ${docs.length} document(s) found.`);

  // 2. Chunk
  const chunks = await chunkDocs(docs, cfg);
  console.log(`2. Documents Chunked: Split into ${chunks.length} total chunk(s).`);

  // 3. Embed & store
  const collection = await getCollection(cfg);
  await upsertChunks(collection, chunks);
  console.log(`3. Chunks Embedded & Stored: ${chunks.length} chunk(s) upserted into Chroma.`);

  // 4. Retrieve
  const results = await retrieve(collection, QUESTION, 3);
  console.log(`4. Retrieved Chunks for question: "${QUESTION}"`);
  console.log('--------------------------------------------------');
  results.forEach((r, i) => {
    console.log(`\n--- Chunk ${i + 1} (Source: ${r.metadata?.source ?? 'unknown'}) ---`);
    console.log(r.pageContent);
  });
  console.log('\n--------------------------------------------------');

  // 5. Generate
  console.log('5. Generating answer... \n');
  const answer = await generate(cfg, QUESTION, results);
  console.log("Model's Answer:");
  console.log(answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});