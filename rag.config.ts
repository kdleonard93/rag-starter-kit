export type FolderSource = { type: 'folder'; path: string; glob: string };
export type WebSource = { type: 'web'; urls: string[] };
export type GDriveSource = { type: 'gdrive'; folderId: string };
export type Source = FolderSource | WebSource | GDriveSource;

export type LLMProvider =
  | { provider: 'ollama'; model: string; baseUrl: string }
  | { provider: 'openrouter'; model: string; apiKey: string; baseUrl: string };


export default {
  sources: [
    { type: 'folder', path: './data', glob: '**/*.{md,txt}' },
    // { type: 'web', urls: ['https://example.com/docs'] },
    // { type: 'gdrive', folderId: '...' },
  ] as Source[],
  chunking: { chunkSize: 500, chunkOverlap: 50 },
  embeddings: {
    provider: 'ollama',
    model: 'nomic-embed-text',
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
      model: 'gemma3:4b',
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    } as LLMProvider,
    openrouter: {
      provider: 'openrouter',
      model: 'z-ai/glm-5.2', // comment out/un-comment models when switching.
      // model: 'moonshotai/kimi-k3',
      // model: 'google/gemma-4-31b',
      // model: 'minimax/minimax-m3',
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
      baseUrl: 'https://openrouter.ai/api/v1',
    } as LLMProvider,
  },
};
