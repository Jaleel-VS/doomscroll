<script lang="ts">
	import Aside from './Aside.svelte';
	import Feed from './Feed.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import Lightbox from './Lightbox.svelte';
	import Settings from './Settings.svelte';
	import { lightbox } from '#lib/lightbox.svelte.js';
	import { reader } from '#lib/reader.svelte.js';
	import type { Book } from '#lib/epub/types.js';

	let { book, onpick }: { book: Book; onpick: () => void } = $props();

	type Tab = typeof reader.tab;

	const nav: { label: string; icon: IconName; active: IconName; tab?: Tab; drawer?: boolean }[] = [
		{ label: 'Home', icon: 'home', active: 'homeActive', tab: 'home' },
		{ label: 'Chapters', icon: 'chapters', active: 'chapters', drawer: true },
		{ label: 'Bookmarks', icon: 'bookmark', active: 'bookmarked', tab: 'bookmarks' },
		{ label: 'Settings', icon: 'settings', active: 'settings', tab: 'settings' }
	];

	function setTab(tab: Tab) {
		reader.drawer = false;
		if (tab === reader.tab) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
			return;
		}
		if (tab === 'home') reader.jump(reader.position, { flash: false });
		else {
			reader.tab = tab;
			window.scrollTo(0, 0);
		}
	}

	/*
	 * On phones the header follows the finger, like X: scrolling down slides it up by the same distance until it's
	 * gone, and scrolling up pulls it back. Scrolls the app makes itself (jumps, and keeping your place while posts
	 * load above) don't move it.
	 */
	const phone = matchMedia('(max-width: 640px)');
	let headerHeight = $state(0);
	let shift = $state(0);
	let lastY = 0;
	let accountMenu = $state(false);

	function fromMenu(action: () => unknown) {
		accountMenu = false;
		action();
	}

	function followScroll() {
		const y = window.scrollY;
		const dy = y - lastY;
		lastY = y;
		if (!phone.matches || reader.tab !== 'home' || reader.drawer || y <= 0) {
			shift = 0;
			return;
		}
		// Hold still while the app scrolls on its own or while you type a reply.
		if (performance.now() < reader.quietUntil || document.activeElement?.tagName === 'TEXTAREA') return;
		shift = Math.min(Math.max(shift + dy, 0), headerHeight);
	}

	// A jump lands posts just under the full header, so show it.
	$effect(() => {
		if (reader.jumping || reader.tab !== 'home' || reader.drawer) shift = 0;
	});

	function onkeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		if (event.key === 'Escape') {
			reader.drawer = false;
			accountMenu = false;
			target.blur?.();
			return;
		}
		if (lightbox.photo || target.closest('input, textarea, [contenteditable]') || event.metaKey || event.ctrlKey || event.altKey) return;
		const id = reader.position;
		const actions: Record<string, () => void> = {
			j: () => reader.jump(id + 1, { smooth: true, flash: false }),
			k: () => reader.jump(id - 1, { smooth: true, flash: false }),
			l: () => reader.toggle(reader.likes, id),
			b: () => reader.toggle(reader.bookmarks, id),
			t: () => reader.toggle(reader.reposts, id),
			r: () => {
				reader.expanded.add(id);
				requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-i="${id}"] textarea`)?.focus());
			},
			'/': () => {
				reader.drawer = innerWidth < 1000;
				requestAnimationFrame(() => document.getElementById('search')?.focus());
			}
		};
		const action = actions[event.key];
		if (action && reader.tab === 'home') {
			event.preventDefault();
			action();
		}
	}
</script>

<svelte:window {onkeydown} onscroll={followScroll} />

<div class="layout" class:drawer={reader.drawer}>
	<nav class="nav">
		<div class="brand">
			<button class="logo" title="Back to top" onclick={() => setTab('home')}><Icon name="bird" size={30} /></button>
			<span class="beta">Beta</span>
		</div>
		{#each nav as item (item.label)}
			{@const on = item.tab ? reader.tab === item.tab : reader.drawer}
			<button
				class="nav-item"
				class:on
				class:chapters-only={item.drawer}
				onclick={() => (item.tab ? setTab(item.tab) : (reader.drawer = !reader.drawer))}
			>
				<Icon name={on ? item.active : item.icon} size={26} />
				<span>{item.label}</span>
			</button>
		{/each}
		<button class="post-button" onclick={onpick} title="Open another book">
			<Icon name="book" size={24} />
			<span>Open book</span>
		</button>
		<div class="account-wrap">
			<button class="account" onclick={() => (accountMenu = !accountMenu)} aria-haspopup="menu" aria-expanded={accountMenu}>
				{#if book.cover}<img src={book.cover} alt="" />{:else}<span class="initial">{book.title[0]}</span>{/if}
				<span class="who">
					<b>{book.title}</b>
					<span>@{book.handle}</span>
				</span>
				<Icon name="more" size={18} />
			</button>
			{#if accountMenu}
				<button class="menu-scrim" aria-label="Close menu" onclick={() => (accountMenu = false)}></button>
				<div class="account-menu" role="menu">
					<div class="current">
						{#if book.cover}<img src={book.cover} alt="" />{:else}<span class="initial">{book.title[0]}</span>{/if}
						<span class="who">
							<b>{book.title}</b>
							<span>@{book.handle}</span>
						</span>
						<span class="tick"><Icon name="check" size={18} /></span>
					</div>
					<button role="menuitem" onclick={() => fromMenu(() => reader.home())}>Switch book</button>
					<button role="menuitem" onclick={() => fromMenu(onpick)}>Open another book</button>
				</div>
			{/if}
		</div>
	</nav>

	<main class="main" style:--header-shift="{shift}px">
		<header class="header" bind:offsetHeight={headerHeight}>
			<div class="mobile-bar">
				<button class="mini-avatar" onclick={() => (reader.drawer = true)} aria-label="Chapters">
					{#if book.cover}<img src={book.cover} alt="" />{:else}<span class="initial">{book.title[0]}</span>{/if}
				</button>
				<span class="bird"><Icon name="bird" size={24} /><span class="beta">Beta</span></span>
				<button class="mini-open" onclick={onpick} aria-label="Open book"><Icon name="book" size={22} /></button>
			</div>
			{#if reader.tab === 'settings'}
				<div class="titlebar">
					<button class="back" onclick={() => setTab('home')} aria-label="Back to the book"><Icon name="back" size={20} /></button>
					<h1>Settings</h1>
				</div>
			{:else}
				<div class="tabs" role="tablist">
					<button role="tab" aria-selected={reader.tab === 'home'} onclick={() => setTab('home')}><span>For you</span></button>
					<button role="tab" aria-selected={reader.tab === 'bookmarks'} onclick={() => setTab('bookmarks')}>
						<span>Bookmarks</span>
					</button>
				</div>
			{/if}
		</header>
		<div class="progress" style:transform="scaleX({reader.progress})"></div>
		{#if reader.tab === 'settings'}
			<Settings {book} />
		{:else}
			<Feed {book} />
		{/if}
	</main>

	<div class="side"><Aside {book} /></div>

	<button class="scrim" aria-label="Close" onclick={() => (reader.drawer = false)}></button>

	<nav class="bottom-bar">
		<button class:on={reader.tab === 'home'} onclick={() => setTab('home')} aria-label="Home">
			<Icon name={reader.tab === 'home' ? 'homeActive' : 'home'} size={26} />
		</button>
		<button
			onclick={() => {
				reader.drawer = true;
				requestAnimationFrame(() => document.getElementById('search')?.focus());
			}}
			aria-label="Search"><Icon name="search" size={26} /></button
		>
		<button class:on={reader.drawer} onclick={() => (reader.drawer = !reader.drawer)} aria-label="Chapters">
			<Icon name="chapters" size={26} />
		</button>
		<button class:on={reader.tab === 'bookmarks'} onclick={() => setTab('bookmarks')} aria-label="Bookmarks">
			<Icon name={reader.tab === 'bookmarks' ? 'bookmarked' : 'bookmark'} size={26} />
		</button>
		<button class:on={reader.tab === 'settings'} onclick={() => setTab('settings')} aria-label="Settings">
			<Icon name="settings" size={26} />
		</button>
	</nav>
</div>

<Lightbox />

<style>
	.layout {
		display: flex;
		justify-content: center;
		min-height: 100vh;
	}

	/* Left navigation */
	.nav {
		position: sticky;
		top: 0;
		/* Sticky makes the nav its own layer; lift it so the account menu can spill over the feed. */
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		width: 275px;
		height: 100vh;
		padding: 0 12px 12px;
		flex: none;
	}
	.nav button {
		display: flex;
		align-items: center;
		background: none;
		border: 0;
		color: var(--strong);
		font: inherit;
		cursor: pointer;
		border-radius: 999px;
		transition: background-color 0.2s;
	}
	.nav button:hover {
		background: var(--hover-strong);
	}
	.nav .logo {
		width: 52px;
		height: 52px;
		justify-content: center;
		margin-top: 2px;
		color: var(--accent);
	}
	.nav .logo:hover {
		background: var(--accent-soft);
	}
	.bird {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--accent);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.nav-item {
		gap: 20px;
		padding: 12px;
		font-size: 20px;
		line-height: 24px;
	}
	.nav-item span {
		padding-right: 16px;
	}
	.nav-item.on {
		font-weight: 700;
	}
	.post-button {
		justify-content: center;
		gap: 8px;
		width: 90%;
		height: 52px;
		margin-top: 16px;
		background: var(--fg) !important;
		color: var(--bg) !important;
		font-weight: 700 !important;
		font-size: 17px !important;
	}
	.post-button :global(svg) {
		display: none;
	}
	.post-button:hover {
		opacity: 0.9;
	}
	.account-wrap {
		position: relative;
		width: 100%;
		margin-top: auto;
	}
	.account {
		gap: 12px;
		width: 100%;
		padding: 12px;
		text-align: left;
	}
	.nav .menu-scrim,
	.nav .menu-scrim:hover {
		position: fixed;
		inset: 0;
		z-index: 40;
		border-radius: 0;
		background: transparent;
		cursor: default;
	}
	/* Like X's account menu: the current book on top, then the actions. */
	.account-menu {
		position: absolute;
		left: 0;
		bottom: calc(100% + 8px);
		z-index: 41;
		display: flex;
		flex-direction: column;
		width: 300px;
		padding: 12px 0;
		border-radius: 16px;
		background: var(--bg);
		box-shadow:
			0 0 15px var(--shadow),
			0 0 3px 1px var(--shadow);
	}
	.current {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 16px 12px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}
	.current img,
	.current .initial {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		flex: none;
	}
	.tick {
		color: var(--green);
	}
	.nav .account-menu button {
		padding: 12px 16px;
		border-radius: 0;
		font-weight: 700;
	}
	.account img,
	.account .initial,
	.mini-avatar img,
	.mini-avatar .initial {
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
		font-size: 15px;
		line-height: 20px;
	}
	.who b,
	.who span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.who span {
		color: var(--muted);
	}

	/* Main column */
	.main {
		width: 600px;
		max-width: 100%;
		min-width: 0;
		border-inline: 1px solid var(--border);
	}
	.header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bar-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
		transform: translateY(calc(-1 * var(--header-shift, 0px)));
	}
	.mobile-bar {
		display: none;
	}
	.titlebar {
		display: flex;
		align-items: center;
		gap: 24px;
		height: 53px;
		padding: 0 16px 0 8px;
	}
	.titlebar h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 800;
		color: var(--strong);
	}
	.back {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--strong);
		cursor: pointer;
	}
	.back:hover {
		background: var(--hover-strong);
	}
	.tabs {
		display: flex;
	}
	.tabs button {
		flex: 1;
		display: flex;
		justify-content: center;
		height: 53px;
		background: none;
		border: 0;
		color: var(--muted);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.tabs button:hover {
		background: var(--hover-strong);
	}
	.tabs span {
		position: relative;
		display: flex;
		align-items: center;
	}
	.tabs [aria-selected='true'] {
		color: var(--strong);
		font-weight: 700;
	}
	.tabs [aria-selected='true'] span::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 4px;
		border-radius: 2px;
		background: var(--accent);
	}
	/* Outside the header so it stays on screen when the phone header slides away. */
	.progress {
		position: sticky;
		top: max(0px, calc(var(--header-h) - 2px - var(--header-shift, 0px)));
		z-index: 11;
		height: 2px;
		margin-top: -2px;
		background: var(--accent);
		transform-origin: left;
		opacity: 0.8;
		pointer-events: none;
	}

	/* Right column */
	.side {
		position: sticky;
		top: 0;
		width: 350px;
		height: 100vh;
		margin-left: 30px;
		padding-right: 10px;
		flex: none;
	}

	.scrim,
	.bottom-bar {
		display: none;
	}

	@media (max-width: 1279px) {
		.nav {
			width: 88px;
			align-items: center;
		}
		.brand {
			flex-direction: column;
			gap: 0;
		}
		.nav-item span,
		.post-button span,
		.account .who,
		.account :global(svg) {
			display: none;
		}
		.nav-item {
			padding: 12px;
		}
		.post-button {
			width: 52px;
		}
		.post-button :global(svg) {
			display: block;
		}
		.account {
			width: auto;
		}
	}
	@media (min-width: 1000px) {
		.chapters-only {
			display: none !important;
		}
	}
	@media (max-width: 999px) {
		.side {
			position: fixed;
			top: 0;
			left: 0;
			z-index: 30;
			width: min(350px, 86vw);
			margin: 0;
			padding: 0 12px;
			background: var(--bg);
			border-right: 1px solid var(--border);
			transform: translateX(-100%);
			transition: transform 0.25s ease;
		}
		.drawer .side {
			transform: none;
		}
		.drawer .scrim {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 20;
			border: 0;
			background: var(--scrim);
		}
	}
	@media (max-width: 640px) {
		.nav {
			display: none;
		}
		.main {
			border: 0;
			padding-bottom: 56px;
		}
		.mobile-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			height: 53px;
			padding: 0 16px;
			color: var(--strong);
		}
		.mobile-bar button {
			background: none;
			border: 0;
			padding: 0;
			color: inherit;
			cursor: pointer;
		}
		.mini-avatar img,
		.mini-avatar .initial {
			width: 32px;
			height: 32px;
		}
		.bottom-bar {
			display: flex;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 10;
			height: 53px;
			padding-bottom: env(safe-area-inset-bottom);
			background: var(--bar-bg);
			backdrop-filter: blur(12px);
			border-top: 1px solid var(--border);
		}
		.bottom-bar button {
			flex: 1;
			display: grid;
			place-items: center;
			background: none;
			border: 0;
			color: var(--strong);
			cursor: pointer;
		}
	}
</style>
