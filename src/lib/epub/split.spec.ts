import { describe, expect, it } from 'vitest';
import { splitRuns } from './split';
import { BOLD, type Run } from './types';

const textOf = (chunks: Run[][]) => chunks.map((c) => c.map((r) => r.text).join(''));

describe('splitRuns', () => {
	it('keeps short paragraphs as a single post', () => {
		const runs = [{ text: 'Short and sweet.', marks: 0 }];
		expect(splitRuns(runs)).toEqual([runs]);
	});

	it('splits at sentence ends into evenly sized posts within the limit', () => {
		const sentence = 'This sentence is exactly fifty characters long ok. ';
		const text = sentence.repeat(7).trim();
		const chunks = textOf(splitRuns([{ text, marks: 0 }], 'en', 280));
		expect(chunks.length).toBe(2);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(280);
			expect(chunk.endsWith('ok.')).toBe(true);
		}
		expect(Math.abs(chunks[0].length - chunks[1].length)).toBeLessThanOrEqual(sentence.length);
		expect(chunks.join(' ')).toBe(text);
	});

	it('falls back to word boundaries for a single overlong sentence', () => {
		const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
		const chunks = textOf(splitRuns([{ text, marks: 0 }], 'en', 280));
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(280);
			expect(chunk).toMatch(/^word\d+( word\d+)*$/);
		}
		expect(chunks.join(' ')).toBe(text);
	});

	it('preserves styling and links on runs that straddle a cut', () => {
		const first = 'A'.repeat(150) + '. ';
		const runs: Run[] = [
			{ text: first, marks: 0 },
			{ text: 'Bold start. ' + 'B'.repeat(150) + '.', marks: BOLD, href: 'ch1.xhtml#x' }
		];
		const chunks = splitRuns(runs, 'en', 280);
		const boldRuns = chunks.flat().filter((r) => r.marks === BOLD);
		expect(boldRuns.every((r) => r.href === 'ch1.xhtml#x')).toBe(true);
		expect(boldRuns.map((r) => r.text).join(' ')).toBe('Bold start. ' + 'B'.repeat(150) + '.');
	});

	it('does not let a footnote marker glued to punctuation hide a sentence end', () => {
		const a = 'x'.repeat(200) + ' guesses.';
		const b = ' Nor will it ' + 'y'.repeat(150) + '.';
		const runs: Run[] = [
			{ text: a, marks: 0 },
			{ text: '1', marks: 0, href: 'notes.xhtml#n1', note: true },
			{ text: b, marks: 0 }
		];
		const [head, tail] = splitRuns(runs, 'en', 280);
		expect(head.at(-1)).toMatchObject({ text: '1', note: true });
		expect(tail[0].text.startsWith('Nor will it')).toBe(true);
	});
});
