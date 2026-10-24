import type { Book, Post } from './epub/types';

/** Path data for the verified badge, the same shape the UI draws. */
const BADGE =
	'M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z';

const WIDTH = 1080;
const PAD = 64;
const AVATAR = 104;

/** Draw a post as a tweet-style card in the current theme, for sharing outside the app. */
export async function renderPostImage(book: Book, post: Post, font: string): Promise<Blob> {
	const css = getComputedStyle(document.documentElement);
	const color = (name: string) => css.getPropertyValue(name).trim();
	const text = (post.kind === 'code' ? post.code! : post.plain).trim();

	const measure = document.createElement('canvas').getContext('2d')!;
	const size = text.length > 400 ? 38 : 46;
	measure.font = `${size}px ${font}`;
	const lines = wrap(measure, text, WIDTH - PAD * 2);
	const lineHeight = Math.round(size * 1.35);
	const height = PAD + AVATAR + 40 + lines.length * lineHeight + 56 + 40 + PAD;

	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = color('--bg');
	ctx.fillRect(0, 0, WIDTH, height);

	if (book.cover) {
		const image = await load(book.cover);
		ctx.save();
		ctx.beginPath();
		ctx.arc(PAD + AVATAR / 2, PAD + AVATAR / 2, AVATAR / 2, 0, Math.PI * 2);
		ctx.clip();
		const scale = Math.max(AVATAR / image.width, AVATAR / image.height);
		ctx.drawImage(image, PAD + (AVATAR - image.width * scale) / 2, PAD + (AVATAR - image.height * scale) / 2, image.width * scale, image.height * scale);
		ctx.restore();
	}

	const nameX = PAD + AVATAR + 24;
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = color('--strong');
	ctx.font = `bold 38px ${font}`;
	const name = fit(ctx, book.author, WIDTH - nameX - PAD - 52);
	ctx.fillText(name, nameX, PAD + 46);
	const badgeX = nameX + ctx.measureText(name).width + 8;
	ctx.save();
	ctx.translate(badgeX, PAD + 12);
	ctx.scale(40 / 24, 40 / 24);
	ctx.fillStyle = color('--accent');
	ctx.fill(new Path2D(BADGE));
	ctx.restore();
	ctx.fillStyle = color('--muted');
	ctx.font = `34px ${font}`;
	ctx.fillText(`@${book.handle}`, nameX, PAD + 92);

	ctx.fillStyle = color('--strong');
	ctx.font = `${size}px ${font}`;
	let y = PAD + AVATAR + 40 + size;
	for (const line of lines) {
		ctx.fillText(line, PAD, y);
		y += lineHeight;
	}

	ctx.fillStyle = color('--border');
	ctx.fillRect(PAD, y + 8, WIDTH - PAD * 2, 2);
	ctx.fillStyle = color('--muted');
	ctx.font = `30px ${font}`;
	ctx.fillText(fit(ctx, `${book.title} · read on Doomscroll`, WIDTH - PAD * 2), PAD, y + 64);

	const { promise, resolve, reject } = Promise.withResolvers<Blob>();
	canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the image'))), 'image/png');
	return promise;
}

/** Share the image through the system share sheet when the browser can, otherwise download it. */
export async function sharePostImage(blob: Blob, title: string): Promise<'shared' | 'saved'> {
	const file = new File([blob], `${title.replace(/[^\w-]+/g, '-').slice(0, 40) || 'post'}.png`, { type: 'image/png' });
	if (navigator.canShare?.({ files: [file] })) {
		await navigator.share({ files: [file] });
		return 'shared';
	}
	const url = URL.createObjectURL(file);
	const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return 'saved';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let line = '';
		for (const word of paragraph.split(/(?<=\s)/)) {
			if (line && ctx.measureText(line + word).width > width) {
				lines.push(line.trimEnd());
				line = '';
			}
			line += word;
		}
		lines.push(line.trimEnd());
	}
	return lines;
}

function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
	if (ctx.measureText(text).width <= width) return text;
	let cut = text;
	while (cut && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
	return `${cut.trimEnd()}…`;
}

function load(src: string): Promise<HTMLImageElement> {
	const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
	const image = new Image();
	image.onload = () => resolve(image);
	image.onerror = reject;
	image.src = src;
	return promise;
}
