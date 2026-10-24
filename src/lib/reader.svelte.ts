import { tick } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { parseEpub } from './epub/parse';
import type { Book, Post } from './epub/types';
import { locate, resolve } from './locator';
import { FONTS, POST_LENGTHS, settings } from './settings.svelte';
import { renderPostImage, sharePostImage } from './share-image';
import {
	deleteBook,
	forgetState,
	listBooks,
	loadBook,
	loadState,
	saveBook,
	saveState,
	type Mark,
	type SavedBook
} from './storage';

const PAGE = 40;

class Reader {
	book = $state.raw<Book | null>(null);
	library = $state.raw<SavedBook[]>([]);
	loading = $state(false);
	error = $state('');

	/** Index of the post at the top of the viewport. */
	position = $state(0);
	/** Rendered window of the feed: posts[start, end). */
	start = $state(0);
	end = $state(0);
	/** True while `jump` owns the scroll position; the feed must not re-anchor meanwhile. */
	jumping = $state(false);

	tab = $state<'home' | 'bookmarks' | 'settings'>('home');
	drawer = $state(false);
	toast = $state('');
	flash = $state(-1);
	/** The last successful search, highlighted in posts until the search box is cleared. */
	query = $state('');

	likes = new SvelteSet<number>();
	reposts = new SvelteSet<number>();
	bookmarks = new SvelteSet<number>();
	/** Posts whose replies (footnotes and yours) are showing. */
	expanded = new SvelteSet<number>();
	/** Replies you wrote, by post id, oldest first. */
	mine = new SvelteMap<number, { text: string; time: number }[]>();

	chapter = $derived(this.book?.posts[this.position]?.chapter ?? 0);
	progress = $derived(this.book && this.book.posts.length > 1 ? this.position / (this.book.posts.length - 1) : 0);

	private file: Blob | null = null;
	private saveTimer = 0;
	private toastTimer = 0;
	private flashTimer = 0;

	async refreshLibrary() {
		try {
			this.library = await listBooks();
		} catch {
			this.library = [];
		}
	}

	/** Parse and show a book. `stay` keeps the current tab and only records the restored place (used by Settings). */
	async open(file: Blob, { stay = false } = {}) {
		this.loading = true;
		this.error = '';
		try {
			const book = await parseEpub(file, { limit: POST_LENGTHS[settings.postLength] });
			if (!book.posts.length) throw new Error('No readable text found in this EPUB.');
			this.close();
			const state = loadState(book.key);
			const last = book.posts.length - 1;
			const toId = (mark: Mark) => (typeof mark === 'number' ? Math.min(Math.max(mark, 0), last) : resolve(book, mark));
			this.likes = new SvelteSet(state.likes.map(toId));
			this.reposts = new SvelteSet(state.reposts.map(toId));
			this.bookmarks = new SvelteSet(state.bookmarks.map(toId));
			this.expanded = new SvelteSet();
			this.mine = new SvelteMap();
			for (const { mark, text, time } of state.replies) {
				const id = toId(mark);
				this.mine.set(id, [...(this.mine.get(id) ?? []), { text, time }]);
			}
			if (!stay) {
				this.tab = 'home';
				this.query = '';
			}
			this.start = this.end = 0;
			this.file = file;
			this.book = book;
			document.title = `${book.title} / Twitter`;
			saveBook({ key: book.key, title: book.title, author: names(book.authors), file, cover: book.coverBlob, opened: Date.now() })
				// Ask the browser to keep saved books instead of evicting them when disk space runs low.
				.then(() => navigator.storage?.persist?.())
				.catch(() => this.notify('Couldn’t save this book for next time'));
			const position = toId(state.position);
			if (stay) this.position = position;
			else await this.jump(position, { flash: false });
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		} finally {
			this.loading = false;
		}
	}

	/** Parse the open book again after a setting changed how posts are split; the reader's place and marks carry over. */
	async reparse() {
		if (!this.file) return;
		const scrolled = window.scrollY;
		await this.open(this.file, { stay: true });
		await tick();
		window.scrollTo(0, scrolled);
	}

	async openSaved(key: string) {
		const saved = await loadBook(key);
		if (saved) await this.open(saved.file);
	}

	async forget(key: string) {
		await deleteBook(key);
		forgetState(key);
		await this.refreshLibrary();
	}

	close() {
		this.flush();
		for (const url of this.book?.urls ?? []) URL.revokeObjectURL(url);
		this.book = null;
		this.file = null;
		this.drawer = false;
		document.title = 'Doomscroll';
	}

	async home() {
		this.close();
		await this.refreshLibrary();
	}

