import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OllamaEmbeddings, ChatOllama } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";


// 1. Loading
const loader = new DirectoryLoader('./data', {
  '.md': (path: string) => new TextLoader(path),
  '.txt': (path: string) => new TextLoader(path)
});

const docs = await loader.load();
console.log(`1. Documents Loaded: ${docs.length} document(s) found.`);

// 2. Chunking
const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 })
const chunks = await splitter.splitDocuments(docs)
console.log(`2. Documents Chunked: Split into ${chunks.length} total chunk(s).`);


// 3. Embedding
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434", // Default value
});

const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings)
console.log(`3. Chunks Embedded & Stored: All ${chunks.length} chunk(s) are now in the vector store.\n`);


// .4 Retrieving
const question = 'Give me a summary of Digital Dopamine.';
const results = await vectorStore.similaritySearch(question, 3)

console.log(`4. Retrieved Chunks for question: "${question}"`);
console.log("--------------------------------------------------");
results.forEach((r, i) => {
  console.log(`\n--- Chunk ${i + 1} (Source: ${r.metadata.source}) ---`);
  console.log(r.pageContent);
});
console.log("\n--------------------------------------------------");

// .5 Generating
const llm = new ChatOllama({
  model: 'gemma3:4b',
  baseUrl: 'http://localhost:11434',
});

const context = results.map((r) => r.pageContent).join('\n\n---\n\n');

const prompt = ChatPromptTemplate.fromTemplate(`
You are a helpful assistant. Answer the question using ONLY the context below.
If the answer is not in the context, say "I don't have that information in the provided documents."

Context:
{context}

Question: {question}
`);

const chain = prompt.pipe(llm);
console.log(`5. Generating answer... \n`);

const response = await chain.invoke({ context, question });
console.log("🤖 Model's Answer:");
console.log(response.content);
