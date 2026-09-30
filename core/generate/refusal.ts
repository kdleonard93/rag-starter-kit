/**
 * The single source of truth for the refusal string.
 *
 * It is used twice: interpolated into the answer prompt in `chain.ts` (so the
 * model knows what to emit), and returned directly by the answerability gate in
 * `core/judge/judge.ts` (so an out-of-scope question can be refused without
 * spending a generation). Keeping one copy means the two paths cannot drift
 * apart and start refusing in different words.
 */
export const REFUSAL = "I don't have that information in the provided documents.";

/** True when `text` is (or contains) the refusal, for callers that need to test. */
export function isRefusal(text: string): boolean {
  return text.includes("I don't have that information");
}
