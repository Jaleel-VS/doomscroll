import type { Locator } from './locator';

/** Local persistence: the book files live in IndexedDB, small per-book reading state in localStorage. */

export type SavedBook = {
	key: string;
	title: string;
	author: string;
	file: Blob;
	cover?: Blob;
	opened: number;
};

/** A saved post. Plain numbers are post ids written before locators existed; they resolve as-is once, then get rewritten. */
export type Mark = Locator | number;

/** Something you wrote under a post. `time` is when, in milliseconds since the epoch. */
export type SavedReply = { mark: Mark; text: string; time: number };

export type ReadingState = {
	progress: number;
	position: Mark;
	likes: Mark[];
	reposts: Mark[];
	bookmarks: Mark[];
	replies: SavedReply[];
	/** The reader closed the "Go to chapter 1" pill for this book. */
	startDismissed: boolean;
};

const DB = 'doomscroll';
const STORE = 'books';

function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const { promise, resolve, reject } = Promise.withResolvers<T>();
	const open = indexedDB.open(DB, 1);
	open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'key' });
	open.onerror = () => reject(open.error);
	open.onsuccess = () => {
		const request = run(open.result.transaction(STORE, mode).objectStore(STORE));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	};
	return promise;
}
export const saveBook = (book: SavedBook) => transact('readwrite', (s) => s.put(book));
export const loadBook = (key: string) => transact<SavedBook | undefined>('readonly', (s) => s.get(key));
export const deleteBook = (key: string) => transact('readwrite', (s) => s.delete(key));
/** Remove every saved book and its reading state from this browser. Display settings stay. */
export async function clearLibrary() {
	await transact('readwrite', (s) => s.clear());
	for (const key of Object.keys(localStorage)) if (key.startsWith('state:')) localStorage.removeItem(key);
}
export const listBooks = async () =>
	(await transact<SavedBook[]>('readonly', (s) => s.getAll())).sort((a, b) => b.opened - a.opened);

export function loadState(key: string): ReadingState {
	const empty: ReadingState = { progress: 0, position: 0, likes: [], reposts: [], bookmarks: [], replies: [], startDismissed: false };
	try {
		const saved = JSON.parse(localStorage.getItem(`state:${key}`) ?? '{}');
		// Older saves stored `position` as an id plus the post count instead of a progress fraction.
		saved.progress ??= typeof saved.position === 'number' && saved.total > 1 ? saved.position / (saved.total - 1) : 0;
		delete saved.total;
		return { ...empty, ...saved };
	} catch {
		return empty;
	}
}

export function saveState(key: string, state: ReadingState) {
	localStorage.setItem(`state:${key}`, JSON.stringify(state));
}

export function forgetState(key: string) {
	localStorage.removeItem(`state:${key}`);
}
