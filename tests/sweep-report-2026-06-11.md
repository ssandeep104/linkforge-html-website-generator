# Linkforge Parser Sweep Report — 2026-06-11

**Parser version:** v5 (commit `d4db73f`) — post shadow-DOM fix for issue #1  
**Fixtures tested:** 15  
**Results:** ✅ 3 PASS · ⚠️ 9 PARTIAL · ❌ 3 FAIL · 🟦 0 N/A

---

## Summary Table

| Fixture | Site / Pattern | Category | Result | Items | Key Issues |
|---------|---------------|----------|--------|-------|------------|
| `nyt-video-feed.html` | NYT video feed (shadow DOM) | video-feed | ✅ PASS | 5/5 | — |
| `youtube-shorts.html` | YouTube Shorts feed | video-feed | ❌ FAIL | 0/4 | Relative hrefs, no base URL detectable |
| `reddit-video-cards.html` | Reddit `<shreddit-post>` cards | video-feed | ⚠️ PARTIAL | 6 (should be 3) | Duplicated items; thumbnail missing on title anchor |
| `bbc-video.html` | BBC News video cards | news-cards | ⚠️ PARTIAL | 4/4 | Wrong titles (img alt used instead of headline) |
| `cnn-video-carousel.html` | CNN video carousel | video-feed | ⚠️ PARTIAL | 4/4 | Duration prefix injected into titles |
| `bloomberg-video.html` | Bloomberg video feed | video-feed | ❌ FAIL | 3 (wrong) | `<button data-video-url>` not processed; images extracted as items instead |
| `guardian-video.html` | The Guardian video section | news-cards | ✅ PASS | 3/3 | — |
| `vimeo-showcase.html` | Vimeo showcase/channel | video-feed | ⚠️ PARTIAL | 8 (should be 4) | Duplicated items (clip + channel links); duration as title |
| `substack-video-post.html` | Substack post with YouTube embeds | social-embed | ⚠️ PARTIAL | 3 (partial) | Second iframe dropped; post-listing thumbs missing |
| `medium-article-cards.html` | Medium article feed | news-cards | ⚠️ PARTIAL | 3/3 | All thumbnails missing (title & image in separate sibling anchors) |
| `twitter-video-embed.html` | Twitter/X blockquote embeds | social-embed | ❌ FAIL | 7 (junk) | t.co links + date strings extracted; no actual tweet content |
| `reuters-video.html` | Reuters video cards | video-feed | ⚠️ PARTIAL | 4/4 | Wrong titles (video duration used instead of headline) |
| `instagram-embed.html` | Instagram blockquote embeds | social-embed | ⚠️ PARTIAL | 2/2 | Instagram iframe not extracted; low-quality thumb URLs |
| `tiktok-foryou.html` | TikTok video feed | video-feed | ⚠️ PARTIAL | 3/3 | Wrong titles (play count used instead of video title) |
| `wsj-video.html` | WSJ video cards | news-cards | ✅ PASS | 3/3 | — |

---

## PASS Details

### ✅ `nyt-video-feed.html` — NYT video feed (shadow DOM)
- **Items:** 5/5 correct
- The v5 fix (`expandShadowTemplates` + `synthesizeFromArticle`) works as intended. All five video articles are synthesized with correct titles, MP4 hrefs, and poster thumbnails. This was the original issue #1 bug and is now fully resolved.

### ✅ `guardian-video.html` — The Guardian video section
- **Items:** 3/3 correct
- Standard `<a href>` cards with `<picture><source>` srcsets. `pickImgSrc` correctly selects the `<img src>` fallback. Titles come from `<h3>` inside the anchor. Guardian uses absolute URLs, so no base URL lookup needed.

### ✅ `wsj-video.html` — WSJ video cards
- **Items:** 3/3 correct
- Standard `<a>` wrapping the entire card (image + headline). `pickImgSrc` correctly picks up `data-src` over the 1×1 base64 placeholder `src`. Titles come from the `<h3>` inside the link.

---

## PARTIAL Details

