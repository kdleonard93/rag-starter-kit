import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { basename } from 'node:path';
import type { RagConfig } from '../config.js';
import type { RetrievedChunk } from '../retrieve/retriever.js';

const PROMPT = ChatPromptTemplate.fromTemplate(`
You are a grounded Q&A assistant for a small business.

STRICT RULES:
1. Answer ONLY using the numbered context below. Never use your own training knowledge, even if you "know" the answer.
2. Every sentence in your answer MUST end with a citation in the form [N], where N matches a numbered source from the context. If you cannot support a claim with a source, do not include it.
3. Do not paraphrase from memory. Only repeat what the context states.
4. If the context does not contain the answer, or does not fully support an answer, respond ONLY with:
"I don't have that information in the provided documents."
5. Never answer questions about prices, dates, facts, people, places, or any entity not mentioned in the context. Refuse instead.

Context (numbered):
{numberedContext}

Question: {question}

Answer (cite [N] after every claim, or refuse):
`);

export interface Citation {
  n: number;
  source: string;
  excerpt?: string;
}

// Show just the filename, not a path — citations are user-facing and a path
// (absolute OR relative) leaks internal structure. URLs pass through unchanged.
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

export interface AnswerResult {
  text: string;
  citations: Citation[];
}

const CITE_RE = /\[(\d+)\]/g;

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

export function buildChain(cfg: Pick<RagConfig, 'llm'>) {
  const llm = new ChatOllama({
    model: cfg.llm.model,
    baseUrl: cfg.llm.baseUrl,
  });
  return PROMPT.pipe(llm);
}

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks.map((c) => c.pageContent).join('\n\n---\n\n');
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
