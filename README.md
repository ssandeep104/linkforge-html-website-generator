# Linkforge

Turn any pile of HTML into a site of your own.

Paste raw HTML from news, research, photography, video, or your own bookmarks. Linkforge pulls out every link, thumbnail, and preview, then lets you pick what goes in and generates a finished site in one of six editorial templates.

## What it does

1. **Sources** — paste HTML or upload `.html` files (drag-and-drop supported). Add as many sources as you want.
2. **Review** — Linkforge parses every anchor, image, and video into three buckets: links with image, links with video preview, and plain links. Pick what makes the cut with dropdowns + checkboxes.
3. **Output** — generates a styled standalone HTML page. Six templates: Editorial, Journal, Showcase, Gallery, Linklog, Screening.

All client-side. No server, no upload, no tracking. Everything happens in your browser.

## Run locally

```bash
# any static server works
python3 -m http.server 8000
# open http://localhost:8000
```

Or just double-click `index.html`.

## Stack

Vanilla JS + CSS. No build step, no dependencies. Single-file templates in `templates.js`.

## License

Personal use.
