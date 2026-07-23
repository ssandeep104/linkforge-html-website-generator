/* =====================================================
   LINKFORGE — parsing engine
   Pure DOM-in, items-out extraction. No UI/browser-chrome
   dependencies beyond DOMParser/URL, so this module runs
   identically in the browser and under Node (with a
   DOMParser polyfill, e.g. linkedom, installed by the caller).
   ===================================================== */

const uid = () => Math.random().toString(36).slice(2, 9);

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

function normalizeURL(urlStr) {
  try {
    const u = new URL(urlStr);

    // 1) Handle YouTube URLs specifically
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId = null;
      if (u.hostname.includes('youtu.be')) {
        videoId = u.pathname.slice(1).split('/')[0];
      } else {
        if (u.searchParams.get('v')) {
          videoId = u.searchParams.get('v');
        } else {
          const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?]+)/);
          if (m) videoId = m[2];
        }
      }
      if (videoId) {
        const cleanURL = new URL('https://www.youtube.com/watch');
        cleanURL.searchParams.set('v', videoId);
        const t = u.searchParams.get('t');
        if (t) cleanURL.searchParams.set('t', t);
        return cleanURL.toString();
      }
    }

    // 2) Handle general URLs by stripping standard tracking parameters
    const paramsToStrip = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_cid', 'utm_reader', 'utm_name', 'utm_social', 'utm_social-type',
      'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'yclid',
      'ref', 'referrer', 'spm', '_openstat', 'action_object_map',
      'action_type_map', 'action_ref_map', '__twitter_impression',
      'pp', 'feature', 'si', 'embeds_referring_euri',
      'embeds_referring_origin', 'source_ve_path', 'ab_channel', 'attr_tag'
    ];

    for (const param of paramsToStrip) {
      if (u.searchParams.has(param)) {
        u.searchParams.delete(param);
      }
    }

    return u.toString();
  } catch {
    return urlStr;
  }
}

