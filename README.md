# Linkforge

Turn any pile of HTML into a site of your own.

Paste raw HTML from web pages, portfolios, product lists, media libraries, or bookmarks. LinkForge pulls out every link, thumbnail, and preview, then lets you pick what goes in and generates a finished site in one of six streaming-style templates (Marquee, Poster Wall, Pulse, Bento, Glasshouse, Queue), each with light and dark themes.

**Live editor:** [linkforge-omega.vercel.app](https://linkforge-omega.vercel.app)

## What it does

1. **Sources** — paste HTML or upload `.html` files (drag-and-drop supported). Add as many sources as you want.
2. **Review** — LinkForge finds the repeating card layouts on each page (a grid of 20 matching containers is one *card set*; a page can hold several) and pairs each card's title, thumbnail, and video preview. Where a field has competing sources (two headings, two pictures) the set is flagged and you pick once for the whole set. Any single card can be edited on its own.
3. **Output** — generates a styled standalone HTML page in the template you pick (the review page shows the current one with a "Change template" button). Each preserves source grouping and readable fallback links; cards with a playable video file preview it on hover. **Download** the HTML and host it wherever you like — your own server, GitHub Pages, Netlify, S3, a USB stick, anywhere that can serve static files.

Parser is fully client-side. There are no network calls — your HTML never leaves the browser.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

You can still use any static server if you prefer (for example, `python3 -m http.server 8000`).

## Deployment

The editor itself is deployed to Vercel from this repo's `main` branch. Configuration lives in `vercel.json`. To set up a fresh Vercel project:

```bash
npx vercel link
npx vercel --prod
```

No environment variables required — the app is fully static.

## How extraction works

`parser.js` runs four stages, all client-side:

1. **Detect card sets** (`cards.js`) — cluster structurally matching siblings, merge matching runs across parents (grid rows, masonry columns), and settle which nesting level is the card.
2. **One destination per card** — a card's author, tag, and comment links become alternates of the card instead of items of their own.
3. **Resolve fields per card** — ordered rule lists produce every title, image, and video candidate inside the card's real bounds.
4. **Judge each set as a group** — a title or image that repeats on every card is a label or logo and is replaced; fields with real rivals are reported as ambiguous.

`parseSourceWithMeta()` returns `items` (each with `setId` and its candidate lists) and `cardSets` (each with per-field `strategy`, `ambiguous`, `rivals`, `options`).

## Adding a template

Templates are data. Each one is a preset object in the `PRESETS` list at the top of `templates.js`: fonts (Google Fonts family names), a dark and a light palette of seven colours, a layout (`rails`, `grid`, `posters`, `bento`, `list`), a hero style, and how a card looks (image ratio, corner radius, title below or over the picture, hover effect). One shared engine renders every preset.

To add a template, add one object to `PRESETS`. It then appears in the picker with a generated preview, loads its own fonts, and gets the source filter, theme toggle, hover video previews and link tail. The template test suites read the preset list, so a new preset is tested without adding test code. The schema is documented in the comment at the top of `templates.js`.

A new *layout* (a new way of arranging cards) is the one thing that needs engine code: an entry in `LAYOUTS` and, if it is not a planned grid, a branch in `renderItems()`.

## Tests

`npm test` runs the parser and template suites; `npm run test:browser` drives the app in Chromium.

Parser sweep fixtures and the latest sweep outputs are in `tests/fixtures/` and `tests/sweep-results.json`.
