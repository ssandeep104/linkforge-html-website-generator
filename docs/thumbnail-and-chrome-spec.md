# Linkforge — Thumbnail Priority & Chrome Removal Spec

**Status:** Draft  
**Scope:** templates.js (all 6 templates) + app.js  
**Purpose:** Remove per-item category chrome from generated output; define authoritative thumbnail priority chain.

---

## Section 1 — Chrome Removal (Definitive List)

"Chrome" = user-visible text that labels an item's content type ("Article", "Video", "Image", "Link") in the **generated output site**. The user wants only thumbnail + title.

The review UI inside app.js (Step 2) is explicitly out of scope — those labels are editor-facing, not user-facing.

### 1.1 templates.js — per-template audit

#### Template 1: Editorial (`buildEditorial`, lines 122–200)

| Location | Line | Exact text / expression | Action |
|---|---|---|---|
| `section()` call | 194 | `` section('Articles', rest) `` | **Remove/rename** — section header "Articles" announcing a content-type bucket. Rename to a neutral label, e.g. `'Stories'`, or omit the section header text and use only the count. |
| `section()` call | 195 | `` section('Watch', videos, true) `` | **Remove/rename** — "Watch" is a content-type announcement. Rename to `'Videos'`? No — user objects to "videos". Use a neutral label like `'More'` or just omit the section title for video items and let the play-button overlay communicate type visually. |
| `section()` call | 196 | `` section('Visuals', gallery) `` | **Keep** — "Visuals" is not a machine category name; it's a descriptive label. Low risk. |
| `section()` call | 197 | `'More reading'` | **Keep** — neutral, descriptive. |
| Hero CTA | 193 | `Read story →` | **Keep** — editorial flavor copy, not a category label. |
| `card()` function | 127–132 | No per-card type pill emitted in editorial cards | ✅ No chrome here. |

**Net: 2 section-header strings to change in editorial** (lines 194, 195).

#### Template 2: Journal (`buildJournal`, lines 206–270)

| Location | Line | Exact text / expression | Action |
|---|---|---|---|
| Entry meta | 219 | `` <span class="entry__type">${esc(i.category)}</span> `` | **Remove** — this is the primary offender: emits the raw `item.category` string ("article", "video", "link", "gallery") as a styled pill on every entry. |

**Net: 1 span to remove** (line 219). The CSS rule `.entry__type` at line 258 can also be deleted.

#### Template 3: Gallery (`buildGallery`, lines 276–336)

| Location | Line | Exact text / expression | Action |
|---|---|---|---|
| Masthead meta | 330 | `` ${tiles.length} visuals `` | **Keep** — count + neutral descriptor, not a category pill. |
| "Also" section | 293 | `<h3>Also</h3>` | **Keep** — neutral section divider for items without a thumbnail. Not a category name. |

**Net: No removals needed in gallery.**

#### Template 4: Screening Room (`buildScreening`, lines 342–423)

| Location | Line | Exact text / expression | Action |
|---|---|---|---|
| Masthead meta | 404 | `` ${videos.length} videos `` | **Remove** — explicit "videos" count badge. Replace with a neutral count: `` ${videos.length} items `` or omit the count entirely. |
| Section header | 419 | `` <h2>More to watch</h2> `` | **Remove/rename** — "More to watch" announces a content type. Rename to `'More'` or omit. |
| Section badge | 419 | `` ${restVideos.length} videos `` | **Remove** — "videos" count badge next to "More to watch". Replace with `` ${restVideos.length} items ``. |
| Section header | 420 | `` <h2>Adjacent</h2> `` | **Keep** — neutral. |
| Section badge | 420 | `` ${other.length} items `` | **Keep** — already neutral. |
| `featured__kicker` | 413 | `` Featured · ${esc(featured.sourceName)} `` | **Keep** — "Featured" is position/editorial context, not a content-type label. |

**Net: 3 changes in screening** (lines 404, 419×2).

#### Template 5: Linklog (`buildLinklog`, lines 429–479)

| Location | Line | Exact text / expression | Action |
|---|---|---|---|
| Post meta | 440 | `` <span class="post__type">${esc(i.category)}</span> `` | **Remove** — emits raw category value ("article", "link", "video") as a pill on every post. |
| Masthead meta | 474 | `` ${all.length} links `` | **Remove/rename** — "links" is a category name. Replace with `` ${all.length} items ``. |

