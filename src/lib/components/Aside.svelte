<script lang="ts">
	import Icon from './Icon.svelte';
	import { compact, reader } from '#lib/reader.svelte.js';
	import type { Book } from '#lib/epub/types.js';

	let { book }: { book: Book } = $props();

	let query = $state('');
	let result = $state<{ index: number; total: number } | null | undefined>(undefined);
	let list: HTMLElement;

	function search(event: SubmitEvent) {
		event.preventDefault();
		const hit = reader.search(query);
		result = hit;
		if (hit) reader.jump(hit.id, { smooth: false });
	}

	$effect(() => {
		const active = list?.querySelector<HTMLElement>(`[data-chapter="${reader.chapter}"]`);
		if (!active) return;
		const box = list.getBoundingClientRect();
		const row = active.getBoundingClientRect();
		if (row.top < box.top || row.bottom > box.bottom) list.scrollTop += row.top - box.top - box.height / 3;
	});
</script>

<aside class="aside">
	<form class="search" onsubmit={search}>
		<label>
			<Icon name="search" size={18} />
			<input
				id="search"
				type="search"
				placeholder="Search this book"
				autocomplete="off"
				bind:value={query}
				oninput={() => (result = undefined)}
			/>
		</label>
		{#if result === null}
			<div class="hint">No posts found for “{query}”</div>
		{:else if result}
			<div class="hint">Result {result.index + 1} of {result.total} · press Enter for next</div>
		{/if}
	</form>

	<section class="panel">
		<h2>What’s happening</h2>
		<div class="progress-line">
			<span>{Math.round(reader.progress * 100)}% read</span>
			<span>{compact(book.posts.length - reader.position)} posts left</span>
		</div>
		<div class="trends" bind:this={list}>
			{#each book.chapters as chapter, i (i)}
				<button
					class="trend"
					class:active={i === reader.chapter}
					class:read={i < reader.chapter}
					data-chapter={i}
					style:padding-left="{16 + Math.min(chapter.depth, 3) * 12}px"
					onclick={() => reader.jump(chapter.start)}
				>
					<span class="small">{i === reader.chapter ? 'Trending now · You’re here' : `${i + 1} of ${book.chapters.length} · Trending`}</span>
					<span class="title">{chapter.title}</span>
					<span class="small">{compact(chapter.count)} posts</span>
				</button>
			{/each}
		</div>
	</section>

	<footer>Doomscroll · Your books never leave this device.</footer>
</aside>

<style>
	.aside {
		display: flex;
		flex-direction: column;
		gap: 16px;
		height: 100%;
		padding: 0 0 12px;
	}
	.search {
		position: sticky;
		top: 0;
		padding: 6px 0 0;
		background: var(--bg);
		z-index: 1;
	}
	label {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 42px;
		padding: 0 16px;
		border-radius: 999px;
		background: var(--search);
		border: 1px solid transparent;
		color: var(--muted);
	}
	label:focus-within {
		background: var(--bg);
		border-color: var(--accent);
		color: var(--accent);
	}
	input {
		flex: 1;
		min-width: 0;
		background: none;
		border: 0;
		outline: 0;
		color: var(--fg);
		font: inherit;
	}
	input::placeholder {
		color: var(--muted);
	}
	.hint {
		padding: 8px 16px 0;
		color: var(--muted);
		font-size: 13px;
	}
	.panel {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
	}
	h2 {
		margin: 0;
		padding: 12px 16px 4px;
		font-size: 20px;
		font-weight: 800;
		color: var(--strong);
	}
	.progress-line {
		display: flex;
		justify-content: space-between;
		padding: 0 16px 12px;
		color: var(--muted);
		font-size: 13px;
	}
	.trends {
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}
	.trend {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 12px 16px;
		background: none;
		border: 0;
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.trend:hover {
		background: var(--hover-strong);
	}
	.small {
		color: var(--muted);
		font-size: 13px;
		line-height: 16px;
	}
	.title {
		font-weight: 700;
		color: var(--strong);
		line-height: 20px;
		overflow-wrap: anywhere;
	}
	.trend.read .title {
		color: var(--muted);
	}
	.trend.active {
		box-shadow: inset 3px 0 var(--accent);
	}
	.trend.active .small:first-child {
		color: var(--accent);
	}
	footer {
		padding: 0 16px;
		color: var(--muted);
		font-size: 13px;
	}
</style>
