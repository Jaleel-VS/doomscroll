import { describe, expect, it } from 'vitest';
import { splitNames } from './parse';

describe('splitNames', () => {
	it('keeps a single name as-is', () => {
		expect(splitNames('  Matt   Dinniman ')).toEqual(['Matt Dinniman']);
	});

	it('flips a sorted "Last, First" name', () => {
		expect(splitNames('Dinniman, Matt')).toEqual(['Matt Dinniman']);
		expect(splitNames('Tolkien, J. R. R.')).toEqual(['J. R. R. Tolkien']);
	});

	it('splits several people crammed into one creator', () => {
		expect(splitNames('John Berryman and Albert Ziegler')).toEqual(['John Berryman', 'Albert Ziegler']);
		expect(splitNames('Ann Lee & Bo Chen')).toEqual(['Ann Lee', 'Bo Chen']);
		expect(splitNames('Ann Lee, Bo Chen, and Cy Diaz')).toEqual(['Ann Lee', 'Bo Chen', 'Cy Diaz']);
		expect(splitNames('Ann Lee; Bo Chen')).toEqual(['Ann Lee', 'Bo Chen']);
	});

	it('does not split names that merely contain "and"', () => {
		expect(splitNames('Sandra Anderson')).toEqual(['Sandra Anderson']);
	});

	it('leaves an ambiguous single comma between full names alone', () => {
		expect(splitNames('Le Guin, Ursula K.')).toEqual(['Le Guin, Ursula K.']);
	});
});
