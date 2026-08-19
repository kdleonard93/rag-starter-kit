import { json } from '@sveltejs/kit';
import cfg from '$core/config';
import { getCollection } from '$core/store/vectorStore';
import { retrieve } from '$core/retrieve/retriever';
import { answer } from '$core/generate/chain';

export async function POST({ request }) {
  const { question } = await request.json();

  const collection = await getCollection(cfg);
  const chunks = await retrieve(collection, question);
  const { text, citations } = await answer(cfg, question, chunks);

  return json({ text, citations });
}
