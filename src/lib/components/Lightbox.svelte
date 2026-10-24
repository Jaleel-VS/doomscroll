<script lang="ts">
	import Icon from './Icon.svelte';
	import { lightbox } from '#lib/lightbox.svelte.js';

	// Keep the page behind the viewer from scrolling while it's open.
	$effect(() => {
		if (!lightbox.photo) return;
		const root = document.documentElement;
		root.style.overflow = 'hidden';
		return () => root.style.removeProperty('overflow');
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && lightbox.close()} />

{#if lightbox.photo}
	<div class="viewer" role="dialog" aria-modal="true" aria-label={lightbox.photo.alt || 'Image'}>
		<button class="backdrop" aria-label="Close" onclick={() => lightbox.close()}></button>
		<img
			class="photo"
			class:matte={lightbox.photo.matte}
			src={lightbox.photo.src}
			alt={lightbox.photo.alt}
			style:--ratio={lightbox.photo.width / lightbox.photo.height || 1}
			style:--natural="{lightbox.photo.width}px"
		/>
		<button class="close" aria-label="Close" onclick={() => lightbox.close()}><Icon name="close" size={20} /></button>
	</div>
{/if}

<style>
	.viewer {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 56px 16px;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgb(0 0 0 / 0.9);
		cursor: zoom-out;
	}
	/* As large as the screen allows, keeping its shape, but at most 3x its real size so small art stays sharp. */
	.photo {
		position: relative;
		width: min(100%, calc((100dvh - 112px) * var(--ratio)), calc(var(--natural) * 3));
		height: auto;
		view-transition-name: lightbox;
		pointer-events: none;
	}
	.photo.matte {
		background: #fff;
	}
	.close {
		position: absolute;
		top: 12px;
		left: 12px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: rgb(15 20 25 / 0.75);
		color: #fff;
		cursor: pointer;
		backdrop-filter: blur(4px);
	}
	.close:hover {
		background: rgb(39 44 48 / 0.75);
	}
</style>