// Canonical de-duplication KEY for a URL. This is NOT the URL we link to — it
// is only used to decide whether two hrefs point at the same destination, so
// the same story reached via slightly different URLs collapses into ONE card
// instead of repeating. The displayed/linked href is always kept verbatim
// (first occurrence wins); only the grouping key is canonicalized.
//
// Two URLs share a key when they differ only by things that never change the
// destination:
//   - protocol (http vs https)
//   - a leading "www." on the host
//   - a trailing slash on the path
//   - an in-page fragment (#comments, #top) — but hashbang / hash-router
//     routes (#/video/2, #!foo) ARE kept, since there the fragment IS the page
//   - query-parameter ORDER (?a=1&b=2 == ?b=2&a=1)
// Tracking params are already removed upstream by normalizeURL, so by the time
// a URL reaches here the remaining params are content-bearing and are kept.
function canonicalHref(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '') || '/';
    const params = [...u.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
    );
    const search = params.length ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&') : '';
    // Keep only route-shaped fragments (#/… or #!…); drop plain in-page anchors.
    const keepHash = /^#!?\//.test(u.hash) ? u.hash : '';
    return `${host}${u.port ? ':' + u.port : ''}${path}${search}${keepHash}`;
  } catch {
    return urlStr;
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


function getPatternSignature(anchor) {
  if (!anchor) return 'Other';
  const container = anchor.closest('article, li, figure, [class*="item" i], [class*="card" i], [class*="tile" i], [class*="post" i]');
  if (container) {
    let cls = (container.getAttribute('class') || '').trim();
    if (cls) {
      // Keep only first two classes to avoid overly specific patterns
      cls = cls.split(/\s+/).slice(0, 2).join(' ');
      return `<${container.tagName.toLowerCase()} class="${cls}">`;
    }
    return `<${container.tagName.toLowerCase()}>`;
  }
  return 'Default Link';
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

// Narrower than looksLikePlaceholder() above, and used for a different job:
// deciding whether <img src> is a lazy-load stand-in that should lose to a
// real lazy-load attribute (data-src, etc.) in pickImgSrc. This runs on the
// DEFAULT-WINNER path for every image in the document, so a false positive
// here silently swaps a legitimate thumbnail for something worse — a much
// costlier mistake than a false negative, which just leaves the (long-
// standing) placeholder-wins behavior unchanged for that one image.
//
// Two rounds of review found real false positives in a keyword-SUBSTRING
// approach: dropping "logo"/"empty"/"default"/"loading" still left "blank"/
// "transparent" matching inside real multi-word filenames like
// "blank-space-taylor-swift-cover.jpg" (delimited by the same "-" the regex
// used as a word boundary). Any English word is at risk of this, so instead
// of continuing to narrow a keyword list, this matches the URL's BASENAME
// (path segment before the extension) EXACTLY against a small set of known
// placeholder names. A real content photo is essentially never named
// exactly "blank.gif" with nothing else in the filename — that's a
// structurally different, much stronger signal than "contains the word
// blank somewhere."
const KNOWN_PLACEHOLDER_BASENAMES = new Set([
  '1x1', '2x2', 'blank', 'spacer', 'placeholder', 'transparent',
  'noimage', 'no-image', 'no_image', 'pixel', 'logo',
]);
function looksLikeLazyLoadPlaceholder(url) {
  if (!url) return true;
  const u = url.toLowerCase();
  if (u.startsWith('data:')) return true; // base64 blank/spinner pixels — the dominant real-world case
  const path = u.split(/[?#]/)[0];
  const basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/, '');
  if (KNOWN_PLACEHOLDER_BASENAMES.has(basename)) return true;
  // Tiny width/height query param — anchored to end-of-value with `(?=$|[&#])`
  // so a hash-like suffix ("?h=4a2b1c9d") can't false-match "h=4" the way a
  // plain "next char is not a digit" lookahead would ("a" also isn't a digit).
  if (/[\?&](w|width|h|height)=(1|2|4|8|10)(?=$|[&#])/.test(u)) return true;
  return false;
}

// Parse a srcset attribute robustly, respecting commas that appear inside
// URLs (CDN transform syntax like Cloudinary's `f_auto,q_auto/...`, Imgix
// param strings, data: URIs with base64, etc.).
//
// WHATWG srcset spec: each comma-separated entry is "URL [descriptor]" where
// the descriptor is `Nw`, `Nx`, or `Nh`. We scan token by token: take a URL,
// optionally take a descriptor, then expect either end-of-string or a comma
// followed by whitespace as the entry separator.
//
// Returns an array of { url, descriptor } in source order. Empty array on
// failure — callers should fall back to anchor <img>/data-* extraction.
function parseSrcset(srcset) {
  if (!srcset || typeof srcset !== 'string') return [];
  const out = [];
  let i = 0;
  const n = srcset.length;
  const isWS = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
  while (i < n) {
    // Skip leading whitespace and stray commas
    while (i < n && (isWS(srcset[i]) || srcset[i] === ',')) i++;
    if (i >= n) break;
    // Read URL — ends at first whitespace, OR at a comma that's followed by
    // whitespace (entry separator) or end-of-string.
    const urlStart = i;
    while (i < n) {
      const c = srcset[i];
      if (isWS(c)) break;
      if (c === ',') {
        // Lookahead: is this comma an entry separator or a comma inside the
        // URL? Spec says: a comma in srcset only terminates a URL when it's
        // immediately followed by whitespace or end-of-input. CDN URLs that
        // contain `f_auto,q_auto/...` don't have whitespace after the comma,
        // so we keep going.
        const next = i + 1 < n ? srcset[i + 1] : '';
        if (next === '' || isWS(next)) break;
      }
      i++;
    }
    const url = srcset.slice(urlStart, i).replace(/,+$/, '');
    // Skip whitespace; optional descriptor follows up to next comma+ws or EOI
    while (i < n && isWS(srcset[i])) i++;
    let descriptor = '';
    const descStart = i;
    while (i < n) {
      const c = srcset[i];
      if (c === ',') break;
      i++;
    }
    descriptor = srcset.slice(descStart, i).trim();
    if (url) out.push({ url, descriptor });
    // Consume the entry-separator comma (if any)
    if (i < n && srcset[i] === ',') i++;
  }
  return out;
}

// Extract numeric width from a srcset descriptor. `1600w` → 1600, `2x` →
// 2 (treated as low priority, returns 2). Empty / unparseable → 0.
// Used by the umbrella-candidate logic to pick the highest-resolution URL
// per <source> / <srcset> for the cross-category "any size" option.
function parseDescriptorWidth(desc) {
  if (!desc) return 0;
  const m = String(desc).trim().match(/^(\d+(?:\.\d+)?)(w|x)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  // density descriptors (1x, 2x) are usually small numbers — keep them under
  // width descriptors which are usually >100
  return m[2] && m[2].toLowerCase() === 'x' ? n : n;
}

function bestSrcsetEntry(srcset) {
  const entries = parseSrcset(srcset);
  if (!entries.length) return null;
  let best = null;
  let bestWidth = -1;
  for (const entry of entries) {
    const width = parseDescriptorWidth(entry.descriptor);
    if (!best || width >= bestWidth) {
      best = entry;
      bestWidth = width;
    }
  }
  return best;
}

// Expand every URL hiding inside an <img> element (and its containing
// <picture>, if any) into picker candidates. The user gets to choose; we
// don't try to outsmart them by picking the "largest" or "freshest".
//
// Returns an array of { value, strategy, label }, deduped on value.
// strategy/label are passed straight through to the picker UI.
function expandImageCandidates(img, picture) {
  const out = [];
  // Dedupe on (strategy, value) tuples — NOT on value alone. The same URL can
  // legitimately appear under multiple strategy keys (e.g. `img-srcset:1600w`
  // and the umbrella `img-srcset:any`); both must reach the picker so the
  // user can pick the umbrella for cross-category selection without losing
  // the detailed option for fine control.
  const seen = new Set();
  const push = (value, strategy, label) => {
    if (!value || typeof value !== 'string') return;
    const v = value.trim();
    if (!v) return;
    const key = strategy + '\0' + v;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ value: v, strategy, label });
  };

  // Each variant gets a UNIQUE strategy key so the per-source picker can
  // surface every <source>/<img>/<srcset>/<data-*> variant separately.
  // The picker collapses candidates by strategy key, so if two variants
  // (say, AVIF 1600w and WebP 800w) share a key, only one appears in the
  // dropdown. Hence the `:type:media:descriptor` suffix.
  const slug = (s) => (s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

  // --- <picture><source> siblings of the <img> ---
  // <picture> can hold multiple <source> elements: AVIF, WebP, JPEG fallbacks,
  // plus art-direction sources gated by `media="(max-width: ...)"`. Each one
  // can have its own srcset with multiple density/width variants. The user
  // may legitimately want the AVIF high-res, the WebP mobile, etc.
  //
  // We emit TWO tiers of candidates so the per-source picker works across
  // categories of links that use different markup shapes:
  //   - DETAILED: one candidate per (type, media, descriptor) — exact match,
  //     but tied to one specific category of href.
  //   - UMBRELLA: one candidate per (type, media) and one per <picture>,
  //     using the highest-descriptor URL inside. These match every href that
  //     has *any* variant in that family, so picking "picture <source> (any)"
  //     works whether the href has 800w or 2400w.
  if (picture) {
    const sources = picture.querySelectorAll('source');
    let anyPictureBest = null;
    sources.forEach((s) => {
      const type = s.getAttribute('type') || '';
      const media = s.getAttribute('media') || '';
      const tag = [type, media].filter(Boolean).join(' · ');
      const entries = parseSrcset(s.getAttribute('srcset') || '');
      let sourceBest = null;
      let sourceBestW = -1;
      entries.forEach((entry) => {
        const desc = entry.descriptor ? ` · ${entry.descriptor}` : '';
        const label = `picture <source>${tag ? ` (${tag})` : ''}${desc}`;
        const key = ['picture-source', slug(type), slug(media), slug(entry.descriptor)].filter(Boolean).join(':');
        push(entry.url, key, label);
        const w = parseDescriptorWidth(entry.descriptor);
        if (w >= sourceBestW) { sourceBestW = w; sourceBest = entry.url; }
      });
      // Some sources use plain `src` instead of `srcset`
      const plainSrc = s.getAttribute('src');
      if (plainSrc) {
        const key = ['picture-source-src', slug(type), slug(media)].filter(Boolean).join(':');
        push(plainSrc, key, `picture <source>${tag ? ` (${tag})` : ''}`);
        if (!sourceBest) sourceBest = plainSrc;
      }
      // UMBRELLA per <source>: any descriptor inside this type/media combo
      if (sourceBest && (type || media)) {
        const umbrellaKey = ['picture-source', slug(type), slug(media), 'any'].filter(Boolean).join(':');
        push(sourceBest, umbrellaKey, `picture <source>${tag ? ` (${tag})` : ''} · any size`);
      }
      if (sourceBest && !anyPictureBest) anyPictureBest = sourceBest;
    });
    // UMBRELLA per <picture>: first <source>'s best URL, regardless of type/media
    if (anyPictureBest) {
      push(anyPictureBest, 'picture-source:any', 'picture <source> · any');
    }
  }

  if (!img) return out;

  // --- <img src> ---
  const src = img.getAttribute('src');
  if (src) push(src, 'img-src', '<img src>');

  // --- <img srcset> (when img is used standalone or alongside picture sources) ---
  // Detailed entries + UMBRELLA `img-srcset:any` that picks the largest descriptor
  // per item, so the picker option works across hrefs with different descriptor sets.
  const imgSrcset = img.getAttribute('srcset');
  if (imgSrcset) {
    const entries = parseSrcset(imgSrcset);
    let bestUrl = null;
    let bestW = -1;
    entries.forEach((entry) => {
      const desc = entry.descriptor ? ` · ${entry.descriptor}` : '';
      const key = ['img-srcset', slug(entry.descriptor)].filter(Boolean).join(':');
      push(entry.url, key, `<img srcset>${desc}`);
      const w = parseDescriptorWidth(entry.descriptor);
      if (w >= bestW) { bestW = w; bestUrl = entry.url; }
    });
    if (bestUrl) push(bestUrl, 'img-srcset:any', '<img srcset> · any size (largest)');
  }

  // --- Every lazy-load / hi-res data-* attribute we recognize ---
  // We expose ALL of them as candidates, even when <img src> is present — the
  // user said: "give all those options and let the user select". On lazy-load
  // sites, the real high-res lives in data-src / data-original / data-hi-res-src,
  // while src is a low-quality placeholder.
  const dataAttrs = [
    ['data-src', 'data-src'],
    ['data-original', 'data-original'],
    ['data-original-src', 'data-original-src'],
    ['data-lazy-src', 'data-lazy-src'],
    ['data-lazy', 'data-lazy'],
    ['data-hi-res-src', 'data-hi-res-src'],
    ['data-full-src', 'data-full-src'],
    ['data-img', 'data-img'],
    ['data-srcset', 'data-srcset (largest)'],
    ['data-image', 'data-image'],
    ['data-large-file', 'data-large-file'],
    ['data-medium-file', 'data-medium-file'],
    ['data-orig-file', 'data-orig-file'],
    ['data-flickity-lazyload', 'data-flickity-lazyload'],
  ];
  for (const [attr, label] of dataAttrs) {
    const v = img.getAttribute(attr);
    if (!v) continue;
    if (attr === 'data-srcset') {
      // Same parser handles data-srcset (some lazy-load libs use it)
      const entries = parseSrcset(v);
      let bestUrl = null;
      let bestW = -1;
      entries.forEach((entry) => {
        const desc = entry.descriptor ? ` · ${entry.descriptor}` : '';
        const key = ['img-data-srcset', slug(entry.descriptor)].filter(Boolean).join(':');
        push(entry.url, key, `<img data-srcset>${desc}`);
        const w = parseDescriptorWidth(entry.descriptor);
        if (w >= bestW) { bestW = w; bestUrl = entry.url; }
      });
      if (bestUrl) push(bestUrl, 'img-data-srcset:any', '<img data-srcset> · any size (largest)');
    } else {
      push(v, 'img-' + attr, `<img ${label}>`);
    }
  }

  return out;
}

// Pick the best <img> src across normal + lazy-load attributes.
// Prefers data-src / data-original / srcset over src when src looks like a placeholder.
function pickImgSrc(img) {
  // Trust the markup — with one exception: a lazy-load placeholder in `src`
  // (base64 blank pixel, spacer.gif, site logo, ...) is not the thumbnail,
  // it's a stand-in the page's own JS swaps out after paint. The extremely
  // common convention is <img src="tiny-placeholder" data-src="real.jpg">;
  // trusting `src` unconditionally here means every lazy-loaded gallery site
  // (most of them, in practice) would default to showing the placeholder.
  // We do NOT parse srcset to "pick the largest" — srcset URLs can contain
  // commas inside their path (CDN transform syntax), which breaks naive
  // splitting. The picker exposes srcset/data-* values as alternates the
  // user can switch to manually.
  const src = img.getAttribute('src');
  if (src && src.trim() && !looksLikeLazyLoadPlaceholder(src.trim())) return src.trim();
  // src missing, empty, or placeholder-shaped — try lazy-load attributes.
  const fallbacks = [
    img.getAttribute('data-src'),
    img.getAttribute('data-original'),
    img.getAttribute('data-lazy-src'),
    img.getAttribute('data-lazy'),
    img.getAttribute('data-hi-res-src'),
    img.getAttribute('data-full-src'),
    img.getAttribute('data-img'),
  ];
  for (const v of fallbacks) {
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  // Nothing better — a placeholder-looking src still beats no thumbnail.
  if (src && src.trim()) return src.trim();
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
      const best = bestSrcsetEntry(ss);
      if (best?.url) return best.url;
    }
  }
  // background-image inline style
  const styled = Array.from(a.querySelectorAll('[style*="background"]'));
  for (const el of styled) {
    const m = el.getAttribute('style').match(/url\(['"]?([^'")]+)['"]?\)/i);
    if (m) return m[1];
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

function isLikelyContentMediaElement(el) {
  if (!el) return false;
  if (el.closest(CHROME_CONTAINER_SELECTOR)) return false;

  const hintText = [
    el.getAttribute?.('class') || '',
    el.getAttribute?.('id') || '',
    el.getAttribute?.('alt') || '',
    el.getAttribute?.('aria-label') || '',
    el.getAttribute?.('data-testid') || '',
  ].join(' ').toLowerCase();

  if (/(?:^|[-_ \t])(avatar|logo|icon|badge|sprite|emoji|favicon)(?:[-_ \t]|$)/.test(hintText)) {
    return false;
  }

  const src = (el.getAttribute?.('src') || el.getAttribute?.('data-src') || '').toLowerCase();
  if (src) {
    if (
      src.includes('yt3.ggpht.com') ||
      src.includes('gravatar.com') ||
      src.includes('avatars.githubusercontent.com') ||
      src.includes('/profile_images/')
    ) {
      return false;
    }
  }

  const width = Number(el.getAttribute?.('width') || 0);
  const height = Number(el.getAttribute?.('height') || 0);
  if (width > 0 && height > 0 && Math.max(width, height) < 48) {
    return false;
  }

  return true;
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
      const best = bestSrcsetEntry(ss);
      if (best?.url) {
        const resolved = safeURL(best.url, baseURL) || best.url;
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
    if (m) {
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

// ---------- adjacent-sibling <img> fallback (flat HTML lists) ----------
// Catches the case where someone writes a plain list like:
//   <a href="/post1">Title</a>
//   <img src="/thumb1.jpg">
// with NO surrounding <article>/<li>/card wrapper. findFigureSiblingThumb
// bails out because there is no card-shaped ancestor. We look in three
// places (in order):
//   1. The anchor's immediately following / preceding element siblings
//      (within a small hop budget, skipping plain text nodes).
//   2. The next adjacent <img> in document order whose closest anchor
//      is THIS anchor (i.e. not closer to a later anchor).
//   3. Children of the immediate parent (paragraph, div) outside the anchor.
function findAdjacentSiblingThumb(a, allAnchors, baseURL, claimedSet) {
  const tryImg = (img) => {
    if (!img || (claimedSet && claimedSet.has(img))) return null;
    const picked = pickImgSrc(img);
    if (!picked) return null;
    return { thumb: safeURL(picked, baseURL) || picked, claimedEl: img };
  };
  const isImg = (el) => el && el.tagName === 'IMG';
  const SCAN_HOPS = 3; // how many element siblings to look at on each side

  // Step 1 — walk forward/backward sibling elements from the anchor.
  // Stop if we hit another anchor (its thumb, not ours).
  let cur = a.nextElementSibling;
  for (let i = 0; cur && i < SCAN_HOPS; i++) {
    if (cur.tagName === 'A') break;
    if (isImg(cur)) {
      const r = tryImg(cur);
      if (r) return r;
    }
    // also look one level inside (e.g. <p><img></p>)
    const inner = cur.querySelector?.('img');
    if (inner && !cur.querySelector?.('a[href]')) {
      const r = tryImg(inner);
      if (r) return r;
    }
    cur = cur.nextElementSibling;
  }
  cur = a.previousElementSibling;
  for (let i = 0; cur && i < SCAN_HOPS; i++) {
    if (cur.tagName === 'A') break;
    if (isImg(cur)) {
      const r = tryImg(cur);
      if (r) return r;
    }
    cur = cur.previousElementSibling;
  }

  // Step 2 — children of the immediate parent that are NOT inside any anchor.
  // Handles <div><a>title</a><img></div> and similar generic wrappers.
  const parent = a.parentElement;
  if (parent && !/^(BODY|HTML|MAIN)$/.test(parent.tagName)) {
    // Make sure no other anchor sits between us and the img — if there are
    // multiple anchors in this parent, each anchor should only claim its
    // nearest image.
    const parentAnchors = parent.querySelectorAll(':scope > a[href], :scope a[href]');
    const parentImgs = parent.querySelectorAll(':scope > img, :scope img');
    for (const img of parentImgs) {
      if (claimedSet && claimedSet.has(img)) continue;
      // Skip imgs inside any anchor — those are handled by extractImageFromAnchor.
      if (img.closest('a[href]')) continue;
      // Skip if there's a closer anchor in the parent than `a`.
      let nearest = null;
      let nearestDist = Infinity;
      for (const other of parentAnchors) {
        // distance = position diff in document order
        const cmp = img.compareDocumentPosition(other);
        // we only care about which anchor is textually closest — use a cheap
        // index-based proximity by walking the parent's children once.
        if (cmp & Node.DOCUMENT_POSITION_PRECEDING || cmp & Node.DOCUMENT_POSITION_FOLLOWING) {
          // good enough — pick the closest by sibling-index difference
          const dist = Math.abs(
            Array.prototype.indexOf.call(parent.children, other.closest(':scope > *') || other) -
            Array.prototype.indexOf.call(parent.children, img.closest(':scope > *') || img)
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = other;
          }
        }
      }
      if (nearest === a) {
        const r = tryImg(img);
        if (r) return r;
      }
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
  if (/^\d+(\.\d+)?[KMB]?$/.test(s)) return true; // play count bare
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
  let text = clone.textContent.replace(/\s+/g, ' ').trim();
  // Strip leading duration patterns like "2:34 " or "12:34:56 "
  text = text.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, '');
  return text.trim();
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
//
// Each field's candidates are produced by an ordered list of named RULES
// instead of one hand-written cascade. This is the point: every site- or
// vendor-specific heuristic (TikTok's PVideoLabel traversal, the
// BBC/Reuters/Medium container-heading priority, ...) is its own enumerable,
// independently nameable unit — grep the id, see exactly what it does and
// why — rather than an anonymous branch buried inside a 60-line function.
// Rules are pure: they read the anchor's DOM neighborhood and return zero or
// more candidates; they never mutate anything or depend on call order.

const CARD_CONTAINER_SELECTOR = 'article, li, [class*="item" i], [class*="card" i], [class*="tile" i], [class*="post" i], figure';

const TITLE_RULES = [
  {
    // BBC / Reuters / Medium: the image anchor comes first in the card and
    // steals the default title via its alt text unless a real heading in
    // the shared container outranks it.
    id: 'container-heading',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const out = [];
      const ch = container.querySelector('h1, h2, h3, h4');
      if (ch && !a.contains(ch)) out.push({ value: visibleText(ch), strategy: 'container-heading', label: `container <${ch.tagName.toLowerCase()}>` });
      const cTitle = container.querySelector('[class*="title" i], [class*="headline" i]');
      if (cTitle && !a.contains(cTitle) && cTitle !== ch) out.push({ value: visibleText(cTitle), strategy: 'container-title-class', label: 'container class=title' });
      return out;
    },
  },
  { id: 'anchor-aria-label', extract: (a) => [{ value: a.getAttribute('aria-label'), strategy: 'anchor-aria-label', label: 'aria-label' }] },
  { id: 'anchor-title-attr', extract: (a) => [{ value: a.getAttribute('title'), strategy: 'anchor-title-attr', label: 'title attribute' }] },
  {
    id: 'anchor-heading',
    extract(a) {
      const heading = a.querySelector('h1, h2, h3, h4, h5, h6');
      return heading ? [{ value: visibleText(heading), strategy: 'anchor-heading', label: `<${heading.tagName.toLowerCase()}>` }] : [];
    },
  },
  {
    id: 'anchor-title-class',
    extract(a) {
      const heading = a.querySelector('h1, h2, h3, h4, h5, h6');
      const titleEl = a.querySelector('[class*="title" i], [class*="headline" i]');
      return (titleEl && titleEl !== heading) ? [{ value: visibleText(titleEl), strategy: 'anchor-title-class', label: 'class=title/headline' }] : [];
    },
  },
  {
    // Photography-portfolio pattern: <figure><a><img alt="..."></a>
    // <figcaption>Real Title</figcaption></figure>. A caption is the
    // author's deliberately-chosen title; alt text just describes the image
    // for accessibility. Ranked above anchor-visible-text/anchor-img-alt
    // (below) specifically because captions are a stronger authorial signal
    // than either — found via manual end-to-end testing against portfolio
    // sites, where alt text was winning over an obviously-better caption.
    id: 'container-caption',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const cap = container.querySelector('figcaption, [class*="caption" i]');
      return cap ? [{ value: visibleText(cap), strategy: 'container-caption', label: 'caption' }] : [];
    },
  },
  { id: 'anchor-visible-text', extract: (a) => [{ value: visibleText(a), strategy: 'anchor-visible-text', label: 'anchor text' }] },
  {
    id: 'anchor-img-alt',
    extract(a) {
      const img = a.querySelector('img[alt]');
      const alt = img?.getAttribute('alt')?.trim();
      return alt ? [{ value: alt, strategy: 'anchor-img-alt', label: 'image alt' }] : [];
    },
  },
  {
    // Nearest article/li/figure that ISN'T the anchor itself. Weak signal —
    // an aria-label on a whole card container usually describes the card's
    // ROLE ("video card"), not a specific title, so this stays low-priority.
    id: 'container-aria-label',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const cAria = container.getAttribute('aria-label');
      return cAria ? [{ value: cAria, strategy: 'container-aria-label', label: 'container aria-label' }] : [];
    },
  },
  {
    // TikTok: the caption lives in a sibling <p class="css-*-PVideoLabel">,
    // reached via a 2-level-up parent walk from the content anchor.
    id: 'tiktok-pvideolabel',
    extract(a) {
      const p = a.parentElement?.parentElement?.querySelector('p[class*="PVideoLabel"]');
      return p ? [{ value: visibleText(p), strategy: 'sibling-p-title', label: 'sibling <p> title' }] : [];
    },
  },
];

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
  for (const rule of TITLE_RULES) {
    for (const c of rule.extract(a) || []) push(c?.value, c?.strategy, c?.label);
  }
  return out;
}

function extractBackgroundImageUrl(el) {
  const m = (el.getAttribute('style') || '').match(/background-image\s*:\s*url\((['"]?)([^)'"]+)\1\)/i);
  return m ? m[2] : null;
}

const THUMB_RULES = [
  {
    // <img>/<picture> inside the anchor — surface EVERY URL the markup
    // exposes: <picture><source srcset> entries (all of them, with
    // type/media descriptors), <img src>, <img srcset> entries, and every
    // lazy-load data-* attribute (WordPress/Jetpack, Flickity, ...). The
    // user picks via the strategy dropdown; we don't pre-decide.
    id: 'anchor-img-picture',
    extract(a) {
      const innerImg = a.querySelector('img');
      const innerPicture = a.querySelector('picture');
      if (!innerImg && !innerPicture) return [];
      return expandImageCandidates(innerImg, innerPicture);
    },
  },
  {
    id: 'anchor-bg-image',
    extract(a) {
      const bgEl = a.matches?.('[style*="background-image"]') ? a : a.querySelector('[style*="background-image"]');
      if (!bgEl) return [];
      const url = extractBackgroundImageUrl(bgEl);
      return url ? [{ value: url, strategy: 'anchor-bg-image', label: 'background-image' }] : [];
    },
  },
  {
    // Adjacent-sibling <img> outside the anchor (flat lists with no card
    // wrapper) — scan a few sibling elements forward/backward.
    // NOTE: this hop-scanning walk is intentionally similar to (but not
    // shared with) findAdjacentSiblingThumb's Tier-3 fallback below — that
    // one also needs to respect a claimedSet and a "nearest anchor wins"
    // parent-children pass that doesn't apply to plain candidate
    // enumeration here. Left as two implementations rather than forced into
    // one to avoid changing either's behavior; a good target for a future
    // pass once the ownership-claiming logic itself is reworked.
    id: 'adjacent-sibling-img',
    extract(a) {
      const out = [];
      const seen = new Set();
      const collect = (img) => {
        if (!img || seen.has(img)) return;
        seen.add(img);
        const v = pickImgSrc(img);
        if (v) out.push({ value: v, strategy: 'adjacent-sibling-img', label: 'adjacent <img>' });
      };
      let sib = a.nextElementSibling;
      for (let i = 0; sib && i < 3; i++) {
        if (sib.tagName === 'A') break;
        if (sib.tagName === 'IMG') collect(sib);
        const inner = sib.querySelector?.('img');
        if (inner && !sib.querySelector?.('a[href]')) collect(inner);
        sib = sib.nextElementSibling;
      }
      sib = a.previousElementSibling;
      for (let i = 0; sib && i < 3; i++) {
        if (sib.tagName === 'A') break;
        if (sib.tagName === 'IMG') collect(sib);
        sib = sib.previousElementSibling;
      }
      return out;
    },
  },
  {
    // Container-level images: hero/poster/thumb classed <img>s.
    id: 'container-class-img',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const imgs = container.querySelectorAll('img[class*="thumb" i], img[class*="poster" i], img[class*="hero" i], img[class*="image" i], img[class*="media" i], img[class*="photo" i]');
      return Array.from(imgs)
        .map((img) => pickImgSrc(img))
        .filter(Boolean)
        .map((v) => ({ value: v, strategy: 'container-class-img', label: 'container thumb/hero/poster img' }));
    },
  },
  {
    id: 'container-video-poster',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const poster = container.querySelector('video[poster]')?.getAttribute('poster');
      return poster ? [{ value: poster, strategy: 'container-video-poster', label: 'video poster' }] : [];
    },
  },
  {
    // Picture sources — expand every <source> + <img> in every container
    // <picture>. Container scope means the candidate list can get long;
    // that's fine, the picker is the right place to dig through alternates.
    id: 'container-picture',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const out = [];
      container.querySelectorAll('picture').forEach((pic) => {
        const picImg = pic.querySelector('img');
        expandImageCandidates(picImg, pic).forEach((c) => {
          // Re-label container-scoped candidates so they don't masquerade
          // as anchor-scoped picks in the picker.
          out.push({ value: c.value, strategy: 'container-' + c.strategy, label: 'container ' + c.label });
        });
      });
      return out;
    },
  },
  {
    id: 'container-bg-image',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const cBg = container.querySelector('[style*="background-image"]');
      if (!cBg) return [];
      const url = extractBackgroundImageUrl(cBg);
      return url ? [{ value: url, strategy: 'container-bg-image', label: 'container background-image' }] : [];
    },
  },
  {
    id: 'container-any-img',
    extract(a) {
      const container = a.closest(CARD_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const anyImg = container.querySelector('img');
      if (!anyImg) return [];
      const v = pickImgSrc(anyImg);
      return v ? [{ value: v, strategy: 'container-any-img', label: 'any container <img>' }] : [];
    },
  },
];

function collectThumbCandidates(a, baseURL) {
  const out = [];
  // Dedupe on (strategy, resolved value) — same URL under different strategy
  // keys (e.g. detailed `img-srcset:1600w` vs umbrella `img-srcset:any`) are
  // both retained so the picker can surface both options.
  const push = (value, strategy, label) => {
    if (!value) return;
    const resolved = safeURL(value, baseURL) || value;
    if (!/^https?:/i.test(resolved)) return;
    if (out.some((c) => c.value === resolved && c.strategy === strategy)) return;
    out.push({ value: resolved, strategy, label });
  };
  for (const rule of THUMB_RULES) {
    for (const c of rule.extract(a, baseURL) || []) push(c?.value, c?.strategy, c?.label);
  }
  return out;
}

const VIDEO_CONTAINER_SELECTOR = 'article, li, figure, [class*="item" i], [class*="card" i], [class*="tile" i]';
const VIDEO_HOVER_DATA_ATTRS = ['data-video', 'data-video-src', 'data-hover-video', 'data-preview-video', 'data-mp4'];

const VIDEO_RULES = [
  {
    id: 'anchor-video',
    extract(a) {
      const v = extractVideoFromAnchor(a);
      return v ? [{ info: v, strategy: 'anchor-video', label: 'anchor <video>' }] : [];
    },
  },
  {
    id: 'container-video',
    extract(a) {
      const container = a.closest(VIDEO_CONTAINER_SELECTOR);
      if (!container || container === a) return [];
      const containerVid = container.querySelector('video');
      if (!containerVid) return [];
      const src = containerVid.getAttribute('src') || containerVid.querySelector('source')?.getAttribute('src');
      return src ? [{ info: { url: src, kind: 'inline' }, strategy: 'container-video', label: 'container <video>' }] : [];
    },
  },
  {
    // Hover-play preview attributes, checked on the anchor and its card
    // container.
    id: 'hover-play-data-attrs',
    extract(a) {
      const container = a.closest(VIDEO_CONTAINER_SELECTOR);
      const out = [];
      for (const attr of VIDEO_HOVER_DATA_ATTRS) {
        const val = a.getAttribute(attr) || container?.getAttribute(attr);
        if (val) out.push({ info: { url: val, kind: 'data-attr' }, strategy: `data-attr-${attr}`, label: `${attr} attribute` });
      }
      return out;
    },
  },
];

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
  for (const rule of VIDEO_RULES) {
    for (const c of rule.extract(a, baseURL) || []) push(c?.info, c?.strategy, c?.label);
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

// =====================================================================
// JSON-LD / Schema.org extraction
// =====================================================================
// Modern news + video sites ship full-fidelity metadata in
// <script type="application/ld+json">: headline, description, image, url,
// datePublished, author. This is authoritative — it's what the site wants
// Google/Facebook/Twitter to see. We treat it as a high-priority candidate
// source alongside DOM scraping.
//
// Output shape: an array of { url, headline, description, image, datePublished,
//                              author, schemaType }.
// Each entry either ENRICHES an existing bucket (if its url matches an anchor
// href in the same page) or stands alone as a new card (if not). The user
// still picks which value to use via the existing strategy picker.
function extractJsonLd(doc, baseURL) {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  if (!scripts.length) return { entries: [], scriptCount: 0, parsedCount: 0 };
  const entries = [];
  let parsedCount = 0;
  for (const s of scripts) {
    let raw = (s.textContent || '').trim();
    if (!raw) continue;
    // Some CMS wrap LD+JSON in HTML comments or CDATA.
    raw = raw.replace(/^<!--/, '').replace(/-->$/, '').replace(/^\/\/<!\[CDATA\[/, '').replace(/\/\/]]>$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      // Tolerate trailing commas / unescaped newlines by trying a lenient re-parse.
      try { parsed = JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1')); }
      catch { continue; }
    }
    parsedCount++;
    // Flatten @graph into top-level nodes.
    const nodes = [];
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const n = queue.shift();
      if (!n || typeof n !== 'object') continue;
      if (Array.isArray(n['@graph'])) { for (const g of n['@graph']) queue.push(g); continue; }
      nodes.push(n);
      // CollectionPage / WebPage / WebSite often nest the actual content under
      // mainEntity (sometimes mainEntityOfPage). Drill in.
      if (n.mainEntity && typeof n.mainEntity === 'object') queue.push(n.mainEntity);
      if (n.mainEntityOfPage && typeof n.mainEntityOfPage === 'object' && !Array.isArray(n.mainEntityOfPage)) {
        // Only drill if it looks like a content node (has its own @type/itemListElement),
        // not a bare { @id: url } reference.
        if (n.mainEntityOfPage['@type'] || n.mainEntityOfPage.itemListElement) queue.push(n.mainEntityOfPage);
      }
      // ItemList: each itemListElement is usually { position, url } or
      // { item: { ... } } — dive into the inner item.
      if (Array.isArray(n.itemListElement)) {
        for (const el of n.itemListElement) {
          if (el && typeof el === 'object') {
            if (el.item) queue.push(el.item);
            else queue.push(el);
          }
        }
      }
    }
    for (const n of nodes) {
      const t = jsonLdTypes(n);
      if (!t.length) continue;
      // Article-shaped schemas — each one becomes an entry.
      const isContent = t.some((x) => /^(NewsArticle|Article|BlogPosting|VideoObject|Report|TechArticle|OpinionNewsArticle|AnalysisNewsArticle|LiveBlogPosting|SocialMediaPosting|Movie|TVEpisode|PodcastEpisode|Recipe|Product|CreativeWork)$/i.test(x));
      const isListPosition = t.some((x) => /^ListItem$/i.test(x));
      if (!isContent && !isListPosition) continue;
      const url = pickJsonLdUrl(n, baseURL);
      if (!url) continue;
      const headline = pickJsonLdString(n.headline) || pickJsonLdString(n.name) || pickJsonLdString(n.alternativeHeadline);
      const description = pickJsonLdString(n.description) || pickJsonLdString(n.abstract);
      const image = pickJsonLdImage(n.image, baseURL) || pickJsonLdImage(n.thumbnailUrl, baseURL) || pickJsonLdImage(n.thumbnail, baseURL);
      const datePublished = pickJsonLdString(n.datePublished) || pickJsonLdString(n.dateCreated);
      const author = pickJsonLdAuthor(n.author);
      const schemaType = t[0];
      entries.push({ url, headline, description, image, datePublished, author, schemaType });
    }
  }
  // Dedupe by url, keeping the richest entry per url.
  const byUrl = new Map();
  const richness = (e) => (e.headline ? 2 : 0) + (e.image ? 2 : 0) + (e.description ? 1 : 0);
  for (const e of entries) {
    const existing = byUrl.get(e.url);
    if (!existing || richness(e) > richness(existing)) byUrl.set(e.url, e);
  }
  return { entries: [...byUrl.values()], scriptCount: scripts.length, parsedCount };
}

function jsonLdTypes(node) {
  const raw = node['@type'];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((x) => String(x));
}

function pickJsonLdString(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) { for (const x of v) { const s = pickJsonLdString(x); if (s) return s; } return null; }
  if (typeof v === 'object') return pickJsonLdString(v['@value']) || pickJsonLdString(v.name) || pickJsonLdString(v.text);
  return null;
}

function pickJsonLdUrl(node, baseURL) {
  // Prefer canonical .url, then mainEntityOfPage.
  const cands = [
    node.url,
    node['@id'],
    node.mainEntityOfPage && (typeof node.mainEntityOfPage === 'string' ? node.mainEntityOfPage : node.mainEntityOfPage['@id'] || node.mainEntityOfPage.url),
    node.identifier && (typeof node.identifier === 'string' ? node.identifier : node.identifier.value),
  ];
  for (const c of cands) {
    if (!c || typeof c !== 'string') continue;
    const resolved = safeURL(c, baseURL);
    if (resolved && /^https?:/i.test(resolved)) return resolved;
  }
  return null;
}

function pickJsonLdImage(v, baseURL) {
  if (!v) return null;
  if (typeof v === 'string') {
    const r = safeURL(v, baseURL);
    return r && /^https?:/i.test(r) ? r : null;
  }
  if (Array.isArray(v)) {
    // Prefer the largest image (highest width × height) when ImageObjects exist.
    let bestUrl = null, bestArea = -1;
    for (const item of v) {
      const u = pickJsonLdImage(item, baseURL);
      if (!u) continue;
      let area = 0;
      if (item && typeof item === 'object') {
        const w = Number(item.width || item['width']) || 0;
        const h = Number(item.height || item['height']) || 0;
        area = w * h;
      }
      if (area > bestArea) { bestArea = area; bestUrl = u; }
    }
    return bestUrl;
  }
  if (typeof v === 'object') {
    if (v.url) return pickJsonLdImage(v.url, baseURL);
    if (v.contentUrl) return pickJsonLdImage(v.contentUrl, baseURL);
    if (v['@id']) return pickJsonLdImage(v['@id'], baseURL);
  }
  return null;
}

function pickJsonLdAuthor(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) {
    const names = v.map(pickJsonLdAuthor).filter(Boolean);
    return names.length ? names.join(', ') : null;
  }
  if (typeof v === 'object') return pickJsonLdString(v.name) || pickJsonLdString(v['@id']);
  return null;
}

// ---------- card-level byline/uploader demotion ----------
// Many feed layouts (Vimeo, YouTube, Reddit, etc.) put TWO+ anchors with
// DIFFERENT hrefs inside a single visual card:
//   <div class="video-card">
//     <a href="/videos/clip-A"><img>...</a>          ← primary content link
//     <div class="titleContainer">
//       <a href="/videos/clip-A">Clip A</a>          ← same href, merges in bucket
//     </div>
//     <a href="/channels/foo">Foo Channel</a>       ← byline link, NOT a card
//     <a class="avatar" href="/channels/foo"></a>   ← byline avatar, NOT a card
//   </div>
//
// The basic bucket-by-href merges the two clip-A anchors. But the channel
// anchors have a different href and would otherwise emit their own card.
// Visually that looks like a duplicate of the video (same thumbnail block,
// similar title because the container fallback pulls the whole card's text).
//
// Rule: inside a card wrapper, the anchor that owns the thumbnail (has an
// <img>/<video>/<picture> child or has a thumbnail-shaped class) is the
// PRIMARY. All other anchors in that card whose href differs from the
// primary are demoted to byline chrome.
//
// Returns a WeakSet of anchors to skip entirely during the main anchor walk.
function detectDemotedBylineAnchors(doc, baseURL) {
  const demotedAnchors = new WeakSet();
  // Only run card-demotion when the wrapper class strongly suggests a single
  // visual media card (video-card, thumb-container, post-card, etc.). Broad
  // selectors like `li[class]` or `[class*="item"]` would over-match generic
  // list wrappers (Twitter blog posts, news lists) and silently drop legit
  // anchors. Be conservative: false negatives keep the duplicate (annoying);
  // false positives delete real content (catastrophic).
  const CARD_SELECTOR =
    '*[class*="card" i], *[class*="tile" i], *[class*="thumb" i], ' +
    '*[class*="video-card" i], *[class*="video-thumb" i], *[class*="video-item" i], ' +
    '*[class*="post-card" i], *[class*="post-tile" i], ' +
    '*[class*="feed-item" i], *[class*="grid-item" i], *[class*="list-item" i], ' +
    'ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-compact-video-renderer, ' +
    'article, [role="article"]';
  const cards = Array.from(doc.querySelectorAll(CARD_SELECTOR));
  // Sort smallest-first so a nested card wins over its ancestor wrapper.
  cards.sort((a, b) => a.querySelectorAll('a[href]').length - b.querySelectorAll('a[href]').length);
  const cardClaimed = new WeakSet(); // anchors already assigned to a card
  for (const card of cards) {
    const anchors = Array.from(card.querySelectorAll('a[href]'))
      .filter((a) => !cardClaimed.has(a));
    if (anchors.length < 2) continue;
    // Group these anchors by their (raw) href so same-href siblings merge.
    const byHref = new Map();
    for (const a of anchors) {
      const h = a.getAttribute('href') || '';
      if (!byHref.has(h)) byHref.set(h, []);
      byHref.get(h).push(a);
    }
    if (byHref.size < 2) continue; // single href in card — bucket handles it
    // We only demote when there's STRONG evidence of byline/uploader anchors
    // sharing the wrapper with a content anchor. The signals:
    //   - one href group has a thumbnail-bearing anchor (img/video/picture inside)
    //   - the OTHER href group has byline-shaped class names or path prefixes
    let primaryHref = null;
    let primaryScore = 0;
    const groupScores = new Map();
    for (const [h, group] of byHref) {
      let score = 0;
      let hasThumbAnchor = false;
      for (const a of group) {
        if (a.querySelector('img, video, picture, iframe')) { score += 10; hasThumbAnchor = true; }
        const cls = (a.getAttribute('class') || '').toLowerCase();
        if (/thumb|poster|media|hero|preview|player/.test(cls)) score += 4;
        if (/uploader|avatar|author|byline|user-?(link|name)|channel-?link/.test(cls)) score -= 8;
        try {
          const p = new URL(safeURL(h, baseURL) || h).pathname;
          if (/^\/(channels?|users?|u|profile|author|by)\//i.test(p) || /^\/@/.test(p)) score -= 4;
        } catch {}
        if (a.getAttribute('aria-label')) score += 1;
      }
      groupScores.set(h, { score, hasThumbAnchor });
      if (score > primaryScore) {
        primaryScore = score;
        primaryHref = h;
      }
    }
    // Guardrails before demoting:
    //   1. Primary must have a thumbnail anchor (else don't trust the verdict)
    //   2. Primary's score must clearly beat the runner-up (delta >= 6)
    if (!primaryHref || !groupScores.get(primaryHref).hasThumbAnchor) continue;
    const others = [...groupScores.entries()].filter(([h]) => h !== primaryHref);
    const worstOther = others.reduce((min, [, v]) => Math.min(min, v.score), Infinity);
    if (primaryScore - worstOther < 6) continue;
    // Demote everything not in the primary group.
    for (const [h, group] of byHref) {
      for (const a of group) cardClaimed.add(a);
      if (h !== primaryHref) {
        // Only demote anchors whose own score is clearly byline-shaped,
        // not random secondary content links inside an article.
        for (const a of group) {
          const cls = (a.getAttribute('class') || '').toLowerCase();
          const isBylineClass = /uploader|avatar|author|byline|user-?(link|name)|channel-?link/.test(cls);
          let isBylinePath = false;
          try {
            const p = new URL(safeURL(h, baseURL) || h).pathname;
            isBylinePath = /^\/(channels?|users?|u|profile|author|by)\//i.test(p) || /^\/@/.test(p);
          } catch {}
          if (isBylineClass || isBylinePath) demotedAnchors.add(a);
        }
      }
    }
  }
  return demotedAnchors;
}

// ---------- per-bucket title/thumbnail/video resolution ----------
// A "bucket" is every anchor found to share one resolved href (see the
// bucketing pass in parseSourceWithMeta). These three functions pick the
// bucket's default title/video/thumbnail winner from its anchors.
//
// `claims` tracks which <img>/<video> DOM elements have already been used
// as another bucket's thumbnail/video, so the standalone image/video walk
// later doesn't re-emit them as orphan items, AND so two different buckets
// don't both claim the same nearby image (e.g. a byline photo shared by two
// adjacent cards). This is INTENTIONALLY stateful and order-dependent —
// buckets are resolved in DOM-discovery order, and "first bucket to claim an
// element wins" is real, load-bearing product behavior, not an accident of
// implementation. A fully stateless/order-independent resolver would change
// which bucket gets a shared image when two anchors sit near the same
// element, so — unlike the title/thumb/video CANDIDATE rules above, which
// are pure — this stays as an explicit shared-state object passed into each
// resolver rather than being eliminated.
function resolveBucketTitle(bucket) {
  let lastResort = null;
  for (const a of bucket.anchors) {
    const t = getAnchorTitle(a);
    if (!t) continue;
    if (!looksLikeBadTitle(t)) return t;
    if (!lastResort) lastResort = t;
  }
  return lastResort;
}

function resolveBucketVideo(bucket, baseURL, claims) {
  for (const a of bucket.anchors) {
    const v = extractVideoFromAnchor(a);
    if (v) return v;
  }
  for (const a of bucket.anchors) {
    const found = findSiblingVideo(a, baseURL);
    if (found) {
      if (found.claimedEl) {
        claims.videos.add(found.claimedEl);
        // also claim every <source> child so source-level dedup works
        found.claimedEl.querySelectorAll?.('source').forEach((s) => claims.videos.add(s));
      }
      return found.videoInfo;
    }
  }
  return null;
}

// Thumbnail priority (per docs/thumbnail-and-chrome-spec.md):
//   Tier 1: video poster for the href (checked by the caller, before this
//           runs, so a real video preview wins over an adjacent <img> that
//           may just be a play-button icon)
//   Tier 2: direct <img> / <picture> / background-image / figure-sibling
//   Tier 3: og:image fallback (single-item only, handled later)
//   Tier 4: synthesized poster from URL pattern (YouTube, etc.) — later
//   Tier 5: deterministic SVG placeholder — later
function resolveBucketThumbnail(bucket, baseURL, claims, rawAnchors) {
  // Tier 2 — direct image inside / adjacent to the anchor.
  for (const a of bucket.anchors) {
    const cand = extractImageFromAnchor(a);
    if (cand) {
      // mark the <img> we picked so the standalone walk doesn't re-emit it
      const innerImg = a.querySelector('img');
      if (innerImg) claims.imgs.add(innerImg);
      return safeURL(cand, baseURL) || cand;
    }
  }
  // figure-sibling fallback — covers Time.com and similar.
  for (const a of bucket.anchors) {
    const found = findFigureSiblingThumb(a, baseURL, claims.imgs);
    if (found) {
      if (found.claimedEl) {
        // claim the <img> (or every <img> inside the <picture>)
        if (found.claimedEl.tagName === 'PICTURE') {
          found.claimedEl.querySelectorAll('img').forEach((i) => claims.imgs.add(i));
        } else {
          claims.imgs.add(found.claimedEl);
        }
      }
      return found.thumb;
    }
  }
  // adjacent-sibling fallback — covers flat <a>...</a><img> lists with no
  // card wrapper. Each anchor only claims an <img> if it's the nearest
  // anchor to that <img> in the parent.
  for (const a of bucket.anchors) {
    const found = findAdjacentSiblingThumb(a, rawAnchors, baseURL, claims.imgs);
    if (found) {
      if (found.claimedEl) claims.imgs.add(found.claimedEl);
      return found.thumb;
    }
  }
  return null;
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

  // JSON-LD pass — collect schema.org metadata before walking the DOM so we
  // can enrich anchor buckets with authoritative headline/image/description
  // and also emit standalone cards for entries whose URL doesn't appear as
  // an anchor in the pasted HTML. The user picks via the existing strategy
  // picker; nothing here is silently chosen.
  const jsonLdResult = extractJsonLd(doc, baseURL);
  const jsonLdByUrl = new Map();
  for (const e of jsonLdResult.entries) {
    jsonLdByUrl.set(canonicalHref(normalizeURL(e.url)), e);
  }
  const jsonLdMatchedUrls = new Set(); // canonical keys consumed by anchor buckets

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
  // Keyed by canonicalHref (destination identity) so URL variants of the same
  // page — trailing slash, #comments, www, http/https, param order — merge into
  // ONE bucket instead of repeating. `href` is the verbatim link we display.
  const buckets = new Map(); // canonicalKey -> { anchors: [a, ...], firstAnchor: a, href }
  const rawAnchors = Array.from(doc.querySelectorAll('a[href], button[data-href], button[data-url], button[data-video-url], button[data-link], [role="link"][data-href]'));

  // Card-level grouping (the "byline-anchor" / uploader fix) — see
  // detectDemotedBylineAnchors below for the full explanation.
  const demotedAnchors = detectDemotedBylineAnchors(doc, baseURL);
  for (const a of rawAnchors) {
    const rawHref = a.getAttribute('href') || a.getAttribute('data-href') || a.getAttribute('data-url') || a.getAttribute('data-video-url') || a.getAttribute('data-link');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) continue;
    const rawHrefResolved = safeURL(rawHref, baseURL);
    if (!rawHrefResolved) {
      if (!/^https?:\/\//i.test(rawHref)) unresolvedCount++;
      continue;
    }
    if (!/^https?:/i.test(rawHrefResolved)) continue;
    
    const href = normalizeURL(rawHrefResolved);

    if (demotedAnchors.has(a)) continue; // byline / uploader / avatar inside a card
    if (isChromeAnchor(a, href)) continue; // drop nav/footer/tag/account chrome
    // Drop URL-shortener / tracker hosts (#6). These appear inside Twitter
    // oEmbed blockquotes (t.co), LinkedIn previews (lnkd.in), etc. and are
    // never the canonical content destination.
    try {
      const host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
      if (SHORT_LINK_HOSTS.has(host)) continue;

      // Filter out twitter/x status anchors whose title looks like a date
      if (host === 'twitter.com' || host === 'x.com') {
        const text = visibleText(a).trim();
        // matches typical dates like "June 10, 2026" or "10 Jun 2026"
        if (/^[a-z]{3,9}\s+\d{1,2},?\s+\d{4}$/i.test(text) || /^\d{1,2}\s+[a-z]{3,9}\s+\d{4}$/i.test(text)) {
          continue;
        }
      }
    } catch {}

    const bucketKey = canonicalHref(href);
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { anchors: [], firstAnchor: a, href });
    buckets.get(bucketKey).anchors.push(a);
  }

  const claims = { imgs: claimedImgs, videos: claimedVideos };
  for (const [bucketKey, bucket] of buckets) {
    if (seen.has(bucketKey)) continue;
    seen.add(bucketKey);
    const href = bucket.href;

    // `title`/`thumb` are reassigned below if JSON-LD offers a stronger pick.
    let title = resolveBucketTitle(bucket) || domainOf(href);

    // Tier 1 — find a video first, so a real video preview wins over an
    // adjacent <img> that might just be a play-button icon (see tier
    // ordering comment on resolveBucketThumbnail).
    const video = resolveBucketVideo(bucket, baseURL, claims);

    // Promote video.poster to the thumbnail immediately if we found one;
    // otherwise fall through Tiers 2-3 in resolveBucketThumbnail.
    let thumb = (video && video.poster)
      ? (safeURL(video.poster, baseURL) || video.poster)
      : resolveBucketThumbnail(bucket, baseURL, claims, rawAnchors);

    // Collect ALL candidates for title/thumb/video across every anchor in the
    // bucket so the Review-step picker can offer alternatives. Defaults stay
    // identical to the old behavior — winner is whatever the legacy code
    // chose above. The picker only surfaces when 2+ distinct candidates exist.
    const titleCandidates = [];
    const thumbCandidates = [];
    const videoCandidates = [];
    const descriptionCandidates = [];
    const seenTitles = new Set();
    const seenThumbs = new Set();
    const seenVideos = new Set();
    const seenDescriptions = new Set();
    // JSON-LD enrichment: if any schema.org entry matches this bucket's href,
    // prepend its values so they're the top-ranked picks in the picker. The
    // user still chooses; this just surfaces authoritative metadata first.
    const jsonLdEntry = jsonLdByUrl.get(bucketKey);
    if (jsonLdEntry) {
      jsonLdMatchedUrls.add(bucketKey);
      if (jsonLdEntry.headline && !seenTitles.has(jsonLdEntry.headline)) {
        seenTitles.add(jsonLdEntry.headline);
        titleCandidates.push({ value: jsonLdEntry.headline, strategy: 'jsonld-headline', label: 'JSON-LD headline' });
      }
      if (jsonLdEntry.image && !seenThumbs.has(jsonLdEntry.image)) {
        seenThumbs.add(jsonLdEntry.image);
        thumbCandidates.push({ value: jsonLdEntry.image, strategy: 'jsonld-image', label: 'JSON-LD image' });
      }
      if (jsonLdEntry.description && !seenDescriptions.has(jsonLdEntry.description)) {
        seenDescriptions.add(jsonLdEntry.description);
        descriptionCandidates.push({ value: jsonLdEntry.description, strategy: 'jsonld-description', label: 'JSON-LD description' });
      }
    }
    for (const a of bucket.anchors) {
      // Dedupe on (strategy, value) so the same URL can appear under multiple
      // strategy keys — e.g. detailed `img-srcset:1600w` and umbrella
      // `img-srcset:any` both reach the picker even though they resolve to the
      // same URL. Without the strategy in the dedupe key, the umbrella gets
      // silently dropped and the picker shows only descriptor-specific options
      // tied to one category of links.
      const tupleKey = (c) => c.strategy + '\0' + c.value;
      for (const c of collectTitleCandidates(a)) {
        const k = tupleKey(c);
        if (seenTitles.has(k)) continue;
        seenTitles.add(k);
        titleCandidates.push(c);
      }
      for (const c of collectThumbCandidates(a, baseURL)) {
        const k = tupleKey(c);
        if (seenThumbs.has(k)) continue;
        seenThumbs.add(k);
        thumbCandidates.push(c);
      }
      for (const c of collectVideoCandidates(a, baseURL)) {
        const k = tupleKey(c);
        if (seenVideos.has(k)) continue;
        seenVideos.add(k);
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
    // If JSON-LD provided a stronger title/image, promote them to defaults.
    if (jsonLdEntry) {
      if (jsonLdEntry.headline) title = jsonLdEntry.headline;
      if (jsonLdEntry.image) thumb = jsonLdEntry.image;
    }

    const item = {
      id: uid(),
      sourceName,
      href,
      title: title.slice(0, 280),
      thumbnail: thumb || null,
      video: video || null,
      description: jsonLdEntry?.description || null,
      titleCandidates,
      thumbCandidates,
      videoCandidates,
      descriptionCandidates,
      jsonLd: jsonLdEntry || null,
      domain: domainOf(href),
      pageSection: sectionFor.get(bucket.firstAnchor) || 'Other',
      pattern: getPatternSignature(bucket.firstAnchor),
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
    const synths = synthesizeFromArticle(art, baseURL, sourceName);
    if (!synths || synths.length === 0) continue;

    for (const synth of synths) {
      if (seen.has(synth.href)) continue;
      seen.add(synth.href);
      synth.pageSection = sectionFor.get(art) || 'Videos';
      items.push(synth);
    }
    // Mark all images & videos inside this article so standalone walks skip them.
    art.querySelectorAll('img, video, iframe, source').forEach((el) => synthesizedFromArticles.add(el));
  }

  // 2) Standalone images on the page (often used in galleries)
  // Only add ones not already attached to anchors above or synthesized from <article>
  const standaloneImgs = Array.from(doc.querySelectorAll('img')).filter(
    (img) => !img.closest('a[href]') && !synthesizedFromArticles.has(img) && !claimedImgs.has(img) && isLikelyContentMediaElement(img)
  );
  for (const img of standaloneImgs) {
    // Use pickImgSrc so we honor lazy-load conventions AND its last-ditch
    // fallback (returns raw src even when every candidate looks like a
    // placeholder). Trust the markup: if it's an <img>, it's an image.
    let src = pickImgSrc(img) || img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) continue;
    const resolvedSrc = safeURL(src, baseURL) || src;
    if (!/^https?:/i.test(resolvedSrc)) continue;
    const normalizedSrc = normalizeURL(resolvedSrc);
    // No IMAGE_EXT filter — modern CDNs serve images from extensionless URLs
    // (imgix, Cloudinary, opaque CMS routes). If the markup says <img src="X">,
    // X is the image, regardless of what the URL looks like.
    const imgKey = canonicalHref(normalizedSrc);
    if (seen.has(imgKey)) continue;
    seen.add(imgKey);
    const altTitle = img.getAttribute('alt')?.trim() || 'Image';
    items.push({
      id: uid(),
      sourceName,
      href: normalizedSrc,
      title: altTitle,
      thumbnail: normalizedSrc,
      video: null,
      titleCandidates: [{ value: altTitle, strategy: 'standalone-img-alt', label: 'image alt' }],
      thumbCandidates: [{ value: normalizedSrc, strategy: 'standalone-img', label: 'standalone <img>' }],
      videoCandidates: [],
      descriptionCandidates: [],
      domain: domainOf(normalizedSrc),
      category: 'gallery',
      pageSection: sectionFor.get(img) || 'Images',
      pattern: '<img>',
    });
  }

  // 3) Pure video tags / iframes without anchors
  const standaloneVideos = Array.from(doc.querySelectorAll('iframe[src], video')).filter(
    (v) => !v.closest('a[href]') && !synthesizedFromArticles.has(v) && !claimedVideos.has(v) && isLikelyContentMediaElement(v)
  );
  for (const v of standaloneVideos) {
    let src = v.getAttribute('src') || v.querySelector?.('source')?.getAttribute('src');
    if (!src) continue;
    const resolvedSrc = safeURL(src, baseURL) || src;
    if (!/^https?:/i.test(resolvedSrc)) continue;
    const normalizedSrc = normalizeURL(resolvedSrc);
    const videoKey = canonicalHref(normalizedSrc);
    if (seen.has(videoKey)) continue;
    // only count actual video sources
    if (!isVideoHref(normalizedSrc) && !(v.tagName === 'VIDEO')) continue;
    seen.add(videoKey);
    const vTitle = v.getAttribute('title') || 'Video';
    const vPoster = v.getAttribute('poster') || null;
    items.push({
      id: uid(),
      sourceName,
      href: normalizedSrc,
      title: vTitle,
      thumbnail: vPoster,
      video: { src: normalizedSrc },
      titleCandidates: [{ value: vTitle, strategy: 'standalone-video-title', label: 'video title attr' }],
      thumbCandidates: vPoster ? [{ value: vPoster, strategy: 'standalone-video-poster', label: 'video poster' }] : [],
      videoCandidates: [{ value: normalizedSrc, strategy: 'standalone-video', label: 'standalone <video>', info: { url: normalizedSrc } }],
      descriptionCandidates: [],
      domain: domainOf(normalizedSrc),
      category: 'video',
      pageSection: sectionFor.get(v) || 'Videos',
      pattern: v.tagName === 'IFRAME' ? '<iframe>' : '<video>',
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

  // JSON-LD orphans — entries whose URL doesn't match any anchor we found.
  // Per user spec: still surface them; let the user decide. These items have
  // no DOM anchor backing them, only schema.org metadata. They float to the
  // top of the review list because they're typically the highest-confidence
  // signal on a page (the site itself declaring "this is the article").
  for (const entry of jsonLdResult.entries) {
    const entryUrl = normalizeURL(entry.url);
    const entryKey = canonicalHref(entryUrl);
    if (jsonLdMatchedUrls.has(entryKey)) continue;
    if (seen.has(entryKey)) continue;
    seen.add(entryKey);
    const titleCandidates = [];
    const thumbCandidates = [];
    const descriptionCandidates = [];
    if (entry.headline) titleCandidates.push({ value: entry.headline, strategy: 'jsonld-headline', label: 'JSON-LD headline' });
    if (entry.image) thumbCandidates.push({ value: entry.image, strategy: 'jsonld-image', label: 'JSON-LD image' });
    if (entry.description) descriptionCandidates.push({ value: entry.description, strategy: 'jsonld-description', label: 'JSON-LD description' });
    const item = {
      id: uid(),
      sourceName,
      href: entryUrl,
      title: (entry.headline || entryUrl).slice(0, 280),
      thumbnail: entry.image || null,
      video: null,
      description: entry.description || null,
      titleCandidates,
      thumbCandidates,
      videoCandidates: [],
      descriptionCandidates,
      jsonLd: entry,
      domain: domainOf(entry.url),
      pageSection: 'JSON-LD',
      enabled: true,
      pattern: 'JSON-LD',
    };
    item.category = classify(item);
    items.push(item);
  }

  // Sort: JSON-LD–backed items first (authoritative), then everything else
  // in DOM order. The user explicitly asked for high-confidence picks to
  // float to the top of the review list.
  items.sort((a, b) => {
    const aLd = a.jsonLd ? 1 : 0;
    const bLd = b.jsonLd ? 1 : 0;
    return bLd - aLd;
  });

  return {
    items,
    unresolvedCount,
    hasBase: !!baseURL,
    baseURL: baseURL || null,
    jsonLdMeta: { scriptCount: jsonLdResult.scriptCount, parsedCount: jsonLdResult.parsedCount, entryCount: jsonLdResult.entries.length, matchedCount: jsonLdMatchedUrls.size, orphanCount: jsonLdResult.entries.length - jsonLdMatchedUrls.size },
  };
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
      const best = bestSrcsetEntry(pic.getAttribute('srcset') || '');
      if (best?.url) thumb = best.url;
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
  const outItems = [];
  const iframes = Array.from(art.querySelectorAll('iframe[src]'));

  if (href) {
    const item = {
      id: uid(),
      sourceName,
      href,
      title,
      thumbnail: thumb || null,
      video: videoInfo,
      titleCandidates: title ? [{ value: title, strategy: 'synthesized', label: 'synthesized from article' }] : [],
      thumbCandidates: thumb ? [{ value: thumb, strategy: 'synthesized', label: 'synthesized from article' }] : [],
      videoCandidates: videoInfo?.src ? [{ value: videoInfo.src, strategy: 'synthesized', label: 'synthesized from article', info: videoInfo }] : [],
      descriptionCandidates: [],
      domain: domainOf(href),
      pattern: '<article>',
    };
    item.category = videoInfo ? 'video' : (thumb ? 'article' : 'link');
    outItems.push(item);
  }

  for (const iframe of iframes) {
    const src = iframe.getAttribute('src');
    const resolved = src ? (safeURL(src, baseURL) || src) : null;
    if (resolved && /^https?:/i.test(resolved)) {
      let iframeHref = resolved;
      let iframeVideoInfo = null;
      if (/youtube|vimeo|tiktok|wistia|dailymotion|twitch|instagram/i.test(resolved)) {
        iframeVideoInfo = { src: resolved };
      }

      const item = {
        id: uid(),
        sourceName,
        href: iframeHref,
        title,
        thumbnail: thumb || null,
        video: iframeVideoInfo,
        titleCandidates: title ? [{ value: title, strategy: 'synthesized', label: 'synthesized from article' }] : [],
        thumbCandidates: thumb ? [{ value: thumb, strategy: 'synthesized', label: 'synthesized from article' }] : [],
        videoCandidates: iframeVideoInfo?.src ? [{ value: iframeVideoInfo.src, strategy: 'synthesized', label: 'synthesized from article', info: iframeVideoInfo }] : [],
        descriptionCandidates: [],
        domain: domainOf(iframeHref),
        pattern: '<iframe>',
      };
      item.category = iframeVideoInfo ? 'video' : (thumb ? 'article' : 'link');
      outItems.push(item);
    }
  }

  // If no playable media URL exists, fall back to linking the article container's
  // data-href / data-url, or the thumbnail itself.
  if (outItems.length === 0) {
    let fallbackHref = null;
    const dataLink = art.getAttribute('data-href') || art.getAttribute('data-url') || art.getAttribute('data-link');
    if (dataLink) {
      const resolved = safeURL(dataLink, baseURL) || dataLink;
      if (/^https?:/i.test(resolved)) fallbackHref = resolved;
    }
    if (!fallbackHref && thumb) fallbackHref = thumb;

    if (fallbackHref) {
      const item = {
        id: uid(),
        sourceName,
        href: fallbackHref,
        title,
        thumbnail: thumb || null,
        video: null,
        titleCandidates: title ? [{ value: title, strategy: 'synthesized', label: 'synthesized from article' }] : [],
        thumbCandidates: thumb ? [{ value: thumb, strategy: 'synthesized', label: 'synthesized from article' }] : [],
        videoCandidates: [],
        descriptionCandidates: [],
        domain: domainOf(fallbackHref),
        pattern: '<article>',
      };
      item.category = thumb ? 'article' : 'link';
      outItems.push(item);
    }
  }

  return outItems.length > 0 ? outItems : null;
}

export { parseSource, parseSourceWithMeta, domainOf, canonicalHref };
