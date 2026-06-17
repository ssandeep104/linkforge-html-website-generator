/* =====================================================
   LINKFORGE — client-side HTML aggregator
   ===================================================== */

const state = {
  sources: [], // {id, name, html, items[]}
  items: [], // flattened, with .enabled flag
  site: { title: 'Daily Reader', tagline: 'A curated front page, built from the web.', template: 'editorial' },
};

// Source names are auto-derived from their position (Source 1, Source 2, …)
// unless the user has customized the name.

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 9);

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('screen--active'));
  $(`#${id}`).classList.add('screen--active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ---------- theme toggle ----------
(function initTheme() {
  const root = document.documentElement;
  let mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', mode);
  const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const render = () => {
    $$('[data-theme-toggle]').forEach((b) => {
      b.innerHTML = mode === 'dark' ? sunSvg : moonSvg;
      b.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
    });
  };
  render();
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    mode = mode === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', mode);
    render();
  });
})();

// ===================================================
// PARSING
// ===================================================

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'twitch.tv', 'dailymotion.com', 'wistia.com', 'instagram.com'];

// URL-shortener / tracker hosts. Anchors pointing here are dropped — they're
// never the canonical destination and just pollute the output (esp. Twitter
// oEmbed cards which contain t.co links for every image and date stamp).
// youtu.be is NOT in this list — it's a real video destination, not a tracker.
const SHORT_LINK_HOSTS = new Set([
  't.co', 'bit.ly', 'tinyurl.com', 'lnkd.in', 'buff.ly', 'ow.ly', 'goo.gl', 'fb.me',
]);
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|$)/i;

function safeURL(href, base) {
  // If no base and href is relative, return the raw href without inventing a domain.
  // The caller can decide how to handle truly relative links (we filter them out for hrefs,
  // but still allow them for thumbnail/image resolution against the source's likely host).
  try {
    if (base) return new URL(href, base).toString();
    return new URL(href).toString();
  } catch {
    return null;
  }
}

// Try to detect the most likely host for a parsed document by counting absolute anchor hosts.
function detectBaseFromAnchors(doc) {
  const counts = {};
  const anchors = doc.querySelectorAll('a[href]');
  for (const a of anchors) {
    const raw = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(raw)) continue;
    try {
      const u = new URL(raw);
      const host = u.hostname.replace(/^www\./, '');
      // Skip social/share hosts and trackers — they're never the publisher
      if (/^(twitter|x|facebook|instagram|linkedin|reddit|pinterest|whatsapp|t|tiktok)\.(com|co)$/i.test(host)) continue;
      if (/^(googleadservices|doubleclick|google-analytics|googletagmanager|amazon-adsystem)\./i.test(host)) continue;
      counts[host] = (counts[host] || 0) + 1;
    } catch {}
  }
  // Return the most common host (with origin), or null
  let best = null, bestCount = 0;
  for (const [host, count] of Object.entries(counts)) {
    if (count > bestCount) { best = host; bestCount = count; }
  }
  return best ? `https://${best}` : null;
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isVideoHref(url) {
  const d = domainOf(url);
  return VIDEO_HOSTS.some((h) => d === h || d.endsWith('.' + h)) || VIDEO_EXT.test(url);
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

function vimeoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

function classify(item) {
  // Item already has href, possibly thumbnail, possibly video.
  if (item.video || isVideoHref(item.href)) return 'video';
  if (item.thumbnail) return 'article';
  // anchor with no media — pure link
  return 'link';
}

// Declarative Shadow DOM: <template shadowrootmode="open"> nodes are NOT
// instantiated by DOMParser. The browser would attach them as real shadow
// trees, but we just get inert <template> elements with their content stuck
// inside a DocumentFragment. To find <a>, <img>, <video>, etc. we hoist that
// content out of the template so subsequent querySelectorAll walks see it.
// Used for sites like NYT, where article media lives inside <template shadowrootmode>.
function expandShadowTemplates(root, depth = 0) {
  if (depth > 12) return; // safety: avoid pathological nesting
  const templates = Array.from(root.querySelectorAll('template'));
  for (const tpl of templates) {
    // Only expand declarative shadow templates — leave plain <template> alone.
    const mode = tpl.getAttribute('shadowrootmode') || tpl.getAttribute('shadowroot');
    if (!mode) continue;
    const frag = tpl.content;
    if (!frag) continue;
    // Recurse into the fragment first so nested shadow templates are flattened too.
    expandShadowTemplates(frag, depth + 1);
    // Move the children out, inserted right after the template so DOM order is preserved.
    const parent = tpl.parentNode;
    if (!parent) continue;
    const after = tpl.nextSibling;
    while (frag.firstChild) {
      parent.insertBefore(frag.firstChild, after);
    }
    // Leave the empty <template> in place so we don't break sibling counts /
    // querySelector :scope > * selectors elsewhere in the parser.
  }
}

function getMetaImage(doc) {
  const sels = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ];
  for (const s of sels) {
    const el = doc.querySelector(s);
    if (el?.content) return el.content;
  }
  return null;
}

// Tier 5 fallback — generates an inline SVG data URI when no real thumbnail
// is available. Deterministic per item (hue derived from title hash), so the
// same title always gets the same color. Slots into the existing
// <img src="..."> pattern in templates without any template changes.
function syntheticPlaceholder(item) {
  const text = (item && (item.title || item.domain)) || 'Link';
  const letter = text.charAt(0).toUpperCase();
  let hue = 0;
  for (let i = 0; i < text.length; i++) hue = (hue + text.charCodeAt(i)) % 360;
  const bg = `hsl(${hue},38%,86%)`;
  const fg = `hsl(${hue},45%,32%)`;
  // 400x250 matches the typical card aspect; templates scale via CSS.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="${bg}"/><text x="200" y="158" font-size="120" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="600" text-anchor="middle" fill="${fg}">${letter}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Heuristic: looks like a placeholder, blank pixel, or site logo (not the real article thumb)
function looksLikePlaceholder(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  if (u.startsWith('data:')) return true; // base64 blank/spinner pixels
  if (/(^|[\/_\-])(logo|placeholder|blank|spacer|pixel|loading|default|empty|transparent|1x1|2x2|noimage|no-image)([\/_\-\.]|$)/.test(u)) return true;
  if (/photogallery\.indiatimes\.com\/.+\.(cms|jpg)\?(.*)?width=(1|2|10|16|20)\b/.test(u)) return true;
  // tiny gif/png often used as lazy placeholders
  if (/[\?&](w|width|h|height)=(1|2|4|8|10)(\D|$)/.test(u)) return true;
  return false;
}

// Pick the best <img> src across normal + lazy-load attributes.
// Prefers data-src / data-original / srcset over src when src looks like a placeholder.
function pickImgSrc(img) {
  const candidates = [];
  const push = (v) => { if (v && typeof v === 'string') candidates.push(v.trim()); };

  // Lazy-load conventions used by major CMSes (TOI, WordPress, Drupal, NYT, etc.)
  push(img.getAttribute('data-src'));
  push(img.getAttribute('data-original'));
  push(img.getAttribute('data-lazy-src'));
  push(img.getAttribute('data-lazy'));
  push(img.getAttribute('data-srcset')?.split(',').pop()?.trim().split(' ')[0]); // largest in lazy srcset
  push(img.getAttribute('data-hi-res-src'));
  push(img.getAttribute('data-full-src'));
  push(img.getAttribute('data-img'));
  // srcset — take the largest entry (last one)
  const srcset = img.getAttribute('srcset');
  if (srcset) {
    const entries = srcset.split(',').map((s) => s.trim()).filter(Boolean);
    if (entries.length) push(entries[entries.length - 1].split(' ')[0]);
  }
  // finally, the visible src
  push(img.getAttribute('src'));

  // First non-placeholder wins. If everything looks like a placeholder,
  // return null so we don't fall back to the site logo.
  for (const c of candidates) {
    if (!looksLikePlaceholder(c)) return c;
  }
  return null;
}

function extractImageFromAnchor(a) {
  // direct img child
  const img = a.querySelector('img');
  if (img) {
    const picked = pickImgSrc(img);
    if (picked) return picked;
  }
  // picture > source (prefer largest in srcset)
  const source = a.querySelector('picture source[srcset], source[srcset]');
  if (source) {
    const ss = source.getAttribute('srcset');
    if (ss) {
      const entries = ss.split(',').map((s) => s.trim()).filter(Boolean);
      const last = entries[entries.length - 1]?.split(' ')[0];
      if (last && !looksLikePlaceholder(last)) return last;
    }
  }
  // background-image inline style
  const styled = Array.from(a.querySelectorAll('[style*="background"]'));
  for (const el of styled) {
    const m = el.getAttribute('style').match(/url\(['"]?([^'")]+)['"]?\)/i);
    if (m && !looksLikePlaceholder(m[1])) return m[1];
  }
  return null;
}

function extractVideoFromAnchor(a) {
  const v = a.querySelector('video');
  if (v) {
    const src = v.getAttribute('src') || v.querySelector('source')?.getAttribute('src');
    const poster = v.getAttribute('poster');
    if (src || poster) return { src, poster };
  }
  const iframe = a.querySelector('iframe[src]');
  if (iframe) {
    const src = iframe.getAttribute('src');
    if (src && /youtube|vimeo|tiktok|wistia|dailymotion|twitch|instagram/i.test(src)) {
      return { src };
    }
  }
  return null;
}

// ---------- chrome / navigation anchor filter (issue #10) ----------
// Many sites embed tag chips, account links, footer nav, and modal dialog
// links throughout their HTML. Treating those as content items pollutes the
// output (e.g. Time.com homepage was emitting /tag/movies, /account/my-feed,
// /account/preferences as articles). This filter drops them by container
// (<nav>, <header>, <footer>, <dialog>, [role="navigation"]) and by URL
// pathname prefix (/tag/, /account/, /login/, etc.).
const CHROME_PATH_PREFIXES = [
  '/tag/', '/tags/', '/category/', '/categories/', '/topic/', '/topics/',
  '/section/', '/sections/',
  '/account/', '/auth/', '/login', '/signin', '/sign-in',
  '/signup', '/sign-up', '/register',
  '/subscribe', '/subscription', '/newsletter', '/newsletters',
  '/about', '/contact', '/privacy', '/terms', '/cookie',
  '/help', '/support', '/feedback',
  '/rss', '/sitemap', '/preferences'
];
const CHROME_CONTAINER_SELECTOR =
  'nav, header, footer, dialog, [role="navigation"], [role="dialog"], [aria-modal="true"], ' +
  '[class*="site-nav"], [class*="site-header"], [class*="site-footer"], ' +
  '[class*="main-nav"], [class*="main-menu"], [class*="main-header"], [class*="main-footer"], ' +
  '[class*="global-nav"], [class*="global-header"], [class*="global-footer"], ' +
  '[id*="site-nav"], [id*="site-header"], [id*="site-footer"]';

function isChromeAnchor(a, resolvedHref) {
  // Container-based check
  if (a.closest(CHROME_CONTAINER_SELECTOR)) return true;

  // Path-based check on the RESOLVED href, so /tag/ on relative links works
  // once base detection succeeds.
  if (resolvedHref) {
    try {
      const pathname = new URL(resolvedHref).pathname;
      if (CHROME_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + (p.endsWith('/') ? '' : '/')) || pathname.startsWith(p))) {
        return true;
      }
    } catch {}
  }
  return false;
}