### ⚠️ `reddit-video-cards.html` — Reddit `<shreddit-post>` web component
- **Expected:** 3 items (one per post, with href = reddit post URL, thumb = preview image)
- **Got:** 6 items — each post appears twice
- **Root cause:** Reddit's `<shreddit-post>` renders two separate `<a>` elements per card: one `slot="title"` anchor (the post link, no thumbnail sibling) and one `slot="thumbnail"` anchor (wraps the preview image). The parser adds both anchors as distinct items because they have the same href but the title-anchor is added first (no thumb), then the thumbnail anchor has a _different_ href structure... actually both have the _same_ href so only the first is kept. The real duplication is from the `<video>` tag in `slot="post-media-container"` — the standalone video walk picks up the `.mp4` source as a third independent item per post, for a total of 6.
- **Deeper issue:** The title anchor's image is inside a _sibling_ `<a>` (the thumbnail slot), not inside the title anchor itself. `extractImageFromAnchor` only looks within the single anchor element, so it misses the thumbnail.
- **Suggestion:** When an `<article>` or custom-element slot structure has a title-link and a separate thumbnail-link pointing to the same URL, consider merging them. Alternatively, detect `slot="thumbnail"` / `slot="media"` attributes to associate thumbnails with their title anchors.

### ⚠️ `bbc-video.html` — BBC News video cards
- **Expected:** 4 items with headline text as title
- **Got:** 4 items with img alt text as title (e.g. "Wildfire spreading across hillside" instead of "California wildfires: What started them?")
- **Root cause:** Each BBC card has two `<a href>` elements pointing to the same URL: one wrapping the image (`media__link` on the image container), and one wrapping the headline (`media__link faux-block-link__overlay-link`). The image anchor is encountered first in DOM order. `getAnchorTitle` finds the `<img alt>` inside it and uses that. When the headline anchor is encountered, its href is already in `seen`, so it is skipped.
- **Suggestion:** In `getAnchorTitle`, when a heading element (`<h1>`–`<h6>`) exists anywhere within the enclosing `<article>` or `<section>` (even if not inside this specific `<a>`), prefer it. Alternatively, do a two-pass approach: collect all anchors by href first, then select the one with the richest title.

### ⚠️ `cnn-video-carousel.html` — CNN video carousel
- **Expected:** 4 items with clean headline titles
- **Got:** 4 correct items but titles include duration prefix ("2:34 Space debris lights up night sky…")
- **Root cause:** CNN's `<a class="container__link">` wraps both a `<span class="container__duration">` ("2:34") and the headline span. `getAnchorTitle` uses `a.textContent` which includes all descendant text, so the duration string is prepended. There is no `<h1>`–`<h6>` inside the anchor (CNN uses `<span class="container__headline-text">`), so the text-content fallback fires.
- **Suggestion:** Add `[class*="headline"], [class*="title"]` span selectors to `getAnchorTitle` before falling back to raw `textContent`. Or strip leading duration-like patterns (`/^\d+:\d+\s+/`) from extracted titles.

### ⚠️ `vimeo-showcase.html` — Vimeo showcase
- **Expected:** 4 items, one per clip (title = clip name, href = vimeo.com/<id>)
- **Got:** 8 items — 4 clip thumbnails (title = duration string) + 4 channel profile links (title = channel name, no thumb)
- **Root causes (two issues):**
  1. **Duration as title:** The thumbnail anchor's text content is the `<span class="clip_duration">` value ("12:34"). The actual clip title is in a _separate_ `.clip_title` anchor below the thumbnail. That anchor has the same `/1001234567` href and is deduplicated away.
  2. **Channel links as spurious items:** Each card has a channel-name anchor (e.g. `/glacierfilms`). These resolve against the `vimeo.com` base and are classified as `video` items (because `domainOf` returns `vimeo.com` which is in `VIDEO_HOSTS`). They inflate the item count with low-quality entries.
- **Suggestion:** Apply a minimum content threshold — anchors whose resolved href maps to a known-video-host user-profile path (no numeric ID segment) could be filtered. For duration-as-title, same fix as CNN: prefer `[class*="title"]` spans over raw text content.

