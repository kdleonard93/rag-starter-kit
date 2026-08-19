import { json } from '@sveltejs/kit';
import { runIngestion } from '$core/ingest/runIngestion';

export async function POST() {
  const chunks = await runIngestion();
  return json({ ok: true, chunks });
}