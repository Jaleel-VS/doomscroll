<script lang="ts">
	import { reader } from '#lib/reader.svelte.js';
	import type { Run } from '#lib/epub/types.js';

	let { runs, onnote }: { runs: Run[]; onnote?: () => void } = $props();

	const NAMES = ['b', 'i', 'c', 'sup', 'sub', 'u', 's'];
	const classes = (marks: number) => NAMES.filter((_, bit) => marks & (1 << bit)).join(' ');

	function follow(event: MouseEvent, href: string) {
		event.preventDefault();
		const anchors = reader.book?.anchors;
		const target = anchors?.get(href) ?? anchors?.get(href.split('#')[0]);
		if (target !== undefined) reader.jump(target);
	}

	/** Split text around case-insensitive matches of the current search so they can be highlighted. */
	function pieces(text: string) {
		const needle = reader.query.toLowerCase();
		if (!needle) return [{ text, hit: false }];
		const lower = text.toLowerCase();
		const out: { text: string; hit: boolean }[] = [];
		let from = 0;
		for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
			if (at > from) out.push({ text: text.slice(from, at), hit: false });
			out.push({ text: text.slice(at, at + needle.length), hit: true });
			from = at + needle.length;
		}
		if (from < text.length) out.push({ text: text.slice(from), hit: false });
		return out;
	}
</script>

{#snippet marked(text: string)}{#each pieces(text) as piece, p (p)}{#if piece.hit}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}{/snippet}

<!-- Equations: `run.math` is MathML rebuilt from an allowlist in epub/mathml.ts, never the book's raw markup. -->
{#each runs as run, i (i)}{#if run.math}<span class="math">{@html run.math}</span>{:else if run.note}<button class="note {classes(run.marks)}" onclick={onnote}>{run.text}</button>{:else if run.href && /^(https?|mailto):/i.test(run.href)}<a class={classes(run.marks)} href={run.href} target="_blank" rel="noopener noreferrer">{@render marked(run.text)}</a>{:else if run.href}<a class={classes(run.marks)} href="#{run.href}" onclick={(e) => follow(e, run.href!)}>{@render marked(run.text)}</a>{:else}<span class={classes(run.marks)}>{@render marked(run.text)}</span>{/if}{/each}

<style>
	.b {
		font-weight: 700;
	}
	.math {
		font-size: 1.1em;
	}
	/* Display equations get their own line and scroll sideways instead of overflowing the post. */
	.math :global(math[display='block']) {
		display: block math;
		margin: 8px 0;
		overflow-x: auto;
		overflow-y: hidden;
	}
	.i {
		font-style: italic;
	}
	.c {
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.9em;
		background: var(--card);
		border-radius: 4px;
		padding: 0 3px;
	}
	.sup,
	.sub {
		font-size: 0.75em;
		line-height: 0;
	}
	.sup {
		vertical-align: super;
	}
	.sub {
		vertical-align: sub;
	}
	.u {
		text-decoration: underline;
	}
	.s {
		text-decoration: line-through;
	}
	a,
	.note {
		color: var(--accent);
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	.note {
		font: inherit;
		font-size: 0.75em;
		vertical-align: super;
		line-height: 0;
		padding: 0 2px;
		background: none;
		border: 0;
		cursor: pointer;
	}
	mark {
		border-radius: 3px;
		background: color-mix(in srgb, var(--accent) 35%, transparent);
		color: inherit;
	}
</style>