**Net: 2 removals in linklog** (lines 440, 474). The CSS rule `.post__type` at line 467 can also be deleted.

#### Template 6: Showcase / Bento (`buildShowcase`, lines 485–556)

| Location | Line | Exact text / expression | Action |
|---|---|---|---|
| Bento body | 506 | `` <span class="bento__type">${esc(i.category)}</span> `` | **Remove** — emits raw category as a styled accent-colour pill on every bento tile. |

**Net: 1 removal in showcase** (line 506). The CSS rule `.bento__type` at line 546 can also be deleted.

### 1.2 Chrome occurrence summary

| Template | File | Line(s) | Change |
|---|---|---|---|
| Editorial | templates.js | 194 | Rename section `'Articles'` → `'Stories'` (or neutral) |
| Editorial | templates.js | 195 | Rename section `'Watch'` → `'More'` (or omit type-announcing title) |
| Journal | templates.js | 219 | **Remove** `<span class="entry__type">` |
| Screening | templates.js | 404 | Replace `videos` count unit with `items` |
| Screening | templates.js | 419 | Rename `More to watch` → `More`; replace `videos` count unit with `items` |
| Linklog | templates.js | 440 | **Remove** `<span class="post__type">` |
| Linklog | templates.js | 474 | Replace `links` count unit with `items` |
| Showcase | templates.js | 506 | **Remove** `<span class="bento__type">` |

**Total: 8 output locations** (3 type-pill removals, 5 section-label changes).

No chrome exists in the **app.js review UI** that reaches the generated output file — `renderItemRow` (lines 1274–1285) and `renderMedia` (lines 1358–1384) are editor-only and are not called by any template builder.

---

## Section 2 — Thumbnail Priority Chain (Spec)

### Authoritative priority order for `item.thumbnail`

```
Tier 1 → video poster/preview for the href
Tier 2 → direct image inside or adjacent to the item block
Tier 3 → og:image / twitter:image of the linked page (single-item only)
Tier 4 → synthesized poster from known video-host URL pattern
Tier 5 → fallback (see §2.5)
```

### Tier 1 — Video preview / poster for the `href`

**When it applies:** The item's `href` (or any `<video>` / `<iframe>` in the same card block) is a video source, AND a poster or thumbnail URL can be derived.

**Detection logic (in priority sub-order):**

1. `<video poster="…">` inside the anchor or in the same card block (via `findSiblingVideo`) → use `poster` attribute directly.
2. `<video><source src="…">` — if the source URL itself resolves to an image (`.jpg` etc.), use it; otherwise this is Tier 2's job.
3. Anchor `href` is a YouTube URL → synthesize `https://i.ytimg.com/vi/<id>/hqdefault.jpg` (already done in Tier 4, but should be promoted here).
4. Anchor `href` is an `<iframe>` embed with a YouTube/Vimeo `src` inside the same block → extract the video ID and synthesize the poster.

**What app.js does today:**
- `extractVideoFromAnchor` (lines 266–281) finds `<video poster>` and `<iframe src>` inside an anchor — returns `{ src, poster }`. The `poster` is stored as `item.video.poster` but is **not** assigned to `item.thumbnail` at this point.
- `findSiblingVideo` (lines 366–394) finds videos in card siblings — returns `videoInfo.poster` but again does not set `item.thumbnail`.
- YouTube thumbnail synthesis (lines 778–779) runs **after** all thumb lookups, only when `item.thumbnail` is already null. It only checks `item.href` and `item.video.src`, not the `video.poster` itself.

**Gap:** `video.poster` is never promoted to `item.thumbnail`. The synthesis step (Tier 4 today) handles YouTube ID → URL but runs last. The fix is to promote `video.poster` to `item.thumbnail` at bucket finalization time, before the og:image check.

