<script lang="ts">
	import Icon from './Icon.svelte';
	import { reader } from '#lib/reader.svelte.js';
	import { loadState } from '#lib/storage.js';

	let { onpick }: { onpick: () => void } = $props();

	const covers = $derived(new Map(reader.library.map((b) => [b.key, b.cover ? URL.createObjectURL(b.cover) : ''])));
	$effect(() => {
		const current = covers;
		return () => current.forEach((url) => url && URL.revokeObjectURL(url));
	});

	const percent = (key: string) => Math.round(loadState(key).progress * 100);
</script>

<div class="landing">
	<div class="mark"><Icon name="bird" size={360} /></div>
	<div class="pitch">
		<h1>Happening now</h1>
		<h2>Read today. <span class="beta">Beta</span></h2>

		{#if reader.loading}
			<div class="loading"><span class="spinner"></span> Loading your book…</div>
		{:else}
			<button class="primary" onclick={onpick}>Open an EPUB</button>
			<p class="muted fine">or drop one anywhere on this page. Books stay on your device.</p>
		{/if}
		{#if reader.error}<p class="error">{reader.error}</p>{/if}

		{#if reader.library.length}
			<h3>Continue reading</h3>
			<ul class="library">
				{#each reader.library as book (book.key)}
					<li>
						<button class="row" onclick={() => reader.openSaved(book.key)} disabled={reader.loading}>
							{#if covers.get(book.key)}
								<img src={covers.get(book.key)} alt="" />
							{:else}
								<span class="initial">{book.title[0]}</span>
							{/if}
							<span class="who">
								<b>{book.title}</b>
								<span>{book.author}</span>
							</span>
							<span class="pct">{percent(book.key)}%</span>
						</button>
						<button class="forget" title="Remove from this device" onclick={() => reader.forget(book.key)}>
							<Icon name="close" size={18} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.landing {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 64px;
		min-height: 100vh;
		padding: 32px;
	}
	.mark {
		color: var(--accent);
		flex: 0 1 auto;
	}
	.mark :global(svg) {
		width: min(360px, 30vw);
		height: auto;
	}
	.pitch {
		width: min(460px, 100%);
	}
	h1 {
		margin: 0 0 40px;
		font-size: clamp(40px, 6vw, 64px);
		line-height: 1.1;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--strong);
	}
	h2 {
		margin: 0 0 32px;
		font-size: 31px;
		font-weight: 800;
		color: var(--strong);
	}
	h3 {
		margin: 40px 0 12px;
		font-size: 17px;
		font-weight: 700;
		color: var(--strong);
	}
	.primary {
		width: 300px;
		max-width: 100%;
		height: 44px;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.primary:hover {
		background: var(--accent-hover);
	}
	.fine {
		margin: 8px 0 0;
		font-size: 13px;
		max-width: 300px;
	}
	.error {
		color: var(--error);
	}
	.loading {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--muted);
	}
	.spinner {
		width: 26px;
		height: 26px;
		border: 3px solid var(--accent-soft);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.library {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
	}
	li {
		display: flex;
		align-items: center;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	li:hover {
		background: var(--hover-strong);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
		padding: 12px 8px 12px 16px;
		background: none;
		border: 0;
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row img,
	.row .initial {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		flex: none;
	}
	.initial {
		display: grid;
		place-items: center;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
	}
	.who {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.who b,
	.who span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.who b {
		color: var(--strong);
	}
	.who span,
	.pct {
		color: var(--muted);
	}
	.forget {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		margin-right: 12px;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}
	.forget:hover {
		color: var(--pink);
		background: rgb(249 24 128 / 0.1);
	}
	@media (max-width: 800px) {
		.landing {
			flex-direction: column;
			align-items: flex-start;
			gap: 32px;
		}
		.mark :global(svg) {
			width: 48px;
		}
	}
</style>
