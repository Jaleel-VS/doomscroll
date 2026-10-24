import type { Book, Post } from './epub/types';

/**
 * A reading position or saved post that survives re-parsing. Post ids are array indexes, so any change to how a
 * book is split (parser fixes, a different thread length) moves them. A locator remembers the spine document and
 * the opening words instead, with the old id as a tiebreaker.
 */
export type Locator = { doc: string; text: string; hint: number };

const SNIPPET = 32;

export function locate(book: Book, id: number): Locator {
	const post = book.posts[id];
	return { doc: post.doc, text: post.plain.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, SNIPPET), hint: id };
}

/** Find the post a locator points at: same document and opening words, else the nearest post in that document. */
export function resolve(book: Book, { doc, text, hint }: Locator): number {
	const nearest = (ids: number[]) => ids.reduce((best, id) => (Math.abs(id - hint) < Math.abs(best - hint) ? id : best));
	const inDoc = book.posts.filter((p) => p.doc === doc);
	if (!inDoc.length) return Math.min(Math.max(hint, 0), book.posts.length - 1);
	const needle = text.slice(0, 24);
	const matches = inDoc.filter((p) => p.plain.replace(/\s+/g, ' ').toLowerCase().includes(needle)).map((p) => p.id);
	return nearest(matches.length ? matches : inDoc.map((p) => p.id));
}
