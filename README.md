# Doomscroll

Read any EPUB as if you were doomscrolling Twitter in Lights Out mode.

Every paragraph becomes a post from the author, long paragraphs turn into threads, chapters trend in the sidebar, footnotes show up as replies, and tables, figures and code listings render as cards. Books are parsed in the browser and stored locally (IndexedDB); nothing is uploaded.

## Run

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # static site in build/
pnpm test         # unit tests
pnpm check        # svelte-check
```

Open or drop an `.epub` anywhere on the page. The most recently read book reopens automatically, at the post you were on.

## How a book becomes a feed

| EPUB content | In the feed |
| --- | --- |
| Paragraph, list item, loose inline text | A post (lists keep `•` / `1.` markers) |
| Paragraph over 280 characters | A thread, split at sentence ends into evenly sized posts |
| `h1`–`h6`, or a large-font CSS class, or a block matching the TOC title | Section header |
| TOC entries (EPUB 3 nav or NCX) | “What’s happening” trends with post counts and reading progress |
| `blockquote` | Quote-card post |
| `figure` / images | Media post; the caption is the post text |
| `table` | Table card (keeps `rowspan`/`colspan`; single-column layout tables are unwrapped) |
| `pre`, monospace CSS, or shaded one-line-per-`div` listings | Code card |
| Footnote references (`epub:type`/`role` noteref, or superscript links) | Reply count; clicking shows the note as replies |
| In-book table of contents pages | Dropped (the sidebar covers them) |
| `dc:creator` entries | First author posts everything; the profile lists all authors and translators (roles honoured, illustrators/editors skipped when real authors exist) |

Bold/italic/monospace come from tags and from the book's own CSS classes, which matters for Calibre-style conversions that style everything with classes.

## Keyboard

`j` / `k` next / previous post · `l` like · `t` repost · `b` bookmark · `/` search · `Esc` close

## Layout

- `src/lib/epub/` — ZIP reader (native `DecompressionStream`), EPUB parser, thread splitter
- `src/lib/reader.svelte.ts` — reading state: windowed feed, jumps, likes/bookmarks, search
- `src/lib/storage.ts` — IndexedDB library and per-book `localStorage` state
- `src/lib/components/` — X-style UI
