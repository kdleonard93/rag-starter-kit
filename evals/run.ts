import questions from './questions.json';
import cfg from '../core/config';
import { getCollection } from '../core/store/vectorStore';
import { retrieve } from '../core/retrieve/retriever';
import { answer } from '../core/generate/chain';

type Result = { q: string; pass: boolean; why: string };

async function run() {
  const results: Result[] = [];
  const collection = await getCollection(cfg);

  for (const q of questions) {
    const chunks = await retrieve(collection, q.question);
    const { text, citations } = await answer(cfg, q.question, chunks);

    let pass = true;
    const whys: string[] = [];

    if (q.mustRefuse) {
      pass = text.includes("I don't have that information");
      if (!pass) whys.push('expected refusal, got answer');
    } else {
      for (const term of q.mustContain ?? []) {
        if (!text.includes(term)) { pass = false; whys.push(`missing "${term}"`); }
      }
      if (q.mustCiteSource) {
        const cited = citations?.some((c) => c.source.includes(q.mustCiteSource));
        if (!cited) { pass = false; whys.push(`did not cite ${q.mustCiteSource}`); }
      }
    }

    results.push({ q: q.question, pass, why: whys.join('; ') || 'ok' });
  }

  const score = results.filter((r) => r.pass).length / results.length;
  console.table(results);
  console.log(`\nGrounded-answer score: ${(score * 100).toFixed(1)}%`);
}

run();
