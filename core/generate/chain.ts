import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import type { RagConfig } from '../config.js';
import type { RetrievedChunk } from '../retrieve/retriever.js';

const PROMPT = ChatPromptTemplate.fromTemplate(`
You are a helpful assistant. Answer the question using ONLY the context below.
If the answer is not in the context, say "I don't have that information in the provided documents."

Context:
{context}

Question: {question}
`);

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
  const response = await chain.invoke({
    context: buildContext(chunks),
    question,
  });
  return typeof response === 'string' ? response : (response as { content?: string }).content ?? String(response);
}