**Amendment (implemented):** the poster promotion above is now in place, with one qualification the original spec didn't anticipate — *a poster attribute is not automatically a usable image*. Players ship `poster="…/blank.gif"` (or a base64 pixel) as a first-paint stand-in, and promoting that unconditionally handed Tier 1 the win with a blank image while real artwork sat in Tier 2. A poster that reads as a placeholder (`looksLikeLazyLoadPlaceholder`) is therefore demoted to *last resort*: Tiers 2–4 get their turn first, and it is still used if none of them produce anything. `poster` is read through `pickVideoPoster`, which also honours the `data-poster` / `data-thumb` lazy convention.

Two other Tier 1 details now differ from the description above:

- **Vendor matching is by hostname, not substring.** Item 4's "iframe with a YouTube/Vimeo src" test used to run as a regex over the whole URL, so an ad frame at `https://ads.example.com/frame?utm_source=youtube` was accepted as a video and flipped the item's category. `isVideoEmbedUrl` resolves the URL and matches `VIDEO_EMBED_HOSTS` against its host (suffix match, so `player.vimeo.com` and `fast.wistia.net` are covered), which also let the list grow to the embed-only domains — `youtube-nocookie.com`, Brightcove, Kaltura, JW Player, Loom, Streamable, Vidyard, Rumble.
- **`<source>` order is a player preference, not a quality ranking.** Sites list the adaptive manifest first because their JS player wants it; a browser `<video>` can't play `.m3u8`/`.mpd` outside Safari. `pickVideoSource` prefers a progressive MP4, then any progressive file, then anything non-manifest — so previews point at something that actually loads.

### Tier 2 — Direct image inside or adjacent to the item block

**Detection logic (in sub-order):**

1. `<img>` direct child of the anchor → `pickImgSrc()` (checks data-src, srcset, src, rejects placeholders).
2. `<picture><source srcset="…">` inside the anchor.
3. CSS `background-image: url(…)` on an element inside the anchor.
4. `<figure><img>` or `<figure><picture>` sibling within the nearest `article / li / [class*="card"]` block → `findFigureSiblingThumb()` (lines 331–355).

Covers: `.svg`, `.webp`, `.avif`, `.jpg`, `.png`, `.gif` (enforced by `IMAGE_EXT` regex and `looksLikePlaceholder`).

**What app.js does today:**
- `extractImageFromAnchor` (lines 240–264) handles items 1–3 above.
- `findFigureSiblingThumb` (lines 331–355) handles item 4.
- Both are called in the bucket loop (lines 628–655) — Tier 2 is already correctly implemented.

**Gap:** None for the detection itself. The gap is ordering: currently both Tier 2 paths run before `video.poster` is considered. See Tier 1 gap.

**Amendment (implemented):** "the anchor's `<img>`" turned out to be too loose a rule — sub-order item 1 took the *first* `<img>`, and card anchors routinely open with furniture (a byline avatar, a channel badge, a play-button sprite) ahead of the artwork. Every step of Tier 2 now prefers a **content-looking** image, via `isContentImage` = `isLikelyContentMediaElement` (word-delimited avatar/logo/icon/badge/sprite naming on the element *and* up to three wrapper levels, known avatar CDNs, sub-48px dimensions) plus "the URL it resolves to isn't a blank placeholder". Where the tier's own selectors already imply a thumbnail role — `figure`/`picture`/`class*=thumb|hero|poster` — an unfiltered fallback still runs, so a misjudged image can't leave a card with nothing.

The two tiers with *no* such role signal are strict, with no fallback: `findFigureSiblingThumb`'s "any `<img>` in the block" last resort, and the adjacent-sibling scan. Both match images that merely sit near the anchor, which makes them the ones that surface site logos — and one logo repeated across every card is worse output than cards with no image, which templates route to their "More links" tail.

Two further Tier 2 corrections:

- **`<picture><source>` is checked before a non-content `<img>`,** not after it. The canonical shape is `<source srcset="real.jpg"><img src="data:…blank">`, where the `<img>` exists to satisfy the element contract rather than to be displayed.
- **`pickImgSrc` consults `srcset` / `data-srcset`** once `src` and the `data-*` attributes come up empty. Responsive markup that ships *only* a srcset is common on lazy-load grids and used to yield no thumbnail at all. `src` still wins when it's real: the larger srcset variants stay available as picker candidates rather than being silently promoted over the size the page itself chose to render.

