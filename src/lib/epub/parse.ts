import { openZip } from './zip';
import { serializeMath } from './mathml';
import { POST_LIMIT, splitRuns, trimRuns } from './split';
import {
	BOLD,
	CODE,
	ITALIC,
	STRIKE,
	SUB,
	SUP,
	UNDERLINE,
	type Book,
	type Cell,
	type Chapter,
	type Media,
	type Post,
	type Run
} from './types';

const OPS = 'http://www.idpf.org/2007/ops';
const OPF = 'http://www.idpf.org/2007/opf';
const XLINK = 'http://www.w3.org/1999/xlink';

/** Style flags derived from CSS classes, beyond inline marks. */
const BIG = 1 << 10,
	HIDDEN = 1 << 11,
	BOX = 1 << 12;

const BLOCKS = new Set(
	'address article aside blockquote body center dd details div dl dt figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol p pre section summary table tbody tfoot thead tr td th ul'.split(
		' '
	)
);
const BLOCK_SELECTOR = [...BLOCKS].join(',');
const SKIP = /^(head|script|style|template|noscript|title|link|meta)$/;
const TAG_MARKS: Record<string, number> = {
	b: BOLD,
	strong: BOLD,
	i: ITALIC,
	em: ITALIC,
	cite: ITALIC,
	dfn: ITALIC,
	var: ITALIC,
	code: CODE,
	kbd: CODE,
	samp: CODE,
	tt: CODE,
	sup: SUP,
	sub: SUB,
	u: UNDERLINE,
	ins: UNDERLINE,
	s: STRIKE,
	del: STRIKE,
	strike: STRIKE
};
const NOTE_TYPES = /\b(?:doc-)?(?:footnote|endnote|rearnote|note)\b/;
const MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	avif: 'image/avif'
};

type ManifestItem = { id: string; href: string; type: string; props: string };
type TocEntry = { title: string; href: string; depth: number };
type Context = { quote: boolean; marks: number };

export type ParseOptions = { /** Thread split size in characters; Infinity keeps one post per paragraph. */ limit?: number };

