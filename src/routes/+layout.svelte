<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '../app.css';
	// Font faces for the Hyperlegible setting; browsers only download them once that font is used.
	import '@fontsource/atkinson-hyperlegible-next/400.css';
	import '@fontsource/atkinson-hyperlegible-next/400-italic.css';
	import '@fontsource/atkinson-hyperlegible-next/700.css';
	import '@fontsource/atkinson-hyperlegible-next/700-italic.css';
	import '@fontsource/atkinson-hyperlegible-next/800.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Doomscroll</title>
	<meta name="theme-color" content="#000000" />
</svelte:head>

{@render children()}
