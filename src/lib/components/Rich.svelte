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
</script>

{#each runs as run, i (i)}{#if run.note}<button class="note {classes(run.marks)}" onclick={onnote}>{run.text}</button>{:else if run.href && /^(https?|mailto):/i.test(run.href)}<a class={classes(run.marks)} href={run.href} target="_blank" rel="noopener noreferrer">{run.text}</a>{:else if run.href}<a class={classes(run.marks)} href="#{run.href}" onclick={(e) => follow(e, run.href!)}>{run.text}</a>{:else}<span class={classes(run.marks)}>{run.text}</span>{/if}{/each}

<style>
	.b {
		font-weight: 700;
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
</style>
