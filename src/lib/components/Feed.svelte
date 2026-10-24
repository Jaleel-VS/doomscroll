<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Icon from './Icon.svelte';
	import PostCard from './PostCard.svelte';
	import { compact, names, reader } from '#lib/reader.svelte.js';
	import type { Book } from '#lib/epub/types.js';

	let { book }: { book: Book } = $props();

	const credits = $derived(
		[
			`@${book.handle}`,
			book.authors.length && `by ${names(book.authors)}`,
			book.translators.length && `translated by ${names(book.translators)}`,
			book.illustrators.length && `illustrated by ${names(book.illustrators)}`
		]
			.filter(Boolean)
			.join(' · ')
	);

	const PAGE = 40;
	const MAX = 240;
	const MARGIN = 1500;

	let feed = $state<HTMLElement>();
	let top = $state<HTMLElement>();
	let bottom = $state<HTMLElement>();
	let filling = false;

	const visible = $derived(book.posts.slice(reader.start, reader.end));

	/** The post element under the sticky header: the reading position and the scroll anchor. */
	function topPost() {
		if (!feed) return null;
		const rect = feed.getBoundingClientRect();
		const header = document.querySelector('.header')?.getBoundingClientRect().bottom ?? 0;
		return document.elementFromPoint(rect.left + rect.width / 2, header + 4)?.closest<HTMLElement>('[data-i]') ?? null;
	}

	/*
	 * Scroll anchoring, done by hand because Safari has none and the browser's version fights the windowed feed.
	 * Remember where the post under the header sits; whenever the feed changes height (posts added or trimmed above,
	 * images loading, a font size change) scroll by however far that post moved. If the page scrolled since the pin
	 * (a jump, or the reader), that movement was intentional: re-pin instead of undoing it.
	 */
	let pinned: { el: HTMLElement; top: number; scrollY: number } | null = null;

	function pin() {
		const el = reader.tab === 'home' ? topPost() : null;
		pinned = el ? { el, top: el.getBoundingClientRect().top, scrollY: window.scrollY } : null;
	}

	function keepPinned() {
		if (reader.jumping) return;
		if (!pinned?.el.isConnected || pinned.scrollY !== window.scrollY) return pin();
		const delta = pinned.el.getBoundingClientRect().top - pinned.top;
		if (!delta) return;
		reader.quietUntil = Math.max(reader.quietUntil, performance.now() + 100);
		window.scrollBy(0, delta);
		pinned.scrollY = window.scrollY;
	}

	async function fill() {
		const [head, tail] = [top, bottom];
		if (filling || reader.jumping || reader.tab !== 'home' || !head || !tail) return;
		filling = true;
		try {
			const total = book.posts.length;
			for (let guard = 0; guard < 50 && !reader.jumping && head.isConnected; guard++) {
				if (tail.getBoundingClientRect().top < innerHeight + MARGIN && reader.end < total) {
					reader.end = Math.min(total, reader.end + PAGE);
					reader.start = Math.max(reader.start, reader.end - MAX);
				} else if (head.getBoundingClientRect().bottom > -MARGIN && reader.start > 0) {
					reader.start = Math.max(0, reader.start - PAGE);
					reader.end = Math.min(reader.end, reader.start + MAX);
				} else break;
				await tick();
				keepPinned();
			}
		} finally {
			filling = false;
		}
	}

	let frame = 0;
	function onscroll() {
		pin();
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			if (reader.tab !== 'home') return;
			const el = topPost();
			if (el) reader.setPosition(Number(el.dataset.i));
			fill();
		});
	}

	$effect(() => {
		void [reader.start, reader.end, reader.tab, reader.jumping];
		tick().then(fill);
	});

	// A finished jump moved the page on purpose: anchor to wherever it landed. Window changes must not re-pin,
	// or the shift they cause would be recorded instead of corrected.
	$effect(() => {
		if (!reader.jumping) pin();
	});

	$effect(() => {
		if (!feed) return;
		const observer = new ResizeObserver(keepPinned);
		observer.observe(feed);
		return () => observer.disconnect();
	});

	onMount(() => () => cancelAnimationFrame(frame));
</script>

<svelte:window {onscroll} />

