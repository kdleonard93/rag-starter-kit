<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Chat' },
		{ href: '/admin', label: 'Admin' },
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>RAG Starter Kit</title>
	<meta name="description" content="A grounded Q&A assistant that answers from your documents — with citations." />
</svelte:head>

<a href="#rag-main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
	Skip to content
</a>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-30 border-b border-ink-200/70 bg-ink-50/80 backdrop-blur-md">
		<div class="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
			<a href="/" class="flex items-center gap-2.5 rounded-md" aria-label="RAG Starter Kit home">
				<span class="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm">
					<svg viewBox="0 0 107 128" class="h-4 w-4" aria-hidden="true">
						<path d="M94.157 22.819c-10.4-14.885-30.94-19.297-45.792-9.835L22.282 29.608A29.92 29.92 0 0 0 8.764 49.65a31.5 31.5 0 0 0 3.108 20.231 30 30 0 0 0-4.477 11.183 31.9 31.9 0 0 0 5.448 24.116c10.402 14.887 30.942 19.297 45.791 9.835l26.083-16.624A29.92 29.92 0 0 0 98.235 78.35a31.53 31.53 0 0 0-3.105-20.232 30 30 0 0 0 4.474-11.182 31.88 31.88 0 0 0-5.447-24.116" fill="#fff" />
					</svg>
				</span>
				<span class="text-sm font-semibold tracking-tight text-ink-800">RAG Starter Kit</span>
			</a>

			<nav aria-label="Primary" class="ml-auto flex items-center gap-1">
				{#each nav as item}
					{@const active = page.url.pathname === item.href}
					<a
						href={item.href}
						aria-current={active ? 'page' : undefined}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {active ? 'bg-brand-100 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-800'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main id="rag-main" class="flex flex-1 flex-col">
		{@render children()}
	</main>

	<footer class="border-t border-ink-200/70 py-4 text-center text-xs text-ink-400">
		<p>RAG Starter Kit — grounded answers, cited sources.</p>
	</footer>
</div>