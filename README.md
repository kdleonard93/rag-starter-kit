# rag-starter-kit

A minimal, local-first RAG (Retrieval-Augmented Generation) starter kit in TypeScript. Point it at documents, and get a chat app with grounded, cited answers running entirely on your machine.

## How it works

1. **Ingest** documents from a local folder, web pages, or Google Drive (`rag.config.ts`)
2. **Chunk** them into pieces sized for retrieval
3. **Embed** each chunk with Ollama
4. **Store** the embeddings in Chroma
5. **Retrieve and generate**: at query time, the top matching chunks are fetched and passed to the LLM as context
6. **Judge**: before generating, decide whether the retrieved chunks can answer the question at all; after generating, check each claim against the chunk it cites

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

### Local model performance

Five Ollama settings decide how fast and how reliably an answer comes back, and all five live
next to the model name in `rag.config.ts`:

- **`numCtx`** — context window (prompt *and* answer). The KV cache grows with this, so it
  is the main memory knob. A retrieval prompt here is only ~650 tokens, so 8192 is already
  generous; raising it costs memory and buys nothing.
- **`numPredict`** — hard ceiling on generated tokens. Without it a model is free to ramble:
  the same one-sentence question has produced 3,200+ tokens, which at ~10 t/s on a 12B model
  is a five-minute wait. This is the single most effective setting for perceived speed.
- **`keepAlive`** — how long the model stays loaded after a request. A 12B model is ~8 GB to
  read off disk, so a short keep-alive means paying a reload between questions.
- **`temperature`** — sampling randomness. Left unset, each model uses its own default, and
  most are high: `gemma4:12b` declares `temperature 1`, `top_k 64`, while `ornith-1.5:9b`
  declares no parameters at all and takes Ollama's defaults. At that level the same question
  against the same retrieved context answers on one run and replies
  "I don't have that information" on the next, and the wording changes every time. Grounded
  extraction wants near-determinism, so this repo sets `0.1`. Raise it only if you want more
  varied phrasing.
- **`think`** — reasoning models (`ollama show <model>` lists a `thinking` capability) emit a
  hidden reasoning pass before answering, which can be thousands of tokens. Set `think: false`
  for straightforward retrieval QA. Leave it unset for models without the capability —
  Ollama rejects the request if you send it to one that doesn't support it.

Check what is actually loaded with `ollama ps` (shows context and whether the run is on GPU
or CPU), and `ollama show <model>` for the model's own defaults.

Memory settles rather than climbing. Ollama reserves the KV cache for the full `numCtx` on the
first inference, not when the model loads, so resident memory steps up across the first request
or two and then stays flat no matter how many questions you ask — the figure `ollama ps`
reports as SIZE is that steady state. Activity Monitor shows more than SIZE because the model
file is memory-mapped and those file-backed pages count toward the process, but they are
reclaimable. If memory keeps climbing past the first few questions, it is not the KV cache:
look for reload churn (a short `keepAlive`, or a second client requesting a different context
size, either of which forces the model to unload and reload) instead.

Three environment-level traps worth knowing about:

- **`OLLAMA_CONTEXT_LENGTH`** is a server-wide *default* context for any client that does not
  pass `num_ctx`. If it is set high, a naive client silently allocates a huge KV cache. The
  per-request `numCtx` in this repo always wins, but check the variable before blaming a model
  for eating memory.
- **Ollama serves one request at a time per GPU slot** (`-np 1` in the runner args). Requests
  queue behind whatever is generating, so one slow caller makes everyone slow. `OLLAMA_NUM_PARALLEL`
  raises the slot count at the cost of a separate KV cache per slot.
- **The model store is per-instance.** The `ollama` service in `docker-compose.yml` publishes
  on host port 11435 with its own volume, so models you pulled into the Ollama desktop app on
  11434 are not visible to the containerized app. Pull them inside the container, or point
  `OLLAMA_BASE_URL` at the host instance.

If answers are slow, read the timing lines Ollama writes to `~/.ollama/logs/server.log`:
`eval time = ... / N tokens` is the generated length, and `prompt eval time` is how long the
retrieved context took to ingest. A large `N` is a generation-length problem
(`numPredict`, `think`); slow `prompt eval` is a context-size or CPU-offload problem (`numCtx`,
`ollama ps` PROCESSOR).

## The judge

Two judgements sit around the generation step, in `core/judge/`, configured under
`judge` in `rag.config.ts`:

- **`answerability`** — before generating, a single call decides whether the retrieved
  chunks can answer the question. If not, the request returns the refusal immediately:
  no generation is spent, and the refusal is a decision rather than a guess.
- **`groundedness`** — after generating, a second call reports which sentences are not
  supported by the chunk they cite. It reports; it never rewrites. This is the hole
  citations alone leave open — `answer()` checks that a citation *number* resolves to a
  chunk, not that the claim matches it, so a figure quoted correctly but attached to the
  wrong product passes.

