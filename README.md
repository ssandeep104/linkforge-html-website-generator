# Linkforge

Turn any pile of HTML into a site of your own.

Paste raw HTML from news, research, photography, video, or your own bookmarks. Linkforge pulls out every link, thumbnail, and preview, then lets you pick what goes in and generates a finished site in one of six editorial templates.

**Live editor:** [linkforge.vercel.app](https://linkforge.vercel.app)

## What it does

1. **Sources** — paste HTML or upload `.html` files (drag-and-drop supported). Add as many sources as you want.
2. **Review** — Linkforge parses every anchor, image, and video into three buckets: links with image, links with video preview, and plain links. Pick what makes the cut with dropdowns + checkboxes.
3. **Output** — generates a styled standalone HTML page. Six templates: Editorial, Journal, Showcase, Gallery, Linklog, Screening. Then either **Download** the HTML or **Publish to Vercel** at `linkforge-<your-slug>.vercel.app`.

Parser is fully client-side. The only network call is `POST /api/publish` when you choose to publish a generated page, which uses a serverless function to hand the bundle to Vercel.

## Run locally

```bash
# any static server works for the editor
python3 -m http.server 8000
# open http://localhost:8000
```

The `/api/publish` serverless function only runs in Vercel's environment (it needs `VERCEL_TOKEN` set as a project env var — see Deployment below).

## Deployment

The editor itself is deployed to Vercel from this repo's `main` branch. Configuration lives in `vercel.json`. To set up a fresh Vercel project:

```bash
npx vercel link
npx vercel env add VERCEL_TOKEN  # paste a token with scope to create projects + deploy
npx vercel --prod
```

`VERCEL_TOKEN` is what the `/api/publish` function uses to spin up each generated page as its own Vercel project. Optional `VERCEL_TEAM_ID` if the token belongs to a team.

## Tests

`tests/run-sweep.js` is a Playwright-based parser regression harness — 17 fixtures from major news, video, and social sites. Run it with:

```bash
node tests/run-sweep.js
```

Latest results: `tests/sweep-results.json`.
