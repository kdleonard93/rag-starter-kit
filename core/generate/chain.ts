import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatPromptValue } from '@langchain/core/prompt_values';
import { RunnableLambda } from '@langchain/core/runnables';
import { basename } from 'node:path';
import type { RagConfig } from '../config.js';
import type { RetrievedChunk } from '../retrieve/retriever.js';
import OpenAI from 'openai';

const PROMPT = ChatPromptTemplate.fromTemplate(`
  Rules:
  1. If the context contains the answer — even if the question's wording differs from the source wording (synonyms, paraphrases, related terms like "implementation" vs "integration", "cost" vs "charge", "price" vs "pricing") — answer it and cite every claim with [N].
  2. If the context genuinely does not address the question, respond ONLY with: "I don't have that information in the provided documents."
  3. Use the closest matching source. Do not combine unrelated facts to fabricate an answer.
  4. Every claim MUST end with a citation [N] referring to the numbered context item it comes from.


  Context (numbered):
  {numberedContext}

  Question: {question}

  Answer
`);

export interface Citation {
  n: number;
  source: string;
  excerpt?: string;
}

export interface AnswerResult {
  text: string;
  citations: Citation[];
}

const CITE_RE = /\[(\d+)\]/g;

// Show just the filename, not a path
function formatSource(source: string | undefined | null): string {
  if (!source) return 'unknown';
  if (source.startsWith('http://') || source.startsWith('https://')) return source;
  return basename(source);
}

export function buildNumberedContext(
  chunks: RetrievedChunk[],
): { numberedContext: string; citationMap: Map<number, Citation> } {
  const citationMap = new Map<number, Citation>();
  const parts: string[] = [];

  chunks.forEach((c, i) => {
    const n = i + 1;
    parts.push(`[${n}] ${c.pageContent}`);
    citationMap.set(n, {
      n,
      source: formatSource(c.metadata?.source as string),
      excerpt: c.pageContent.slice(0, 120),
    });
  });

  return { numberedContext: parts.join('\n\n'), citationMap };
}

type LLMConfig = RagConfig['llm'];

function activeLLM(llm: LLMConfig) {
  return llm.active === 'openrouter' ? llm.openrouter : llm.ollama;
}


function buildChain(cfg: Pick<RagConfig, 'llm'>) {
  const llm = activeLLM(cfg.llm);

  if (llm.provider === 'openrouter') {
    // Guard: fail loudly if cloud is active but the key is missing.
    // Saves you (or a client) from a mysterious 401 an hour into debugging.
    if (!llm.apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set but llm.active is 'openrouter'. " +
        'Add it to .env (repo root) and app/.env, or set llm.active back to \'ollama\'.',
      );
    }

    const client = new OpenAI({
      apiKey: llm.apiKey,
      baseURL: llm.baseUrl,
    });

    // Wrap the OpenAI call in a RunnableLambda so it has the same
    // .invoke({ numberedContext, question }) contract as the Ollama pipe below.
    const model = RunnableLambda.from(async (input: ChatPromptValue) => {
      const messages = input.toChatMessages().map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
        const t = m.getType();
        if (t === 'human') return { role: 'user', content: m.content as string };
        if (t === 'ai')    return { role: 'assistant', content: m.content as string };
        return { role: 'system', content: m.content as string };
      });

      const res = await client.chat.completions.create({
        model: llm.model,
        messages,
      });
      return { content: res.choices[0]?.message?.content ?? '' };
    });

    return PROMPT.pipe(model);
  }

  const model = new ChatOllama({
    model: llm.model,
    baseUrl: llm.baseUrl,
  });
  return PROMPT.pipe(model);
}

export async function generate(
  cfg: Pick<RagConfig, 'llm'>,
  question: string,
  chunks: RetrievedChunk[],
): Promise<string> {
  const chain = buildChain(cfg);
  const { numberedContext } = buildNumberedContext(chunks);
  const response = await chain.invoke({
    numberedContext,
    question,
  });
  return typeof response === 'string' ? response : (response as { content?: string }).content ?? String(response);
}

export async function answer(
  cfg: Pick<RagConfig, 'llm'>,
  question: string,
  chunks: RetrievedChunk[],
): Promise<AnswerResult> {
  const { numberedContext, citationMap } = buildNumberedContext(chunks);
  const chain = buildChain(cfg);
  const response = await chain.invoke({ numberedContext, question });
  const raw = typeof response === 'string' ? response : (response as { content?: string }).content ?? String(response);

  const claimed = new Set<number>();
  let m: RegExpExecArray | null = CITE_RE.exec(raw);
  while (m !== null) {
    claimed.add(Number(m[1]));
    m = CITE_RE.exec(raw);
  }
  const validNs = [...claimed].filter((n) => citationMap.has(n));
  const validSet = new Set(validNs);

  const text = raw.replace(CITE_RE, (full, n) => (validSet.has(Number(n)) ? full : ''));

  const citations = validNs
    .sort((a, b) => a - b)
    .map((n) => citationMap.get(n)!)
    .filter(Boolean);

  return { text, citations };
}