### Tier 3 — og:image / twitter:image of the linked page

**What app.js does today:** `getMetaImage(doc)` (lines 182–194) reads the **source document's** `og:image`, not the destination page's. It is used only as a last-resort site-wide fallback (lines 769–773): applied only when there is **exactly 1 item** and it has no thumbnail — specifically to avoid the TOI-logo-on-every-card problem.

**Spec decision — keep restricted:** Do not extend og:image to multiple items. The current single-item guard (line 770: `items.length === 1`) is intentional and correct. Extending it to per-item destination-page fetching would require async HTTP requests that are out of scope for a client-side parser.

**No change needed** for Tier 3.

### Tier 4 — Synthesized poster from URL pattern

**What app.js does today:** Lines 776–782:
```js
if (it.category === 'video' && !it.thumbnail) {
  const yt = youtubeId(it.href) || (it.video?.src ? youtubeId(it.video.src) : null);
  if (yt) it.thumbnail = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  const vi = vimeoId(it.href) || (it.video?.src ? vimeoId(it.video.src) : null);
  if (vi) it.thumbnail = null; // vimeo needs API; leave blank
}
```

This correctly handles YouTube. Vimeo is intentionally left null (API required). No other hosts are handled.

**Additions to specify:**
- Instagram Reels embed URLs contain a media ID; the thumbnail endpoint is `https://www.instagram.com/p/<shortcode>/media/?size=l` but requires login — skip.
- TikTok: no public thumbnail endpoint without API — skip.
- Twitter/X native video: no reliable thumbnail URL without API — skip.

**Spec decision:** Tier 4 stays YouTube-only. Keep Vimeo as intentional blank (renders styled card).

**Change needed:** Promote the YouTube synthesis to run immediately after `video.poster` assignment (see Tier 1), not as a separate post-processing loop. The current post-processing loop position (lines 776–786) is fine as long as `video.poster` promotion (Tier 1 fix) is added before it.

### Tier 5 — No thumbnail fallback suggestions

When all tiers fail, `item.thumbnail` is null. The user requested suggestions. Here are three options ranked by recommendation:

**Option A (Recommended): Deterministic generated SVG placeholder**
- Generate an inline SVG `data:` URI derived from the title's first letter + a hash-stable hue.
- Hash: `hue = (sum of charCodes of title) % 360`.
- Renders as a coloured circle with the initial letter — visually distinct per item, never blank.
- Pros: Always works offline; no external requests; visually rich; each item looks different.
- Cons: Not a real image; may feel generic for serious content.
- Implementation: A ~10-line JS function, returns a `data:image/svg+xml,...` string.

**Option B: Source favicon (apple-touch-icon / favicon.ico)**
- Try `https://<domain>/apple-touch-icon.png` first (180×180), then `/favicon.ico`.
- Pros: Real branding from the source site; meaningful visual cue.
- Cons: Extra network request per item; some domains block CORS; favicon quality varies; may still look like a placeholder if favicon is small/blurry.

**Option C: Textual card (no media area)**
- Let templates render without an image area when `item.thumbnail` is null — only title + domain, larger type.
- Most templates already do this (the `card__media--empty` / `bento__media--empty` path with the letter mark). This path already exists; no new code needed.
- Pros: No visual noise; clean text-first presentation.
- Cons: Inconsistent card heights in grid layouts; empty media area with a letter is already rendering.

**Recommendation: Option A** (deterministic SVG).
Rationale: It requires no network access, is always available, produces unique per-item visual identity, and gives templates a real `item.thumbnail` value that slots into the existing `<img src="…">` pattern without template changes. Option B adds latency and CORS risk. Option C is already the implicit current behavior and the user explicitly asked for "something" in the image slot.

**SVG generation spec:**
```js
function syntheticPlaceholder(item) {
  const letter = (item.title || item.domain || 'L').charAt(0).toUpperCase();
  const hue = [...(item.title || item.domain || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue},40%,88%)`;
  const fg = `hsl(${hue},40%,35%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250">
    <rect width="400" height="250" fill="${bg}"/>
    <text x="200" y="148" font-size="96" font-family="system-ui,sans-serif"
      text-anchor="middle" fill="${fg}">${letter}</text>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
```

