/**
 * Model-free tests for the judge parsers.
 *
 * These are the parts of the judge that break silently: a parser that accepts
 * prose puts the judgement back into the model's own words, which is the exact
 * failure the gate exists to remove. Run with `pnpm eval:judge`.
 */
import { parseChoice, parseIndexList } from '../core/judge/parse.js';

type Case<T> = { input: string; expected: T; why: string };

// The judge is offered word options, not letters: `gemma4:12b` carries a bias
// against the letter "B" that survives a change of rubric, so A/B options make it
// refuse answerable questions. See "The judge" in the README.
const CHOICE_OPTIONS = ['ANSWERABLE', 'NOT_ANSWERABLE'] as const;

const CHOICE_CASES: Case<string | null>[] = [
  { input: 'ANSWERABLE', expected: 'ANSWERABLE', why: 'the happy path' },
  { input: 'answerable', expected: 'ANSWERABLE', why: 'case-insensitive' },
  { input: 'NOT_ANSWERABLE', expected: 'NOT_ANSWERABLE', why: 'the other option' },
  { input: 'not answerable', expected: 'NOT_ANSWERABLE', why: 'spaces instead of underscores' },
  { input: 'Not-Answerable', expected: 'NOT_ANSWERABLE', why: 'hyphens instead of underscores' },
  { input: ' ANSWERABLE \n', expected: 'ANSWERABLE', why: 'surrounding whitespace' },
  { input: 'ANSWERABLE.', expected: 'ANSWERABLE', why: 'trailing period' },
  { input: '**ANSWERABLE**', expected: 'ANSWERABLE', why: 'markdown emphasis' },
  { input: '"ANSWERABLE"', expected: 'ANSWERABLE', why: 'quoted' },
  { input: 'ANSWERABLE\nbecause the context lists pricing.', expected: 'ANSWERABLE', why: 'trailing explanation on its own line' },
  { input: 'ANSWERABLE. Because the context lists pricing.', expected: null, why: 'prose on the answer line is rejected' },
  { input: 'The answer is ANSWERABLE', expected: null, why: 'prose is rejected, not searched for an option' },
  { input: 'Answer: ANSWERABLE', expected: null, why: 'a labelled answer is still prose' },
  { input: 'ANSWERABLENOT_ANSWERABLE', expected: null, why: 'two options is not one option' },
  { input: '', expected: null, why: 'empty reply' },
  { input: '   \n  ', expected: null, why: 'whitespace-only reply' },
  { input: 'I cannot determine', expected: null, why: 'a refusal is not an option' },
  { input: 'MAYBE', expected: null, why: 'an option that was never offered' },
];

const INDEX_CASES: Case<number[] | null>[] = [
  { input: 'NONE', expected: [], why: 'nothing unsupported' },
  { input: 'none\n', expected: [], why: 'nothing unsupported, lowercase' },
  { input: 'NONE.', expected: [], why: 'nothing unsupported, trailing period' },
  { input: 'N/A', expected: [], why: 'nothing unsupported, said another way' },
  { input: '1', expected: [1], why: 'a single item' },
  { input: '1, 3', expected: [1, 3], why: 'a list' },
  { input: '1,3', expected: [1, 3], why: 'no space after the comma' },
  { input: '[1, 3]', expected: [1, 3], why: 'bracketed' },
  { input: '1. 3.', expected: [1, 3], why: 'a numbered list' },
  { input: '3, 1, 1', expected: [1, 3], why: 'deduped and sorted' },
  { input: '2\n', expected: [2], why: 'trailing newline' },
  { input: '1, 2 and 3', expected: null, why: 'prose between numbers is rejected' },
  { input: 'Item 1', expected: null, why: 'a labelled number is rejected' },
  { input: '1.5', expected: null, why: 'a non-integer is rejected, not split into two items' },
  { input: '0', expected: null, why: 'below the range' },
  { input: '4', expected: null, why: 'above the range (max is 3)' },
  { input: '', expected: null, why: 'empty reply' },
  { input: 'I do not know', expected: null, why: 'a refusal is not a list' },
];

function run() {
  const failures: string[] = [];
  let count = 0;

  for (const c of CHOICE_CASES) {
    count += 1;
    const actual = parseChoice(c.input, CHOICE_OPTIONS);
    if (JSON.stringify(actual) !== JSON.stringify(c.expected)) {
      failures.push(`parseChoice(${JSON.stringify(c.input)}) → ${JSON.stringify(actual)}, expected ${JSON.stringify(c.expected)} (${c.why})`);
    }
  }

  for (const c of INDEX_CASES) {
    count += 1;
    const actual = parseIndexList(c.input, 3);
    if (JSON.stringify(actual) !== JSON.stringify(c.expected)) {
      failures.push(`parseIndexList(${JSON.stringify(c.input)}) → ${JSON.stringify(actual)}, expected ${JSON.stringify(c.expected)} (${c.why})`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${count} parser cases failed:\n`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log(`\nJudge parsers: ${count}/${count} cases pass.`);
}

run();