export async function parseEpub(file: Blob, { limit = POST_LIMIT }: ParseOptions = {}): Promise<Book> {
	const zip = openZip(await file.arrayBuffer());
	const read = async (path: string) => {
		const bytes = await zip(path);
		return bytes ? new TextDecoder().decode(bytes) : null;
	};

	const container = await read('META-INF/container.xml');
	if (!container) throw new Error('This EPUB has no META-INF/container.xml.');
	const opfPath = xml(container).querySelector('rootfile')?.getAttribute('full-path');
	const opfText = opfPath && (await read(opfPath));
	if (!opfPath || !opfText) throw new Error('This EPUB has no package document.');
	const opf = xml(opfText);

	const meta = (name: string) =>
		Array.from(opf.getElementsByTagNameNS('*', name), (el) => el.textContent?.trim() ?? '').filter(Boolean);
	// Drop the extension and download-site tags like "(z-library.sk, 1lib.sk)" from file names.
	const fileTitle = ((file as File).name ?? '')
		.replace(/\.epub$/i, '')
		.replace(/\s*\([^)]*\.[a-z]{2,}\b[^)]*\)/gi, '')
		.trim();
	const metaTitle = meta('title')[0];
	const title = (metaTitle && !/^(book )?title$|^untitled$|^unknown$/i.test(metaTitle) ? metaTitle : fileTitle) || 'Untitled';
	const { authors, translators } = readCreators(opf);
	const lang = meta('language')[0] || 'en';
	const description = htmlToText(meta('description')[0] ?? '');
	const year = meta('date')[0]?.match(/\d{4}/)?.[0] ?? '';

	const manifest: ManifestItem[] = Array.from(opf.querySelectorAll('manifest > item'), (el) => ({
		id: el.getAttribute('id') ?? '',
		href: resolve(el.getAttribute('href') ?? '', opfPath),
		type: el.getAttribute('media-type') ?? '',
		props: el.getAttribute('properties') ?? ''
	}));
	const byId = new Map(manifest.map((item) => [item.id, item]));
	const spine = Array.from(opf.querySelectorAll('spine > itemref'), (el) => byId.get(el.getAttribute('idref') ?? ''))
		.filter((item): item is ManifestItem => !!item && /html/.test(item.type));

	const toc = await readToc(opf, manifest, byId, read);
	const coverItem =
		manifest.find((item) => /\bcover-image\b/.test(item.props)) ??
		byId.get(opf.querySelector('meta[name="cover"]')?.getAttribute('content') ?? '') ??
		manifest.find((item) => /^image\//.test(item.type) && /cover/i.test(item.id + item.href));

	const builder = new Builder(lang, limit);
	for (const item of spine) {
		const source = await read(item.href);
		if (!source) continue;
		const doc = html(source);
		await builder.addStyles(doc, item.href, read);
		builder.addDocument(doc, item.href);
	}
	const { posts, anchors, notes } = builder;

	const chapters = buildChapters(toc, anchors, posts);

	const urls: string[] = [];
	const types = new Map(manifest.map((item) => [item.href, item.type]));
	const blobs = new Map<string, Blob>();
	const imagePaths = new Set([...builder.images, ...(coverItem ? [coverItem.href] : [])]);
	for (const path of imagePaths) {
		const bytes = await zip(path);
		if (!bytes) continue;
		const type = types.get(path) || MIME[path.split('.').pop()!.toLowerCase()] || '';
		blobs.set(path, new Blob([bytes], { type }));
	}
	const urlFor = new Map<string, string>();
	for (const [path, blob] of blobs) {
		const url = URL.createObjectURL(blob);
		urls.push(url);
		urlFor.set(path, url);
	}
	for (const post of posts) {
		post.media = post.media
			.filter((m) => urlFor.has(m.src))
			.map((m) => ({ ...m, src: urlFor.get(m.src)!, opaque: /jpe?g/.test(blobs.get(m.src)!.type) }));
	}

	const coverPath = coverItem?.href ?? [...builder.images][0];
	const handle = (authors[0] ?? title)
		.normalize('NFKD')
		.replace(/[^a-z0-9]/gi, '')
		.toLowerCase()
		.slice(0, 15);

	return {
		// The package identifier survives title clean-ups; title+author is the fallback for books without one.
		key: meta('identifier')[0] || `${title}|${authors.join(', ')}`,
		title,
		author: authors[0] ?? 'Unknown author',
		authors,
		translators,
		handle: handle || 'book',
		description,
		year,
		cover: coverPath ? urlFor.get(coverPath) : undefined,
		coverBlob: coverPath ? blobs.get(coverPath) : undefined,
		posts,
		chapters,
		anchors,
		notes,
		urls
	};
}

/** Authors and translators from `dc:creator`, honouring EPUB 2 `opf:role` and EPUB 3 `refines` roles. */
function readCreators(opf: Document) {
	const roles = new Map<string, string>();
	for (const meta of opf.getElementsByTagNameNS('*', 'meta')) {
		const target = meta.getAttribute('refines');
		if (target && meta.getAttribute('property') === 'role') roles.set(target.slice(1), meta.textContent?.trim() ?? '');
	}
	const creators = Array.from(opf.getElementsByTagNameNS('*', 'creator'), (el) => ({
		names: splitNames(el.textContent ?? ''),
		role: (el.getAttributeNS(OPF, 'role') || el.getAttribute('opf:role') || roles.get(el.getAttribute('id') ?? '') || '').toLowerCase()
	}));
	const names = (list: typeof creators) => [...new Set(list.flatMap((c) => c.names))];
	// Unmarked creators count as authors; anthologies credited only to editors still need a byline.
	let authors = names(creators.filter((c) => !c.role || c.role === 'aut'));
	if (!authors.length) authors = names(creators.filter((c) => c.role !== 'trl'));
	return { authors, translators: names(creators.filter((c) => c.role === 'trl')) };
}

/** One `dc:creator` can hold several people ("A & B", "A, B, and C") or a sorted name ("Dinniman, Matt"). */
export function splitNames(raw: string): string[] {
	const name = raw.replace(/\s+/g, ' ').trim();
	if (!name) return [];
	const commas = name.split(',').length - 1;
	const conjunction = /;|\s&\s|\band\b/i.test(name);
	if (commas >= 2 || (commas && conjunction)) return name.split(/\s*(?:,|;|&|\band\b)\s*/i).filter(Boolean);
	if (conjunction) return name.split(/\s*(?:;|&|\band\b)\s*/i).filter(Boolean);
	const sorted = name.match(/^(\S+),\s*(.+)$/);
	return [sorted ? `${sorted[2]} ${sorted[1]}` : name];
}

