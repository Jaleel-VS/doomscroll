/*
 * Offline support. The app is a static shell, so caching the build output and `static/` files lets Doomscroll open
 * and read saved books with no network. Books themselves live in IndexedDB, not in this cache.
 */
import { self } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `doomscroll-${version}`;
// The demo book is several megabytes; it's fetched only when someone taps "Try it", then lives in IndexedDB.
const SHELL = [...immutable, ...assets, ...prerendered]
	.map(({ path }) => new URL(path, self.registration.scope).pathname)
	.filter((path) => !path.startsWith('/demo/'));
const shell = new Set(SHELL);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (shell.has(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
		return;
	}
	if (request.mode === 'navigate') {
		// Fresh page when online, the cached shell when not.
		event.respondWith(
			fetch(request).catch(async () => (await caches.match(new URL('./', self.registration.scope).pathname)) ?? Response.error())
		);
	}
});
