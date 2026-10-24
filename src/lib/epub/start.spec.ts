import { describe, expect, it } from 'vitest';
import { tocStarts } from './parse';

/** The guesses tocStarts makes, as entry titles: [after "Contents", chapter one, first real entry]. */
const guesses = (titles: string[], book: string) => {
	const toc = titles.map((title, i) => ({ title, href: `ch${i}.xhtml`, depth: 0 }));
	return tocStarts(toc, book).map((href) => (href ? titles[Number(href.slice(2, -6))] : undefined));
};

describe('tocStarts', () => {
	it('takes the first real entry after Contents, skipping repeated titles and prefaces', () => {
		const [afterContents] = guesses(['DRACULA', 'Contents', 'D R A C U L A', 'THE PREFACE', 'CHAPTER I'], 'Dracula');
		expect(afterContents).toBe('CHAPTER I');
	});

	it('keeps an opening that is not called chapter one, like Frankenstein’s letters', () => {
		expect(guesses(['Frankenstein', 'Contents', 'Letter 1', 'Chapter 1'], 'Frankenstein')[0]).toBe('Letter 1');
	});

	it('recognises chapter one in Spanish, Afrikaans, French, and German', () => {
		expect(guesses(['LIBRO PRIMERO DUNE', 'CAPÍTULO I'], 'Dune')[1]).toBe('LIBRO PRIMERO DUNE');
		expect(guesses(['Titelblad', 'Aanhalings', 'Hoofstuk 1: Sestien minute'], 'Moord')[1]).toBe('Hoofstuk 1: Sestien minute');
		expect(guesses(['Couverture', 'Chapitre premier'], 'Livre')[1]).toBe('Chapitre premier');
		expect(guesses(['Inhalt', 'Erster Teil'], 'Buch')[1]).toBe('Erster Teil');
	});

	it('accepts a bare number before a capitalised title, but not a sentence that starts with 1', () => {
		expect(guesses(['Cover Page', '1 in 3 people agree', '1 INTRODUCTORY CONCEPTS'], 'Graphics')[1]).toBe(
			'1 INTRODUCTORY CONCEPTS'
		);
	});

	it('jumps past a classic’s editorial introduction to the half-title of the main text', () => {
		const titles = ['The Count of Monte Cristo (Unabridged)', 'Chronology', 'Introduction', 'A Note on the Text', 'The Count of Monte Cristo', 'Notes'];
		expect(guesses(titles, 'The Count of Monte Cristo')[2]).toBe('The Count of Monte Cristo');
	});

	it('otherwise falls back to the first entry past the front matter and the title', () => {
		expect(guesses(['Cubierta', 'El último barco', 'Nido', 'Preludio'], 'El último barco')[2]).toBe('Nido');
	});
});
