export type FolderSource = { type: 'folder'; path: string };
export type WebSource = { type: 'web'; urls: string[] };
export type GDriveSource = { type: 'gdrive'; folderId: string };
export type Source = FolderSource | WebSource | GDriveSource;

export type LLMProvider =
  | {
      provider: 'ollama';
      model: string;
      baseUrl: string;
      numCtx: number;
      numPredict: number;
      keepAlive: string | number;
      // Grounded extraction QA wants near-determinism: at the models' own
      // default (temperature 1) the same question and context alternately
      // answer and refuse. Raise only if you want more varied phrasing.
      temperature: number;
      think?: boolean;
    }
  | { provider: 'openrouter'; model: string; apiKey: string; baseUrl: string };

export type JudgeProvider =
  // Reuses whichever model `llm.ollama` names, so the judge never forces a
  // second model to load. Only sampling is configured here; model, numCtx and
  // keepAlive are read from the answer model at request time.
  | { backend: 'prompt'; temperature: number; numPredict: number }
  // A decision model over Ollama's /v1/systemone endpoint. Needs its own model
  // resident (nimble is 9.5 GB), so on a 24 GB machine it costs a model swap.
  | { backend: 'systemone'; model: string; baseUrl: string; keepAlive: string | number; timeoutMs: number };


export default {
  sources: [
    { type: 'folder', path: './data' },
    // { type: 'web', urls: ['https://example.com/docs'] },
    // { type: 'gdrive', folderId: '...' },
  ] as Source[],
  chunking: { chunkSize: 500, chunkOverlap: 50 },
  embeddings: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    // model: 'qwen3-embedding:0.6b',
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  },
  vectorStore: {
    provider: 'chroma',
    url: process.env.CHROMA_URL ?? 'http://localhost:8000',
    collection: 'rag-kit',
  },
  llm: {
    active: 'ollama' as 'ollama' | 'openrouter',
    ollama: {
      provider: 'ollama',
      model: 'gemma4:12b',
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      numCtx: 8192,
      numPredict: 512,
      keepAlive: '30m',
      think: false,
      temperature: 0.1,
    } satisfies LLMProvider,
    openrouter: {
      provider: 'openrouter',
      model: 'z-ai/glm-5.2', // comment out/un-comment models when switching.
      // model: 'moonshotai/kimi-k3',
      // model: 'google/gemma-4-31b',
      // model: 'minimax/minimax-m3',
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      baseUrl: 'https://openrouter.ai/api/v1',
    } satisfies LLMProvider,
  },
  judge: {
    enabled: false,
    active: 'prompt' as 'prompt' | 'systemone',
    answerability: true,
    groundedness: 'flag' as 'off' | 'flag',
    prompt: {
      backend: 'prompt',
      temperature: 0,
      numPredict: 16, // one letter, or a short list of item numbers
    } satisfies JudgeProvider,
    systemone: {
      backend: 'systemone',
      model: 'nimble',
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      keepAlive: '30m',
      timeoutMs: 30_000,
    } satisfies JudgeProvider,
  },
};
