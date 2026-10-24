import { describe, expect, it } from 'vitest';
import type { Book, Post } from './epub/types';
import { locate, resolve } from './locator';

const book = (posts: [doc: string, plain: string][]) =>
	({ posts: posts.map(([doc, plain], id) => ({ id, doc, plain }) as Post) }) as Book;

const opening = 'Down, down, down. Would the fall never come to an end?';
const ending = 'I wonder how many miles I have fallen by this time?';

describe('locators', () => {
	it('find the same passage after posts are added earlier in the book', () => {
		const before = book([
			['ch1.xhtml', 'Alice was beginning to get very tired.'],
			['ch1.xhtml', opening],
			['ch1.xhtml', ending]
		]);
		const after = book([
			['toc.xhtml', 'Contents'],
			['toc.xhtml', 'Chapter 1'],
			['ch1.xhtml', 'Alice was beginning to get very tired.'],
			['ch1.xhtml', opening],
			['ch1.xhtml', ending]
		]);
		expect(after.posts[resolve(after, locate(before, 2))].plain).toBe(ending);
	});

	it('find a thread post after the paragraph is split differently', () => {
		const threaded = book([
			['ch1.xhtml', 'Intro.'],
			['ch1.xhtml', opening],
			['ch1.xhtml', ending]
		]);
		// One post per paragraph: both thread parts are now a single post.
		const joined = book([
			['ch1.xhtml', 'Intro.'],
			['ch1.xhtml', `${opening} ${ending}`]
		]);
		expect(resolve(joined, locate(threaded, 2))).toBe(1);
	});

	it('pick the copy nearest the old position when the opening words repeat', () => {
		const repeated = book([
			['ch1.xhtml', '“Off with her head!” the Queen shouted.'],
			['ch1.xhtml', 'Nobody moved.'],
			['ch1.xhtml', '“Off with her head!” the Queen shouted.']
		]);
		expect(resolve(repeated, locate(repeated, 2))).toBe(2);
		expect(resolve(repeated, locate(repeated, 0))).toBe(0);
	});

	it('fall back to the nearest post in the same document when the text changed', () => {
		const before = book([
			['ch1.xhtml', 'Old text one.'],
			['ch2.xhtml', 'Old text two.'],
			['ch2.xhtml', 'Old text three.']
		]);
		const after = book([
			['ch1.xhtml', 'New text one.'],
			['ch2.xhtml', 'New text two.'],
			['ch2.xhtml', 'New text three.'],
			['ch3.xhtml', 'New text four.']
		]);
		expect(after.posts[resolve(after, locate(before, 2))].doc).toBe('ch2.xhtml');
	});
});
