import { json } from '@sveltejs/kit';
import cfg from '$core/config';
import { getCollection } from '$core/store/vectorStore';
import { retrieve } from '$core/retrieve/retriever';
import { answer } from '$core/generate/chain';
import { REFUSAL } from '$core/generate/refusal';
import { checkAnswerability, checkGroundedness, type Claim } from '$core/judge/judge';

export async function POST({ request }) {
  const { question } = await request.json();

  const collection = await getCollection(cfg);
  const chunks = await retrieve(collection, question);

  // Answerability gate: refuse before spending a generation. A refusal here is a
  // decision made against a fixed set of options, not the answer prompt's guess.
  let answerability: { verdict: string; parsed: boolean; backend: string } | undefined;

  if (cfg.judge.enabled && cfg.judge.answerability) {
    const gate = await checkAnswerability(cfg, question, chunks);
    answerability = { verdict: gate.verdict, parsed: gate.parsed, backend: gate.backend };

    if (gate.verdict === 'not_answerable') {
      return json({ text: REFUSAL, citations: [], judge: { answerability } });
    }
  }

  const { text, citations } = await answer(cfg, question, chunks);

  // Groundedness: report the sentences whose own cited chunk does not support
  // them. Reported, never rewritten.
  let grounding: { unsupported: Claim[]; parsed: boolean; backend: string } | undefined;

  if (cfg.judge.enabled && cfg.judge.groundedness === 'flag') {
    const checked = await checkGroundedness(cfg, text, chunks);
    grounding = {
      unsupported: checked.verdict,
      parsed: checked.parsed,
      backend: checked.backend,
    };
  }

  return json({ text, citations, judge: { answerability, grounding } });
}
