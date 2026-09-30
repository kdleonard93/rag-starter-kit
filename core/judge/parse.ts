/**
 * Parsers for judge output. No model is involved, so these are the parts worth
 * testing directly (see `evals/judge.ts`).
 *
 * The judge is asked for a one-line answer that is exactly one of a fixed set of
 * options. These parsers enforce that: they tolerate the cosmetic noise models
 * add (markdown emphasis, a trailing period, a trailing explanation on the next
 * line) but reject prose. "ANSWERABLE" parses; "The answer is ANSWERABLE" does
 * not, because accepting prose here would put us back where we started — a model
 * deciding by writing sentences.
 */

/**
 * Reduce a reply to letters and digits, with every run of separators collapsed
 * to a single underscore. This is what makes "not answerable", "NOT-ANSWERABLE"
 * and "NOT_ANSWERABLE" the same answer without also accepting prose: the whole
 * line must still match an option, so a sentence stays a sentence.
 */
function canonical(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** The first non-empty line, which is the only line the judge is asked for. */
function firstLine(raw: string): string | null {
  return raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? null;
}

/**
 * Map a judge reply onto one of `options`, or `null` when it is not exactly one
 * of them. The comparison is case-insensitive, on the first non-empty line.
 */
export function parseChoice(raw: string, options: readonly string[]): string | null {
  const line = firstLine(raw);
  if (line === null) return null;

  const answer = canonical(line);
  if (!answer) return null;

  return options.find((o) => canonical(o) === answer) ?? null;
}

const NONE_WORDS = /^(NONE|NO|NOTHING|N_A|NIL)$/;

/**
 * Parse a judge reply that names a set of 1-based item numbers, e.g. "1, 3".
 * `NONE` (and its synonyms) mean the empty set. Anything malformed — prose, a
 * non-numeric token, a number outside 1..max — returns `null`, which callers
 * treat as "unparsed" and fail open on.
 */
export function parseIndexList(raw: string, max: number): number[] | null {
  const line = firstLine(raw);
  if (line === null) return null;

  const answer = canonical(line);
  if (!answer) return null;
  if (NONE_WORDS.test(answer)) return [];

  const parts = line.replace(/[[\]()]/g, ' ').split(/[,;\s]+/).filter(Boolean);
  const numbers: number[] = [];

  for (const part of parts) {
    // Tolerate a trailing period or a leading bracket; reject anything else
    // non-numeric, so "Item 1" and "1.5" are unparsed rather than guessed at.
    const token = part.replace(/^[^0-9]+/, '').replace(/[^0-9]+$/, '');
    if (!/^\d+$/.test(token)) return null;

    const n = Number(token);
    if (n < 1 || n > max) return null;
    numbers.push(n);
  }

  return [...new Set(numbers)].sort((a, b) => a - b);
}
