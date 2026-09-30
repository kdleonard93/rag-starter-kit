import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import type { RagConfig } from '../config.js';
import { parseChoice, parseIndexList } from './parse.js';

export type JudgeBackendName = 'prompt' | 'systemone';

/** A question with a fixed set of allowed answers. */
export interface DecideArgs {
  /** What to decide and what each option means. Owned by `judge.ts`, not here. */
  instructions: string;
  /** The material being judged: retrieved context, the question, the claims. */
  state: string;
  /** The only answers allowed. The reply must be exactly one of these. */
  options: readonly string[];
}

/** A question whose answer is a set of 1-based item numbers. */
export interface ListArgs {
  instructions: string;
  state: string;
  /** Highest item number the judge may name. */
  max: number;
}

export interface JudgeResponse {
  raw: string;
  choice: string | null;
  backend: JudgeBackendName;
}

export interface IndexListResponse {
  raw: string;
  indices: number[] | null;
  backend: JudgeBackendName;
}

export interface JudgeBackend {
  name: JudgeBackendName;
  decide(args: DecideArgs): Promise<JudgeResponse>;
  decideIndexList(args: ListArgs): Promise<IndexListResponse>;
}

/** Flatten a message's content, which may be a string or an array of parts. */
function textOf(message: unknown): string {
  if (typeof message === 'string') return message;

  const content = (message as { content?: unknown } | null)?.content;
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        const text = (part as { text?: unknown } | null)?.text;
        return typeof text === 'string' ? text : '';
      })
      .join('');
  }

  return content === undefined || content === null ? String(message) : JSON.stringify(content);
}

const JUDGE_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', '{system}'],
  ['human', '{user}'],
]);

/**
 * Judge with a chat model, using the answer model that is already loaded.
 *
 * `model` and `numCtx` are load-time settings for Ollama: if either differs from
 * the values the answer model was loaded with, Ollama unloads the 8.4 GB model
 * and reloads it — on every question. They are therefore read from `llm.ollama`
 * rather than repeated here, so they cannot drift. Only request-time sampling
 * (temperature, numPredict, stop) is overridden.
 */
function promptBackend(cfg: Pick<RagConfig, 'judge' | 'llm'>): JudgeBackend {
  const judge = cfg.judge.prompt;
  const llm = cfg.llm.ollama;

  function build() {
    const model = new ChatOllama({
      model: llm.model,
      baseUrl: llm.baseUrl,
      numCtx: llm.numCtx,
      keepAlive: llm.keepAlive,
      numPredict: judge.numPredict,
      temperature: judge.temperature,
      stop: ['\n'],
      ...(llm.think === undefined ? {} : { think: llm.think }),
    });
    return JUDGE_PROMPT.pipe(model);
  }

  return {
    name: 'prompt',

    async decide({ instructions, state, options }: DecideArgs): Promise<JudgeResponse> {
      const user = `${state}\n\nReply with exactly one of: ${options.join(' or ')}. No other words, no punctuation.`;
      const raw = textOf(await build().invoke({ system: instructions, user }));
      return { raw, choice: parseChoice(raw, options), backend: 'prompt' };
    },

    async decideIndexList({ instructions, state, max }: ListArgs): Promise<IndexListResponse> {
      const user = `${state}\n\nReply with the numbers of those items, comma-separated, or exactly NONE. One line, no other words.`;
      const raw = textOf(await build().invoke({ system: instructions, user }));
      return { raw, indices: parseIndexList(raw, max), backend: 'prompt' };
    },
  };
}

/**
 * Judge with a decision model (Ollama's `/v1/systemone`, used by `nimble` and
 * `tev1`). Not active in the default config — it needs a second model resident
 * alongside the answer model, which does not fit in 24 GB, so it costs a model
 * swap per question.
 *
 * Ollama's JS library does not expose this endpoint, hence the plain `fetch`.
 */
function systemoneBackend(cfg: Pick<RagConfig, 'judge'>): JudgeBackend {
  const judge = cfg.judge.systemone;

  async function ask(
    state: string,
    questions: Record<string, unknown>,
  ): Promise<{ answers?: Record<string, { choice?: unknown; noul?: unknown }> }> {
    const res = await fetch(`${judge.baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: judge.model,
        state,
        questions,
        keep_alive: judge.keepAlive,
      }),
      signal: AbortSignal.timeout(judge.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`systemone request failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as { answers?: Record<string, { choice?: unknown; noul?: unknown }> };
  }

  return {
    name: 'systemone',

    async decide({ instructions, state, options }: DecideArgs): Promise<JudgeResponse> {
      const data = await ask(state, {
        q: { type: 'choice', instructions, options: [...options] },
      });

      const answer = data.answers?.q;
      const choice = typeof answer?.choice === 'string' ? answer.choice : null;

      return { raw: JSON.stringify(answer ?? null), choice, backend: 'systemone' };
    },

    async decideIndexList(): Promise<IndexListResponse> {
      throw new Error(
        'The systemone backend does not implement the groundedness job yet. ' +
        'Groundedness degrades to "unparsed" while judge.active is systemone.',
      );
    },
  };
}

export function buildJudgeBackend(cfg: Pick<RagConfig, 'judge' | 'llm'>): JudgeBackend {
  return cfg.judge.active === 'systemone' ? systemoneBackend(cfg) : promptBackend(cfg);
}