Apply only when `item.thumbnail` is null after Tier 1–4, and only for items that have a real `href` (not gallery items where `href === thumbnail`).

---

## Section 3 — Current Implementation Audit

### Function-by-function summary (thumbnail path)

| Function | Lines | What it does | Priority chain role |
|---|---|---|---|
| `classify(item)` | 145–151 | Returns `'video'` if `item.video` or `isVideoHref(href)`; `'article'` if `item.thumbnail`; else `'link'`. | Sets category after thumb resolution. |
| `looksLikePlaceholder(url)` | 197–206 | Rejects data-URIs, URLs containing `logo/placeholder/blank/spacer/pixel/loading/default/1x1/2x2`, and known tiny-pixel patterns. | Gate used by all image pickers. |
| `pickImgSrc(img)` | 210–238 | Checks `data-src`, `data-original`, `data-lazy-src`, `data-lazy`, `data-srcset`, `data-hi-res-src`, `data-full-src`, `data-img`, `srcset` (last entry), then `src`. Returns first non-placeholder. | Core of Tier 2 img extraction. |
| `extractImageFromAnchor(a)` | 240–264 | Calls `pickImgSrc` on direct `<img>`, then `<picture source[srcset]>`, then `background-image` style. | Tier 2 — direct image in anchor. |
| `extractVideoFromAnchor(a)` | 266–281 | Finds `<video>` (returns `{src, poster}`) or `<iframe>` matching known video hosts. | Tier 1 detection — but `poster` is not promoted to `item.thumbnail`. **Gap.** |
| `findFigureSiblingThumb(a, baseURL, claimedSet)` | 331–355 | Walks up to nearest `article/li/[class*=card/story/teaser]`, finds `figure img` or `figure picture source[srcset]`. | Tier 2 — figure-sibling fallback. |
| `findSiblingVideo(a, baseURL)` | 366–394 | Walks up to card-shaped block, finds `<video>` (with `src`) or embedded `<iframe>`. Returns `{videoInfo, claimedEl}`. | Tier 1 sibling detection — `videoInfo.poster` is stored but not set on `item.thumbnail`. **Gap.** |
| Bucket loop — img | 628–655 | Calls `extractImageFromAnchor` then `findFigureSiblingThumb` per bucket anchor; sets `item.thumbnail`. | Tier 2 execution. |
| Bucket loop — video | 661–679 | Calls `extractVideoFromAnchor` then `findSiblingVideo`; sets `item.video`. Poster stored in `item.video.poster` only. | Tier 1 partial — poster NOT promoted. **Gap.** |
| og:image fallback | 769–773 | Applies source og:image to `item.thumbnail` only when `items.length === 1` and item has no thumb. | Tier 3 — correctly restricted. |
| YouTube synthesis | 778–779 | Runs post-loop; sets `item.thumbnail = https://i.ytimg.com/vi/<id>/hqdefault.jpg` if no thumb and category is video. | Tier 4. |
| Vimeo stub | 780–781 | Sets `item.thumbnail = null` explicitly for Vimeo (API required). | Tier 4 intentional no-op. |
| `synthesizeFromArticle` | 797–889 | For `<article>` nodes with no outbound `<a>`: pulls poster img → video source → iframe. Sets `item.category` directly (line 887). | Handles NYT-style video cards. Tier 1+2 combined for article synthesis. |
| `parseNytArticle` / article loop | 700–712 | Runs `synthesizeFromArticle` on all `<article>` elements, marks media as claimed. | Feeds into priority chain post-anchor-bucket. |
| `pickItemFromAnchor` finalization | 681–692 | Sets `item.category = classify(item)` and `item.enabled = true`. | Final classify after all tiers. |

### Gaps / conflicts with new spec

1. **`video.poster` never becomes `item.thumbnail`** (critical gap). In both `extractVideoFromAnchor` (line 271) and `findSiblingVideo` (line 381), the `poster` attribute is captured but only stored in `video.poster`. The bucket finalization loop (lines 681–692) never promotes `video.poster` to `item.thumbnail`. The YouTube synthesis at line 778 only runs when `item.thumbnail` is null — so if a `<video poster="…">` was found, it would naturally get picked up there, but only if `item.thumbnail` is null AND the poster was separately set. In practice the poster is in `item.video.poster`, not `item.thumbnail`, so it never reaches templates.

