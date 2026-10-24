<script lang="ts">
	import Icon from './Icon.svelte';
	import Rich from './Rich.svelte';
	import { compact, engagement, reader } from '#lib/reader.svelte.js';
	import { lightbox } from '#lib/lightbox.svelte.js';
	import { settings } from '#lib/settings.svelte.js';
	import type { Book, Post } from '#lib/epub/types.js';

	let { post, book, onopen }: { post: Post; book: Book; onopen?: () => void } = $props();

	const stats = $derived(engagement(post));
	const liked = $derived(reader.likes.has(post.id));
	const reposted = $derived(reader.reposts.has(post.id));
	const bookmarked = $derived(reader.bookmarks.has(post.id));
	const expanded = $derived(reader.expanded.has(post.id));
	const mine = $derived(reader.mine.get(post.id) ?? []);
	const notes = $derived(
		post.notes
			.map((key) => book.notes.get(key) ?? book.posts[book.anchors.get(key) ?? -1]?.runs)
			.filter((runs) => runs?.length)
	);
	const chapter = $derived(book.chapters[post.chapter]?.title ?? '');

	const replyCount = $derived(notes.length + mine.length);

	let draft = $state('');

	function toggleReplies() {
		reader.toggle(reader.expanded, post.id);
	}

	function send(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!text) return;
		reader.reply(post.id, text);
		draft = '';
	}

	/** Twitter-style relative time: 45s, 12m, 3h, then a short date. */
	function ago(time: number) {
		const seconds = Math.max(1, Math.round((Date.now() - time) / 1000));
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
		return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	let menu = $state(false);

	function pick(action: () => unknown) {
		menu = false;
		action();
	}
</script>

{#snippet avatar(size: number)}
	{#if book.cover}
		<img class="avatar" src={book.cover} alt="" width={size} height={size} />
	{:else}
		<div class="avatar initial" style:width="{size}px" style:height="{size}px">{book.title[0]}</div>
	{/if}
{/snippet}

{#if post.kind === 'head'}
	<h2 class="section" data-i={post.id} class:flash={reader.flash === post.id}><Rich runs={post.runs} /></h2>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<article
		class="post"
		class:up={post.part > 0}
		class:down={post.part < post.parts - 1}
		class:flash={reader.flash === post.id}
		class:clickable={!!onopen}
		data-i={post.id}
		onclick={(e) => onopen && !(e.target as Element).closest('button, a, form') && onopen()}
	>
		<div class="gutter">{@render avatar(40)}</div>
		<div class="body">
			<div class="meta">
				<span class="name">{book.author}</span>
				<Icon name="verified" size={18} class="badge" />
				<span class="handle">@{book.handle}</span>
				<span class="dot">·</span>
				<span class="time">{chapter}</span>
			</div>

			{#if post.runs.length}
				<div class="text" class:quote={post.quote}>
					{#if post.bullet}<span class="bullet">{post.bullet}</span>{/if}<Rich runs={post.runs} onnote={() => reader.expanded.add(post.id)} />{#if post.parts > 1}<span class="count">{post.part + 1}/{post.parts}</span>{/if}
				</div>
			{/if}

			{#if post.kind === 'code'}
				<pre class="card code">{post.code}</pre>
			{/if}

			{#if post.rows}
				<div class="card table">
					<table>
						<tbody>
							{#each post.rows as row, r (r)}
								<tr>
									{#each row as cell, c (c)}
										<svelte:element this={cell.head ? 'th' : 'td'} rowspan={cell.rowspan} colspan={cell.colspan}
											><Rich runs={cell.runs} /></svelte:element
										>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#each post.media as media, m (m)}
				<button
					class="zoom"
					aria-label={media.alt ? `Open image: ${media.alt}` : 'Open image'}
					onclick={(e) =>
						lightbox.open(e.currentTarget.firstElementChild as HTMLImageElement, { src: media.src, alt: media.alt, matte: !media.opaque })}
				>
					<img class="card media" class:matte={!media.opaque} src={media.src} alt={media.alt} loading="lazy" />
				</button>
			{/each}

			<div class="actions">
				<button class="action reply" class:has-notes={replyCount > 0} title={notes.length ? 'Footnotes and replies' : 'Reply'} onclick={toggleReplies}>
					<span class="halo"><Icon name="reply" size={18} /></span>{#if replyCount}{replyCount}{:else if settings.metrics}{compact(stats.replies)}{/if}
				</button>
				<button class="action repost" class:on={reposted} title="Repost" onclick={() => reader.toggle(reader.reposts, post.id)}>
					<span class="halo"><Icon name="repost" size={18} /></span>{#if settings.metrics}{compact(stats.reposts + (reposted ? 1 : 0))}{/if}
				</button>
				<button class="action like" class:on={liked} title="Like" onclick={() => reader.toggle(reader.likes, post.id)}>
					<span class="halo"><Icon name={liked ? 'liked' : 'like'} size={18} /></span>{#if settings.metrics}{compact(stats.likes + (liked ? 1 : 0))}{/if}
				</button>
				{#if settings.metrics}
					<span class="action views" title="Views"><span class="halo"><Icon name="views" size={18} /></span>{compact(stats.views)}</span>
				{/if}
				<span class="end">
					<button class="action bookmark" class:on={bookmarked} title="Bookmark" onclick={() => reader.toggle(reader.bookmarks, post.id)}>
						<span class="halo"><Icon name={bookmarked ? 'bookmarked' : 'bookmark'} size={18} /></span>
					</button>
					<span class="share-wrap">
						<button class="action share" title="Share" aria-haspopup="menu" aria-expanded={menu} onclick={() => (menu = !menu)}>
							<span class="halo"><Icon name="share" size={18} /></span>
						</button>
						{#if menu}
							<button class="menu-scrim" aria-label="Close menu" onclick={() => (menu = false)}></button>
							<span class="menu" role="menu">
								<button role="menuitem" onclick={() => pick(() => reader.share(post))}>Copy text</button>
								<button role="menuitem" onclick={() => pick(() => reader.shareImage(post))}>Share as image</button>
							</span>
						{/if}
					</span>
				</span>
			</div>

			{#if expanded}
				{#each notes as runs, n (n)}
					<div class="reply-post">
						<div class="gutter">{@render avatar(32)}</div>
						<div class="body">
							<div class="meta">
								<span class="name">{book.author}</span>
								<Icon name="verified" size={16} class="badge" />
								<span class="handle">@{book.handle}</span>
							</div>
							<div class="replying">Replying to <span>@{book.handle}</span></div>
							<div class="text"><Rich runs={runs!} /></div>
						</div>
					</div>
				{/each}
				{#each mine as reply (reply.time)}
					<div class="reply-post">
						<div class="gutter"><div class="avatar you">You</div></div>
						<div class="body">
							<div class="meta">
								<span class="name">You</span>
								<span class="dot">·</span>
								<span class="time">{ago(reply.time)}</span>
								<button class="delete" title="Delete reply" onclick={() => reader.deleteReply(post.id, reply.time)}>
									<Icon name="close" size={16} />
								</button>
							</div>
							<div class="replying">Replying to <span>@{book.handle}</span></div>
							<div class="text">{reply.text}</div>
						</div>
					</div>
				{/each}
				<form class="compose" onsubmit={send}>
					<div class="avatar you">You</div>
					<textarea
						bind:value={draft}
						placeholder="Post your reply"
						rows="1"
						maxlength="2000"
						aria-label="Your reply"
						onkeydown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
						}}
					></textarea>
					<button type="submit" disabled={!draft.trim()}>Reply</button>
				</form>
			{/if}
		</div>
	</article>
{/if}

<style>
	.section {
		margin: 0;
		padding: 20px 16px 12px;
		font-family: var(--reading-font);
		font-size: calc(var(--post-size) * 1.33);
		line-height: 1.2;
		font-weight: 800;
		color: var(--strong);
		border-bottom: 1px solid var(--border);
		scroll-margin-top: var(--header-h);
		overflow-wrap: anywhere;
	}
	/* Book CSS often sets display fonts on headings; a feed header stays plain. */
	.section :global(.c) {
		font: inherit;
		background: none;
		padding: 0;
	}

	.post {
		position: relative;
		display: flex;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		scroll-margin-top: var(--header-h);
		transition: background-color 0.2s;
	}
	.post:hover {
		background: var(--hover);
	}
	.post.clickable {
		cursor: pointer;
	}
	.post.down {
		border-bottom: 0;
	}
	/* Thread connector through the avatar column. */
	.post.down::after,
	.post.up::before {
		content: '';
		position: absolute;
		left: 35px;
		width: 2px;
		background: var(--thread);
	}
	.post.down::after {
		top: 56px;
		bottom: 0;
	}
	.post.up::before {
		top: 0;
		height: 8px;
	}

	.flash {
		animation: flash 1.6s ease-out;
	}
	@keyframes flash {
		from {
			background: color-mix(in srgb, var(--accent) 18%, transparent);
		}
	}

	.gutter {
		flex: none;
	}
	.avatar {
		display: block;
		border-radius: 50%;
		object-fit: cover;
		background: var(--card);
	}
	.initial {
		display: grid;
		place-items: center;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
		font-size: 18px;
	}

	.body {
		flex: 1;
		min-width: 0;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		white-space: nowrap;
		line-height: 20px;
	}
	.name {
		font-weight: 700;
		color: var(--strong);
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 0 1 auto;
	}
	.meta :global(.badge) {
		color: var(--accent);
	}
	.handle,
	.dot,
	.time {
		color: var(--muted);
	}
	.handle {
		flex: 0 1 auto;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.time {
		flex: 0 10 auto;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 2ch;
	}

	.text {
		margin-top: 2px;
		font-family: var(--reading-font);
		font-size: var(--post-size);
		line-height: 1.34;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.text.quote {
		margin-top: 8px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 16px;
	}
	.bullet {
		color: var(--muted);
		margin-right: 6px;
	}
	.count {
		color: var(--muted);
		margin-left: 6px;
		font-size: 13px;
	}

	.card {
		display: block;
		margin-top: 12px;
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
	}
	.code {
		padding: 12px 14px;
		background: var(--card);
		font: calc(var(--post-size) - 2px) / 1.5 ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.table {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		min-width: 100%;
		font-family: var(--reading-font);
		font-size: calc(var(--post-size) - 1px);
		line-height: 1.3;
	}
	th,
	td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	tr:last-child > * {
		border-bottom: 0;
	}
	th {
		color: var(--strong);
		font-weight: 700;
		background: var(--card);
	}
	td + td,
	th + td,
	td + th {
		border-left: 1px solid var(--border);
	}
	.zoom {
		display: block;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
	}
	.media {
		max-width: 100%;
		max-height: 600px;
		height: auto;
	}
	/* Transparent PNG/SVG art usually assumes a white page. */
	.media.matte {
		background: #fff;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 4px 0 -4px -8px;
		color: var(--muted);
		font-size: 13px;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: 0;
		min-width: 0;
		padding: 0 4px 0 0;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition: color 0.2s;
	}
	.views {
		cursor: default;
	}
	.halo {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		transition: background-color 0.2s;
	}
	.end {
		display: flex;
	}
	.reply:hover,
	.reply.has-notes,
	.views:hover,
	.bookmark:hover,
	.bookmark.on,
	.share:hover {
		color: var(--accent);
	}
	.reply:hover .halo,
	.views:hover .halo,
	.bookmark:hover .halo,
	.share:hover .halo {
		background: var(--accent-soft);
	}
	.repost:hover,
	.repost.on {
		color: var(--green);
	}
	.repost:hover .halo {
		background: rgb(0 186 124 / 0.1);
	}
	.like:hover,
	.like.on {
		color: var(--pink);
	}
	.like:hover .halo {
		background: rgb(249 24 128 / 0.1);
	}
	.like.on .halo,
	.bookmark.on .halo {
		animation: pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	@keyframes pop {
		0% {
			transform: scale(0.6);
		}
		100% {
			transform: scale(1);
		}
	}

	.reply-post {
		display: flex;
		gap: 8px;
		margin-top: 8px;
		padding: 12px 0 4px;
		border-top: 1px solid var(--border);
	}
	.replying {
		color: var(--muted);
		font-size: 14px;
	}
	.replying span {
		color: var(--accent);
	}
	.you {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 11px;
		font-weight: 800;
	}
	.delete {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		margin-left: auto;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}
	.delete:hover {
		color: var(--pink);
		background: rgb(249 24 128 / 0.1);
	}
	.compose {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-top: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	.compose textarea {
		flex: 1;
		min-width: 0;
		min-height: 32px;
		padding: 5px 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--fg);
		font-family: var(--reading-font);
		font-size: var(--post-size);
		line-height: 1.34;
		resize: none;
		field-sizing: content;
	}
	.compose textarea::placeholder {
		color: var(--muted);
	}
	.compose button {
		flex: none;
		height: 32px;
		padding: 0 16px;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.compose button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.share-wrap {
		position: relative;
	}
	.menu-scrim {
		position: fixed;
		inset: 0;
		z-index: 30;
		border: 0;
		background: transparent;
		cursor: default;
	}
	.menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 4px);
		z-index: 31;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		padding: 4px 0;
		border-radius: 12px;
		background: var(--bg);
		box-shadow:
			0 0 15px var(--shadow),
			0 0 3px 1px var(--shadow);
		overflow: hidden;
	}
	.menu button {
		padding: 12px 16px;
		border: 0;
		background: none;
		color: var(--strong);
		font: inherit;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
	}
	.menu button:hover {
		background: var(--hover-strong);
	}
</style>
