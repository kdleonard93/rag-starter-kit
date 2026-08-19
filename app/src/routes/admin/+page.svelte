<script lang="ts">
  import posthog from 'posthog-js';

  let status: 'idle' | 'loading' | 'done' | 'error' = 'idle';
  let result: string | null = null;

  async function reindex() {
    status = 'loading';
    result = null;
    const res = await fetch('/api/admin/reindex', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      status = 'done';
      result = `Re-indexed ${data.chunks} chunk(s).`;
      posthog.capture('knowledge_base_reindexed', { chunk_count: data.chunks });
    } else {
      status = 'error';
      result = `Failed: ${res.status} ${res.statusText}`;
    }
  }
</script>

<h1>Admin</h1>
<button on:click={reindex} disabled={status === 'loading'}>
  {status === 'loading' ? 'Re-indexing…' : 'Re-index knowledge base'}
</button>
{#if result}
  <p class={status}>{result}</p>
{/if}