Both are one-line classification calls, not generation: `temperature 0`, a 16-token cap,
and a parser that accepts only one of the offered answers. Anything else — a malformed
reply, a model that is down — is treated as *unparsed* and the request continues
unjudged. A false refusal is worse than a leaked non-answer, so the judge fails open and
the prompt's own refusal rule stays as the backstop.

The reply is surfaced as a `judge` field on the chat response:

```json
{ "text": "...", "citations": [...],
  "judge": { "answerability": { "verdict": "answerable", "parsed": true, "backend": "prompt" },
             "grounding": { "unsupported": [], "parsed": true, "backend": "prompt" } } }
```

**The judge runs on the model `llm.ollama` already names**, so it never loads a second
model: on this machine `OLLAMA_NUM_PARALLEL` is 1 and there is one GPU slot, so a judge
call and the generation serialize anyway, and a second resident model would not fit.
`model` and `numCtx` are therefore read from `llm.ollama` at request time rather than
repeated in the judge config — changing either is what makes Ollama unload and reload an
8 GB model.

The gate's scope is narrower than it first looks, and that is deliberate — it was measured,
not assumed:

- **Ask the gate about the subject, not the fact.** A rubric asking "does the context state
  the fact the question asks for?" refused 3 of 7 questions this corpus clearly answers —
  "What is RAG?" among them — and that failure held across three quite different wordings
  of the same mandate, so the fault was the mandate rather than its phrasing. A rubric
  asking only "is the context about this subject at all?" refused 9 of 9 out-of-domain
  questions and allowed 7 of 7 in-domain ones. **A refusal here therefore means "the
  context is about something else", never "the fact is missing."**
- **The fact-missing case belongs to the answer prompt.** Rule 2 in `core/generate/chain.ts`
  refuses the questions this corpus covers but does not answer, and does it reliably — 5 of
  5 in testing, where the gate managed 0 of 3 on the same class. The two layers each cover
  what the other is bad at, which is why a question can pass the gate and still be refused.
- **A model that refuses in prose is not a judge.** An earlier attempt at the gate lived
  inside the answer prompt as a rule, and refused an answerable question five times out of
  six. Constraining the answer to a fixed set of options is what makes the decision
  measurable — the reply is one line, and the parsers can then be tested without a model,
  which `pnpm eval:judge` does.

What the groundedness check catches, and what it does not, measured on this corpus with the
mislabeled answer this kit has actually produced:

- **Catches invented figures.** "Digital Dopamine charges $99,999 for a RAG integration"
  against a chunk pricing it at $20,000 is flagged.
- **Misses a figure attached to the wrong product when the cited chunk holds both facts.**
  "The RAG Starter Kit costs $20,000 for the MVP" passed three different rubrics, two of
  which said outright that a correctly quoted figure attached to something else is
  unsupported. The corpus prices RAG *integration* and says the kit is free, but both
  statements sit inside the chunk the answer cites, so at this granularity there is nothing
  to detect — a chunking symptom rather than a prompt one.
- **Can flag a faithful paraphrase.** End to end, "The core kit is free and released under
  the Apache 2.0 License [2]" was reported unsupported against a chunk saying exactly that
  in different words.

All three are the same failure as the subject bullet above: this model's judgement is
literal-match-shaped. Topic-level questions it answers well; paraphrase-sensitive ones it
does not. That is why grounding ships in `flag` mode, reporting into the response's `judge`
field rather than acting on the answer — treat it as a lead to check, not a verdict.

`judge.active` can also be `'systemone'`, which sends the same decision to a local
decision model over Ollama's `/v1/systemone` endpoint (`nimble`, `tev1`). That endpoint is
not in Ollama's JS library, so the adapter uses `fetch`. It is off by default because the
decision model needs its own 9.5 GB resident alongside the answer model — a model swap per
question on a 24 GB machine. Answerability is implemented there; groundedness is not.

## Evals

Add questions to `evals/questions.json` (see `questions.example.json`), then run:

```sh
pnpm eval
```

Each question can assert that the answer contains specific terms, cites a given source, or
refuses when the answer isn't in the corpus. `mustGate` (`"answer"` or `"refuse"`) asserts
what the answerability gate should decide, independent of the text that comes back — a
false *gate* refusal is a different bug from a refusal written by the model, and the two
need separate assertions to tell them apart.

A question the corpus covers but does not answer carries both `mustRefuse: true` and
`mustGate: "answer"`, which is not a contradiction: the gate lets it through because the
subject matches, and the answer prompt is what refuses it. That pairing is the assertion
that each layer is doing its own job.

The judge parsers are tested without a model:

```sh
pnpm eval:judge
```

It feeds malformed and cosmetic replies (`"The answer is A"`, `"**A**"`, `"1, 3"`,
`"I cannot determine"`) through `core/judge/parse.ts` and asserts which parse and which
must not — a reply that is nearly an option is rejected, because accepting prose here puts
the judgement back into the model's own words.