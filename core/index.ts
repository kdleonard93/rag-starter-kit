import cfg from './config.js';
import { runIngestion } from './ingest/runIngestion.js';
import { getCollection } from './store/vectorStore.js';
import { retrieve } from './retrieve/retriever.js';
import { generate } from './generate/chain.js';

const QUESTION = 'Give me a summary of Digital Dopamine.';

async function main() {
  // Load, chunk, embed & store — shared with /api/admin/reindex
  const chunksCount = await runIngestion();
  console.log(`1–3. Ingested ${chunksCount} chunk(s) into Chroma.`);

  // Retrieve
  const collection = await getCollection(cfg);
  const results = await retrieve(collection, QUESTION, 3);
  console.log(`4. Retrieved Chunks for question: "${QUESTION}"`);
  console.log('--------------------------------------------------');
  results.forEach((r, i) => {
    console.log(`\n--- Chunk ${i + 1} (Source: ${r.metadata?.source ?? 'unknown'}) ---`);
    console.log(r.pageContent);
  });
  console.log('\n--------------------------------------------------');

  // Generate
  console.log('5. Generating answer... \n');
  const answer = await generate(cfg, QUESTION, results);
  console.log("Model's Answer:");
  console.log(answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
