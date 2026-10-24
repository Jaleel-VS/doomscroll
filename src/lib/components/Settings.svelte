<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import PostCard from './PostCard.svelte';
	import { reader } from '#lib/reader.svelte.js';
	import { ACCENTS, FONTS, FONT_SIZES, POST_LENGTHS, THEMES, settings } from '#lib/settings.svelte.js';
	import { clearLibrary } from '#lib/storage.js';
	import type { Book } from '#lib/epub/types.js';

	let { book }: { book: Book } = $props();

	const preview = $derived(book.posts.find((p, i) => i >= reader.position && p.kind === 'text') ?? book.posts[reader.position]);
	const lengths: { key: keyof typeof POST_LENGTHS; label: string; hint: string }[] = [
		{ key: 'classic', label: '280 characters', hint: 'Classic. Long paragraphs become threads.' },
		{ key: 'long', label: '1,000 characters', hint: 'Fewer, longer posts.' },
		{ key: 'full', label: 'No limit', hint: 'One post per paragraph, no threads.' }
	];

	let usage = $state('');
	let reparsing = $state(false);

	onMount(async () => {
		const estimate = await navigator.storage?.estimate?.();
		if (estimate?.usage !== undefined) usage = `${(estimate.usage / 1e6).toFixed(1)} MB`;
	});

	async function setPostLength(key: keyof typeof POST_LENGTHS) {
		if (key === settings.postLength) return;
		settings.postLength = key;
		reparsing = true;
		await reader.reparse();
		reparsing = false;
		reader.notify('Book re-split. Your place and bookmarks stayed put.');
	}

	async function clear() {
		const count = reader.library.length || 1;
		if (!confirm(`Remove ${count === 1 ? 'this book' : `all ${count} books`} and your reading progress from this browser?`)) return;
		// Close first: closing saves the open book's progress, which the clear must then remove.
		reader.close();
		await clearLibrary();
		await reader.refreshLibrary();
	}
</script>