class Builder {
	posts: Post[] = [];
	anchors = new Map<string, number>();
	notes = new Map<string, Run[]>();
	images = new Set<string>();
	private classStyles = new Map<string, number>();
	private loadedCss = new Set<string>();
	private path = '';

	constructor(
		private lang: string,
		private limit: number
	) {}

	async addStyles(doc: Document, path: string, read: (p: string) => Promise<string | null>) {
		for (const link of doc.querySelectorAll('link[rel~="stylesheet"][href]')) {
			const href = resolve(link.getAttribute('href')!, path);
			if (this.loadedCss.has(href)) continue;
			this.loadedCss.add(href);
			parseCss((await read(href)) ?? '', this.classStyles);
		}
		for (const style of doc.querySelectorAll('style')) parseCss(style.textContent ?? '', this.classStyles);
	}

	addDocument(doc: Document, path: string) {
		this.path = path;
		this.anchor(path);
		const body = doc.getElementsByTagName('body')[0] ?? doc.documentElement;
		this.visit(body, { quote: false, marks: 0 });
	}

	private anchor(key: string) {
		if (!this.anchors.has(key)) this.anchors.set(key, this.posts.length);
	}

	private anchorIds(el: Element) {
		const id = el.getAttribute('id') ?? (el.localName === 'a' ? el.getAttribute('name') : null);
		if (id) this.anchor(`${this.path}#${id}`);
	}

	private styleOf(el: Element) {
		let flags = TAG_MARKS[el.localName.toLowerCase()] ?? 0;
		for (const name of el.getAttribute('class')?.split(/\s+/) ?? []) {
			flags |= this.classStyles.get(name) ?? 0;
			if (/bold/i.test(name)) flags |= BOLD;
			if (/ital/i.test(name)) flags |= ITALIC;
		}
		const style = el.getAttribute('style');
		if (style) flags |= cssFlags(style);
		if (el.hasAttribute('hidden')) flags |= HIDDEN;
		return flags;
	}

	/** Walk a container, grouping loose inline content into anonymous blocks the way browsers do. */
	private visit(el: Element, ctx: Context) {
		let inline: Node[] = [];
		const flush = () => {
			if (inline.length) this.leaf(inline, ctx, null);
			inline = [];
		};
		for (const node of el.childNodes) {
			if (node.nodeType === 3) {
				inline.push(node);
				continue;
			}
			if (node.nodeType !== 1) continue;
			const child = node as Element;
			const tag = child.localName.toLowerCase();
			if (SKIP.test(tag)) continue;
			const flags = this.styleOf(child);
			if (flags & HIDDEN) continue;
			const isBlock = BLOCKS.has(tag) || !!child.querySelector(BLOCK_SELECTOR);
			if (!isBlock) {
				inline.push(child);
				continue;
			}
			flush();
			this.block(child, tag, flags, ctx);
		}
		flush();
	}