<div class="feed" bind:this={feed}>
	{#if reader.tab === 'home'}
		{#if reader.start === 0}
			<section class="profile">
				<div class="banner" style:background-image={book.cover ? `url(${book.cover})` : undefined}></div>
				<div class="profile-body">
					{#if book.cover}
						<img class="big-avatar" src={book.cover} alt="" />
					{:else}
						<div class="big-avatar initial">{book.title[0]}</div>
					{/if}
					{#if book.start}
						<!-- Where X puts "Follow": skip the title page, copyright, and other front matter. -->
						<button class="start" onclick={() => reader.jump(book.start!)}>Start reading</button>
					{/if}
					<h1>{book.title} <Icon name="verified" size={22} class="badge" /></h1>
					<div class="muted">{credits}</div>
					{#if book.description}<p class="bio">{book.description}</p>{/if}
					<div class="muted facts">
						{#if book.year}<span><Icon name="calendar" size={18} /> Published {book.year}</span>{/if}
					</div>
					<div class="counts">
						<span><b>{compact(book.chapters.length)}</b> Chapters</span>
						<span><b>{compact(book.posts.length)}</b> Posts</span>
					</div>
				</div>
			</section>
		{/if}
		<div bind:this={top}></div>
		{#each visible as post (post.id)}
			<PostCard {post} {book} />
		{/each}
		<div bind:this={bottom}></div>
		{#if reader.end >= book.posts.length}
			<div class="end">You’re all caught up. <span class="muted">That’s the whole book.</span></div>
		{/if}
	{:else}
		{@const saved = [...reader.bookmarks].sort((a, b) => a - b).map((id) => book.posts[id]).filter(Boolean)}
		{#each saved as post (post.id)}
			<PostCard {post} {book} onopen={() => reader.jump(post.id)} />
		{:else}
			<div class="empty">
				<h2>Save posts for later</h2>
				<p class="muted">Bookmark passages to easily find them again in the future.</p>
			</div>
		{/each}
	{/if}
</div>

<style>
	.feed {
		min-height: 100vh;
	}
	.profile {
		border-bottom: 1px solid var(--border);
	}
	.banner {
		height: 200px;
		background: var(--card) center / cover;
		filter: blur(24px) saturate(1.3) brightness(0.7);
		transform: scale(1.2);
		clip-path: inset(0);
	}
	.profile {
		overflow: hidden;
	}
	.profile-body {
		position: relative;
		padding: 0 16px 16px;
	}
	.start {
		position: absolute;
		top: 12px;
		right: 16px;
		height: 36px;
		padding: 0 16px;
		border: 0;
		border-radius: 999px;
		background: var(--fg);
		color: var(--bg);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.2s;
	}
	.start:hover {
		opacity: 0.9;
	}
	.big-avatar {
		width: 134px;
		height: 134px;
		margin-top: -67px;
		border: 4px solid var(--bg);
		border-radius: 50%;
		object-fit: cover;
		background: var(--card);
	}
	.initial {
		display: grid;
		place-items: center;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 56px;
		font-weight: 800;
	}
	h1 {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 12px 0 0;
		font-size: 20px;
		line-height: 24px;
		font-weight: 800;
		color: var(--strong);
	}
	h1 :global(.badge) {
		color: var(--accent);
		flex: none;
	}
	.bio {
		margin: 12px 0 0;
		display: -webkit-box;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.facts {
		display: flex;
		gap: 12px;
		margin-top: 12px;
	}
	.facts span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.counts {
		display: flex;
		gap: 20px;
		margin-top: 12px;
		color: var(--muted);
		font-size: 14px;
	}
	.counts b {
		color: var(--strong);
	}
	.end,
	.empty {
		padding: 40px 32px 120px;
		text-align: center;
		font-weight: 700;
		color: var(--strong);
	}
	.end .muted {
		display: block;
		font-weight: 400;
		margin-top: 4px;
	}
	.empty {
		text-align: left;
		max-width: 400px;
		margin: 0 auto;
	}
	.empty h2 {
		font-size: 31px;
		line-height: 36px;
		font-weight: 800;
		margin: 0 0 8px;
	}
	.empty p {
		font-weight: 400;
		margin: 0;
	}
</style>