### ⚠️ `substack-video-post.html` — Substack post with YouTube embeds
- **Expected:** ~4 items (2 YouTube embeds + 2 post-listing cards with thumbnails)
- **Got:** 3 items — 1 synthesized article item (first YouTube iframe) + 2 post-listing links (no thumbnails)
- **Root causes:**
  1. **Second iframe dropped:** `synthesizeFromArticle` finds the first `<iframe>` and returns. The second iframe within the same `<article>` is never inspected. The `synthesizedFromArticles` WeakSet then marks both iframes as consumed, so the standalone video walk also skips them.
  2. **Post-listing thumbnails missing:** Each Substack post preview has a `.post-preview-title` anchor and a separate `.post-preview-image` anchor pointing to the same URL. The title anchor is processed first (no img inside it), the image anchor is deduplicated away.
  3. **Article title attributed to iframe:** The synthesized item correctly uses the article's `<h1>` title ("The AI Video Revolution Is Here"), but the `href` is the YouTube embed URL — which is accurate for playback but conflates the article with the first video.
- **Suggestion:** `synthesizeFromArticle` should collect all iframes within an article and return multiple items (one per embeddable source). For split anchor/image cards, the same two-pass or sibling-image merge fix from BBC/Medium would help.

### ⚠️ `medium-article-cards.html` — Medium article feed
- **Expected:** 3 items with thumbnails
- **Got:** 3 items, 0 thumbnails
- **Root cause:** Medium article cards use two separate sibling `<a>` elements per item: one `.cs.ct` (title link, contains the headline, no image) and one `.di.dj` (image link, contains the `<img>` with `data-src`). The title anchor is encountered first. When the image anchor is encountered later, its href is already in `seen` and it is skipped. `extractImageFromAnchor` never gets to run on the image anchor.
- **Suggestion:** After the anchor walk, for any item still missing a thumbnail, scan the `<article>` (or nearest block container) for `<img>` elements regardless of anchor ownership and attach the first non-placeholder image. This is a general pattern fix that would help Medium, BBC, Reddit, and Substack simultaneously.

### ⚠️ `reuters-video.html` — Reuters video cards
- **Expected:** 4 items with headline titles
- **Got:** 4 correct items but titles are video durations ("2:47", "3:15", "4:33", "1:58")
- **Root cause:** Same two-anchor pattern as BBC: Reuters cards have a thumbnail-wrapping `<a class="story-card__media-content">` (encountered first, text = duration overlay text) and a headline `<a class="story-card__heading-link">` (deduplicated away). The `<div class="story-card__duration">` is a child of the thumbnail anchor, so its text is captured as the anchor's text content.
- **Suggestion:** Same fix as BBC — prefer heading text from the enclosing `<article>` over raw anchor `textContent`. Also, stripping pure `HH:MM` / `M:SS` strings as titles would prevent duration strings from leaking through.

### ⚠️ `instagram-embed.html` — Instagram blockquote embeds
- **Expected:** 2–3 items (2 blockquote posts + 1 reel iframe)
- **Got:** 2 items (blockquote anchors only; iframe not extracted)
- **Root causes:**
  1. **Instagram iframe not extracted:** The `<iframe src="https://www.instagram.com/reel/.../embed/">` is processed by the standalone video walk, but `instagram.com` is not in `VIDEO_HOSTS` (only `tiktok.com` is). The filter `/youtube|vimeo|tiktok|wistia|dailymotion|twitch/i` does not match Instagram. The iframe is dropped.
  2. **Low-quality thumbs:** The thumbnail URLs (`/p/<id>/media/?size=t`) are tiny Instagram thumbnail endpoints — functionally present but resolution is minimal.
- **Suggestion:** Add `instagram.com` to either `VIDEO_HOSTS` or the iframe-detection regex. Instagram Reels are video content equivalent to TikTok.

### ⚠️ `tiktok-foryou.html` — TikTok video feed
- **Expected:** 3 items with video titles (e.g. "How bees make honey — 3D animation")
- **Got:** 3 correct items but titles are play counts ("4.2M", "11.7M", "8.9M")
- **Root cause:** TikTok's `<a class="css-1lhfnfw-AVideoContainer">` wraps the thumbnail div and the play count `<strong>` element. The video title is in a `<p class="css-13cdu78-PVideoLabel">` that sits _outside_ the anchor, in a sibling `.css-fwsm2v-DivInfoContainer`. `getAnchorTitle` finds the `<strong>` text ("4.2M") as the anchor's text content.
- **Suggestion:** When anchor text content is very short and looks like a count/number (matches `/^\d+(\.\d+)?[KMB]?$/`), fall back to searching sibling elements for a text-rich title. Alternatively, check `aria-label` on the parent container (`data-e2e="user-post-item"` or the ancestor `<div>`).

