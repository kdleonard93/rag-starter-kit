import type { RagConfig } from '../config.js';
import type { RetrievedChunk } from '../retrieve/retriever.js';
import { buildNumberedContext } from '../generate/chain.js';
import { buildJudgeBackend } from './backends.js';

export type Answerability = 'answerable' | 'not_answerable' | 'unknown';

export interface Verdict<T> {
  verdict: T;
  /** False when the judge's reply did not parse — the verdict is then a default. */
  parsed: boolean;
  /** The judge's raw reply, kept so a parse failure is diagnosable. */
  raw: string;
  backend: string;
}

export interface Claim {
  text: string;
  /** The context item this sentence cites, or null when it cites nothing. */
  n: number | null;
}

export interface GroundingResult extends Verdict<Claim[]> {
  /** Every claim considered, so callers can see what was and was not checked. */
  claims: Claim[];
}

const CITE_RE = /\[(\d+)\]/g;

/**
 * Split an answer into sentences, each with the citation it carries.
 *
 * `answer()` guarantees every citation number resolves to a retrieved chunk, so
 * `n` can be used as a direct index into the chunks array (`chunks[n - 1]`).
 */
export function segmentClaims(text: string): Claim[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sentence) => {
      const match = sentence.match(CITE_RE);
      return {
        text: sentence,
        n: match ? Number(match[0].replace(/\D/g, '')) : null,
      };
    });
}

/**
 * The gate is asked about the question's *subject*, never about whether the
 * context states the particular fact it asks for.
 *
 * That scope is measured, not assumed. A rubric that asked "does the context
 * state the fact asked for?" refused 3 of 7 questions this corpus clearly
 * answers — "What is RAG?" among them — and that failure held across three quite
 * different wordings of the same mandate, so the fault was the mandate rather
 * than its phrasing. Asking only "is the context about this subject at all?"
 * refused 9 of 9 out-of-domain questions and allowed 7 of 7 in-domain ones.
 *
 * Whether the specific fact is present is the answer prompt's job, and it does
 * it reliably: the questions this corpus covers but does not answer are refused
 * by rule 2 in `core/generate/chain.ts`.
 */
export const ANSWERABILITY_INSTRUCTIONS = `You decide one thing only: whether the retrieved context is about the question's subject at all. You never answer the question, and you never judge whether the context contains the particular fact it asks for.

ANSWERABLE: at least one context item is about the same subject as the question — the same organisation, product, feature or topic — even if that item does not state the fact asked for, and even if the question's wording differs.
NOT_ANSWERABLE: no context item is about the question's subject at all; the context is about entirely different things.

Examples:
- "How much do they charge?" over a context item giving pricing for one of the organisation's services: ANSWERABLE.
- "Is the company an LLC?" over context items about the company that never mention its legal form: ANSWERABLE. The subject matches; the missing fact is not your concern.
- "What is the capital of France?" over context items about an unrelated product: NOT_ANSWERABLE.
- "How many calories does a butter burger have?" over an unrelated product's documentation: NOT_ANSWERABLE.`;

/**
 * Measured behaviour on this corpus, worth knowing before trusting a verdict:
 * it flags invented figures, it misses a correctly quoted figure attached to the
 * wrong product when the cited chunk contains both facts, and it can flag a
 * faithful paraphrase. Three alternative wordings, including one stating the
 * attachment rule outright, changed none of that — so the rubric is kept simple
 * rather than padded with clauses that do nothing.
 *
 * The pattern is the same one behind ANSWERABILITY_INSTRUCTIONS: this model's
 * judgement is literal-match-shaped. Topic-level calls it gets right;
 * paraphrase-sensitive ones it does not. Hence `flag` mode — it advises, and
 * never edits the answer.
 */