	/** Render a window around post `id` and scroll it under the header. */
	async jump(id: number, { smooth = false, flash = true } = {}) {
		const book = this.book;
		if (!book || id < 0 || id >= book.posts.length) return;
		this.jumping = true;
		this.tab = 'home';
		this.drawer = false;
		if (id < this.start || id >= this.end) {
			this.start = Math.max(0, id - 10);
			this.end = Math.min(book.posts.length, id + PAGE);
		}
		await tick();
		const behavior = smooth ? 'smooth' : 'instant';
		if (id === 0) window.scrollTo({ top: 0, behavior });
		else document.querySelector(`[data-i="${id}"]`)?.scrollIntoView({ block: 'start', behavior });
		this.position = id;
		this.jumping = false;
		this.persist();
		if (flash) {
			this.flash = id;
			clearTimeout(this.flashTimer);
			this.flashTimer = window.setTimeout(() => (this.flash = -1), 1600);
		}
	}

	setPosition(id: number) {
		if (id === this.position) return;
		this.position = id;
		this.persist();
	}

	toggle(set: SvelteSet<number>, id: number) {
		if (set.has(id)) set.delete(id);
		else set.add(id);
		this.persist();
	}

	notify(message: string) {
		this.toast = message;
		clearTimeout(this.toastTimer);
		this.toastTimer = window.setTimeout(() => (this.toast = ''), 2600);
	}

	async share(post: Post) {
		const book = this.book!;
		const text = post.kind === 'code' ? post.code! : post.plain;
		await navigator.clipboard.writeText(`“${text}”\n— ${names(book.authors) || book.author}, ${book.title}`);
		this.notify('Copied to clipboard');
	}

	async shareImage(post: Post) {
		try {
			const blob = await renderPostImage(this.book!, post, FONTS[settings.font].stack);
			const how = await sharePostImage(blob, this.book!.title);
			this.notify(how === 'shared' ? 'Shared' : 'Image downloaded');
		} catch (e) {
			// Closing the share sheet rejects with AbortError; that's a choice, not a failure.
			if ((e as Error).name !== 'AbortError') this.notify('Couldn’t make the image');
		}
	}

	/** Find the next post after `from` containing `query`, wrapping to the start. */
	search(query: string, from = this.position) {
		const normalize = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();
		const needle = normalize(query.trim());
		if (!needle || !this.book) return null;
		const hits = this.book.posts.filter((p) => normalize(p.plain).includes(needle)).map((p) => p.id);
		if (!hits.length) return null;
		const next = hits.findIndex((id) => id > from);
		const index = next === -1 ? 0 : next;
		return { id: hits[index], index, total: hits.length };
	}

	private persist() {
		clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => this.flush(), 250);
	}

	/** Write reading state now. Called on close and when the page is hidden, so the debounce never loses a save. */
	flush() {
		clearTimeout(this.saveTimer);
		const book = this.book;
		if (!book) return;
		const marks = (ids: Iterable<number>) => [...ids].map((id) => locate(book, id));
		saveState(book.key, {
			progress: this.progress,
			position: locate(book, this.position),
			likes: marks(this.likes),
			reposts: marks(this.reposts),
			bookmarks: marks(this.bookmarks),
			replies: [...this.mine].flatMap(([id, list]) => list.map((r) => ({ mark: locate(book, id), ...r })))
		});
	}

	reply(id: number, text: string) {
		this.mine.set(id, [...(this.mine.get(id) ?? []), { text, time: Date.now() }]);
		this.persist();
	}

	deleteReply(id: number, time: number) {
		const rest = (this.mine.get(id) ?? []).filter((r) => r.time !== time);
		if (rest.length) this.mine.set(id, rest);
		else this.mine.delete(id);
		this.persist();
	}
}

export const reader = new Reader();

/** Deterministic, plausible engagement numbers for a post. */
export function engagement(post: Post) {
	let h = 2166136261;
	for (let i = 0; i < Math.min(post.plain.length, 64); i++) h = Math.imul(h ^ post.plain.charCodeAt(i), 16777619);
	h = Math.imul(h ^ post.id, 16777619) >>> 0;
	const views = 800 + (h % 48000) * (1 + (post.plain.length % 7));
	const likes = Math.round(views * (0.01 + ((h >>> 8) % 40) / 1000));
	return {
		views,
		likes,
		reposts: Math.round(likes / (4 + ((h >>> 4) % 8))),
		replies: Math.round(likes / (12 + ((h >>> 12) % 20)))
	};
}

export function compact(n: number) {
	if (n < 1000) return String(n);
	if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}K`;
	return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}

const list = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** "A", "A and B", "A, B, and C"; long lists collapse to "A, B, and 10 others". */
export function names(people: string[]) {
	return list.format(people.length > 3 ? [...people.slice(0, 2), `${people.length - 2} others`] : people);
}
