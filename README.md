# Linkforge

Turn any pile of HTML into a site of your own.

Paste raw HTML from creator feeds, research pages, photography sets, video hubs, or your own bookmarks. Linkforge pulls out every link, thumbnail, and preview, then lets you pick what goes in and generates a finished site in one of six templates.

**Live editor:** [linkforge-omega.vercel.app](https://linkforge-omega.vercel.app)

## What it does

1. **Sources** — paste HTML or upload `.html` files (drag-and-drop supported). Add as many sources as you want.
2. **Review** — Linkforge parses every anchor, image, and video into three buckets: links with image, links with video preview, and plain links. Pick what makes the cut with dropdowns + checkboxes.
3. **Output** — generates a styled standalone HTML page. Eight templates: Marquee, Fire TV App, Creator Grid, Stream Catalog, Photo Wall, Spotlight Bento, Signal Board, and Story Deck. The default experience now leans toward streaming, gallery, and mixed-media outputs while still preserving source grouping and readable fallback links. **Download** the HTML and host it wherever you like — your own server, GitHub Pages, Netlify, S3, a USB stick, anywhere that can serve static files.

### Fire TV App export

The **Fire TV App** template doesn't export a website — it exports an Android app. The output is a lean-back, 10-foot UI (shelf rows per source, amber focus ring, built-in fullscreen video player) driven entirely by the Fire TV remote: D-pad browses, center opens/plays, Back closes the player, and the play/pause / rewind / fast-forward buttons work during playback. No mouse or ADB keyboard app required.

Videos play **inside the app** instead of bouncing to the source website: direct MP4/WebM links use the native player (hardware decode), while YouTube, Vimeo, and Dailymotion links open in an in-app embedded player that the remote drives over each provider's postMessage API — so OK/seek/Back keep working even inside the embed. Only links with no recognizable video source open as pages.

Links that do open as pages load in full desktop disguise (desktop user agent, desktop client hints, spoofed JS fingerprint, viewport fitted to the TV screen), with the remote acting as a mouse pointer. Video on those pages stays remote-controllable too — play/pause / rewind / fast-forward work everywhere, in fullscreen the D-pad becomes seek/play transport control, and the remote's menu (≡) button snaps any playing video to fullscreen directly, no hunting for the player's own fullscreen button.

Ad blocking is built in and always on: the app has no tabs, so an ad popunder or redirect would hijack the only view there is. Requests to major ad networks are dropped, gestureless popups are swallowed, app-store/intent redirects are blocked, and holding Back always jumps straight home to the shelves.

Downloading gives you a complete Android project (.zip) with the generated page bundled in `assets/`, a leanback WebView wrapper, and a GitHub Actions workflow — push the folder to a GitHub repo and the workflow builds the sideloadable `.apk` for you (or open it in Android Studio and press Build). The README inside the zip walks through building and sideloading on Fire TV step by step.

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
