<script lang="ts">
	import posthog from 'posthog-js';

	let status: 'idle' | 'loading' | 'done' | 'error' = 'idle';
	let result: string | null = null;
	let chunks: number | null = null;

	async function reindex() {
		status = 'loading';
		result = null;
		chunks = null;
		try {
			const res = await fetch('/api/admin/reindex', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			status = 'done';
			chunks = data.chunks;
			result = `Re-indexed ${data.chunks} chunk${data.chunks === 1 ? '' : 's'}.`;
			posthog.capture('knowledge_base_reindexed', { chunk_count: data.chunks });
		} catch (e) {
			status = 'error';
			result = `Failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
		}
	}
</script>

<section class="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold tracking-tight text-ink-800 sm:text-3xl">Admin</h1>
		<p class="mt-1.5 text-sm text-ink-500">Maintenance tools for the knowledge base.</p>
	</div>

	<div class="overflow-hidden rounded-2xl border border-ink-200/70 bg-white/70 shadow-sm backdrop-blur-sm">
		<div class="border-b border-ink-200/70 bg-cream-50/60 px-5 py-3">
			<h2 class="text-sm font-semibold text-ink-700">Ingestion</h2>
		</div>

		<div class="p-5">
			<p class="text-sm text-ink-600">
				Re-index the knowledge base to ingest or refresh documents from the configured source. This rebuilds the
				vector store chunks. Existing embeddings are replaced.
			</p>

			<div class="mt-5 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={reindex}
					disabled={status === 'loading'}
					class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-brand-500 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:from-brand-400 disabled:hover:to-brand-600"
				>
					{#if status === 'loading'}
						<svg viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round" /></svg>
						<span>Re-indexing…</span>
					{:else}
						<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
						<span>Re-index knowledge base</span>
					{/if}
				</button>

				{#if status === 'done' && chunks !== null}
					<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
						<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5" /></svg>
						{chunks} chunk{chunks === 1 ? '' : 's'} indexed
					</span>
				{/if}
			</div>

			{#if result}
				{@const isError = status === 'error'}
				<div
					role="status"
					aria-live="polite"
					class="mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm {isError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}"
				>
					<svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						{#if isError}
							<circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
						{:else}
							<path d="m20 6-11 11-5-5" />
						{/if}
					</svg>
					<span>{result}</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="mt-4 text-center">
		<a href="/" class="text-xs font-medium text-ink-500 hover:text-brand-600">&larr; Back to chat</a>
	</div>
</section>