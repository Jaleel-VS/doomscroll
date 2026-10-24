/**
 * Full-screen photo viewer, like tapping an image on X. Opening and closing use a view transition, so the image grows
 * out of its place in the post and shrinks back into it. Browsers without view transitions, and readers who prefer
 * reduced motion, get the viewer without the animation.
 */
import { tick } from 'svelte';

export type Photo = { src: string; alt: string; matte: boolean; width: number; height: number };

const NAME = 'lightbox';

class Lightbox {
	photo = $state<Photo | null>(null);
	private origin: HTMLElement | null = null;

	/** Open the viewer from an image in a post; its natural size sets how large the viewer may draw it. */
	open(origin: HTMLImageElement, photo: Omit<Photo, 'width' | 'height'>) {
		this.origin = origin;
		const size = { width: origin.naturalWidth || origin.width, height: origin.naturalHeight || origin.height };
		this.swap(origin, () => (this.photo = { ...photo, ...size }));
	}

	close() {
		if (!this.photo) return;
		this.swap(this.origin, () => (this.photo = null), true);
	}

	/** Run `change` inside a view transition that hands the shared name between the post image and the viewer. */
	private swap(origin: HTMLElement | null, change: () => void, closing = false) {
		const animate =
			'startViewTransition' in document && origin?.isConnected && !matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!animate) {
			change();
			return;
		}
		// The element that carries the name in each snapshot is the one the browser morphs between.
		if (!closing) origin!.style.setProperty('view-transition-name', NAME);
		const transition = document.startViewTransition(async () => {
			if (closing) origin!.style.setProperty('view-transition-name', NAME);
			else origin!.style.removeProperty('view-transition-name');
			change();
			await tick();
		});
		transition.finished.finally(() => origin?.style.removeProperty('view-transition-name'));
	}
}

export const lightbox = new Lightbox();