export const GROUNDING_INSTRUCTIONS = `Each numbered item below is one sentence from an answer, followed by the context that sentence cites. You decide which sentences are NOT supported by their own cited context. You never rewrite them.

A sentence is unsupported when its numbers, names or claims do not appear in — and are not implied by — the context it cites. A figure that is quoted correctly but attached to the wrong product or service is unsupported.
A sentence that restates or paraphrases its own cited context is supported.`;

export const ANSWERABILITY_OPTIONS = ['ANSWERABLE', 'NOT_ANSWERABLE'] as const;

/**
 * Decide whether the retrieved context is about the question's subject at all,
 * before spending a generation on it.
 *
 * Scope is deliberately narrow: only a subject mismatch refuses here. Whether
 * the context states the *specific fact* asked for is left to the answer
 * prompt's own refusal rule, because a judge asked about fact-presence refused
 * legitimate in-domain questions (see ANSWERABILITY_INSTRUCTIONS above).
 *
 * The call exists at all because judgement smuggled into the answer prompt as
 * prose is unreliable: the same question and context once produced a refusal
 * five times out of six. A separate call with a fixed set of options makes the
 * decision explicit, and `evals/` can assert it.
 */
export async function checkAnswerability(
  cfg: Pick<RagConfig, 'judge' | 'llm'>,
  question: string,
  chunks: RetrievedChunk[],
): Promise<Verdict<Answerability>> {
  const backend = buildJudgeBackend(cfg);
  const { numberedContext } = buildNumberedContext(chunks);

  try {
    const { raw, choice } = await backend.decide({
      instructions: ANSWERABILITY_INSTRUCTIONS,
      state: `Context:\n${numberedContext}\n\nQuestion: ${question}`,
      options: ANSWERABILITY_OPTIONS,
    });

    const verdict: Answerability =
      choice === 'ANSWERABLE'
        ? 'answerable'
        : choice === 'NOT_ANSWERABLE'
          ? 'not_answerable'
          : 'unknown';

    return { verdict, parsed: choice !== null, raw, backend: backend.name };
  } catch (err) {
    // Fail open: a broken judge must not refuse a question on the user's behalf.
    return { verdict: 'unknown', parsed: false, raw: String(err), backend: backend.name };
  }
}

/**
 * The material the grounding judge reads: each claim with the full text of the
 * chunk it cites. Exported so tests can drive the real prompt.
 */
export function groundingState(claims: Claim[], chunks: RetrievedChunk[]): string {
  return claims
    .map((c, i) => `[${i + 1}] Sentence: ${c.text}\nContext it cites:\n${chunks[c.n! - 1].pageContent}`)
    .join('\n\n');
}

/**
 * Decide which sentences of a generated answer are not supported by the chunk
 * they cite.
 *
 * `answer()` in `core/generate/chain.ts` validates only that a citation *number*
 * resolves to a chunk — never that the claim matches it, so a correctly quoted
 * figure attached to the wrong product passes today. This closes that gap.
 */
export async function checkGroundedness(
  cfg: Pick<RagConfig, 'judge' | 'llm'>,
  answerText: string,
  chunks: RetrievedChunk[],
): Promise<GroundingResult> {
  const backend = buildJudgeBackend(cfg);

  // Only sentences that cite a chunk can be checked against one.
  const claims = segmentClaims(answerText).filter(
    (c) => c.n !== null && c.n >= 1 && c.n <= chunks.length,
  );

  if (claims.length === 0) {
    return { verdict: [], claims, parsed: true, raw: '', backend: backend.name };
  }

  try {
    const state = groundingState(claims, chunks);
    const { raw, indices } = await backend.decideIndexList({
      instructions: GROUNDING_INSTRUCTIONS,
      state,
      max: claims.length,
    });

    if (indices === null) {
      return { verdict: [], claims, parsed: false, raw, backend: backend.name };
    }

    return {
      verdict: indices.map((i) => claims[i - 1]),
      claims,
      parsed: true,
      raw,
      backend: backend.name,
    };
  } catch (err) {
    return { verdict: [], claims, parsed: false, raw: String(err), backend: backend.name };
  }
}
