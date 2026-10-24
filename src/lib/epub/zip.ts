/** Minimal ZIP reader for EPUBs: central directory + stored/deflate entries via the native DecompressionStream. */
export type ZipReader = (path: string) => Promise<Uint8Array<ArrayBuffer> | null>;

type Entry = { method: number; size: number; offset: number };

export function openZip(buffer: ArrayBuffer): ZipReader {
	const view = new DataView(buffer);
	const bytes = new Uint8Array(buffer);
	let eocd = buffer.byteLength - 22;
	while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
	if (eocd < 0) throw new Error('This file is not an EPUB (no ZIP directory found).');

	const entries = new Map<string, Entry>();
	const folded = new Map<string, string>();
	const utf8 = new TextDecoder();
	const latin1 = new TextDecoder('windows-1252');
	let p = view.getUint32(eocd + 16, true);
	const count = view.getUint16(eocd + 10, true);
	for (let k = 0; k < count && view.getUint32(p, true) === 0x02014b50; k++) {
		const flags = view.getUint16(p + 8, true);
		const nameLen = view.getUint16(p + 28, true);
		const extraLen = view.getUint16(p + 30, true);
		const commentLen = view.getUint16(p + 32, true);
		const raw = bytes.subarray(p + 46, p + 46 + nameLen);
		const name = (flags & 0x800 ? utf8 : isUtf8(raw) ? utf8 : latin1).decode(raw);
		entries.set(name, {
			method: view.getUint16(p + 10, true),
			size: view.getUint32(p + 20, true),
			offset: view.getUint32(p + 42, true)
		});
		folded.set(name.toLowerCase(), name);
		p += 46 + nameLen + extraLen + commentLen;
	}

	return async (path) => {
		const entry = entries.get(path) ?? entries.get(folded.get(path.toLowerCase()) ?? '');
		if (!entry) return null;
		const o = entry.offset;
		const start = o + 30 + view.getUint16(o + 26, true) + view.getUint16(o + 28, true);
		const data = bytes.subarray(start, start + entry.size);
		if (entry.method === 0) return data;
		if (entry.method !== 8) throw new Error(`Unsupported ZIP compression method ${entry.method}`);
		const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	};
}

function isUtf8(raw: Uint8Array) {
	try {
		new TextDecoder('utf-8', { fatal: true }).decode(raw);
		return true;
	} catch {
		return false;
	}
}
