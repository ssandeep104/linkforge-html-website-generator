# Linkforge

Turn any pile of HTML into a site of your own.

Paste raw HTML from creator feeds, research pages, photography sets, video hubs, or your own bookmarks. Linkforge pulls out every link, thumbnail, and preview, then lets you pick what goes in and generates a finished site in one of six templates.

**Live editor:** [linkforge-omega.vercel.app](https://linkforge-omega.vercel.app)

## What it does

1. **Sources** — paste HTML or upload `.html` files (drag-and-drop supported). Add as many sources as you want.
2. **Review** — Linkforge parses every anchor, image, and video into three buckets: links with image, links with video preview, and plain links. Pick what makes the cut with dropdowns + checkboxes.
3. **Output** — generates a styled standalone HTML page. Seven templates: Marquee, Creator Grid, Stream Catalog, Photo Wall, Spotlight Bento, Signal Board, and Story Deck. The default experience now leans toward streaming, gallery, and mixed-media outputs while still preserving source grouping and readable fallback links. **Download** the HTML and host it wherever you like — your own server, GitHub Pages, Netlify, S3, a USB stick, anywhere that can serve static files.

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

## Tests

Parser sweep fixtures and the latest sweep outputs are in `tests/fixtures/` and `tests/sweep-results.json`.
