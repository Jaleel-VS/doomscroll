# Doomscroll

Doomscroll turns an EPUB into a Twitter timeline, so you can read a book the way you'd doomscroll in Lights Out mode. Each paragraph is a post from the author. Long paragraphs become threads, chapters trend in the sidebar, and footnotes show up as replies.

Everything runs in your browser. The book is parsed on your device and saved in IndexedDB, and nothing is uploaded.

![A thread from Alice's Adventures in Wonderland, with chapters trending in the sidebar](docs/screenshots/thread.png)

## Run it

You need Node and pnpm.

```sh
pnpm install
pnpm dev      # http://localhost:5173
```

Open an `.epub` or drop one anywhere on the page. The last book you read reopens at the post you were on.

Other scripts:

```sh
pnpm build    # static site in build/
pnpm test     # unit tests
pnpm check    # svelte-check
```

`pnpm build` writes a static site, so you can host `build/` anywhere that serves files.

## What it looks like

The top of the feed is the book's profile: the cover is the avatar, and the header lists the authors, the publication year, and the chapter and post counts.

![The profile header for Alice's Adventures in Wonderland](docs/screenshots/profile.png)

Illustrations become media posts, and chapter headings become section breaks in the feed.

![An illustration post followed by the next chapter heading](docs/screenshots/illustration.png)

On a phone you get the mobile layout: a bottom tab bar, and a drawer for search and chapters that opens when you tap your avatar.

| Feed | Chapters |
| --- | --- |
| ![Mobile feed](docs/screenshots/mobile-feed.png) | ![Mobile chapter drawer](docs/screenshots/mobile-chapters.png) |

The landing page keeps a list of the books you've opened, with how far you got in each.

![The landing page with two books in progress](docs/screenshots/landing.png)

The screenshots use public-domain books from [Project Gutenberg](https://www.gutenberg.org/).

## How a book becomes a feed

| In the EPUB | In the feed |
| --- | --- |
| Paragraph, list item, or loose text | A post. Lists keep their `•` or `1.` markers. |
| Paragraph over 280 characters | A thread, split at sentence ends into posts of similar length. |
| `h1` to `h6`, a large-font CSS class, or a line that matches the table of contents | A section header. |
| Table of contents (EPUB 3 nav or NCX) | The "What's happening" trends, with post counts and your progress. |
| `blockquote` | A quote card. |
| `figure` or image | A media post. The caption is the post text. |
| `table` | A table card that keeps `rowspan` and `colspan`. Single-column layout tables are unwrapped. |
| `pre`, monospace CSS, or a shaded box with one `div` per line | A code card. |
| Footnote reference (`noteref` type or role, or a superscript link) | The reply count. Click it to read the note as a reply. |
| The book's own contents page | Dropped, because the sidebar already lists the chapters. |
| `dc:creator` | The first author writes every post. The profile lists every author and translator. |

Bold, italic, and monospace come from the HTML tags and from the book's CSS classes. That matters for books converted with Calibre, which often style everything through classes.

The like, repost, reply, and view counts are made up. They come from a hash of each post, so they stay the same between visits. Your likes, reposts, and bookmarks are real and saved per book.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `j` | Next post |
| `k` | Previous post |
| `l` | Like |
| `t` | Repost |
| `b` | Bookmark |
| `/` | Search the book |
| `Esc` | Close the drawer |

## Limits

- Doomscroll needs a recent browser: Chrome 119, Safari 17.4, Firefox 125, or later. It relies on the built-in `DecompressionStream`, `Intl.Segmenter`, and `Promise.withResolvers`.
- There's no DRM support.
- ZIP64 archives don't open. EPUBs are rarely large enough to use ZIP64.
- Math shows as plain italic text, not rendered equations.
- Book metadata is shown as the book provides it. A messy title in the EPUB is a messy title in the feed.

## Code layout

| Path | What it does |
| --- | --- |
| `src/lib/epub/zip.ts` | Reads the EPUB's ZIP archive with the browser's `DecompressionStream`. |
| `src/lib/epub/parse.ts` | Turns the package, table of contents, and chapters into posts. |
| `src/lib/epub/split.ts` | Splits long paragraphs into threads. |
| `src/lib/reader.svelte.ts` | Holds the reading state: the rendered window of posts, jumps, likes, bookmarks, and search. |
| `src/lib/storage.ts` | Saves books to IndexedDB and reading progress to `localStorage`. |
| `src/lib/components/` | The Twitter-style UI. |

Doomscroll isn't affiliated with Twitter or X. The bird logo belongs to X Corp.
