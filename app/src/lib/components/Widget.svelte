<script lang="ts">
	import posthog from 'posthog-js';

	interface Citation {
		n: number;
		source: string;
		excerpt?: string;
	}
	type Message = { role: 'user' | 'assistant'; text: string; citations?: Citation[]; error?: boolean };

	let question = $state('');
	let messages = $state<Message[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let listEl: HTMLDivElement | null = null;
	let inputEl: HTMLTextAreaElement | null = null;
	let formEl: HTMLFormElement | null = null;

	// Split assistant text into segments: plain text + [N] markers that have a matching citation.
	function renderText(text: string, cites: Citation[] | undefined): { kind: 'text' | 'cite'; value: string; n?: number }[] {
		if (!cites || cites.length === 0) return [{ kind: 'text', value: text }];
		const valid = new Set(cites.map((c) => c.n));
		const re = /\[(\d+)\]/g;
		const out: { kind: 'text' | 'cite'; value: string; n?: number }[] = [];
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			const n = Number(m[1]);
			if (!valid.has(n)) continue;
			if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
			out.push({ kind: 'cite', value: m[0], n });
			last = m.index + m[0].length;
		}
		if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
		return out;
	}

	function scrollBottom() {
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	}

	$effect(() => {
		// re-run when messages change
		messages.length;
		queueMicrotask(scrollBottom);
	});

	async function ask(event: SubmitEvent) {
		event.preventDefault();
		const q = question.trim();
		if (!q || loading) return;
		error = null;
		messages = [...messages, { role: 'user', text: q }];
		posthog.capture('chat_question_submitted');
		loading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ question: q }),
			});
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const data = await res.json();
			messages = [...messages, { role: 'assistant', text: data.text, citations: data.citations }];
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Something went wrong.';
			error = msg;
			messages = [...messages, { role: 'assistant', text: `Sorry, I couldn't get an answer. (${msg})`, error: true }];
		} finally {
			loading = false;
			question = '';
			if (inputEl) inputEl.style.height = '';
		}
	}

	function autoGrow() {
		if (!inputEl) return;
		inputEl.style.height = 'auto';
		inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
	}

	const suggestions = [
		'What is this?',
		'Summarize the key points',
		'How does it work?',
	];
</script>