---

## FAIL Details

### ❌ `youtube-shorts.html` — YouTube Shorts feed
- **Items:** 0 (8 unresolved)
- **Root cause:** All `<a href>` values are relative paths (`/shorts/<id>`) and the fixture contains no `<base>` tag. The parser's `detectBaseFromAnchors` cannot find a host because no absolute `href` exists. All 8 relative links are counted as `unresolvedCount` and no items are produced.
- **Fix needed:** YouTube Shorts pages always originate from `youtube.com`. The parser cannot know this without a base URL signal in the HTML. The UI should prompt the user for a domain when `unresolvedCount > 0` (this may already happen — but the parser itself yields zero items). A more aggressive fallback might try `youtube.com` if `ytd-*` custom elements are detected, but that would be brittle. **Primary recommendation:** surface the "unresolved links" warning more prominently in the UI, and/or allow the user to supply a base domain.
- **Parser change:** No change needed if the UI already handles `unresolvedCount > 0`. If not, add a heuristic: detect `ytd-*` custom element tags → assume `https://www.youtube.com` as base.

### ❌ `bloomberg-video.html` — Bloomberg video feed
- **Items:** 3 (all wrong — images extracted as items instead of video cards)
- **Root cause:** Bloomberg's video feed uses `<button class="video-card__trigger" data-video-url="...">` instead of `<a href>`. The parser's anchor walk only processes `a[href]` selectors. `data-video-url` / `data-href` on `<button>` elements is not read. The three images inside the buttons _are_ picked up by the standalone image walk as gallery items (with the image CDN URL as both href and thumbnail), which is incorrect.
- **Fix needed:** Extend the anchor walk (or add a separate pass) to handle `button[data-href]`, `button[data-url]`, `button[data-video-url]`, `[data-href]:not(a)`, `[data-link]:not(a)`. These are common CMS patterns (Bloomberg, some Vox Media properties). This is the highest-priority fix as it produces actively wrong output (images as items) rather than just zero items.
- **Parser change suggestion:**
  ```js
  // After the main anchor walk, handle non-anchor clickable elements with data links
  const dataLinkEls = Array.from(doc.querySelectorAll(
    'button[data-href], button[data-url], button[data-video-url], button[data-link], [role="link"][data-href]'
  ));
  for (const el of dataLinkEls) {
    const rawHref = el.getAttribute('data-href') || el.getAttribute('data-url') ||
                    el.getAttribute('data-video-url') || el.getAttribute('data-link');
    // ... same resolution logic as anchor walk
  }
  ```

### ❌ `twitter-video-embed.html` — Twitter/X blockquote embeds
- **Items:** 7 (all junk — t.co short links, date strings, and one valid blog link)
- **Root cause:** Twitter `<blockquote class="twitter-tweet">` embeds contain two types of anchors: (a) `t.co` short links (to the media) and (b) `twitter.com/status/...` links (the tweet permalink). The parser extracts both. `t.co` is not in the social-host blocklist, so those links pass through. `twitter.com` status links are also not blocked for item extraction (only for base URL detection). The resulting items have junk titles derived from the link text ("pic.twitter.com/...", "June 10, 2026").
- **Fix needed:** 
  1. Add `t.co` to a short-link / tracker blocklist so those hrefs are skipped.
  2. Either add `twitter.com` / `x.com` to a "skip as items" list for the anchor walk (since tweet status links are not useful as standalone Linkforge items), or at minimum filter anchors whose title looks like a date string or a bare URL.
  3. Longer term: parse `data-instgrm-permalink` / `blockquote[class*="twitter-tweet"]` containers as synthesized items using the tweet text as title and the media link as href.
- **Parser change suggestion:** Add `t.co`, `bit.ly`, `tinyurl.com` etc. to an expanded social/tracker blocklist checked in the anchor walk, not just in `detectBaseFromAnchors`.

---

## Cross-Cutting Issues and Suggested Fixes