<div class="settings">
	<p class="intro">These settings apply to every book you read in this browser.</p>

	<div class="preview">
		{#if preview}<PostCard post={preview} {book} />{/if}
	</div>

	<section>
		<h2>Font size</h2>
		<div class="slider">
			<span class="small-a">Aa</span>
			<input
				type="range"
				min="0"
				max={FONT_SIZES.length - 1}
				step="1"
				bind:value={settings.fontSize}
				aria-label="Font size"
				aria-valuetext="{FONT_SIZES[settings.fontSize]} pixels"
			/>
			<span class="big-a">Aa</span>
		</div>
	</section>

	<section>
		<h2>Font</h2>
		<div class="choices">
			{#each Object.entries(FONTS) as [key, font] (key)}
				<label class="choice" class:on={settings.font === key} style:font-family={font.stack}>
					<input type="radio" name="font" value={key} bind:group={settings.font} />
					<span class="radio"></span>
					{font.label}
				</label>
			{/each}
		</div>
	</section>

	<section>
		<h2>Color</h2>
		<div class="swatches">
			{#each Object.entries(ACCENTS) as [key, accent] (key)}
				<label class="swatch" style:background={accent.color} style:color={accent.text} title={accent.label}>
					<input type="radio" name="accent" value={key} bind:group={settings.accent} aria-label={accent.label} />
					{#if settings.accent === key}<Icon name="check" size={20} />{/if}
				</label>
			{/each}
		</div>
	</section>

	<section>
		<h2>Background</h2>
		<div class="choices">
			{#each Object.entries(THEMES) as [key, theme] (key)}
				<label class="choice theme-{key}" class:on={settings.theme === key}>
					<input type="radio" name="theme" value={key} bind:group={settings.theme} />
					<span class="radio"></span>
					{theme.label}
				</label>
			{/each}
		</div>
	</section>

	<section>
		<h2>Post length</h2>
		<div class="list">
			{#each lengths as length (length.key)}
				<label class="row">
					<span>
						<b>{length.label}</b>
						<span class="hint">{length.hint}</span>
					</span>
					<input
						type="radio"
						name="length"
						checked={settings.postLength === length.key}
						disabled={reparsing}
						onchange={() => setPostLength(length.key)}
					/>
				</label>
			{/each}
		</div>
		<p class="note">Changing this re-reads the book. Your place, likes, and bookmarks stay where they were.</p>
	</section>

	<section>
		<h2>Engagement</h2>
		<div class="list">
			<label class="row">
				<span>
					<b>Show like and view counts</b>
					<span class="hint">The numbers are made up. Your own likes and bookmarks are real.</span>
				</span>
				<input type="checkbox" class="switch" bind:checked={settings.metrics} />
			</label>
		</div>
	</section>

	<section>
		<h2>Storage</h2>
		<p class="note">
			Books and your reading progress are saved in this browser only{usage ? `, using ${usage}` : ''}. Clearing site data or using
			another device starts you fresh.
		</p>
		<div class="buttons">
			<button class="secondary" onclick={() => reader.home()}>Switch book</button>
			<button class="secondary" onclick={() => settings.reset()}>Reset display settings</button>
			<button class="danger" onclick={clear}>Clear library</button>
		</div>
	</section>

	<section>
		<h2>About</h2>
		<p class="note">
			Doomscroll is in beta. If a book looks wrong, <a href="https://github.com/Jaleel-VS/doomscroll/issues" target="_blank" rel="noopener noreferrer"
				>report it on GitHub</a
			> and say which book it was.
		</p>
	</section>
</div>

<style>
	.settings {
		padding-bottom: 120px;
	}
	.intro {
		margin: 0;
		padding: 12px 16px;
		color: var(--muted);
		font-size: 13px;
	}
	.preview {
		margin: 0 16px 8px;
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
		pointer-events: none;
	}
	.preview :global(.post) {
		border-bottom: 0;
	}
	section {
		padding: 12px 16px;
		border-top: 1px solid var(--border);
	}
	h2 {
		margin: 0 0 12px;
		font-size: 17px;
		font-weight: 800;
		color: var(--strong);
	}
	.slider {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 16px;
		border-radius: 16px;
		background: var(--card);
	}
	.slider input {
		flex: 1;
		accent-color: var(--accent);
	}
	.small-a {
		font-size: 13px;
	}
	.big-a {
		font-size: 20px;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--card);
		color: var(--strong);
		font-weight: 700;
		cursor: pointer;
	}
	.choice.on {
		border: 2px solid var(--accent);
	}
	.theme-light {
		background: #fff;
		color: #0f1419;
	}
	.theme-dim {
		background: #15202b;
		color: #f7f9f9;
	}
	.theme-dark {
		background: #000;
		color: #e7e9ea;
	}
	.radio {
		flex: none;
		width: 20px;
		height: 20px;
		border: 2px solid #8b98a5;
		border-radius: 50%;
	}
	.on .radio {
		border: 6px solid var(--accent);
	}
	input[type='radio'] {
		accent-color: var(--accent);
	}
	.choice input,
	.swatch input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.swatches {
		display: flex;
		justify-content: space-around;
		padding: 12px;
		border-radius: 16px;
		background: var(--card);
	}
	.swatch {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		cursor: pointer;
	}
	.swatch:has(:focus-visible),
	.choice:has(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.list {
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 16px;
		cursor: pointer;
	}
	.row + .row {
		border-top: 1px solid var(--border);
	}
	.row:hover {
		background: var(--hover);
	}
	.row > span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.row b {
		color: var(--strong);
	}
	.hint,
	.note {
		color: var(--muted);
		font-size: 13px;
		line-height: 16px;
	}
	.note {
		margin: 8px 0 0;
	}
	.note a {
		color: var(--accent);
	}
	.row input {
		flex: none;
		width: 20px;
		height: 20px;
		accent-color: var(--accent);
	}
	.switch {
		appearance: none;
		position: relative;
		width: 40px !important;
		height: 24px !important;
		border-radius: 999px;
		background: var(--border);
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s;
	}
	.switch:checked {
		background: var(--accent);
	}
	.switch:checked::after {
		transform: translateX(16px);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 12px;
	}
	.buttons button {
		height: 36px;
		padding: 0 16px;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.secondary {
		border: 1px solid var(--border);
		background: none;
		color: var(--strong);
	}
	.secondary:hover {
		background: var(--hover-strong);
	}
	.danger {
		border: 1px solid color-mix(in srgb, var(--error) 50%, transparent);
		background: none;
		color: var(--error);
	}
	.danger:hover {
		background: color-mix(in srgb, var(--error) 10%, transparent);
	}
	@media (max-width: 500px) {
		.choices {
			grid-template-columns: 1fr;
		}
		.choice {
			min-height: 52px;
		}
	}
</style>