2. **Ordering: Tier 2 runs before Tier 1 is checked.** The bucket loop checks `extractImageFromAnchor` (Tier 2) before even looking at `extractVideoFromAnchor` (Tier 1). If a card has both a `<video poster>` and an adjacent `<img>`, the `<img>` wins. This conflicts with the user's intent (video poster > adjacent image).

3. **No synthetic fallback placeholder.** When both Tiers 1–4 yield nothing, `item.thumbnail` is null. The current template fallback is the letter-mark placeholder (`card__media--empty`), which is Option C from §2.5. Per spec, Option A (SVG data URI) should be used instead.

4. **`synthesizeFromArticle` line 887** sets `item.category = videoInfo ? 'video' : (thumb ? 'article' : 'link')`. This internal category assignment is correct logic but the category value surfaces via Journal's `entry__type` and Linklog's `post__type` chrome pills. Not a parser bug — a templates bug. See Section 1.

---

## Section 4 — Concrete Code Changes (Implementation Checklist)

### Chrome removal (templates.js)

1. **templates.js line 219** — Remove `<span class="entry__type">${esc(i.category)}</span>` from Journal entry meta. Also remove the CSS rule `.entry__type{color:var(--accent);font-weight:500}` at line 258.

2. **templates.js line 440** — Remove `<span class="post__type">${esc(i.category)}</span>` from Linklog post meta. Also remove CSS rule `.post__type{…}` at line 467.

3. **templates.js line 506** — Remove `<span class="bento__type">${esc(i.category)}</span>` from Showcase bento body. Also remove CSS rule `.bento__type{…}` at line 546.

4. **templates.js line 194** — Change `section('Articles', rest)` to `section('Stories', rest)` (or another neutral label; avoid "Articles").

5. **templates.js line 195** — Change `section('Watch', videos, true)` to `section('More', videos, true)` (avoids both "Watch" and "Videos").

6. **templates.js line 404** — Change `` ${videos.length} videos `` to `` ${videos.length} items `` in Screening masthead.

7. **templates.js line 419** — Change `<h2>More to watch</h2>` to `<h2>More</h2>` and `${restVideos.length} videos` to `${restVideos.length} items`.

8. **templates.js line 474** — Change `` ${all.length} links `` to `` ${all.length} items `` in Linklog masthead.

### Thumbnail Tier 1 — promote video.poster (app.js)

9. **app.js ~line 683** — After the video bucket loop (after line 679), before building the item object, add:
   ```js
   // Tier 1: promote video poster to thumbnail
   if (!thumb && video?.poster) {
     thumb = safeURL(video.poster, baseURL) || video.poster;
   }
   ```
   Insert this block immediately after the `video` variable is finalized (line 679) and before `const item = { … }` at line 681.

10. **app.js ~line 683** — Reorder the bucket loop so video extraction precedes image extraction:
    - Move the video extraction block (lines 661–679) to **before** the thumbnail extraction block (lines 628–655).
    - After extracting `video`, check `video.poster` first:
      ```js
      if (!thumb && video?.poster) thumb = safeURL(video.poster, baseURL) || video.poster;
      ```
    - Only then run `extractImageFromAnchor` / `findFigureSiblingThumb` if `thumb` is still null.
    - This makes Tier 1 (video poster) win over Tier 2 (adjacent img) per spec.

### Thumbnail Tier 5 — synthetic SVG fallback (app.js)

11. **app.js** — Add new function `syntheticPlaceholder(item)` (see §2.5 spec). Place it near `looksLikePlaceholder` (~line 197).

12. **app.js ~line 784** — After the YouTube/Vimeo synthesis block (after line 782), add:
    ```js
    // Tier 5: synthetic SVG placeholder for items still without a thumbnail
    if (!it.thumbnail && it.href !== (it.video?.src)) {
      it.thumbnail = syntheticPlaceholder(it);
    }
    ```
    This ensures every item gets a thumbnail, so no item falls through to the empty `card__media--empty` letter path in templates. If Option C is preferred instead, skip this step.

