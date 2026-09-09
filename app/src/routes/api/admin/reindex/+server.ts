import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { runIngestion } from '$core/ingest/runIngestion';

export async function POST({ request }) {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected && !dev) {
    return json(
      { ok: false, error: 'Re-indexing is disabled: set ADMIN_TOKEN to allow it.' },
      { status: 403 },
    );
  }

  if (expected) {
    const provided = request.headers.get('authorization');
    if (provided !== `Bearer ${expected}`) {
      return json({ ok: false, error: 'Invalid admin token.' }, { status: 401 });
    }
  }

  const chunks = await runIngestion();
  return json({ ok: true, chunks });
}