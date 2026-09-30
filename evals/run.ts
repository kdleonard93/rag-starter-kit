import questions from './questions.json';
import cfg from '../core/config';
import { getCollection } from '../core/store/vectorStore';
import { retrieve } from '../core/retrieve/retriever';
import { answer } from '../core/generate/chain';
import { REFUSAL, isRefusal } from '../core/generate/refusal';
import { checkAnswerability } from '../core/judge/judge';

type Result = { q: string; pass: boolean; why: string };

async function run() {
  const results: Result[] = [];
  const collection = await getCollection(cfg);

  for (const q of questions) {
    const chunks = await retrieve(collection, q.question);

    // Same order as the chat route: gate on answerability, and only generate if
    // the gate allows it. This is what makes a refusal cheap.
    let gateVerdict = 'off';
    let gateRefused = false;

    if (cfg.judge.enabled && cfg.judge.answerability) {
      const gate = await checkAnswerability(cfg, q.question, chunks);
      gateVerdict = gate.verdict;
      gateRefused = gate.verdict === 'not_answerable';
    }

    let text: string;
    let citations: { source: string }[] = [];

    if (gateRefused) {
      text = REFUSAL;
    } else {
      const answered = await answer(cfg, q.question, chunks);
      text = answered.text;
      citations = answered.citations;
    }

    let pass = true;
    const whys: string[] = [];

    if (q.mustGate === 'refuse' && !gateRefused) {
      pass = false;
      whys.push(`expected the gate to refuse, it said "${gateVerdict}"`);
    }
    if (q.mustGate === 'answer' && gateRefused) {
      pass = false;
      whys.push('expected the gate to allow the question, it refused');
    }

    if (q.mustRefuse) {
      pass = isRefusal(text);
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
  console.log(`Answered: ${results.filter((r) => r.pass).length}/${results.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