	private block(el: Element, tag: string, flags: number, ctx: Context) {
		this.anchorIds(el);
		const type = `${el.getAttributeNS(OPS, 'type') ?? el.getAttribute('epub:type') ?? ''} ${el.getAttribute('role') ?? ''}`;
		if (tag === 'aside' && NOTE_TYPES.test(type)) {
			const runs = this.collect([el], 0);
			for (const target of [el, ...el.querySelectorAll('[id]')]) {
				const id = target.getAttribute('id');
				if (id) this.notes.set(`${this.path}#${id}`, runs);
			}
			return;
		}
		const inner: Context = { quote: ctx.quote || tag === 'blockquote', marks: ctx.marks | (flags & 0xff) };
		if (tag === 'hr') return;
		if (tag === 'pre') return this.code(el.textContent ?? '');
		if (tag === 'table') return this.table(el, inner);
		if (tag === 'figure' && el.querySelector('img, image')) return this.leaf([el], inner, el, flags);
		if (flags & BOX && el.querySelector(BLOCK_SELECTOR)) {
			// Converted books often draw code listings as a shaded box of one-div-per-line instead of <pre>.
			const lines = [...el.querySelectorAll(BLOCK_SELECTOR)]
				.filter((line) => !line.querySelector(BLOCK_SELECTOR))
				.map((line) => (line.textContent ?? '').trimEnd());
			if (lines.length > 1 && lines.every((l) => l.length <= 120) && lines.some((l) => /[;{}=]|^\s*(\/\/|#)/.test(l)))
				return this.code(lines.join('\n'));
		}
		if (el.querySelector(BLOCK_SELECTOR)) return this.visit(el, inner);
		this.leaf([...el.childNodes], inner, el, flags);
	}

	private leaf(nodes: Node[], ctx: Context, el: Element | null, flags = 0) {
		const media: Media[] = [];
		const runs = this.collect(nodes, ctx.marks, media);
		const plain = runs.map((r) => r.text).join('');
		if (!plain.trim() && !media.length) return;
		// In-book tables of contents: every visible run is an internal link. The sidebar already covers these.
		const tocLine = runs.every((r) => !r.text.trim() || (r.href && !r.note && !/^[a-z][a-z0-9+.-]*:/i.test(r.href)));
		if (tocLine && !media.length) return;
		const tag = el?.localName.toLowerCase() ?? '';

		if (!media.length && (/^h[1-6]$/.test(tag) || (flags & BIG && plain.length <= 120))) {
			return this.push({ kind: 'head', runs, plain, media });
		}
		if (ctx.marks & CODE && runs.every((r) => r.marks & CODE)) return this.code(plain);

		let bullet: string | undefined;
		if (tag === 'li') {
			const list = el!.parentElement;
			if (list?.localName.toLowerCase() === 'ol') {
				const items = [...list.children].filter((c) => c.localName.toLowerCase() === 'li');
				bullet = `${Number(list.getAttribute('start') ?? 1) + items.indexOf(el!)}.`;
			} else bullet = '•';
		}

		const chunks = splitRuns(runs, this.lang, this.limit);
		chunks.forEach((chunk, part) =>
			this.push({
				kind: 'text',
				runs: chunk,
				plain: chunk.map((r) => r.text).join(''),
				media: part === chunks.length - 1 ? media : [],
				part,
				parts: chunks.length,
				quote: ctx.quote,
				bullet: part === 0 ? bullet : undefined
			})
		);
	}

	private code(text: string) {
		const code = text.replace(/^\s*\n/, '').trimEnd();
		if (code) this.push({ kind: 'code', runs: [], plain: code, code });
	}

	private table(el: Element, ctx: Context) {
		const rows = [...el.querySelectorAll('tr')].filter((tr) => tr.closest('table') === el);
		// Single-column tables are layout boxes, not data.
		if (rows.every((tr) => tr.children.length <= 1)) return this.visit(el, ctx);
		const caption = el.querySelector('caption');
		const captionRuns = caption ? this.collect([caption], 0) : [];
		const cells: Cell[][] = rows.map((tr) =>
			[...tr.children]
				.filter((c) => /^t[dh]$/i.test(c.localName))
				.map((c) => ({
					runs: this.collect([...c.childNodes], 0),
					head: c.localName.toLowerCase() === 'th' || !!c.closest('thead'),
					rowspan: Number(c.getAttribute('rowspan')) || 1,
					colspan: Number(c.getAttribute('colspan')) || 1
				}))
		);
		this.anchorIds(el);
		this.push({
			kind: 'table',
			runs: captionRuns,
			plain: [captionRuns, ...cells.flat().map((c) => c.runs)].map((r) => r.map((x) => x.text).join('')).join(' '),
			media: [],
			rows: cells,
			quote: ctx.quote
		});
	}

	/** Flatten inline content to styled runs, collecting images and recording anchors along the way. */
	private collect(nodes: Node[], baseMarks: number, media: Media[] = []): Run[] {
		const runs: Run[] = [];
		const walk = (node: Node, marks: number, href?: string, note?: boolean) => {
			if (node.nodeType === 3) {
				const text = (node.textContent ?? '').replace(/[ \t\n\r\f]+/g, ' ');
				if (text) runs.push({ text, marks, href, note });
				return;
			}
			if (node.nodeType !== 1) return;
			const el = node as Element;
			const tag = el.localName.toLowerCase();
			if (SKIP.test(tag)) return;
			const flags = this.styleOf(el);
			if (flags & HIDDEN) return;
			this.anchorIds(el);
			if (tag === 'br') return void runs.push({ text: '\n', marks });
			if (tag === 'img' || tag === 'image') {
				const src =
					el.getAttribute('src') ?? el.getAttributeNS(XLINK, 'href') ?? el.getAttribute('xlink:href') ?? el.getAttribute('href');
				if (src && !/^data:/.test(src)) {
					const path = resolve(src, this.path);
					this.images.add(path);
					media.push({ src: path, alt: el.getAttribute('alt') ?? '', opaque: false });
				}
				return;
			}
			if (tag === 'math') {
				const text = (el.getAttribute('alttext') || el.textContent || '').replace(/\s+/g, ' ').trim();
				return void runs.push({ text: text || '∎', marks, href, note, math: serializeMath(el) });
			}
			if (tag === 'a' && el.getAttribute('href')) {
				const raw = el.getAttribute('href')!;
				href = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : resolve(raw, this.path);
				note = isNoteRef(el, href, flags);
			}
			for (const child of el.childNodes) walk(child, marks | (flags & 0xff), href, note);
		};
		for (const node of nodes) walk(node, baseMarks);
		return trimRuns(mergeRuns(runs));
	}

	private push(fields: Partial<Post> & Pick<Post, 'kind' | 'runs' | 'plain'>) {
		const notes = [...new Set(fields.runs.filter((r) => r.note && r.href).map((r) => r.href!))];
		this.posts.push({
			id: this.posts.length,
			doc: this.path,
			media: [],
			part: 0,
			parts: 1,
			quote: false,
			chapter: 0,
			notes,
			...fields
		});
	}
}

function isNoteRef(a: Element, href: string, flags: number) {
	if (!href.includes('#') || /^[a-z]+:/i.test(href)) return false;
	const type = `${a.getAttributeNS(OPS, 'type') ?? a.getAttribute('epub:type') ?? ''} ${a.getAttribute('role') ?? ''} ${a.getAttribute('data-type') ?? ''}`;
	if (/backlink/.test(type)) return false;
	if (/noteref/.test(type)) return true;
	const superscript =
		!!(flags & SUP) || !!a.closest('sup') || (a.children.length === 1 && a.children[0].localName.toLowerCase() === 'sup');
	return superscript && (a.textContent?.trim().length ?? 0) <= 4;
}

/** Merge neighbouring runs with identical styling and collapse whitespace across run boundaries. */
function mergeRuns(runs: Run[]): Run[] {
	const out: Run[] = [];
	for (const run of runs) {
		const prev = out.at(-1);
		let text = run.text;
		if (prev && /[ \n]$/.test(prev.text) && text.startsWith(' ')) text = text.slice(1);
		if (!text) continue;
		const same = prev && !prev.math && !run.math && prev.marks === run.marks && prev.href === run.href && prev.note === run.note;
		if (same) prev.text += text;
		else out.push({ ...run, text });
	}
	// A display equation sits on its own line, so spaces beside it would show at the start or end of a line.
	out.forEach((run, i) => {
		if (!run.math || !/^<math[^>]*\sdisplay="block"/.test(run.math)) return;
		if (out[i - 1]) out[i - 1].text = out[i - 1].text.trimEnd();
		if (out[i + 1]) out[i + 1].text = out[i + 1].text.trimStart();
	});
	return out.filter((run) => run.text);
}

function buildChapters(toc: TocEntry[], anchors: Map<string, number>, posts: Post[]): Chapter[] {
	const starts: Omit<Chapter, 'count'>[] = [];
	for (const entry of toc) {
		const start = anchors.get(entry.href) ?? anchors.get(entry.href.split('#')[0]);
		if (start === undefined || start >= posts.length) continue;
		if (starts.some((c) => c.start === start)) continue;
		starts.push({ title: entry.title, start, depth: entry.depth });
	}
	if (!starts.length) {
		for (const post of posts) if (post.kind === 'head') starts.push({ title: post.plain, start: post.id, depth: 0 });
	}
	starts.sort((a, b) => a.start - b.start);
	if (!starts.length || starts[0].start > 0) starts.unshift({ title: 'Front matter', start: 0, depth: 0 });

	const chapters = starts.map((c, i) => ({ ...c, count: (starts[i + 1]?.start ?? posts.length) - c.start }));
	chapters.forEach((chapter, index) => {
		for (let i = chapter.start; i < chapter.start + chapter.count; i++) posts[i].chapter = index;
		// Books that style headings with CSS only: promote the first post when it matches the TOC title.
		const first = posts[chapter.start];
		if (first.kind === 'text' && first.parts === 1 && !first.media.length && similar(first.plain, chapter.title))
			first.kind = 'head';
	});
	return chapters;
}

function similar(a: string, b: string) {
	const [x, y] = [a, b].map((s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
	return !!x && !!y && x.length <= 120 && (x.includes(y) || y.includes(x));
}

async function readToc(
	opf: Document,
	manifest: ManifestItem[],
	byId: Map<string, ManifestItem>,
	read: (p: string) => Promise<string | null>
): Promise<TocEntry[]> {
	const navItem = manifest.find((item) => /\bnav\b/.test(item.props));
	const navSource = navItem && (await read(navItem.href));
	if (navItem && navSource) {
		const doc = html(navSource);
		const navs = [...doc.getElementsByTagName('nav')];
		const nav =
			navs.find((n) => /\btoc\b/.test(n.getAttributeNS(OPS, 'type') ?? n.getAttribute('epub:type') ?? '')) ?? navs[0];
		const entries = [...(nav?.getElementsByTagName('a') ?? [])]
			.filter((a) => a.getAttribute('href'))
			.map((a) => ({
				title: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
				href: resolve(a.getAttribute('href')!, navItem.href),
				depth: depthOf(a, 'ol', nav!)
			}));
		if (entries.length) return entries;
	}
	const ncxItem =
		byId.get(opf.querySelector('spine')?.getAttribute('toc') ?? '') ??
		manifest.find((item) => item.type === 'application/x-dtbncx+xml');
	const ncxSource = ncxItem && (await read(ncxItem.href));
	if (!ncxItem || !ncxSource) return [];
	const ncx = xml(ncxSource);
	return Array.from(ncx.getElementsByTagNameNS('*', 'navPoint'), (point) => ({
		title: (point.getElementsByTagNameNS('*', 'text')[0]?.textContent ?? '').replace(/\s+/g, ' ').trim(),
		href: resolve(point.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('src') ?? '', ncxItem.href),
		depth: depthOf(point, 'navPoint', ncx.documentElement)
	})).filter((e) => e.title);
}

function depthOf(el: Element, tag: string, root: Element) {
	let depth = 0;
	for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (p.localName === tag) depth++;
	return Math.max(0, depth - (tag === 'ol' ? 1 : 0));
}

function parseCss(css: string, into: Map<string, number>) {
	for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const flags = cssFlags(body);
		if (!flags) continue;
		for (const selector of selectors.split(',')) {
			const name = selector.trim().match(/^[a-z0-9]*\.([\w-]+)$/i)?.[1];
			if (name) into.set(name, (into.get(name) ?? 0) | flags);
		}
	}
}

function cssFlags(body: string) {
	let flags = 0;
	if (/font-weight\s*:\s*(bold|bolder|[6-9]00)/i.test(body)) flags |= BOLD;
	if (/font-style\s*:\s*(italic|oblique)/i.test(body)) flags |= ITALIC;
	if (/font-family\s*:[^;]*(mono|courier|consol|menlo)/i.test(body)) flags |= CODE;
	if (/vertical-align\s*:\s*super/i.test(body)) flags |= SUP;
	if (/display\s*:\s*none/i.test(body)) flags |= HIDDEN;
	if (
		/background(-color)?\s*:\s*(?!transparent|none|inherit|initial|white|#fff\b|#ffffff\b)[#a-z]/i.test(body) ||
		/border(-\w+)?(-style)?\s*:[^;]*\bsolid\b/i.test(body)
	)
		flags |= BOX;
	const size = body.match(/font-size\s*:\s*([\d.]+)\s*(em|rem|%)/i);
	if ((size && Number(size[1]) / (size[2] === '%' ? 100 : 1) >= 1.3) || /font-size\s*:\s*x+-large/i.test(body))
		flags |= BIG;
	return flags;
}

/** Resolve an href against the file it appears in; returns a decoded `path` or `path#fragment` key. */
function resolve(href: string, base: string) {
	const url = new URL(href, `https://book.invalid/${base}`);
	const decode = (s: string) => {
		try {
			return decodeURIComponent(s);
		} catch {
			return s;
		}
	};
	return decode(url.pathname.slice(1)) + (url.hash ? `#${decode(url.hash.slice(1))}` : '');
}

function xml(source: string) {
	return new DOMParser().parseFromString(source, 'application/xml');
}

function html(source: string) {
	const doc = new DOMParser().parseFromString(source, 'application/xhtml+xml');
	return doc.getElementsByTagName('parsererror').length ? new DOMParser().parseFromString(source, 'text/html') : doc;
}

function htmlToText(source: string) {
	return (new DOMParser().parseFromString(source, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
