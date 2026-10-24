<script lang="ts">
	import { onMount } from 'svelte';
	import Landing from '#lib/components/Landing.svelte';
	import ReaderView from '#lib/components/ReaderView.svelte';
	import { reader } from '#lib/reader.svelte.js';

	let input: HTMLInputElement;
	let dragging = $state(false);

	const pick = () => input.click();

	function openFile(file: File | undefined) {
		if (!file) return;
		if (!/\.epub$/i.test(file.name) && file.type !== 'application/epub+zip') {
			reader.notify('That doesn’t look like an EPUB file');
			return;
		}
		reader.open(file);
	}

	onMount(async () => {
		// Reading position is restored per book; the browser's own restoration would fight it.
		history.scrollRestoration = 'manual';
		await reader.refreshLibrary();
		const last = reader.library[0];
		if (last) await reader.openSaved(last.key);
	});
</script>

<svelte:window
	onpagehide={() => reader.flush()}
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={(e) => {
		if (!e.relatedTarget) dragging = false;
	}}
	ondrop={(e) => {
		e.preventDefault();
		dragging = false;
		openFile(e.dataTransfer?.files[0]);
	}}
/>

<input
	bind:this={input}
	type="file"
	accept=".epub,application/epub+zip"
	hidden
	onchange={() => {
		openFile(input.files?.[0]);
		input.value = '';
	}}
/>

{#if reader.book}
	{#key reader.book}
		<ReaderView book={reader.book} onpick={pick} />
	{/key}
{:else}
	<Landing onpick={pick} />
{/if}

{#if dragging}
	<div class="dropzone">Drop your EPUB to start reading</div>
{/if}

{#if reader.toast}
	<div class="toast" role="status">{reader.toast}</div>
{/if}

<style>
	.dropzone {
		position: fixed;
		inset: 12px;
		z-index: 100;
		display: grid;
		place-items: center;
		border: 2px dashed var(--accent);
		border-radius: 24px;
		background: var(--accent-soft);
		backdrop-filter: blur(4px);
		color: var(--strong);
		font-size: 24px;
		font-weight: 800;
		pointer-events: none;
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: 32px;
		z-index: 100;
		transform: translateX(-50%);
		padding: 12px 16px;
		border-radius: 4px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 15px;
		box-shadow: 0 0 15px var(--shadow);
		animation: rise 0.2s ease-out;
	}
	@keyframes rise {
		from {
			transform: translate(-50%, 16px);
			opacity: 0;
		}
	}
	@media (max-width: 640px) {
		.toast {
			bottom: 72px;
		}
	}
</style>
