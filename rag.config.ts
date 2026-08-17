export default {
  sources: [
    { type: 'folder', path: './data', glob: '**/*.{md,txt}' },
    // { type: 'web', urls: ['https://example.com/docs'] },
    // { type: 'gdrive', folderId: '...' },
  ],
  chunking: { chunkSize: 500, chunkOverlap: 50 },
  embeddings: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    baseUrl: 'http://localhost:11434',
  },
  vectorStore: {
    provider: 'chroma',
    url: 'http://localhost:8000',
    collection: 'rag-kit',
  },
  llm: {
    provider: 'ollama',
    model: 'gemma3:4b',
    baseUrl: 'http://localhost:11434',
  },
};
