/** Display and reading preferences, saved per browser and applied to <html> as a theme attribute and CSS variables. */

const SANS = "TwitterChirp, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const FONT_SIZES = [14, 15, 17, 19, 21];

export const FONTS = {
	sans: { label: 'Sans', stack: SANS },
	serif: { label: 'Serif', stack: "'Iowan Old Style', Charter, 'Palatino Linotype', Georgia, serif" },
	legible: { label: 'Hyperlegible', stack: `'Atkinson Hyperlegible Next', ${SANS}` }
};

export const THEMES = {
	light: { label: 'Default', bg: '#ffffff' },
	dim: { label: 'Dim', bg: '#15202b' },
	dark: { label: 'Lights out', bg: '#000000' }
};

/** Twitter's six accent colours. Yellow is too light for white text. */
export const ACCENTS = {
	blue: { label: 'Blue', color: '#1d9bf0', text: '#fff' },
	yellow: { label: 'Yellow', color: '#ffd400', text: '#0f1419' },
	pink: { label: 'Pink', color: '#f91880', text: '#fff' },
	purple: { label: 'Purple', color: '#7856ff', text: '#fff' },
	orange: { label: 'Orange', color: '#ff7a00', text: '#fff' },
	green: { label: 'Green', color: '#00ba7c', text: '#fff' }
};

/** Characters per post before a paragraph becomes a thread. */
export const POST_LENGTHS = {
	classic: 280,
	long: 1000,
	full: Infinity
};

type Prefs = {
	fontSize: number;
	font: keyof typeof FONTS;
	theme: keyof typeof THEMES;
	accent: keyof typeof ACCENTS;
	postLength: keyof typeof POST_LENGTHS;
	metrics: boolean;
};

const DEFAULTS: Prefs = { fontSize: 1, font: 'sans', theme: 'dark', accent: 'blue', postLength: 'classic', metrics: true };
const KEY = 'settings';

function load(): Prefs {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
		const valid = (value: unknown, options: object) => typeof value === 'string' && value in options;
		return {
			fontSize: Number.isInteger(saved.fontSize) && FONT_SIZES[saved.fontSize!] ? saved.fontSize! : DEFAULTS.fontSize,
			font: valid(saved.font, FONTS) ? saved.font! : DEFAULTS.font,
			theme: valid(saved.theme, THEMES) ? saved.theme! : DEFAULTS.theme,
			accent: valid(saved.accent, ACCENTS) ? saved.accent! : DEFAULTS.accent,
			postLength: valid(saved.postLength, POST_LENGTHS) ? saved.postLength! : DEFAULTS.postLength,
			metrics: typeof saved.metrics === 'boolean' ? saved.metrics : DEFAULTS.metrics
		};
	} catch {
		return DEFAULTS;
	}
}

class Settings {
	fontSize = $state(DEFAULTS.fontSize);
	font = $state(DEFAULTS.font);
	theme = $state(DEFAULTS.theme);
	accent = $state(DEFAULTS.accent);
	postLength = $state(DEFAULTS.postLength);
	metrics = $state(DEFAULTS.metrics);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		Object.assign(this, load());
		$effect.root(() => {
			$effect(() => this.apply());
		});
	}

	reset() {
		Object.assign(this, DEFAULTS);
	}

	private apply() {
		const root = document.documentElement;
		const accent = ACCENTS[this.accent];
		root.dataset.theme = this.theme;
		root.style.setProperty('--accent', accent.color);
		root.style.setProperty('--on-accent', accent.text);
		root.style.setProperty('--post-size', `${FONT_SIZES[this.fontSize]}px`);
		root.style.setProperty('--reading-font', FONTS[this.font].stack);
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[this.theme].bg);
		const prefs: Prefs = {
			fontSize: this.fontSize,
			font: this.font,
			theme: this.theme,
			accent: this.accent,
			postLength: this.postLength,
			metrics: this.metrics
		};
		localStorage.setItem(KEY, JSON.stringify(prefs));
	}
}

export const settings = new Settings();