// ---------- figure-sibling thumbnail fallback (issue #5 / #10) ----------
// On many modern news templates (Time.com, Vox, Gutenberg block-editor sites),
// the article image is in a <figure> sibling of the headline anchor, with NO
// wrapping <a> on the image itself. Walk up to the nearest <article>/<li> and
// pull the first non-placeholder image. Mark the chosen <img> in the WeakSet
// passed in (if any) so the standalone-image walk doesn't re-emit it as an
// orphan "Image" item.
function findFigureSiblingThumb(a, baseURL, claimedSet) {
  const block = a.closest('article, li, [class*="card"], [class*="story"], [class*="teaser"], [class*="item"], [class*="tile"], [class*="post"]');
  if (!block) return null;
  // Tier A — prefer <figure><picture><img> / <figure><img> / div-wrapped thumb.
  // Real-world news sites often wrap thumbs in <div class="thumb|image|media|poster|hero">
  // instead of <figure>, so we look for those too.
  const candidates = block.querySelectorAll(
    'figure img, picture img, figure picture source[srcset], ' +
    '[class*="thumb" i] img, [class*="image" i] img, [class*="media" i] img, ' +
    '[class*="poster" i] img, [class*="hero" i] img, [class*="photo" i] img'
  );
  for (const cand of candidates) {
    if (claimedSet && claimedSet.has(cand)) continue;
    if (cand.tagName === 'SOURCE') {
      const ss = cand.getAttribute('srcset');
      if (!ss) continue;
      const entries = ss.split(',').map((s) => s.trim()).filter(Boolean);
      const last = entries[entries.length - 1]?.split(' ')[0];
      if (last && !looksLikePlaceholder(last)) {
        const resolved = safeURL(last, baseURL) || last;
        return { thumb: resolved, claimedEl: cand.closest('picture') || cand };
      }
      continue;
    }
    const picked = pickImgSrc(cand);
    if (picked) {
      const resolved = safeURL(picked, baseURL) || picked;
      return { thumb: resolved, claimedEl: cand };
    }
  }
  // Tier B — block-level background-image (some CMSes inline the thumb as CSS).
  const styled = block.querySelectorAll('[style*="background"]');
  for (const el of styled) {
    const m = el.getAttribute('style').match(/url\(['"]?([^'")]+)['"]?\)/i);
    if (m && !looksLikePlaceholder(m[1])) {
      const resolved = safeURL(m[1], baseURL) || m[1];
      return { thumb: resolved, claimedEl: el };
    }
  }
  // Tier C — last-resort: ANY non-placeholder <img> anywhere in the block.
  // Catches arbitrary layouts (NBC, MSN, Bloomberg variants) where the thumb
  // lives in a wrapper with no class hint at all.
  const allImgs = block.querySelectorAll('img');
  for (const cand of allImgs) {
    if (claimedSet && claimedSet.has(cand)) continue;
    const picked = pickImgSrc(cand);
    if (picked) {
      const resolved = safeURL(picked, baseURL) || picked;
      return { thumb: resolved, claimedEl: cand };
    }
  }
  return null;
}

// ---------- sibling video fallback (issue #5 follow-up: Reddit shreddit-post) ----------
// On Reddit (and any card-based feed using web components), the post anchor
// is in one slot and the <video> is in a sibling slot of the same card. The
// anchor never *contains* the video, so extractVideoFromAnchor misses it and
// the standalone-video walk later picks it up as a junk "Video" item with
// title literally "Video". This helper walks up to the nearest card-shaped
// container and pulls the first <video> / <iframe> found in any sibling.
// The returned element should be added to claimedVideos so the standalone
// walk doesn't re-emit it.
function findSiblingVideo(a, baseURL) {
  const block = a.closest(
    'article, li, [class*="card"], [class*="story"], [class*="teaser"], [class*="post"], ' +
    'shreddit-post, shreddit-feed-post, [class*="feed-item"], [class*="feed-card"]'
  );
  if (!block) return null;
  // <video> with <source> or src attr
  const video = block.querySelector('video');
  if (video) {
    const src =
      video.getAttribute('src') ||
      video.querySelector('source[src]')?.getAttribute('src') ||
      video.querySelector('source[data-src]')?.getAttribute('data-src');
    if (src) {
      const resolved = safeURL(src, baseURL) || src;
      return { videoInfo: { src: resolved, poster: video.getAttribute('poster') || null }, claimedEl: video };
    }
  }
  // Embedded iframe (YouTube/Vimeo/TikTok/Instagram embeds)
  const iframe = block.querySelector('iframe[src]');
  if (iframe) {
    const src = iframe.getAttribute('src');
    if (src && /youtube|vimeo|tiktok|wistia|dailymotion|twitch|instagram/i.test(src)) {
      const resolved = safeURL(src, baseURL) || src;
      return { videoInfo: { src: resolved }, claimedEl: iframe };
    }
  }
  return null;
}

// ---------- bad-title detector (issue #6) ----------
// Some sites use anchor text that's a duration ("12:34") or play-count
// ("1.2M", "4.5K views") instead of a real title. When that happens we want
// to fall back to another anchor in the same bucket (image alt, aria-label,
// nested heading) before settling. Returns true if the candidate looks bad.
function looksLikeBadTitle(t) {
  if (!t) return true;
  let s = String(t).trim();
  if (!s) return true;
  // Strip leading bullets / dashes / arrows / non-letter punctuation so
  // "• Video 0:48 CNN" matches the same chip pattern as "Video 0:48 CNN".
  s = s.replace(/^[\s•·●◦▪▫‣⁃·\-–—>»►◉○♦]+/, '').trim();
  if (!s) return true;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return true; // duration
  if (/^\d+(\.\d+)?[KMB]?(\s*(views|likes|comments))?$/i.test(s)) return true; // play count
  // Source-attribution chip: optional "Video/Watch/Play/Listen" verb, a duration,
  // then an attribution string that can include slashes, ampersands, @handles,
  // and 1-6 words. Matches: "Video 0:39 CNN", "Video 1:13 CNN/Reuters",
  // "Video 0:29 Gaston Valdez/Facebook", "Watch • 2:34", "0:39 CNN",
  // "Video 1:13 @johnnystorms/X", "Video 0:48 getty images".
  // Source group regex: 1-6 tokens of letters/digits/@/. with separators
  // (space, slash, &, dot). Cap at 60 chars to avoid eating real headlines.
  const SRC = '[\\s•·–—:|]*[A-Za-z@][A-Za-z0-9 .\\/&@_-]{0,60}';
  if (new RegExp('^(video|watch|play|listen)[\\s•·–—:|]*\\d{1,2}:\\d{2}(:\\d{2})?(' + SRC + ')?$', 'i').test(s)) return true;
  if (new RegExp('^\\d{1,2}:\\d{2}(:\\d{2})?' + SRC + '$').test(s)) return true; // "0:39 CNN"
  if (looksLikeCode(s)) return true; // inline <script>/onerror handler bleeding through textContent
  return false;
}

