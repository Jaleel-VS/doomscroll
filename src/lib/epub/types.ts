export const BOLD = 1,
	ITALIC = 2,
	CODE = 4,
	SUP = 8,
	SUB = 16,
	UNDERLINE = 32,
	STRIKE = 64;

/** A styled span of text. `href` is an internal anchor key (`path#id`) or an external URL. */
export type Run = { text: string; marks: number; href?: string; note?: boolean };

export type Cell = { runs: Run[]; head: boolean; rowspan: number; colspan: number };

export type Media = { src: string; alt: string; opaque: boolean };

export type Post = {
	id: number;
	/** Spine document the post came from; part of its stable locator. */
	doc: string;
	kind: 'text' | 'head' | 'code' | 'table';
	runs: Run[];
	plain: string;
	media: Media[];
	code?: string;
	rows?: Cell[][];
	/** Thread position for paragraphs split into several posts. */
	part: number;
	parts: number;
	quote: boolean;
	bullet?: string;
	/** Anchor keys of footnotes referenced by this post. */
	notes: string[];
	chapter: number;
};

export type Chapter = { title: string; start: number; count: number; depth: number };

export type Book = {
	key: string;
	title: string;
	/** First author: the name on every post. */
	author: string;
	authors: string[];
	translators: string[];
	handle: string;
	description: string;
	year: string;
	cover?: string;
	coverBlob?: Blob;
	posts: Post[];
	chapters: Chapter[];
	anchors: Map<string, number>;
	notes: Map<string, Run[]>;
	urls: string[];
};
