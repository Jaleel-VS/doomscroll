import type { Run } from './types';

export const POST_LIMIT = 280;

const segmenters = new Map<string, Intl.Segmenter>();

/** Split a paragraph into thread-sized chunks, preferring sentence ends, then word ends. */
export function splitRuns(runs: Run[], lang = 'en', limit = POST_LIMIT): Run[][] {
	const text = runs.map((r) => r.text).join('');
	if (text.length <= limit) return [runs];

	let segmenter = segmenters.get(lang);
	if (!segmenter) {
		segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
		segmenters.set(lang, segmenter);
	}
	// Footnote markers glued to punctuation ("guesses.¹ Nor") hide sentence ends; blank them for segmentation.
	const prose = runs.map((r) => (r.note ? ' '.repeat(r.text.length) : r.text)).join('');
	const sentenceEnds = Array.from(segmenter.segment(prose), (s) => s.index + s.segment.length);

	const cuts: number[] = [];
	let from = 0;
	while (text.length - from > limit) {
		// Aim for evenly sized posts so a thread doesn't end on a stub.
		const rest = text.length - from;
		const target = from + rest / Math.ceil(rest / limit);
		let cut = 0;
		for (const end of sentenceEnds) {
			if (end <= from) continue;
			if (end - from > limit) break;
			if (!cut || Math.abs(end - target) < Math.abs(cut - target)) cut = end;
		}
		if (!cut) {
			const space = text.lastIndexOf(' ', Math.min(from + limit, Math.ceil(target)));
			cut = space > from ? space + 1 : from + limit;
		}
		cuts.push(cut);
		from = cut;
	}
	cuts.push(text.length);

	const chunks: Run[][] = [];
	let start = 0;
	for (const end of cuts) {
		const chunk = trimRuns(sliceRuns(runs, start, end));
		if (chunk.length) chunks.push(chunk);
		start = end;
	}
	return chunks;
}

function sliceRuns(runs: Run[], start: number, end: number): Run[] {
	const out: Run[] = [];
	let offset = 0;
	for (const run of runs) {
		const a = Math.max(start, offset);
		const b = Math.min(end, offset + run.text.length);
		// An equation can't be cut in half; it goes whole into the post where it starts.
		if (run.math) {
			if (offset >= start && offset < end) out.push(run);
		} else if (a < b) out.push({ ...run, text: run.text.slice(a - offset, b - offset) });
		offset += run.text.length;
	}
	return out;
}

/** Trim whitespace at the edges of a run list, dropping runs that become empty. */
export function trimRuns(runs: Run[]): Run[] {
	const out = runs.map((r) => ({ ...r }));
	while (out.length) {
		out[0].text = out[0].text.trimStart();
		if (out[0].text) break;
		out.shift();
	}
	while (out.length) {
		const last = out[out.length - 1];
		last.text = last.text.trimEnd();
		if (last.text) break;
		out.pop();
	}
	return out;
}
