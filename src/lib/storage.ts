/** Local persistence: the book files live in IndexedDB, small per-book reading state in localStorage. */

export type SavedBook = {
	key: string;
	title: string;
	author: string;
	file: Blob;
	cover?: Blob;
	opened: number;
};

export type ReadingState = { position: number; total: number; likes: number[]; reposts: number[]; bookmarks: number[] };

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
export const listBooks = async () =>
	(await transact<SavedBook[]>('readonly', (s) => s.getAll())).sort((a, b) => b.opened - a.opened);

export function loadState(key: string): ReadingState {
	const empty = { position: 0, total: 0, likes: [], reposts: [], bookmarks: [] };
	try {
		return { ...empty, ...JSON.parse(localStorage.getItem(`state:${key}`) ?? '{}') };
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