<div class="flex h-[calc(100vh-13rem)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-ink-200/70 bg-white/70 shadow-sm backdrop-blur-sm sm:h-[calc(100vh-15rem)]">
	<!-- Status row -->
	<div class="flex items-center gap-2 border-b border-ink-200/70 bg-cream-50/60 px-4 py-2 text-xs text-ink-500">
		<span class="inline-flex items-center gap-1.5">
			<span class="h-2 w-2 rounded-full {loading ? 'bg-brand-400 animate-pulse' : 'bg-emerald-400'}"></span>
			{loading ? 'Generating…' : 'Ready'}
		</span>
		<span class="ml-auto hidden sm:inline">{messages.length} message{messages.length === 1 ? '' : 's'}</span>
	</div>

	<!-- Messages -->
	<div
		bind:this={listEl}
		class="rag-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6"
		role="log"
		aria-live="polite"
		aria-label="Conversation"
	>
		{#if messages.length === 0}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<div class="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-200 to-mist-200 text-brand-600 shadow-sm">
					<svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 3a9 9 0 0 0-9 9c0 1.4.32 2.72.9 3.9L3 21l5.1-.9A9 9 0 1 0 12 3Z" />
						<path d="M9 12h.01M12 12h.01M15 12h.01" />
					</svg>
				</div>
				<h2 class="mt-4 text-base font-semibold text-ink-700">Ask anything about your documents</h2>
				<p class="mt-1 max-w-sm text-sm text-ink-500">Answers are grounded in your indexed knowledge base. Every claim is cited.</p>
				<div class="mt-5 flex flex-wrap justify-center gap-2">
					{#each suggestions as s}
						<button
							type="button"
							class="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
							onclick={() => { question = s; inputEl?.focus(); }}
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<ul class="flex flex-col gap-5">
				{#each messages as m, i (i)}
					<li class="rag-fade flex gap-3 {m.role === 'user' ? 'flex-row-reverse' : ''}">
						<!-- Avatar -->
						<span
							class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold shadow-sm
								{m.role === 'user'
									? 'bg-mist-200 text-mist-400'
									: m.error
										? 'bg-rose-100 text-rose-600'
										: 'bg-gradient-to-br from-brand-300 to-brand-500 text-white'}"
							aria-hidden="true"
						>
							{m.role === 'user' ? 'You' : 'AI'}
						</span>

						<!-- Bubble -->
						<div class="max-w-[80%] {m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col">
							<div
								class="rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap break-words
									{m.role === 'user'
										? 'rounded-tr-sm bg-mist-100 text-ink-800'
										: m.error
											? 'rounded-tl-sm bg-rose-50 text-rose-700 border border-rose-200'
											: 'rounded-tl-sm bg-cream-100 text-ink-800 border border-cream-200'}"
							>
								{#if m.role === 'assistant' && m.citations?.length}
									{#each renderText(m.text, m.citations) as seg}
										{#if seg.kind === 'text'}{seg.value}{:else}<button type="button" class="rag-cite" aria-label={`See citation ${seg.n}`} onclick={() => document.getElementById(`cite-${seg.n}-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>{seg.n}</button>{/if}
									{/each}
								{:else}
									{m.text}
								{/if}
							</div>

							<!-- Citations footnote panel -->
							{#if m.role === 'assistant' && m.citations?.length}
								<ol class="mt-2 w-full space-y-1 border-l-2 border-brand-200 pl-3 text-xs text-ink-500">
									{#each m.citations as c}
										<li id={`cite-${c.n}-${i}`} class="rounded-md">
											<span class="font-semibold text-brand-600">[{c.n}]</span>
											<span class="ml-1 font-medium text-ink-600">{c.source}</span>
											{#if c.excerpt}<span class="mt-0.5 block text-ink-400 line-clamp-2">&ldquo;{c.excerpt}&hellip;&rdquo;</span>{/if}
										</li>
									{/each}
								</ol>
							{/if}
						</div>
					</li>
				{/each}

				<!-- Loading bubble -->
				{#if loading}
					<li class="rag-fade flex gap-3" aria-label="Assistant is typing">
						<span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-500 text-xs font-semibold text-white shadow-sm" aria-hidden="true">AI</span>
						<div class="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-cream-200 bg-cream-100 px-4 py-3.5">
							<span class="rag-dot h-1.5 w-1.5 rounded-full bg-brand-400"></span>
							<span class="rag-dot h-1.5 w-1.5 rounded-full bg-brand-400"></span>
							<span class="rag-dot h-1.5 w-1.5 rounded-full bg-brand-400"></span>
						</div>
					</li>
				{/if}
			</ul>
		{/if}
	</div>

	<!-- Composer -->
	<div class="border-t border-ink-200/70 bg-white/80 px-4 py-3 sm:px-6">
		{#if error}
			<p class="mb-2 text-xs text-rose-600" role="alert">{error}</p>
		{/if}
		<form bind:this={formEl} onsubmit={ask} class="flex items-end gap-2">
			<label for="rag-input" class="sr-only">Your question</label>
			<textarea
				id="rag-input"
				bind:this={inputEl}
				bind:value={question}
				oninput={autoGrow}
				onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); formEl?.requestSubmit(); } }}
				rows="1"
				placeholder="Ask a question…"
				maxlength="2000"
				class="rag-scroll max-h-40 flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-800 placeholder:text-ink-400 transition-colors focus:border-brand-400"
			></textarea>
			<button
				type="submit"
				disabled={loading || !question.trim()}
				class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:from-brand-500 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-brand-400 disabled:hover:to-brand-600"
			>
				{#if loading}
					<svg viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round" /></svg>
					<span class="hidden sm:inline">Sending</span>
				{:else}
					<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
					<span class="hidden sm:inline">Send</span>
				{/if}
			</button>
		</form>
		<p class="mt-1.5 text-center text-[0.7rem] text-ink-400">
			Press <kbd class="rounded border border-ink-200 bg-ink-100 px-1 font-sans text-[0.65rem]">Enter</kbd> to send, <kbd class="rounded border border-ink-200 bg-ink-100 px-1 font-sans text-[0.65rem]">Shift+Enter</kbd> for a new line.
		</p>
	</div>
</div>