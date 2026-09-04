# rag-starter-kit

A minimal, local-first RAG (Retrieval-Augmented Generation) starter kit in TypeScript. Point it at documents, and get a chat app with grounded, cited answers running entirely on your machine.

## How it works

1. **Ingest** documents from a local folder, web pages, or Google Drive (`rag.config.ts`)
2. **Chunk** them into pieces sized for retrieval
3. **Embed** each chunk with Ollama
4. **Store** the embeddings in Chroma
5. **Retrieve and generate**: at query time, the top matching chunks are fetched and passed to the LLM as context

## What's included

- `core/` - the RAG pipeline: loading, chunking, embedding, retrieval, and generation (LangChain + Chroma + Ollama)
- `app/` - a SvelteKit chat UI with streaming answers and source citations, plus a token-protected admin page to trigger reindexing
- `evals/` - a lightweight answer-quality harness that checks expected terms, source citations, and refusals (`pnpm eval`)
- `docker-compose.yml` - the full stack: Chroma, Ollama, and the app

Runs fully local by default (Ollama for embeddings and generation), with optional OpenRouter support for hosted models.

## Quick start

Requires Node 20+, pnpm, and Docker.

```sh
pnpm install
docker compose up -d chroma ollama
```

Pull the models used by the default config:

```sh
docker exec rag-starter-kit-ollama-1 ollama pull nomic-embed-text
docker exec rag-starter-kit-ollama-1 ollama pull gemma3:4b
```

Run the core pipeline against the sample docs in `data/` (ingest, retrieve, and answer one question):

```sh
pnpm dev
```

Or run the chat UI:

```sh
cd app
pnpm install
pnpm dev
```

The UI is then available at `http://localhost:5173`. Set `ADMIN_TOKEN` in `app/.env` to protect the admin reindex page.

To run everything in Docker instead, build and start the whole stack:

```sh
docker compose up --build
```

The app is then served at `http://localhost:3000`.

## Configuration

Everything is configured in `rag.config.ts`:

- **Sources**: local folder, web URLs, or Google Drive
- **Chunking**: chunk size and overlap
- **Embeddings**: provider, model, and base URL (Ollama by default)
- **Vector store**: Chroma URL and collection name
- **LLM**: Ollama or OpenRouter, with the model of your choice

Environment variables (`CHROMA_URL`, `OLLAMA_BASE_URL`, `OPENROUTER_API_KEY`, `ADMIN_TOKEN`) can override the defaults, and are wired through in `docker-compose.yml`.

## Evals

Add questions to `evals/questions.json` (see `questions.example.json`), then run:

```sh
pnpm eval
```

Each question can assert that the answer contains specific terms, cites a given source, or refuses when the answer isn't in the corpus.