### 1. Two-anchor card pattern (BBC, Reuters, Medium, Substack, Reddit, Vimeo)
Many CMSes render cards with two sibling `<a>` elements pointing to the same URL: one wrapping the image, one wrapping the headline text. The parser encounters the image anchor first, uses the `img alt` text as the title (wrong), then skips the headline anchor as a duplicate.

**Suggested fix — `getAnchorTitle` enhancement:**
Before falling back to `a.textContent`, walk up to the nearest `<article>` / block ancestor and look for a heading or `[class*="headline"]`/`[class*="title"]` element. Use that as the title if found.

**Suggested fix — thumbnail merging:**
After the anchor walk, for each item still missing a thumbnail, search the item's source anchor's nearest block ancestor for a non-placeholder `<img>` that isn't already claimed by another item.

### 2. Duration strings leaking into titles (CNN, Reuters, Vimeo)
`<span>` elements with duration text ("2:34", "12:34") inside `<a>` tags are included in `textContent` and used as titles when no `<h1>`–`<h6>` is found.

**Suggested fix:** In `getAnchorTitle`, strip or ignore short strings matching `/^\d{1,2}:\d{2}(:\d{2})?$/` from text content candidates. Or: before returning the raw `textContent`, check if it matches a pure duration/count pattern and skip it.

### 3. Non-anchor clickable elements (Bloomberg)
`<button data-video-url>` and `[data-href]` on non-`<a>` elements are common in modern CMSes that use JavaScript navigation.

**Suggested fix:** Add a pass for `button[data-href], button[data-url], button[data-video-url], [role="link"][data-href]`.

### 4. Multiple iframes per article (Substack)
`synthesizeFromArticle` returns after the first iframe. Articles embedding multiple videos (Substack, Medium, blog posts) lose subsequent embeds.

**Suggested fix:** Collect all `iframe[src]` + `video[src]` elements in the article and emit one synthesized item per embeddable source (or at minimum, emit the article with an array of media URLs).

### 5. YouTube relative hrefs with no base (YouTube Shorts)
YouTube pages use relative paths and no `<base>` tag. The parser yields zero items.

**Suggested fix:** Detect `ytd-*` / `yt-*` custom elements and assume `https://www.youtube.com` as base. This is a safe heuristic since no other site uses `ytd-` prefixed elements.

### 6. Instagram iframe not extracted (Instagram)
`instagram.com` is not in `VIDEO_HOSTS` or the iframe pattern regex.

**Suggested fix:** Add `instagram.com` to `VIDEO_HOSTS` and the iframe-detection regex.

### 7. t.co / short-link junk extraction (Twitter)
`t.co` links produce useless items.

**Suggested fix:** Add `t.co` to a short-link blocklist in the anchor walk.

---

## Appendix: Fixture File List

All fixtures saved under `tests/fixtures/`:

| File | Source | Size | Notes |
|------|--------|------|-------|
| `nyt-video-feed.html` | nytimes.com | 6.0 KB | Real fixture from issue #1 |
| `youtube-shorts.html` | youtube.com | 2.9 KB | Synthesized representative sample |
| `reddit-video-cards.html` | reddit.com | 3.7 KB | Synthesized representative sample |
| `bbc-video.html` | bbc.com | 5.4 KB | Synthesized representative sample |
| `cnn-video-carousel.html` | cnn.com | 4.1 KB | Synthesized representative sample |
| `bloomberg-video.html` | bloomberg.com | 3.1 KB | Synthesized representative sample |
| `guardian-video.html` | theguardian.com | 4.5 KB | Synthesized representative sample |
| `vimeo-showcase.html` | vimeo.com | 3.2 KB | Synthesized representative sample |
| `substack-video-post.html` | substack.com | 3.6 KB | Synthesized representative sample |
| `medium-article-cards.html` | medium.com | 3.9 KB | Synthesized representative sample |
| `twitter-video-embed.html` | twitter.com / x.com | 2.2 KB | Synthesized representative sample |
| `reuters-video.html` | reuters.com | 4.6 KB | Synthesized representative sample |
| `instagram-embed.html` | instagram.com | 2.3 KB | Synthesized representative sample |
| `tiktok-foryou.html` | tiktok.com | 3.8 KB | Synthesized representative sample |
| `wsj-video.html` | wsj.com | 4.2 KB | Synthesized representative sample |