// ---------- code-leak detector ----------
// CNN and other news sites embed inline <script> blocks (image onerror
// handlers, lazy-load shims) inside <article>/<figure>/<a>. The browser's
// .textContent walks through *all* descendants including <script>, so the
// raw JS source bleeds into anchor / headline text. Detect a string that
// looks like source code so we can fall back to a safer title candidate.
function looksLikeCode(s) {
  if (!s || s.length < 30) return false;
  // Strong programming-language signals
  if (/\bfunction\s*\w*\s*\(/.test(s)) return true;
  if (/=>\s*\{/.test(s)) return true;
  if (/\bvar\s|\blet\s|\bconst\s/.test(s) && /[=;{}]/.test(s)) return true;
  if (/document\.(getElementById|querySelector|createElement)/.test(s)) return true;
  if (/\.(removeAttribute|setAttribute|appendChild|addEventListener)\s*\(/.test(s)) return true;
  // Punctuation-density heuristic: real prose has very few of ;{}=()
  const codeChars = (s.match(/[;{}=()]/g) || []).length;
  const ratio = codeChars / s.length;
  if (s.length > 80 && ratio > 0.08) return true;
  return false;
}

// ---------- visible text extractor ----------
// Like .textContent, but strips <script>/<style>/<noscript>/<template>
// descendants first. Required because some sites (CNN, MSN, etc.) embed
// inline JS inside <article>/<figure>/<a>, and .textContent walks through
// <script> too — so the raw JS source bleeds into titles.
function visibleText(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  for (const bad of clone.querySelectorAll('script, style, noscript, template')) {
    bad.remove();
  }
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function getAnchorTitle(a) {
  // Back-compat wrapper: collect all candidates, return the first that passes
  // the bad-title filter, else the first non-code candidate, else null.
  const cands = collectTitleCandidates(a);
  for (const c of cands) if (!looksLikeBadTitle(c.value)) return c.value;
  for (const c of cands) if (!looksLikeCode(c.value)) return c.value;
  return cands[0]?.value || null;
}

// ---------- Strategy-list extractors ----------
// Each extractor returns a candidate {value, strategy, label} or null. The
// orchestrator runs them in order and collects every non-null result, deduped
// by value. The first candidate is the default winner; the user can swap to
// any other strategy via the Review-step picker.
//
// Design contract:
//   - Extractors are pure: input = (anchor, container?, baseURL) → output
//   - The `strategy` field is a STABLE identifier (don't rename casually —
//     it's used as the dropdown selection key).
//   - The `label` field is human-readable for the dropdown.

function collectTitleCandidates(a) {
  const out = [];
  const push = (value, strategy, label) => {
    if (!value) return;
    const v = String(value).trim();
    if (!v) return;
    // dedup by normalized value
    if (out.some((c) => c.value === v)) return;
    out.push({ value: v.slice(0, 280), strategy, label });
  };
  const aria = a.getAttribute('aria-label');
  push(aria, 'anchor-aria-label', 'aria-label');
  const ttl = a.getAttribute('title');
  push(ttl, 'anchor-title-attr', 'title attribute');
  const heading = a.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) push(visibleText(heading), 'anchor-heading', `<${heading.tagName.toLowerCase()}>`);
  const titleEl = a.querySelector('[class*="title" i], [class*="headline" i]');
  if (titleEl && titleEl !== heading) push(visibleText(titleEl), 'anchor-title-class', 'class=title/headline');
  push(visibleText(a), 'anchor-visible-text', 'anchor text');
  const img = a.querySelector('img[alt]');
  if (img?.getAttribute('alt')?.trim()) push(img.getAttribute('alt'), 'anchor-img-alt', 'image alt');
  // Container-level fallbacks — nearest article/li/figure that ISN'T the anchor.
  const container = a.closest('article, li, [class*="item" i], [class*="card" i], [class*="tile" i], [class*="post" i], figure');
  if (container && container !== a) {
    const ch = container.querySelector('h1, h2, h3, h4');
    if (ch && !a.contains(ch)) push(visibleText(ch), 'container-heading', `container <${ch.tagName.toLowerCase()}>`);
    const cTitle = container.querySelector('[class*="title" i], [class*="headline" i]');
    if (cTitle && !a.contains(cTitle) && cTitle !== ch) push(visibleText(cTitle), 'container-title-class', 'container class=title');
    const cAria = container.getAttribute('aria-label');
    if (cAria && container !== a) push(cAria, 'container-aria-label', 'container aria-label');
    const cap = container.querySelector('figcaption, [class*="caption" i]');
    if (cap) push(visibleText(cap), 'container-caption', 'caption');
  }
  return out;
}

function collectThumbCandidates(a, baseURL) {
  const out = [];
  const push = (value, strategy, label) => {
    if (!value) return;
    const resolved = safeURL(value, baseURL) || value;
    if (!/^https?:/i.test(resolved)) return;
    if (out.some((c) => c.value === resolved)) return;
    out.push({ value: resolved, strategy, label });
  };
  // 1. <img> inside the anchor
  const innerImg = a.querySelector('img');
  if (innerImg) push(pickImgSrc(innerImg), 'anchor-img', 'anchor <img>');
  // 2. <picture><source srcset> inside the anchor — pick the largest entry
  const innerPic = a.querySelector('picture source[srcset]');
  if (innerPic) {
    const ss = innerPic.getAttribute('srcset') || '';
    const last = ss.split(',').pop()?.trim().split(/\s+/)[0];
    if (last) push(last, 'anchor-picture-srcset', 'picture srcset');
  }
  // 3. inline background-image on anchor or anchor descendant
  const bgEl = a.matches?.('[style*="background-image"]') ? a : a.querySelector('[style*="background-image"]');
  if (bgEl) {
    const m = (bgEl.getAttribute('style') || '').match(/background-image\s*:\s*url\((['"]?)([^)'"]+)\1\)/i);
    if (m) push(m[2], 'anchor-bg-image', 'background-image');
  }
  // 4. Container-level images (figure-sibling, hero/poster/thumb classed)
  const container = a.closest('article, li, figure, [class*="item" i], [class*="card" i], [class*="tile" i], [class*="post" i]');
  if (container && container !== a) {
    const cPosters = container.querySelectorAll('img[class*="thumb" i], img[class*="poster" i], img[class*="hero" i], img[class*="image" i], img[class*="media" i], img[class*="photo" i]');
    cPosters.forEach((img) => push(pickImgSrc(img), 'container-class-img', 'container thumb/hero/poster img'));
    // video poster on a container <video>
    const vid = container.querySelector('video[poster]');
    if (vid) push(vid.getAttribute('poster'), 'container-video-poster', 'video poster');
    // picture source
    const cPic = container.querySelector('picture source[srcset]');
    if (cPic) {
      const ss = cPic.getAttribute('srcset') || '';
      const last = ss.split(',').pop()?.trim().split(/\s+/)[0];
      if (last) push(last, 'container-picture-srcset', 'container picture srcset');
    }
    // bg-image on container
    const cBg = container.querySelector('[style*="background-image"]');
    if (cBg) {
      const m = (cBg.getAttribute('style') || '').match(/background-image\s*:\s*url\((['"]?)([^)'"]+)\1\)/i);
      if (m) push(m[2], 'container-bg-image', 'container background-image');
    }
    // any-img fallback
    const anyImg = container.querySelector('img');
    if (anyImg) push(pickImgSrc(anyImg), 'container-any-img', 'any container <img>');
  }
  return out;
}

function collectVideoCandidates(a, baseURL) {
  // Video previews are intentionally low-priority. We still expose candidates
  // so the picker dropdown can list them; templates choose whether to use them.
  const out = [];
  const push = (info, strategy, label) => {
    if (!info?.url) return;
    const resolved = safeURL(info.url, baseURL) || info.url;
    if (!/^https?:/i.test(resolved)) return;
    if (out.some((c) => c.value === resolved)) return;
    out.push({ value: resolved, strategy, label, info: { ...info, url: resolved } });
  };
  // anchor-embedded <video>/<source>
  const v = extractVideoFromAnchor(a);
  if (v) push(v, 'anchor-video', 'anchor <video>');
  // container-embedded
  const container = a.closest('article, li, figure, [class*="item" i], [class*="card" i], [class*="tile" i]');
  if (container && container !== a) {
    const containerVid = container.querySelector('video');
    if (containerVid) {
      const src = containerVid.getAttribute('src') || containerVid.querySelector('source')?.getAttribute('src');
      if (src) push({ url: src, kind: 'inline' }, 'container-video', 'container <video>');
    }
  }
  // data-* attributes commonly used for hover-play
  for (const attr of ['data-video', 'data-video-src', 'data-hover-video', 'data-preview-video', 'data-mp4']) {
    const val = a.getAttribute(attr) || container?.getAttribute(attr);
    if (val) push({ url: val, kind: 'data-attr' }, `data-attr-${attr}`, `${attr} attribute`);
  }
  return out;
}

// ---------- page-section detection ----------
// Walk up from each anchor/img/video and figure out which on-page section
// it belongs to. We look for the nearest <section>, <nav>, <aside>, or
// any element that has a heading (h1-h4) as its first child / preceding sibling,
// or an aria-label. Result: Map<element, sectionLabel>.
function buildSectionMap(doc) {
  const map = new Map();
  const SECT_TAGS = new Set(['SECTION', 'NAV', 'ASIDE', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER']);

  function labelFor(el) {
    if (!el) return null;
    // aria-label / aria-labelledby
    const aria = el.getAttribute?.('aria-label');
    if (aria && aria.trim().length < 80) return aria.trim();
    const labelledBy = el.getAttribute?.('aria-labelledby');
    if (labelledBy) {
      const lbl = doc.getElementById(labelledBy);
      if (lbl) {
        const t = lbl.textContent.replace(/\s+/g, ' ').trim();
        if (t && t.length < 80) return t;
      }
    }
    // first heading inside this element (h1-h4)
    const h = el.querySelector?.(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > header h1, :scope > header h2, :scope > header h3, :scope > header h4, :scope > div > h1, :scope > div > h2, :scope > div > h3, :scope > div > h4');
    if (h) {
      const t = h.textContent.replace(/\s+/g, ' ').trim();
      if (t && t.length < 80) return t;
    }
    // data-section / data-category / id-as-label
    const dataSection = el.getAttribute?.('data-section') || el.getAttribute?.('data-category');
    if (dataSection && dataSection.length < 80) return dataSection;
    // id as label (e.g. id="top-news")
    const id = el.id;
    if (id && /^[a-z0-9_-]{3,40}$/i.test(id) && !/^(main|content|root|app|page|wrapper|container)$/i.test(id)) {
      return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    // class hint (e.g. class="top-news-section")
    const cls = el.className;
    if (typeof cls === 'string') {
      const m = cls.match(/\b([a-z]+(?:-[a-z]+){0,3})-(?:section|widget|module|block|list)\b/i);
      if (m) return m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return null;
  }

  // Also detect heading-led groups (no enclosing <section>): a heading followed by
  // a list of links until the next heading at the same or higher level.
  // For each heading h1-h4, collect anchors in its following siblings until the next heading.
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4'));
  for (const h of headings) {
    const lvl = +h.tagName[1];
    const label = h.textContent.replace(/\s+/g, ' ').trim();
    if (!label || label.length > 80) continue;
    let sib = h.nextElementSibling;
    while (sib) {
      if (/^H[1-4]$/.test(sib.tagName)) {
        const sibLvl = +sib.tagName[1];
        if (sibLvl <= lvl) break;
      }
      sib.querySelectorAll?.('a[href], img, iframe, video').forEach((el) => {
        if (!map.has(el)) map.set(el, label);
      });
      sib = sib.nextElementSibling;
    }
  }

  // Walk all anchors/images/videos and find their nearest tagged-section ancestor.
  const targets = Array.from(doc.querySelectorAll('a[href], img, iframe, video'));
  for (const t of targets) {
    if (map.has(t)) continue;
    let cur = t.parentElement;
    let found = null;
    let depth = 0;
    while (cur && depth < 8) {
      if (SECT_TAGS.has(cur.tagName) || cur.getAttribute?.('role') === 'region') {
        const lbl = labelFor(cur);
        if (lbl) { found = lbl; break; }
      }
      cur = cur.parentElement;
      depth++;
    }
    if (found) map.set(t, found);
  }
  return map;
}

// Parse a source's HTML into items.
// Returns an array of items (back-compat — callers can also read `.meta` for
// the unresolved-anchors info via parseSourceWithMeta below).
function parseSource(html, sourceName, opts = {}) {
  return parseSourceWithMeta(html, sourceName, opts).items;
}

function parseSourceWithMeta(html, sourceName, opts = {}) {
  if (!html?.trim()) return { items: [], unresolvedCount: 0, hasBase: false };
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return { items: [], unresolvedCount: 0, hasBase: false };
  }

  // Flatten declarative Shadow DOM so we can see media inside <template shadowrootmode>.
  // Required for sites like NYT video feeds.
  expandShadowTemplates(doc);

  // Try to detect a base URL from multiple signals, in order of reliability.
  // Used to resolve relative hrefs/thumbnails. If we can't find one, we leave
  // relative links unresolved (the parser will skip them) so we never invent
  // a fake host like example.com.
  let baseURL = doc.querySelector('base')?.href || null;
  if (!baseURL) {
    const ogu = doc.querySelector('meta[property="og:url"]')?.content;
    if (ogu) try { baseURL = new URL(ogu).origin; } catch {}
  }
  if (!baseURL) {
    const canon = doc.querySelector('link[rel="canonical"]')?.href;
    if (canon) try { baseURL = new URL(canon).origin; } catch {}
  }
  if (!baseURL) {
    const tw = doc.querySelector('meta[name="twitter:url"]')?.content || doc.querySelector('meta[property="twitter:url"]')?.content;
    if (tw) try { baseURL = new URL(tw).origin; } catch {}
  }
  if (!baseURL) baseURL = detectBaseFromAnchors(doc);

  // YouTube heuristic: pages always have relative /shorts/<id> hrefs and no
  // <base> tag. If we still have no base and the DOM contains YouTube custom
  // elements, synthesize the canonical origin. (Issue #6)
  if (!baseURL && doc.querySelector('ytd-app, [class^="ytd-"], [class*=" ytd-"], yt-formatted-string, [class*="yt-simple-endpoint"]')) {
    baseURL = 'https://www.youtube.com';
  }

  // Allow caller to override base (e.g. user typed a domain into the prompt).
  if (opts.overrideBase) baseURL = opts.overrideBase;

  const fallbackImage = getMetaImage(doc);
  const items = [];
  const seen = new Set();
  let unresolvedCount = 0;

  // Pre-compute the section that each anchor sits in so the review page can
  // group items the way they appear on the original page (Top News, Sports, etc.)
  const sectionFor = buildSectionMap(doc);

  // 1) anchors with href — bucketed by resolved href so two-anchor card patterns
  // (image-link + headline-link → same URL) merge into a single item with the
  // best title from either half and the best thumbnail from either half.
  // Also filters out navigation/chrome anchors (tag chips, account links,
  // footer/nav, modal dialogs) to prevent them polluting the output.
  // Issues #5 (two-anchor) and #10 (chrome filter, figure-sibling thumb).
  const claimedImgs = new WeakSet(); // images claimed by article-level synthesis
  const claimedVideos = new WeakSet(); // <video>/<iframe> claimed by anchor-bucket items (#5/Reddit)
  const buckets = new Map(); // href -> { anchors: [a, ...], firstAnchor: a }
  const rawAnchors = Array.from(doc.querySelectorAll('a[href]'));
  for (const a of rawAnchors) {
    const rawHref = a.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) continue;
    const href = safeURL(rawHref, baseURL);
    if (!href) {
      if (!/^https?:\/\//i.test(rawHref)) unresolvedCount++;
      continue;
    }
    if (!/^https?:/i.test(href)) continue;
    if (isChromeAnchor(a, href)) continue; // drop nav/footer/tag/account chrome
    // Drop URL-shortener / tracker hosts (#6). These appear inside Twitter
    // oEmbed blockquotes (t.co), LinkedIn previews (lnkd.in), etc. and are
    // never the canonical content destination.
    try {
      const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
      if (SHORT_LINK_HOSTS.has(host)) continue;
    } catch {}

    if (!buckets.has(href)) buckets.set(href, { anchors: [], firstAnchor: a });
    buckets.get(href).anchors.push(a);
  }

  for (const [href, bucket] of buckets) {
    if (seen.has(href)) continue;
    seen.add(href);

    // Best title: try every anchor in the bucket; structured signals beat raw text.
    let title = null;
    for (const a of bucket.anchors) {
      const t = getAnchorTitle(a);
      if (t && !looksLikeBadTitle(t)) { title = t; break; }
      if (t && !title) title = t; // keep as last-resort fallback
    }
    if (!title) title = domainOf(href);

    // Thumbnail priority (per docs/thumbnail-and-chrome-spec.md):
    //   Tier 1: video poster for the href (run FIRST so a real video preview
    //           wins over an adjacent <img>, which may be a play-button icon)
    //   Tier 2: direct <img> / <picture> / background-image / figure-sibling
    //   Tier 3: og:image fallback (single-item only, handled later)
    //   Tier 4: synthesized poster from URL pattern (YouTube, etc.) — later
    //   Tier 5: deterministic SVG placeholder — later

    // Tier 1 — find a video first.
    let video = null;
    for (const a of bucket.anchors) {
      const v = extractVideoFromAnchor(a);
      if (v) { video = v; break; }
    }
    if (!video) {
      for (const a of bucket.anchors) {
        const found = findSiblingVideo(a, baseURL);
        if (found) {
          video = found.videoInfo;
          if (found.claimedEl) {
            claimedVideos.add(found.claimedEl);
            // also claim every <source> child so source-level dedup works
            found.claimedEl.querySelectorAll?.('source').forEach((s) => claimedVideos.add(s));
          }
          break;
        }
      }
    }

    let thumb = null;
    // Promote video.poster to the thumbnail immediately if we found one.
    if (video && video.poster) {
      thumb = safeURL(video.poster, baseURL) || video.poster;
    }

    // Tier 2 — direct image inside / adjacent to the anchor.
    if (!thumb) {
      for (const a of bucket.anchors) {
        const cand = extractImageFromAnchor(a);
        if (cand) {
          thumb = safeURL(cand, baseURL) || cand;
          // mark the <img> we picked so the standalone walk doesn't re-emit it
          const innerImg = a.querySelector('img');
          if (innerImg) claimedImgs.add(innerImg);
          break;
        }
      }
    }
    if (!thumb) {
      // figure-sibling fallback — covers Time.com and similar.
      for (const a of bucket.anchors) {
        const found = findFigureSiblingThumb(a, baseURL, claimedImgs);
        if (found) {
          thumb = found.thumb;
          if (found.claimedEl) {
            // claim the <img> (or every <img> inside the <picture>)
            if (found.claimedEl.tagName === 'PICTURE') {
              found.claimedEl.querySelectorAll('img').forEach((i) => claimedImgs.add(i));
            } else {
              claimedImgs.add(found.claimedEl);
            }
          }
          break;
        }
      }
    }

    // Collect ALL candidates for title/thumb/video across every anchor in the
    // bucket so the Review-step picker can offer alternatives. Defaults stay
    // identical to the old behavior — winner is whatever the legacy code
    // chose above. The picker only surfaces when 2+ distinct candidates exist.
    const titleCandidates = [];
    const thumbCandidates = [];
    const videoCandidates = [];
    const seenTitles = new Set();
    const seenThumbs = new Set();
    const seenVideos = new Set();
    for (const a of bucket.anchors) {
      for (const c of collectTitleCandidates(a)) {
        if (seenTitles.has(c.value)) continue;
        seenTitles.add(c.value);
        titleCandidates.push(c);
      }
      for (const c of collectThumbCandidates(a, baseURL)) {
        if (seenThumbs.has(c.value)) continue;
        seenThumbs.add(c.value);
        thumbCandidates.push(c);
      }
      for (const c of collectVideoCandidates(a, baseURL)) {
        if (seenVideos.has(c.value)) continue;
        seenVideos.add(c.value);
        videoCandidates.push(c);
      }
    }
    // If our chosen winner didn't come from a strategy (e.g. domain fallback),
    // make sure it still appears as the first option so the picker shows it.
    if (title && !titleCandidates.some((c) => c.value === title)) {
      titleCandidates.unshift({ value: title, strategy: 'fallback', label: 'fallback' });
    }
    if (thumb && !thumbCandidates.some((c) => c.value === thumb)) {
      thumbCandidates.unshift({ value: thumb, strategy: 'fallback', label: 'fallback' });
    }

    const item = {
      id: uid(),
      sourceName,
      href,
      title: title.slice(0, 280),
      thumbnail: thumb || null,
      video: video || null,
      titleCandidates,
      thumbCandidates,
      videoCandidates,
      domain: domainOf(href),
      pageSection: sectionFor.get(bucket.firstAnchor) || 'Other',
    };
    item.category = classify(item);
    items.push(item);
  }

  // 1.5) <article> synthesis — for articles that contain no <a href> of their own.
  // This handles sites like NYT video feeds where each card is a self-contained
  // <article> with <video><source>, <img> poster, and a <p> headline but no anchors.
  // We do this BEFORE the standalone image/video walks so the standalone passes
  // don't grab the article's media as orphan "Image"/"Video" items.
  const synthesizedFromArticles = new WeakSet();
  const articles = Array.from(doc.querySelectorAll('article'));
  for (const art of articles) {
    if (art.querySelector('a[href]')) continue; // already covered by anchor walk
    const synth = synthesizeFromArticle(art, baseURL, sourceName);
    if (!synth) continue;
    if (seen.has(synth.href)) continue;
    seen.add(synth.href);
    synth.pageSection = sectionFor.get(art) || 'Videos';
    items.push(synth);
    // Mark all images & videos inside this article so standalone walks skip them.
    art.querySelectorAll('img, video, iframe, source').forEach((el) => synthesizedFromArticles.add(el));
  }

  // 2) Standalone images on the page (often used in galleries)
  // Only add ones not already attached to anchors above or synthesized from <article>
  const standaloneImgs = Array.from(doc.querySelectorAll('img')).filter(
    (img) => !img.closest('a[href]') && !synthesizedFromArticles.has(img) && !claimedImgs.has(img)
  );
  for (const img of standaloneImgs) {
    let src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) continue;
    src = safeURL(src, baseURL) || src;
    if (!/^https?:/i.test(src)) continue;
    if (!IMAGE_EXT.test(src)) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    const altTitle = img.getAttribute('alt')?.trim() || 'Image';
    items.push({
      id: uid(),
      sourceName,
      href: src,
      title: altTitle,
      thumbnail: src,
      video: null,
      titleCandidates: [{ value: altTitle, strategy: 'standalone-img-alt', label: 'image alt' }],
      thumbCandidates: [{ value: src, strategy: 'standalone-img', label: 'standalone <img>' }],
      videoCandidates: [],
      domain: domainOf(src),
      category: 'gallery',
      pageSection: sectionFor.get(img) || 'Images',
    });
  }

  // 3) Pure video tags / iframes without anchors
  const standaloneVideos = Array.from(doc.querySelectorAll('iframe[src], video')).filter(
    (v) => !v.closest('a[href]') && !synthesizedFromArticles.has(v) && !claimedVideos.has(v)
  );
  for (const v of standaloneVideos) {
    let src = v.getAttribute('src') || v.querySelector?.('source')?.getAttribute('src');
    if (!src) continue;
    src = safeURL(src, baseURL) || src;
    if (!/^https?:/i.test(src)) continue;
    if (seen.has(src)) continue;
    // only count actual video sources
    if (!isVideoHref(src) && !(v.tagName === 'VIDEO')) continue;
    seen.add(src);
    const vTitle = v.getAttribute('title') || 'Video';
    const vPoster = v.getAttribute('poster') || null;
    items.push({
      id: uid(),
      sourceName,
      href: src,
      title: vTitle,
      thumbnail: vPoster,
      video: { src },
      titleCandidates: [{ value: vTitle, strategy: 'standalone-video-title', label: 'video title attr' }],
      thumbCandidates: vPoster ? [{ value: vPoster, strategy: 'standalone-video-poster', label: 'video poster' }] : [],
      videoCandidates: [{ value: src, strategy: 'standalone-video', label: 'standalone <video>', info: { url: src } }],
      domain: domainOf(src),
      category: 'video',
      pageSection: sectionFor.get(v) || 'Videos',
    });
  }

  // og:image is the SITE-wide social card (often the site logo). Never apply it
  // to multiple anchors — that's what caused every TOI article to show the TOI logo.
  // Only use it when there's exactly one anchor and it has no thumb of its own.
  const articlesWithoutThumb = items.filter((i) => !i.thumbnail && i.category === 'link');
  if (fallbackImage && items.length === 1 && articlesWithoutThumb.length === 1) {
    articlesWithoutThumb[0].thumbnail = safeURL(fallbackImage, baseURL) || fallbackImage;
    articlesWithoutThumb[0].category = 'article';
  }

  // Reclassify items now that thumbs are settled, and synthesize video posters.
  for (const it of items) {
    // Tier 4 — synthesize from known URL patterns when no real thumb yet.
    if (it.category === 'video' && !it.thumbnail) {
      const yt = youtubeId(it.href) || (it.video?.src ? youtubeId(it.video.src) : null);
      if (yt) it.thumbnail = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
      // Vimeo needs an API — fall through to Tier 5 below.
    }
    // Tier 5 placeholder REMOVED — items without a real thumbnail must stay
    // null so partitionGroups() in templates.js can route them to the
    // "More links" tail. Previously we filled in a deterministic SVG letter
    // placeholder here, which made every item look like it had a preview.
    // re-run classify in case thumbnails changed
    it.category = classify(it);
    it.enabled = true;
  }

  return { items, unresolvedCount, hasBase: !!baseURL, baseURL: baseURL || null };
}

// Build an item from a self-contained <article> when the article has no
// outbound <a href>. We pull:
//   title:     headline-like <p> text, or aria-label on any inner role="group" / video
//   thumbnail: poster <img> (data-testid="betamax-poster" for NYT, else first <img>)
//   href:      best <video><source> URL (mp4 preferred, then any), or first <iframe>
// Returns null if we can't even derive a title + (href or thumbnail).
function synthesizeFromArticle(art, baseURL, sourceName) {
  // --- title ---
  // All textContent reads go through visibleText() so inline <script> sources
  // (CNN onerror handlers, MSN lazy-load shims) don't leak into the title.
  let title = null;
  // Each candidate must pass looksLikeBadTitle (which already includes
  // looksLikeCode) so "• Video 0:48 CNN" chips and JS source leaks don't
  // win when a real headline exists.
  const tryTitle = (s) => (s && !looksLikeBadTitle(s)) ? s : null;
  // Headline containers commonly used by news sites
  const headline = art.querySelector('[class*="headline"] p, [class*="headline"] h1, [class*="headline"] h2, [class*="headline"] h3, [class*="caption"] p');
  if (headline) title = tryTitle(visibleText(headline));
  // Generic headline-like child
  if (!title) {
    const hs = art.querySelectorAll('h1, h2, h3, h4');
    for (const h of hs) {
      const t = tryTitle(visibleText(h));
      if (t) { title = t; break; }
    }
  }
  // aria-label on an inner role="group" (NYT betamax)
  if (!title) {
    const grps = art.querySelectorAll('[role="group"][aria-label], [aria-label]');
    for (const grp of grps) {
      const t = tryTitle(grp.getAttribute('aria-label').replace(/\s+/g, ' ').trim());
      if (t) { title = t; break; }
    }
  }
  // First <p> as last resort — but skip <p> that's only a script/style wrapper
  // or a duration/source chip.
  if (!title) {
    const ps = art.querySelectorAll('p');
    for (const p of ps) {
      const t = tryTitle(visibleText(p));
      if (t) { title = t; break; }
    }
  }
  // Final relaxation: if every candidate looked like a chip/code, fall back
  // to the first heading's raw text (better than null — caller will dedupe).
  if (!title) {
    const h = art.querySelector('h1, h2, h3, h4, p');
    const t = h ? visibleText(h) : '';
    if (t && !looksLikeCode(t)) title = t;
  }
  if (title && title.length > 280) title = title.slice(0, 280);
  if (!title) return null;

  // --- thumbnail ---
  // Try (in order): poster-classed <img>, <video poster="…">, <picture><source srcset>,
  // any <img>, then inline background-image on a media-like wrapper.
  let thumb = null;
  const poster = art.querySelector('img[data-testid*="poster"], img[class*="poster"], img[class*="thumb"]');
  if (poster) thumb = pickImgSrc(poster);
  if (!thumb) {
    const vid = art.querySelector('video[poster]');
    if (vid) thumb = vid.getAttribute('poster');
  }
  if (!thumb) {
    const pic = art.querySelector('picture source[srcset]');
    if (pic) {
      // grab the largest entry from the srcset
      const ss = pic.getAttribute('srcset') || '';
      const last = ss.split(',').pop()?.trim().split(/\s+/)[0];
      if (last) thumb = last;
    }
  }
  if (!thumb) {
    const anyImg = art.querySelector('img');
    if (anyImg) thumb = pickImgSrc(anyImg);
  }
  if (!thumb) {
    // Inline background-image on a media/thumb/hero wrapper
    const bgEl = art.querySelector('[style*="background-image"], [class*="thumb"][style], [class*="image"][style], [class*="media"][style], [class*="hero"][style]');
    if (bgEl) {
      const m = (bgEl.getAttribute('style') || '').match(/background-image\s*:\s*url\((['"]?)([^)'"]+)\1\)/i);
      if (m) thumb = m[2];
    }
  }
  if (thumb) thumb = safeURL(thumb, baseURL) || thumb;
  if (thumb && !/^https?:/i.test(thumb)) thumb = null;

  // --- href: best video source, then iframe, then thumbnail itself ---
  let href = null;
  let videoInfo = null;
  const video = art.querySelector('video');
  if (video) {
    // Find the highest-quality MP4 source; prefer non-HLS for direct linking.
    const sources = Array.from(video.querySelectorAll('source'));
    let best = sources.find((s) => /video\/mp4/i.test(s.getAttribute('type') || '') && !/m3u8/i.test(s.getAttribute('src') || ''));
    if (!best) best = sources.find((s) => /\.mp4/i.test(s.getAttribute('src') || ''));
    if (!best) best = sources[0];
    if (best) {
      const src = best.getAttribute('src');
      if (src) {
        const resolved = safeURL(src, baseURL) || src;
        if (/^https?:/i.test(resolved)) {
          href = resolved;
          videoInfo = { src: resolved, poster: thumb || null };
        }
      }
    }
  }
  if (!href) {
    const iframe = art.querySelector('iframe[src]');
    if (iframe) {
      const src = iframe.getAttribute('src');
      const resolved = src ? (safeURL(src, baseURL) || src) : null;
      if (resolved && /^https?:/i.test(resolved)) {
        href = resolved;
        if (/youtube|vimeo|tiktok|wistia|dailymotion|twitch|instagram/i.test(resolved)) {
          videoInfo = { src: resolved };
        }
      }
    }
  }
  // If no playable media URL exists, fall back to linking the article container's
  // data-href / data-url, or the thumbnail itself.
  if (!href) {
    const dataLink = art.getAttribute('data-href') || art.getAttribute('data-url') || art.getAttribute('data-link');
    if (dataLink) {
      const resolved = safeURL(dataLink, baseURL) || dataLink;
      if (/^https?:/i.test(resolved)) href = resolved;
    }
  }
  if (!href && thumb) href = thumb;
  if (!href) return null;

  const item = {
    id: uid(),
    sourceName,
    href,
    title,
    thumbnail: thumb || null,
    video: videoInfo,
    titleCandidates: title ? [{ value: title, strategy: 'synthesized', label: 'synthesized from article' }] : [],
    thumbCandidates: thumb ? [{ value: thumb, strategy: 'synthesized', label: 'synthesized from article' }] : [],
    videoCandidates: videoInfo?.url ? [{ value: videoInfo.url, strategy: 'synthesized', label: 'synthesized from article', info: videoInfo }] : [],
    domain: domainOf(href),
  };
  item.category = videoInfo ? 'video' : (thumb ? 'article' : 'link');
  return item;
}

// ===================================================
// STEP 1 — SOURCE UI
// ===================================================

function addSource(prefill = {}) {
  const source = {
    id: uid(),
    name: prefill.name || '',          // empty = auto-named by position
    customName: !!prefill.name,        // true once user types something
    html: prefill.html || '',
    items: [],
    overrideBase: null,                // set when user manually provides a domain
    unresolvedCount: 0,                // # of relative anchors that need a domain
    domainValidationState: 'idle',     // 'idle' | 'checking' | 'ok' | 'failed'
  };
  state.sources.push(source);
  renderSources();
  return source;
}

function displayName(src, idx) {
  return src.customName && src.name ? src.name : `Source ${idx + 1}`;
}

function removeSource(id) {
  state.sources = state.sources.filter((s) => s.id !== id);
  if (state.sources.length === 0) addSource();
  renderSources();
}

function renderSources() {
  const root = $('#sources');
  root.innerHTML = '';
  state.sources.forEach((src, idx) => {
    const card = document.createElement('div');
    card.className = 'source-card';
    card.dataset.id = src.id;
    card.innerHTML = `
      <div class="source-card__head">
        <span class="source-card__label">${String(idx + 1).padStart(2, '0')}</span>
        <input class="source-card__name" type="text" value="${escapeAttr(displayName(src, idx))}" placeholder="Name this source (e.g. NYT homepage)" />
        <button class="source-card__remove" type="button" aria-label="Remove source" title="Remove source">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <textarea spellcheck="false" placeholder="Paste raw HTML here — &lt;html&gt;, a fragment, or anything that contains anchors, images, videos…">${escapeText(src.html)}</textarea>
      <div class="source-card__banner" data-banner hidden></div>
      <div class="source-card__foot">
        <div class="source-card__stats">
          <span><strong>0</strong> items</span>
          <span><strong>0</strong> with image</span>
          <span><strong>0</strong> videos</span>
        </div>
        <span class="source-card__hint"></span>
      </div>
    `;
    root.appendChild(card);

    const nameInput = card.querySelector('.source-card__name');
    const textarea = card.querySelector('textarea');
    const removeBtn = card.querySelector('.source-card__remove');

    nameInput.addEventListener('input', () => {
      src.name = nameInput.value;
      src.customName = nameInput.value.trim().length > 0;
      // Re-stamp already-parsed items with the new source name so the rendered
      // page groups them under the typed label instead of UNSOURCED. Without
      // this, items keep whatever sourceName they got at paste time (often '').
      if (src.items && src.items.length) {
        for (const it of src.items) it.sourceName = src.name;
      }
      updateCounts();
    });
    textarea.addEventListener('input', () => {
      src.html = textarea.value;
      runParse(src, card);
    });
    removeBtn.addEventListener('click', () => removeSource(src.id));

    // initial stats if prefilled
    if (src.html) runParse(src, card);
  });
  updateCounts();
}

// Parse a source and update its card UI (stats + unresolved-domain banner).
function runParse(src, card) {
  const meta = parseSourceWithMeta(src.html, src.name, {
    overrideBase: src.overrideBase || undefined,
  });
  // Stamp every item with the source id so the renderer can group them even
  // if the user later edits the source name (sourceName captured at parse
  // time would otherwise be stale or empty).
  for (const it of meta.items) it.sourceId = src.id;
  src.items = meta.items;
  src.unresolvedCount = meta.unresolvedCount;
  src.detectedBase = meta.baseURL;
  // "Empty source" — we got non-empty HTML but zero items. Likely a JS-rendered
  // page or a snippet that needs different selectors. Track so we can show a hint.
  src.emptyAfterParse = !!(src.html.trim() && meta.items.length === 0 && meta.unresolvedCount === 0);
  updateStats(card, meta.items);
  renderBanner(src, card);
  updateCounts();
}

// Show / hide the yellow "unresolved domain" banner under the textarea.
function renderBanner(src, card) {
  const banner = card.querySelector('[data-banner]');
  if (!banner) return;

  // Empty-source hint takes over when there's no unresolved-domain situation.
  if (!src.unresolvedCount && src.emptyAfterParse) {
    banner.hidden = false;
    banner.className = 'source-card__banner is-empty';
    banner.innerHTML = `
      <div class="banner__msg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>No links, images, or videos detected. This may be a JS-rendered page — try “View Page Source” in your browser and paste that instead of inspecting the rendered DOM.</span>
      </div>
    `;
    return;
  }

  if (!src.unresolvedCount) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  const stateClass = src.domainValidationState === 'checking' ? 'is-checking'
                  : src.domainValidationState === 'failed' ? 'is-failed'
                  : src.domainValidationState === 'ok' ? 'is-ok' : '';
  const msg = src.domainValidationState === 'checking' ? 'Checking that host…'
           : src.domainValidationState === 'failed' ? "Couldn't reach that host — check the spelling, or use \"Skip & drop these links\"."
           : src.domainValidationState === 'ok' ? 'Got it — links will use this domain.'
           : `${src.unresolvedCount} link${src.unresolvedCount === 1 ? '' : 's'} ${src.unresolvedCount === 1 ? 'has' : 'have'} no domain. What site are these from?`;
  banner.className = `source-card__banner ${stateClass}`;
  banner.innerHTML = `
    <div class="banner__msg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      <span>${escapeText(msg)}</span>
    </div>
    <form class="banner__form" data-banner-form>
      <input type="text" class="banner__input" placeholder="e.g. dallasnews.com" value="${escapeAttr(src.overrideBase || '')}" autocomplete="off" spellcheck="false" />
      <button type="submit" class="banner__btn banner__btn--primary">Use this domain</button>
      <button type="button" class="banner__btn banner__btn--ghost" data-banner-skip>Skip & drop these links</button>
    </form>
  `;
  const form = banner.querySelector('[data-banner-form]');
  const input = banner.querySelector('.banner__input');
  const skipBtn = banner.querySelector('[data-banner-skip]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    const origin = normalizeHostToOrigin(raw);
    if (!origin) {
      src.domainValidationState = 'failed';
      renderBanner(src, card);
      return;
    }
    src.domainValidationState = 'checking';
    renderBanner(src, card);
    const ok = await probeHost(origin);
    if (!ok) {
      src.domainValidationState = 'failed';
      renderBanner(src, card);
      return;
    }
    src.overrideBase = origin;
    src.domainValidationState = 'ok';
    runParse(src, card); // re-parse with the new base
  });
  skipBtn.addEventListener('click', () => {
    // Mark as resolved-by-skipping: clear unresolvedCount so banner hides;
    // the unresolved anchors are already excluded from items so they get dropped.
    src.unresolvedCount = 0;
    src.domainValidationState = 'idle';
    renderBanner(src, card);
    updateCounts();
  });
}

// Accept anything from "dallasnews.com" to "https://www.dallasnews.com/foo"
// and return a clean "https://host" origin string. Returns null if invalid.
function normalizeHostToOrigin(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

// Best-effort reachability test. Uses no-cors so an opaque success still means
// the host resolved. AbortController gives us a 5s timeout.
async function probeHost(origin) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    await fetch(origin, { mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(tid);
    return true;
  } catch {
    return false;
  }
}

function updateStats(card, items) {
  const stats = card.querySelector('.source-card__stats');
  const nonVideo = items.filter((i) => i.category === 'link' || i.category === 'article').length;
  const images = items.filter((i) => i.thumbnail).length;
  const videos = items.filter((i) => i.category === 'video').length;
  stats.innerHTML = `
    <span><strong>${nonVideo}</strong> items</span>
    <span><strong>${images}</strong> with image</span>
    <span><strong>${videos}</strong> videos</span>
  `;
}

function updateCounts() {
  const sourceCount = state.sources.filter((s) => s.html.trim()).length;
  const itemCount = state.sources.reduce((sum, s) => sum + s.items.length, 0);
  $('[data-count-sources]').textContent = `${sourceCount} source${sourceCount === 1 ? '' : 's'}`;
  $('[data-count-items]').textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} detected`;
  $('#btn-parse').disabled = itemCount === 0;
}

function escapeText(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ===================================================
// STEP 2 — REVIEW UI
// ===================================================

const CATEGORY_META = {
  'with-image': { title: 'Links with image preview', desc: 'Anchors that came with a thumbnail.' },
  'with-video': { title: 'Links with video preview', desc: 'YouTube, Vimeo, and other embedded videos.' },
  'plain': { title: 'Plain links (no preview)', desc: 'Anchors with text only — no image, no video.' },
};

const CATEGORY_ORDER = ['with-image', 'with-video', 'plain'];

// Map the internal item.category to the user-facing bucket above.
function bucketOf(item) {
  if (item.category === 'video') return 'with-video';
  if (item.thumbnail) return 'with-image'; // includes article + gallery
  return 'plain';
}

function gotoReview() {
  // Block parse if any source still has unresolved links the user hasn't
  // addressed. They have to either type a domain or click "Skip & drop".
  const blocked = state.sources.filter((s) => s.unresolvedCount > 0);
  if (blocked.length) {
    const first = document.querySelector(`.source-card[data-id="${blocked[0].id}"] .banner__input`);
    if (first) first.focus();
    const hint = blocked.length === 1
      ? 'One source has links with no domain — resolve it first.'
      : `${blocked.length} sources have links with no domain — resolve them first.`;
    const parseHint = $('#parse-hint');
    if (parseHint) {
      parseHint.textContent = hint;
      parseHint.classList.add('is-warn');
      setTimeout(() => { parseHint.classList.remove('is-warn'); parseHint.textContent = ''; }, 4000);
    }
    return;
  }
  flattenSourcesIntoItems({ resetEnabled: true });
  renderReview();
  showScreen('step-review');
}

// Apply each source's strategy choice then flatten src.items into state.items.
// Preserves per-item `enabled` toggles across re-flattens unless resetEnabled.
function flattenSourcesIntoItems({ resetEnabled = false } = {}) {
  // remember enabled state by href before we rebuild
  const prevEnabled = new Map();
  if (!resetEnabled) {
    for (const it of state.items || []) prevEnabled.set(it.href, it.enabled);
  }
  for (const src of state.sources) {
    applySourceStrategy(src);
  }
  const all = [];
  const seen = new Set();
  for (const src of state.sources) {
    for (const it of src.items) {
      if (seen.has(it.href)) continue;
      seen.add(it.href);
      const enabled = resetEnabled ? true : (prevEnabled.has(it.href) ? prevEnabled.get(it.href) : true);
      all.push({ ...it, enabled, pageSection: it.pageSection || 'Other' });
    }
  }
  state.items = all;
}

// ---------- candidate-picker support ----------
// Each source stores src.strategy = {title, thumb, video} with the user's
// chosen extractor name. Applying it walks the source's items and updates
// item.title/thumbnail/video from the saved candidate lists. No re-parse needed.
function applySourceStrategy(src) {
  const strat = src.strategy || {};
  for (const it of src.items || []) {
    if (strat.title && it.titleCandidates?.length) {
      const pick = it.titleCandidates.find((c) => c.strategy === strat.title);
      if (pick) it.title = pick.value;
    }
    if (strat.thumb && it.thumbCandidates?.length) {
      const pick = it.thumbCandidates.find((c) => c.strategy === strat.thumb);
      if (pick) it.thumbnail = pick.value;
      else if (strat.thumb === '__none__') it.thumbnail = null;
    }
    if (strat.video && it.videoCandidates?.length) {
      const pick = it.videoCandidates.find((c) => c.strategy === strat.video);
      if (pick) it.video = pick.info || { url: pick.value };
      else if (strat.video === '__none__') it.video = null;
    }
  }
}

// Build the option list for a source's title/thumb/video picker. Each option
// is a strategy that produced at least one candidate across the source's
// items, with a sample preview value the user can see in the dropdown.
function buildPickerOptionsForSource(src, field) {
  const candKey = field === 'title' ? 'titleCandidates'
    : field === 'thumb' ? 'thumbCandidates'
    : 'videoCandidates';
  const byStrategy = new Map();
  for (const it of src.items || []) {
    for (const c of it[candKey] || []) {
      if (!byStrategy.has(c.strategy)) {
        byStrategy.set(c.strategy, { strategy: c.strategy, label: c.label, sample: c.value, count: 0 });
      }
      byStrategy.get(c.strategy).count++;
    }
  }
  return Array.from(byStrategy.values());
}

// Initialize src.strategy from the parser's default winner (first candidate).
// This makes the dropdown show the right value on first render.
function seedDefaultStrategies(src) {
  if (!src) return;
  src.strategy = src.strategy || {};
  for (const it of src.items || []) {
    if (!src.strategy.title && it.titleCandidates?.length) {
      // pick the strategy whose value equals the current it.title, else first
      const match = it.titleCandidates.find((c) => c.value === it.title);
      src.strategy.title = (match || it.titleCandidates[0]).strategy;
    }
    if (!src.strategy.thumb && it.thumbCandidates?.length) {
      const match = it.thumbCandidates.find((c) => c.value === it.thumbnail);
      src.strategy.thumb = (match || it.thumbCandidates[0]).strategy;
    }
    if (src.strategy.title && src.strategy.thumb) break;
  }
  // video defaults to none (opt-in)
  if (!src.strategy.video) src.strategy.video = '__none__';
}

function renderSourceStrategyPicker() {
  const root = $('#source-strategy');
  if (!root) return;
  // Only render rows where the source has 2+ strategies for title OR thumb
  // OR any video candidates (video is opt-in). Sources with a single
  // unambiguous extractor don't need UI.
  const rows = [];
  for (const src of state.sources) {
    seedDefaultStrategies(src);
    const titleOpts = buildPickerOptionsForSource(src, 'title');
    const thumbOpts = buildPickerOptionsForSource(src, 'thumb');
    const videoOpts = buildPickerOptionsForSource(src, 'video');
    const showTitle = titleOpts.length >= 2;
    const showThumb = thumbOpts.length >= 2;
    const showVideo = videoOpts.length >= 1;
    if (!showTitle && !showThumb && !showVideo) continue;
    rows.push({ src, titleOpts, thumbOpts, videoOpts, showTitle, showThumb, showVideo });
  }
  if (rows.length === 0) { root.hidden = true; root.innerHTML = ''; return; }
  root.hidden = false;
  root.innerHTML = `
    <div class="strategy-picker__head">
      <h3>How should links from each source look?</h3>
      <p class="muted">When a source offers more than one way to grab the title or image, pick the one that fits best. Your choice applies to every link from that source.</p>
    </div>
    <div class="strategy-picker__list">
      ${rows.map(({ src, titleOpts, thumbOpts, videoOpts, showTitle, showThumb, showVideo }) => `
        <div class="strategy-row" data-src-id="${escapeAttr(src.id)}">
          <div class="strategy-row__source">
            <span class="strategy-row__name">${escapeText(src.name || 'Untitled source')}</span>
            <span class="strategy-row__count muted">${(src.items || []).length} link${(src.items || []).length === 1 ? '' : 's'}</span>
          </div>
          <div class="strategy-row__fields">
            ${showTitle ? renderStrategySelect('title', src, titleOpts) : ''}
            ${showThumb ? renderStrategySelect('thumb', src, thumbOpts, { allowNone: true }) : ''}
            ${showVideo ? renderStrategySelect('video', src, videoOpts, { allowNone: true, optional: true }) : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  // bind change handlers
  root.querySelectorAll('select[data-strategy-field]').forEach((sel) => {
    sel.addEventListener('change', onStrategyChange);
  });
}

function renderStrategySelect(field, src, options, opts = {}) {
  const { allowNone = false, optional = false } = opts;
  const labelText = field === 'title' ? 'Title' : field === 'thumb' ? 'Image' : 'Video preview';
  const current = src.strategy?.[field] || (options[0]?.strategy) || '__none__';
  const optHtml = options.map((o) => {
    const sample = truncate(o.sample || '', 48);
    const optLabel = `${o.label} — ${sample || '(empty)'} · ${o.count} link${o.count === 1 ? '' : 's'}`;
    return `<option value="${escapeAttr(o.strategy)}" ${o.strategy === current ? 'selected' : ''}>${escapeText(optLabel)}</option>`;
  }).join('');
  const noneHtml = allowNone
    ? `<option value="__none__" ${current === '__none__' ? 'selected' : ''}>${optional ? 'No video preview' : `No ${field}`}</option>`
    : '';
  return `
    <label class="strategy-field">
      <span class="strategy-field__label">${labelText}</span>
      <select data-strategy-field="${field}" data-src-id="${escapeAttr(src.id)}">
        ${optHtml}
        ${noneHtml}
      </select>
    </label>
  `;
}

function onStrategyChange(e) {
  const sel = e.currentTarget;
  const srcId = sel.dataset.srcId;
  const field = sel.dataset.strategyField;
  const value = sel.value;
  const src = state.sources.find((s) => s.id === srcId);
  if (!src) return;
  src.strategy = src.strategy || {};
  src.strategy[field] = value;
  // Re-flatten so the new title/thumb/video shows up in state.items, then
  // re-render the categories panel. Preserve user's enabled toggles.
  flattenSourcesIntoItems({ resetEnabled: false });
  renderReview();
}

function truncate(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function renderReview() {
  const meta = $('[data-review-meta]');
  const sources = new Set(state.items.map((i) => i.sourceName));
  const enabledCount = state.items.filter((i) => i.enabled).length;
  meta.innerHTML = `
    <span><strong>${enabledCount}</strong> / ${state.items.length} selected</span>
    <span>${sources.size} source${sources.size === 1 ? '' : 's'}</span>
  `;

  renderSourceStrategyPicker();
  renderTemplatePicker();

  const root = $('#categories');
  root.innerHTML = '';

  if (state.items.length === 0) {
    root.innerHTML = `
      <div class="empty">
        <h3>No items found.</h3>
        <p>Go back and paste HTML that contains anchor tags, images, or videos.</p>
      </div>
    `;
    return;
  }

  // Group by content-type bucket: with-image, with-video, plain.
  const grouped = new Map();
  for (const it of state.items) {
    const k = bucketOf(it);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(it);
  }

  CATEGORY_ORDER.forEach((key, idx) => {
    const items = grouped.get(key);
    if (!items || items.length === 0) return;
    root.appendChild(renderGroupPanel(key, items, idx === 0));
  });
}

function renderGroupPanel(key, items, openByDefault) {
  const title = CATEGORY_META[key]?.title || key;
  const desc = CATEGORY_META[key]?.desc || '';
  const enabled = items.filter((i) => i.enabled).length;
  const allOn = enabled === items.length;
  const someOn = enabled > 0 && enabled < items.length;

  const panel = document.createElement('section');
  panel.className = 'group-panel';
  if (openByDefault) panel.classList.add('group-panel--open');
  panel.innerHTML = `
    <header class="group-panel__head">
      <label class="group-checkbox" title="Toggle all in this group">
        <input type="checkbox" data-group-toggle ${allOn ? 'checked' : ''} ${someOn ? 'data-indeterminate="true"' : ''} />
        <span class="group-checkbox__box"></span>
      </label>
      <button type="button" class="group-panel__toggle" aria-expanded="${openByDefault ? 'true' : 'false'}">
        <span class="group-panel__title">${escapeText(title)}</span>
        <span class="group-panel__count">${enabled} / ${items.length}</span>
        <svg class="group-panel__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      ${desc ? `<p class="group-panel__desc">${escapeText(desc)}</p>` : ''}
    </header>
    <div class="group-panel__body"></div>
  `;

  const body = panel.querySelector('.group-panel__body');
  items.forEach((it) => body.appendChild(renderItemRow(it)));

  // Fix indeterminate after attaching
  const groupChk = panel.querySelector('[data-group-toggle]');
  if (someOn) groupChk.indeterminate = true;

  // Group checkbox: select / deselect all in this group
  groupChk.addEventListener('change', (e) => {
    e.stopPropagation();
    const turnOn = groupChk.checked;
    items.forEach((it) => (it.enabled = turnOn));
    renderReview();
  });

  // Collapse toggle
  panel.querySelector('.group-panel__toggle').addEventListener('click', () => {
    panel.classList.toggle('group-panel--open');
    const expanded = panel.classList.contains('group-panel--open');
    panel.querySelector('.group-panel__toggle').setAttribute('aria-expanded', expanded);
  });

  return panel;
}

function renderItemRow(item) {
  const row = document.createElement('label');
  row.className = 'item-row';
  if (!item.enabled) row.classList.add('item-row--off');
  row.dataset.id = item.id;

  const thumbHtml = item.thumbnail
    ? `<div class="item-row__thumb ${item.category === 'video' ? 'item-row__thumb--video' : ''}">
         <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('item-row__thumb--empty'); this.remove();" />
         ${item.category === 'video' ? '<span class="item-row__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' : ''}
       </div>`
    : `<div class="item-row__thumb item-row__thumb--empty"><span>${escapeText((item.domain || item.title || 'L').charAt(0).toUpperCase())}</span></div>`;

  const typeLabel = item.category === 'article' ? 'Article'
    : item.category === 'video' ? 'Video'
    : item.category === 'gallery' ? 'Image' : 'Link';

  row.innerHTML = `
    <input type="checkbox" class="item-row__check" ${item.enabled ? 'checked' : ''} />
    <span class="item-row__box"></span>
    ${thumbHtml}
    <div class="item-row__body">
      <p class="item-row__title">${escapeText(item.title)}</p>
      <div class="item-row__meta">
        <span class="item-row__type item-row__type--${item.category}">${typeLabel}</span>
        <span class="item-row__domain">${escapeText(item.domain)}</span>
      </div>
      <span class="item-row__url">${escapeText(item.href)}</span>
    </div>
  `;

  const check = row.querySelector('.item-row__check');
  check.addEventListener('change', () => {
    item.enabled = check.checked;
    row.classList.toggle('item-row--off', !item.enabled);
    // Update parent group + meta counts without re-rendering everything
    updateGroupHeader(row);
    updateReviewMeta();
  });

  return row;
}

function updateGroupHeader(row) {
  const panel = row.closest('.group-panel');
  if (!panel) return;
  const checks = Array.from(panel.querySelectorAll('.item-row__check'));
  const onCount = checks.filter((c) => c.checked).length;
  const groupChk = panel.querySelector('[data-group-toggle]');
  groupChk.checked = onCount === checks.length;
  groupChk.indeterminate = onCount > 0 && onCount < checks.length;
  panel.querySelector('.group-panel__count').textContent = `${onCount} / ${checks.length}`;
}

function updateReviewMeta() {
  const meta = $('[data-review-meta]');
  if (!meta) return;
  const sources = new Set(state.items.map((i) => i.sourceName));
  const enabledCount = state.items.filter((i) => i.enabled).length;
  meta.innerHTML = `
    <span><strong>${enabledCount}</strong> / ${state.items.length} selected</span>
    <span>${sources.size} source${sources.size === 1 ? '' : 's'}</span>
  `;
}

function renderItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  if (!item.enabled) card.classList.add('item-card--off');
  card.dataset.id = item.id;

  const mediaHtml = renderMedia(item);
  card.innerHTML = `
    ${mediaHtml}
    <button class="item-card__toggle" type="button" aria-pressed="${item.enabled}" aria-label="Toggle inclusion">
      ${item.enabled
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'}
    </button>
    <div class="item-card__body">
      <span class="item-card__source">${escapeText(item.sourceName)} · ${escapeText(item.domain)}</span>
      <p class="item-card__title">${escapeText(item.title)}</p>
      <span class="item-card__url">${escapeText(item.href)}</span>
    </div>
  `;

  card.querySelector('.item-card__toggle').addEventListener('click', () => {
    item.enabled = !item.enabled;
    card.classList.toggle('item-card--off', !item.enabled);
    card.querySelector('.item-card__toggle').innerHTML = item.enabled
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  });

  return card;
}

function renderMedia(item) {
  const typeLabel = item.category === 'article' ? 'Article'
    : item.category === 'video' ? 'Video'
    : item.category === 'gallery' ? 'Image' : 'Link';
  const typeBadge = `<span class="item-card__type">${typeLabel}</span>`;
  if (item.thumbnail) {
    const videoOverlay = item.category === 'video' ? `
      <div class="item-card__play">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
      </div>` : '';
    return `
      <div class="item-card__media ${item.category === 'video' ? 'item-card__media--video' : ''}">
        ${typeBadge}
        <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('item-card__media--empty'); this.remove();" />
        ${videoOverlay}
      </div>
    `;
  }
  // empty card — show initial of domain
  const mark = (item.domain || item.title || 'L').charAt(0).toUpperCase();
  return `
    <div class="item-card__media item-card__media--empty">
      ${typeBadge}
      <span class="item-card__empty-mark">${escapeText(mark)}</span>
    </div>
  `;
}

// bulk actions
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bulk]');
  if (!btn) return;
  const mode = btn.dataset.bulk;
  for (const it of state.items) {
    if (mode === 'all') it.enabled = true;
    else if (mode === 'none') it.enabled = false;
    else if (mode === 'with-image') it.enabled = !!it.thumbnail;
  }
  renderReview();
});

// ===================================================
// STEP 3 — GENERATE FINAL SITE
// ===================================================

// ---------- TEMPLATE PICKER UI ----------
function countByCategory(items) {
  // Provide both bucket counts (for suggesting templates from the 3-bucket world)
  // and legacy category counts (article/video/gallery/link) for back-compat.
  const c = { article: 0, video: 0, gallery: 0, link: 0, total: items.length };
  for (const i of items) c[i.category] = (c[i.category] || 0) + 1;
  return c;
}

function renderTemplatePicker() {
  const grid = $('#template-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const enabled = state.items.filter((i) => i.enabled);
  const counts = countByCategory(enabled);
  const suggested = window.LINKFORGE_SUGGEST(counts);

  // pick default if not already set
  if (!state.site.template || !window.LINKFORGE_TEMPLATES[state.site.template]) {
    state.site.template = suggested;
  }

  for (const [key, tpl] of Object.entries(window.LINKFORGE_TEMPLATES)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'template-card';
    if (state.site.template === key) card.classList.add('template-card--active');
    card.dataset.template = key;
    card.innerHTML = `
      ${key === suggested ? '<span class="template-card__suggested">Suggested</span>' : ''}
      <div class="template-card__preview">${tpl.preview()}</div>
      <div class="template-card__body">
        <div class="template-card__name">${escapeText(tpl.name)}</div>
        <div class="template-card__desc">${escapeText(tpl.desc)}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.site.template = key;
      $$('.template-card').forEach((c) => c.classList.toggle('template-card--active', c.dataset.template === key));
    });
    grid.appendChild(card);
  }
}

// ---------- BUILD GENERATED SITE ----------
function buildGeneratedSite() {
  state.site.title = $('#site-title').value.trim() || 'Daily Reader';
  state.site.tagline = $('#site-tagline').value.trim() || '';

  // The final site uses the same three buckets shown on the review page:
  //   withImage  -> rendered as image-card grid (articles section)
  //   withVideo  -> rendered as video card grid (videos section)
  //   plain      -> rendered as text-only link list (links section)
  // We also keep `gallery` (standalone images) as a separate bucket so the
  // Gallery template can still receive image-only items if needed.
  const enabled = state.items.filter((i) => i.enabled);
  const withImage = enabled.filter((i) => bucketOf(i) === 'with-image');
  const videos = enabled.filter((i) => bucketOf(i) === 'with-video');
  const links = enabled.filter((i) => bucketOf(i) === 'plain');

  // For backward compat with existing templates, split withImage into
  //   articles (have an outbound href, i.e. not pure standalone images)
  //   gallery  (standalone images where href === thumbnail)
  const articles = withImage.filter((i) => i.category !== 'gallery');
  const gallery = withImage.filter((i) => i.category === 'gallery');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Group enabled items by source name, preserving the order sources were added.
  // Each source's display name (typed value, or auto "Source N") is the canonical
  // group label. Items keep an `id` ref to their source so we can re-resolve the
  // name at render time even if the name was edited after paste.
  const bySource = [];
  const sourceIndex = new Map(); // sourceId -> bySource index
  const idToName = new Map();    // sourceId -> display name
  state.sources.forEach((src, idx) => {
    const name = displayName(src, idx);
    idToName.set(src.id, name);
    sourceIndex.set(src.id, bySource.length);
    bySource.push({ name, items: [] });
  });
  // Build a name->bySource fallback for items whose sourceId we can't map.
  const nameIndex = new Map();
  state.sources.forEach((src, idx) => {
    const name = displayName(src, idx);
    if (!nameIndex.has(name)) nameIndex.set(name, sourceIndex.get(src.id));
  });
  for (const it of enabled) {
    // Prefer sourceId binding (survives name edits). Fall back to sourceName lookup,
    // then to a free-standing "Unsourced" bucket as a last resort.
    let bucketIdx = it.sourceId ? sourceIndex.get(it.sourceId) : undefined;
    if (bucketIdx === undefined && it.sourceName) bucketIdx = nameIndex.get(it.sourceName);
    if (bucketIdx === undefined) {
      const key = it.sourceName || 'Unsourced';
      if (!nameIndex.has(key)) {
        nameIndex.set(key, bySource.length);
        bySource.push({ name: key, items: [] });
      }
      bucketIdx = nameIndex.get(key);
    }
    // Overwrite item.sourceName with the current canonical name (so cards/kickers
    // reflect the latest typed value).
    if (it.sourceId && idToName.has(it.sourceId)) it.sourceName = idToName.get(it.sourceId);
    bySource[bucketIdx].items.push(it);
  }
  // Drop empty source groups
  const sourceGroups = bySource.filter((g) => g.items.length > 0);

  const ctx = {
    title: state.site.title,
    tagline: state.site.tagline,
    articles, videos, gallery, links,
    all: enabled,
    sourceGroups,
    today,
  };

  const tpl = window.LINKFORGE_TEMPLATES[state.site.template] || window.LINKFORGE_TEMPLATES.editorial;
  return tpl.build(ctx);
}

function _UNUSED() {
  const _html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeText(state.site.title)}</title>
  <meta name="description" content="${escapeAttr(state.site.tagline)}" />
  <link rel="preconnect" href="https://api.fontshare.com" crossorigin />
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=gambarino@400&display=swap" rel="stylesheet" />
  ${css}
</head>
<body>
  <header class="masthead">
    <div class="masthead__top">
      <span class="masthead__date">${escapeText(today)}</span>
      <span class="masthead__count">${enabled.length} ${enabled.length === 1 ? 'item' : 'items'}</span>
    </div>
    <h1 class="masthead__title">${escapeText(state.site.title)}</h1>
    ${state.site.tagline ? `<p class="masthead__tagline">${escapeText(state.site.tagline)}</p>` : ''}
  </header>

  ${hero ? renderHero(hero) : ''}

  ${restArticles.length ? renderSection('Articles', restArticles, state.site.layout) : ''}
  ${videos.length ? renderSection('Watch', videos, state.site.layout, true) : ''}
  ${gallery.length ? renderSection('Visuals', gallery, state.site.layout) : ''}
  ${links.length ? renderLinkList('More reading', links) : ''}

  <footer class="footer">
    <p>Compiled with Linkforge · ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
  return _html;
}

function renderHero(item) {
  return `
    <a class="hero" href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer">
      ${item.thumbnail ? `<div class="hero__img"><img src="${escapeAttr(item.thumbnail)}" alt="" /></div>` : ''}
      <div class="hero__body">
        <span class="kicker">${escapeText(item.sourceName)} · ${escapeText(item.domain)}</span>
        <h2 class="hero__title">${escapeText(item.title)}</h2>
        <span class="hero__cta">Read story →</span>
      </div>
    </a>
  `;
}

function renderSection(title, items, layout, isVideo = false) {
  const cards = items.map((i) => renderGenCard(i, isVideo)).join('');
  const cls = layout === 'masonry' ? 'grid grid--masonry' : 'grid grid--magazine';
  return `
    <section class="section">
      <h3 class="section__title">${escapeText(title)}<span class="section__count">${items.length}</span></h3>
      <div class="${cls}">${cards}</div>
    </section>
  `;
}

function renderGenCard(item, isVideo) {
  const mark = (item.domain || item.title || 'L').charAt(0).toUpperCase();
  const media = item.thumbnail
    ? `<div class="card__media ${isVideo ? 'card__media--video' : ''}">
         <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('card__media--empty'); this.remove();" />
         ${isVideo ? '<div class="card__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : ''}
       </div>`
    : `<div class="card__media card__media--empty"><span class="card__mark">${escapeText(mark)}</span></div>`;
  return `
    <a class="card" href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer">
      ${media}
      <div class="card__body">
        <span class="kicker">${escapeText(item.sourceName)} · ${escapeText(item.domain)}</span>
        <p class="card__title">${escapeText(item.title)}</p>
      </div>
    </a>
  `;
}

function renderLinkList(title, items) {
  const rows = items.map((i) => `
    <li>
      <a href="${escapeAttr(i.href)}" target="_blank" rel="noopener noreferrer">
        <span class="link-list__title">${escapeText(i.title)}</span>
        <span class="link-list__src">${escapeText(i.domain)}</span>
      </a>
    </li>
  `).join('');
  return `
    <section class="section">
      <h3 class="section__title">${escapeText(title)}<span class="section__count">${items.length}</span></h3>
      <ul class="link-list">${rows}</ul>
    </section>
  `;
}

function generatedStyles(layout) {
  return `
    :root {
      --bg: #f5f3ee;
      --surface: #fbfaf6;
      --surface-2: #ffffff;
      --offset: #ebe8df;
      --border: #cac3ad;
      --divider: #d9d4c5;
      --text: #1a1a17;
      --muted: #6b665a;
      --faint: #a39c8a;
      --accent: #c63b1e;
      --accent-hover: #a82e14;
      --font-display: 'Gambarino', 'Iowan Old Style', Georgia, serif;
      --font-body: 'Satoshi', -apple-system, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #15140f;
        --surface: #1c1a14;
        --surface-2: #221f17;
        --offset: #2a261c;
        --border: #3d382c;
        --divider: #2d2920;
        --text: #ebe5d3;
        --muted: #8a8472;
        --faint: #5a5446;
        --accent: #ff6b4a;
        --accent-hover: #ff8868;
      }
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; }
    body {
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      padding: clamp(1rem, 4vw, 3rem);
      max-width: 1320px;
      margin: 0 auto;
    }
    img { display: block; max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; }

    .masthead {
      border-bottom: 2px solid var(--text);
      padding-bottom: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .masthead__top {
      display: flex; justify-content: space-between;
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em;
      color: var(--muted); margin-bottom: 1rem;
    }
    .masthead__title {
      font-family: var(--font-display);
      font-size: clamp(2.5rem, 6vw, 5rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .masthead__tagline {
      margin-top: 0.75rem;
      color: var(--muted);
      font-size: 1.125rem;
      font-style: italic;
      font-family: var(--font-display);
    }

    .hero {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 2.5rem;
      align-items: center;
      padding: 2rem 0;
      margin-bottom: 3rem;
      border-bottom: 1px solid var(--divider);
      transition: opacity 0.2s;
    }
    .hero:hover { opacity: 0.85; }
    @media (max-width: 800px) {
      .hero { grid-template-columns: 1fr; gap: 1.5rem; }
    }
    .hero__img {
      aspect-ratio: 4/3;
      overflow: hidden;
      background: var(--offset);
      border-radius: 4px;
    }
    .hero__img img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform 0.5s ease;
    }
    .hero:hover .hero__img img { transform: scale(1.03); }
    .kicker {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--accent);
      font-weight: 500;
      margin-bottom: 0.75rem;
    }
    .hero__title {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 3.5vw, 2.75rem);
      font-weight: 400;
      letter-spacing: -0.01em;
      line-height: 1.1;
      margin-bottom: 1rem;
    }
    .hero__cta {
      display: inline-block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--accent);
      border-bottom: 1px solid currentColor;
      padding-bottom: 2px;
    }

    .section {
      margin: 3rem 0;
    }
    .section__title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 400;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--text);
      display: flex; align-items: baseline; justify-content: space-between;
    }
    .section__count {
      font-size: 0.75rem;
      color: var(--faint);
      font-family: var(--font-body);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .grid {
      display: grid;
      gap: 1.5rem 1.5rem;
    }
    .grid--magazine {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
    .grid--masonry {
      column-count: 3;
      column-gap: 1.5rem;
      display: block;
    }
    .grid--masonry .card { break-inside: avoid; margin-bottom: 1.5rem; display: inline-block; width: 100%; }
    @media (max-width: 900px) {
      .grid--masonry { column-count: 2; }
    }
    @media (max-width: 600px) {
      .grid--masonry { column-count: 1; }
    }

    .card {
      display: block;
      background: var(--surface);
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--divider);
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--muted);
      box-shadow: 0 12px 28px rgba(0,0,0,0.08);
    }
    .card__media {
      aspect-ratio: 16/10;
      overflow: hidden;
      background: var(--offset);
      position: relative;
    }
    .card__media img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform 0.5s ease;
    }
    .card:hover .card__media img { transform: scale(1.04); }
    .card__media--video::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(transparent 50%, rgba(0,0,0,0.55));
    }
    .card__media--empty {
      display: grid; place-items: center;
      background: linear-gradient(135deg, var(--offset), var(--surface-2));
    }
    .card__mark {
      font-family: var(--font-display);
      font-size: 3rem;
      color: var(--faint);
    }
    .card__play {
      position: absolute; inset: 0;
      display: grid; place-items: center;
      z-index: 1;
    }
    .card__play svg { width: 44px; height: 44px; color: #fff; filter: drop-shadow(0 3px 10px rgba(0,0,0,0.5)); }
    .card__body {
      padding: 1rem 1.125rem 1.25rem;
    }
    .card__title {
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.35;
      color: var(--text);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .link-list {
      list-style: none;
      border-top: 1px solid var(--divider);
    }
    .link-list li { border-bottom: 1px solid var(--divider); }
    .link-list a {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 1rem 0;
      gap: 1.5rem;
      transition: padding 0.2s;
    }
    .link-list a:hover { padding-left: 0.75rem; color: var(--accent); }
    .link-list__title {
      font-size: 1rem; font-weight: 500;
      flex: 1;
    }
    .link-list__src {
      font-size: 0.75rem;
      color: var(--faint);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      white-space: nowrap;
    }

    .footer {
      margin-top: 4rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--divider);
      font-size: 0.75rem;
      color: var(--muted);
      text-align: center;
    }

    ${layout === 'reader' ? `
      .grid--magazine, .grid--masonry { display: block; column-count: 1; }
      .grid--magazine .card, .grid--masonry .card {
        display: grid;
        grid-template-columns: 1fr 200px;
        gap: 1.5rem;
        margin-bottom: 1rem;
        border-radius: 4px;
      }
      .grid--magazine .card__media, .grid--masonry .card__media {
        order: 2; aspect-ratio: 4/3;
      }
      .grid--magazine .card__body, .grid--masonry .card__body {
        order: 1;
      }
      @media (max-width: 600px) {
        .grid--magazine .card, .grid--masonry .card {
          grid-template-columns: 1fr;
        }
        .grid--magazine .card__media, .grid--masonry .card__media { order: 0; }
      }
    ` : ''}
  `;
}

function gotoOutput() {
  const html = buildGeneratedSite();
  const iframe = $('#preview-frame');
  iframe.srcdoc = html;
  iframe._html = html;
  showScreen('step-output');
}

function downloadHtml() {
  const html = $('#preview-frame')._html || buildGeneratedSite();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const slug = (state.site.title || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug || 'site'}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Downloaded ' + a.download);
}

// ===================================================
// EVENTS
// ===================================================

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-add-source]')) {
    addSource();
    return;
  }
  if (e.target.closest('[data-back-to-input]')) {
    showScreen('step-input');
    return;
  }
  if (e.target.closest('[data-back-to-review]')) {
    showScreen('step-review');
    return;
  }
  if (e.target.closest('[data-load-sample]')) {
    loadSample();
    return;
  }
});

$('#btn-parse').addEventListener('click', gotoReview);
$('#btn-generate').addEventListener('click', gotoOutput);
$('#btn-download').addEventListener('click', downloadHtml);

// Publish-to-Vercel was removed: hosting user-generated pages on a shared
// Vercel account is an abuse vector (anyone could fill the project quota or
// publish illegal content under our deployment). Users now download the HTML
// and host it wherever they like.

// file upload
// If the first source is empty, fill it with the first uploaded file instead
// of appending a new card. (Otherwise users see Source 1 sit empty while their
// upload lands in Source 2.)
$('#file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const html = await file.text();
    const name = file.name.replace(/\.html?$/i, '');
    const firstEmpty = state.sources.find((s) => !s.html.trim());
    if (firstEmpty) {
      firstEmpty.name = name;
      firstEmpty.customName = true;
      firstEmpty.html = html;
      // items + banner state get populated by renderSources → runParse below
    } else {
      addSource({ name, html });
    }
  }
  renderSources();
  e.target.value = '';
});

// drag and drop on textareas
document.addEventListener('dragover', (e) => {
  if (e.target.closest('.source-card')) e.preventDefault();
});
document.addEventListener('drop', async (e) => {
  const card = e.target.closest('.source-card');
  if (!card) return;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  e.preventDefault();
  const html = await file.text();
  const src = state.sources.find((s) => s.id === card.dataset.id);
  if (src) {
    const name = file.name.replace(/\.html?$/i, '');
    src.html = html;
    src.name = name;
    src.customName = true;
    // items + banner state get populated by renderSources → runParse below
    renderSources();
  }
});

// ===================================================
// SAMPLE DATA
// ===================================================

function loadSample() {
  state.sources = [];

  // Section-rich news sample with lazy-loaded images (the TOI pattern):
  // every <img> has src=site-logo and data-src=real-article-image.
  addSource({
    name: 'Daily Times — homepage',
    html: `<!doctype html><html>
      <head>
        <meta property="og:url" content="https://signal.dev/" />
        <meta property="og:image" content="https://signal.dev/logo.png" />
      </head>
      <body>
        <section id="top-news" aria-label="Top News">
          <h2>Top News</h2>
          <a href="https://signal.dev/the-quiet-rise-of-small-towns">
            <img src="https://signal.dev/logo.png" data-src="https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=800" alt="Sunset over a small town" />
            <h3>The quiet rise of America's smallest towns</h3>
          </a>
          <a href="https://signal.dev/inside-the-new-space-race">
            <img src="https://signal.dev/logo.png" data-src="https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800" alt="Rocket launch at night" />
            <h3>Inside the new space race — and who's actually winning</h3>
          </a>
          <a href="https://signal.dev/coffee-and-the-modern-morning">
            <img src="https://signal.dev/logo.png" data-src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800" alt="Pour over coffee" />
            <h3>What our morning coffee says about the way we live now</h3>
          </a>
        </section>

        <section id="sports" aria-label="Sports">
          <h2>Sports</h2>
          <a href="https://signal.dev/sports/champions-league-final">
            <img src="https://signal.dev/logo.png" data-src="https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=800" alt="Soccer stadium" />
            <h3>The Champions League final — what to watch for</h3>
          </a>
          <a href="https://signal.dev/sports/grand-slam-preview">
            <img src="https://signal.dev/logo.png" data-src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800" alt="Tennis court" />
            <h3>Grand Slam preview: five storylines to follow</h3>
          </a>
          <a href="https://signal.dev/sports/marathon-records">
            Why marathon records keep falling
          </a>
        </section>

        <section id="entertainment" aria-label="Entertainment">
          <h2>Entertainment</h2>
          <a href="https://signal.dev/entertainment/summer-blockbusters">
            <img src="https://signal.dev/logo.png" data-src="https://images.unsplash.com/photo-1489599735188-900a0c1316dd?w=800" alt="Cinema seats" />
            <h3>Summer blockbuster season: the films to watch</h3>
          </a>
          <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
            <h3>Behind the scenes of a record season</h3>
          </a>
          <a href="https://www.youtube.com/watch?v=9bZkp7q19f0">
            <h3>A morning at the harbor — short film</h3>
          </a>
        </section>

        <section id="opinion" aria-label="Opinion">
          <h2>Opinion</h2>
          <a href="https://signal.dev/opinion/why-cities-still-matter">Why cities still matter</a>
          <a href="https://signal.dev/opinion/the-quiet-power-of-public-libraries">The quiet power of public libraries</a>
          <a href="https://signal.dev/opinion/saturday-mail">Saturday Mail: readers respond</a>
        </section>
      </body>
    </html>`,
  });

  showToast('Sample loaded — try the section view');
}

// ===================================================
// INIT
// ===================================================

addSource();