### Internal classification (app.js — keep, do not surface)

13. **app.js line 887** — `item.category = videoInfo ? 'video' : (thumb ? 'article' : 'link')` — **keep as-is** for internal routing logic (template bucketing, template suggestion, etc.). The category must NOT be removed — only its surfacing in templates is removed (items 1–3 above).

14. **app.js line 1274–1276** — `renderItemRow` type label ("Article", "Video", "Image", "Link") in the Step 2 review UI — **keep**. This is editor-facing only and never reaches the generated output.

15. **app.js line 1359–1362** — `renderMedia` type label in the old card grid — **keep** for same reason.

---

## Section 5 — Test Plan

17 fixture files enumerated via `ls tests/fixtures/`.

For each, the expected `item.thumbnail` source after the change (which priority tier):

| # | Fixture | Expected thumbnail source | Tier |
|---|---|---|---|
| 1 | `bbc-video.html` | `<video poster>` or `findSiblingVideo` poster; if absent, YouTube/video-host img synthesis | 1 |
| 2 | `bloomberg-video.html` | Direct `<img>` inside anchor (Bloomberg cards have explicit `<img>` thumbnails) | 2 |
| 3 | `cnn-video-carousel.html` | `<video poster>` or `<img>` inside carousel card; CNN uses lazy-loaded images on video cards | 1 or 2 |
| 4 | `guardian-video.html` | `<img>` inside article anchor (Guardian uses `<figure><img>` pattern) → `findFigureSiblingThumb` | 2 |
| 5 | `instagram-embed.html` | No public poster URL (API required) → Tier 5 synthetic SVG | 5 |
| 6 | `medium-article-cards.html` | `<img>` inside anchor (`progressive-image__image` / lazy src) | 2 |
| 7 | `nbc-vertvideo-feed.html` | `<video poster>` attribute (NBC vertical video feeds include poster on `<video>`) | 1 |
| 8 | `nyt-video-feed.html` | `<img data-testid="betamax-poster">` via `synthesizeFromArticle` | 2 (via article synthesis) |
| 9 | `reddit-video-cards.html` | `findSiblingVideo` → `videoInfo.poster`; after fix, promoted to `item.thumbnail` | 1 (after fix) |
| 10 | `reuters-video.html` | `<img>` inside anchor (Reuters video cards use explicit preview images) | 2 |
| 11 | `substack-video-post.html` | `<img>` direct child of anchor or `<figure>` sibling | 2 |
| 12 | `tiktok-foryou.html` | No public poster endpoint → Tier 5 synthetic SVG | 5 |
| 13 | `time-entertainment.html` | `findFigureSiblingThumb` (Time.com uses `<figure>` sibling pattern; documented in code comment at line 327) | 2 |
| 14 | `twitter-video-embed.html` | `<img>` inside `blockquote` / oEmbed card; `<video poster>` in embedded player | 1 or 2 |
| 15 | `vimeo-showcase.html` | Vimeo intentionally null (line 781); after Tier 5 fix → synthetic SVG | 5 |
| 16 | `wsj-video.html` | `<img>` inside anchor (WSJ includes `<img>` on video teasers) | 2 |
| 17 | `youtube-shorts.html` | YouTube ID synthesis → `https://i.ytimg.com/vi/<id>/hqdefault.jpg` | 4 |

**QA targets per tier:**
- **Tier 1 verified:** fixtures 1, 7, 9 (poster promoted), 14 — confirm `item.thumbnail` equals the `<video poster>` URL, not an adjacent `<img>`.
- **Tier 2 verified:** fixtures 2, 4, 6, 8, 10, 11, 13, 16 — confirm `item.thumbnail` is an `<img>` URL from the page.
- **Tier 4 verified:** fixture 17 — confirm YouTube `hqdefault.jpg` URL.
- **Tier 5 verified:** fixtures 5, 12, 15 — confirm `item.thumbnail` is a `data:image/svg+xml,…` string with deterministic hue matching title hash.
- **Chrome removal verified (all):** Load each fixture through the full pipeline to editorial/journal/linklog/showcase output and assert no `<span class="entry__type">`, `<span class="post__type">`, or `<span class="bento__type">` appears in the rendered HTML.
