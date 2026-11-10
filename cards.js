/* =====================================================
   LINKFORGE — card-set detection and field consensus

   A "card" on a modern page is not a link. It is one unit of a REPEATING
   structure: twenty siblings built from the same markup, each holding its own
   title, thumbnail and (sometimes) video preview. This module finds those
   repeating structures and reasons about them as a set.

   Two halves, both pure:

     detectCardSets(doc)            DOM in  -> card sets out
       Clusters structurally matching siblings, merges matching runs across
       parents (grid rows, masonry columns), then settles which nesting level
       is the card (a row of cards is a wrapper; a tag chip is card detail).

     resolveSetFields(items, ...)   items in -> per-set field verdicts out
       With every card of a set side by side, a field source can be judged on
       evidence no single card offers: a "title" that reads the same on every
       card is a label, an "image" that repeats on every card is a logo. The
       same pass reports where two sources genuinely compete, so the UI can
       ask the user instead of guessing silently.

   No dependency on parser.js; the parser passes in what it knows (which
   elements are clickable, what counts as page chrome, what a bad title is).
   ===================================================== */

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'BASE', 'TITLE',
  'SVG', 'PATH', 'G', 'BR', 'HR', 'WBR', 'SOURCE', 'TRACK', 'OPTION', 'OPTGROUP',
  'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'COL', 'COLGROUP', 'THEAD', 'TFOOT',
  'SPAN', 'B', 'I', 'EM', 'STRONG', 'SMALL', 'TIME', 'CODE', 'ABBR', 'SUP', 'SUB',
]);

// Class tokens that describe an element's momentary state or position rather
// than what it is. Two cards differing only by one of these are the same card.
const STATE_CLASS = /^(?:is|has|js|no|not)-|^(?:active|selected|current|first|last|odd|even|hidden|visible|open|closed|featured|new|hover|focus|loaded|lazyloaded|lazyload|show|in|fade)$|^(?:slick|swiper-slide|aos)-/i;

const MEDIA_SELECTOR =
  'img, picture, video, iframe, [style*="url("], [data-bg], [data-bg-src], [data-background], [data-background-image]';

const MIN_SET = 3;        // a repeating structure needs at least this many members...
const MIN_RICH_SET = 2;   // ...unless every member is a full card (media + link/text)
const MAX_LINKS_PER_CARD = 8; // more distinct destinations than this is a page region, not a card

function firstStableClass(el) {
  const raw = (el.getAttribute('class') || '').trim();
  if (!raw) return '';
  for (const token of raw.split(/\s+/)) {
    if (token.length > 48) continue;
    if (STATE_CLASS.test(token)) continue;
    if (/\d{3,}/.test(token)) continue; // post-18234, css-1x2y3z4-style ids
    return token;
  }
  return '';
}

// tag + first stable class: loose on purpose. WordPress stamps every post with
// its own category/tag classes, utility-CSS sites reorder tokens per variant;
// the leading stable token is what the cards of one set reliably share.
function looseKey(el) {
  const cls = firstStableClass(el);
  return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
}

function signatureOf(key) {
  const dot = key.indexOf('.');
  return dot < 0 ? `<${key}>` : `<${key.slice(0, dot)} class="${key.slice(dot + 1)}">`;
}

function mediaUrlOf(el) {
  if (!el) return '';
  const attrs = ['src', 'data-src', 'poster', 'data-poster', 'data-bg', 'data-background-image', 'srcset', 'data-srcset'];
  for (const attr of attrs) {
    const v = el.getAttribute?.(attr);
    if (v && !/^data:/i.test(v.trim())) return v.trim().split(/\s+/)[0];
  }
  const style = el.getAttribute?.('style') || '';
  const m = style.match(/url\(\s*['"]?([^'")]+)/i);
  return m ? m[1] : '';
}

// What one candidate member holds. Cached per element: an element can be
// weighed as a member of its own group and as a container of an inner one.
function makeFeatureReader(clickSelector) {
  const cache = new WeakMap();
  return function featuresOf(el) {
    let f = cache.get(el);
    if (f) return f;
    const selfClick = el.matches(clickSelector);
    const clicks = selfClick ? [el] : Array.from(el.querySelectorAll(clickSelector));
    const hrefs = [];
    for (const c of clicks) {
      const raw = (c.getAttribute('href') || c.getAttribute('data-href') || c.getAttribute('data-url') ||
        c.getAttribute('data-video-url') || c.getAttribute('data-contentid') || c.getAttribute('data-content-id') ||
        c.getAttribute('data-video-id') || c.getAttribute('data-link') || c.getAttribute('data-permalink') || '').trim();
      if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel):/i.test(raw)) continue;
      hrefs.push({ el: c, href: raw.replace(/[#?].*$/, '').replace(/\/+$/, '') || raw });
    }
    const mediaEl = el.matches(MEDIA_SELECTOR) ? el : el.querySelector(MEDIA_SELECTOR);
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const distinctLinks = new Set(hrefs.map((h) => h.href)).size;
    f = {
      link: hrefs.length > 0,
      firstLinkEl: hrefs[0]?.el || null,
      media: !!mediaEl,
      mediaEl: mediaEl || null,
      text: text.length >= 3,
      distinctLinks,
      identity: hrefs[0]?.href || mediaUrlOf(mediaEl) || '',
    };
    cache.set(el, f);
    return f;
  };
}

/**
 * Find the repeating card structures in a document.
 *
 * @param {Document} doc
 * @param {object} opts
 * @param {string} opts.clickSelector   what the parser treats as a click target
 * @param {string} [opts.chromeSelector] nav/header/footer containers to ignore
 * @returns {{ sets: Array, memberOf: (node: Element) => ({set, el, index}|null) }}
 */
function detectCardSets(doc, { clickSelector = 'a[href]', chromeSelector = '' } = {}) {
  const featuresOf = makeFeatureReader(clickSelector);
  const root = doc.body || doc.documentElement;
  if (!root) return { sets: [], memberOf: () => null };

  // ---- 1. sibling runs: children of one parent that share a loose key ----
  const merged = new Map(); // path key -> { key, members: [] }
  const parents = [root, ...root.querySelectorAll('*')];
  for (const parent of parents) {
    if (SKIP_TAGS.has(parent.tagName.toUpperCase())) continue;
    if (parent.children.length < 2) continue;
    if (chromeSelector && parent.closest(chromeSelector)) continue;
    const runs = new Map();
    for (const child of parent.children) {
      if (SKIP_TAGS.has(child.tagName.toUpperCase())) continue;
      const k = looseKey(child);
      if (!runs.has(k)) runs.set(k, []);
      runs.get(k).push(child);
    }
    for (const [k, members] of runs) {
      if (members.length < 2) continue;
      const feats = members.map(featuresOf);
      const content = feats.filter((f) => f.link || f.media).length;
      if (content < 2 || content / members.length < 0.6) continue;
      // Coarse shape, so a text-only "most read" <ul> does not merge with the
      // image grid that happens to use the same bare <ul><li> markup.
      const share = (flag) => feats.filter((f) => f[flag]).length / members.length;
      const shape = (share('media') >= 0.3 ? 'M' : '') + (share('link') >= 0.3 ? 'L' : '') + (share('text') >= 0.3 ? 'T' : '');
      const gp = parent.parentElement;
      const path = `${gp ? looseKey(gp) : ''}>${looseKey(parent)}>${k}|${shape}`;
      if (!merged.has(path)) merged.set(path, { key: k, path, members: [] });
      merged.get(path).members.push(...members);
    }
  }

  // ---- 2. qualify each merged group ----
  let groups = [];
  for (const g of merged.values()) {
    const feats = g.members.map(featuresOf);
    const n = feats.length;
    const mean = (fn) => feats.reduce((s, f) => s + (fn(f) ? 1 : 0), 0) / n;
    g.mediaShare = mean((f) => f.media);
    g.linkShare = mean((f) => f.link);
    g.textShare = mean((f) => f.text);
    g.score = g.mediaShare + g.linkShare + g.textShare;
    const rich = g.mediaShare >= 0.6 && (g.linkShare >= 0.6 || g.textShare >= 0.6);
    if (n < (rich ? MIN_RICH_SET : MIN_SET)) continue;
    const avgLinks = feats.reduce((s, f) => s + f.distinctLinks, 0) / n;
    if (avgLinks > MAX_LINKS_PER_CARD) continue;
    // Members must be different things. Slides of one carousel all link to the
    // same product; that is one card with several pictures, not a card set.
    const ids = feats.map((f) => f.identity).filter(Boolean);
    if (ids.length >= 2 && new Set(ids).size / ids.length < 0.5) continue;
    groups.push(g);
  }

  // ---- 3. settle nesting: which level is the card? ----
  // For every (outer A, inner B) pair, exactly one of them is not a card set:
  //   A is a WRAPPER  when B's members are as rich as A's, several sit in each
  //                   A member, they are distinct things, and A's own content
  //                   lives inside them (a row of cards, a page region);
  //   B is CARD DETAIL otherwise (tag chips, a related-links list, slides).
  const groupOf = new Map();
  for (const g of groups) for (const m of g.members) groupOf.set(m, g);
  const pairs = new Map(); // "A|B" -> { A, B, containers: Map<containerEl, memberEls[]> }
  for (const B of groups) {
    for (const m of B.members) {
      let cur = m.parentElement;
      while (cur) {
        const A = groupOf.get(cur);
        if (A && A !== B) {
          const id = A.path + '\u0000' + B.path;
          if (!pairs.has(id)) pairs.set(id, { A, B, containers: new Map() });
          const c = pairs.get(id).containers;
          if (!c.has(cur)) c.set(cur, []);
          c.get(cur).push(m);
        }
        cur = cur.parentElement;
      }
    }
  }
  const dropped = new Set();
  for (const { A, B, containers } of pairs.values()) {
    let total = 0;
    let distinct = 0;
    let withIds = 0;
    let primaryInside = 0;
    for (const [container, inner] of containers) {
      total += inner.length;
      const ids = inner.map((m) => featuresOf(m).identity).filter(Boolean);
      withIds += ids.length;
      distinct += new Set(ids).size;
      const cf = featuresOf(container);
      const inInner = (el) => !el || inner.some((m) => m === el || m.contains(el));
      if (inInner(cf.firstLinkEl) && inInner(cf.mediaEl)) primaryInside++;
    }
    const perContainer = total / containers.size;
    const distinctRatio = withIds ? distinct / withIds : 1;
    const coverage = containers.size / A.members.length;
    const asRich = B.score >= A.score - 0.25 && B.mediaShare >= A.mediaShare - 0.25;
    const aIsWrapper =
      perContainer >= 1.5 && distinctRatio >= 0.7 && asRich &&
      (coverage < 0.5 || primaryInside / containers.size >= 0.5);
    dropped.add(aIsWrapper ? A : B);
  }
  groups = groups.filter((g) => !dropped.has(g));

  // ---- 4. publish, in document order ----
  const order = new Map();
  let i = 0;
  for (const el of parents) order.set(el, i++);
  groups.sort((a, b) => order.get(a.members[0]) - order.get(b.members[0]));
  const lookup = new Map();
  const sets = groups.map((g, idx) => {
    const set = {
      id: `set-${idx + 1}`,
      kind: 'repeating',
      signature: signatureOf(g.key),
      members: g.members,
    };
    g.members.forEach((el, index) => lookup.set(el, { set, el, index }));
    return set;
  });

  function memberOf(node) {
    let cur = node;
    while (cur) {
      const hit = lookup.get(cur);
      if (hit) return hit;
      cur = cur.parentElement;
    }
    return null;
  }

  return { sets, memberOf };
}

// ===================================================
// Field consensus
// ===================================================

// How much a title source can be trusted on its own. Used to decide whether a
// competing source is a real rival (ask the user) or just a weaker echo.
function titleTier(strategy) {
  if (/^jsonld-/.test(strategy)) return 3;
  if (/^slot:h[1-6]/.test(strategy) || /^slot:.*(title|headline)/i.test(strategy)) return 3;
  if (/heading|title-class|title-testid/.test(strategy)) return 3;
  if (/aria-label|title-attr|caption|sibling-p-title|synthesized/.test(strategy) && !/container-aria-label/.test(strategy)) return 2;
  return 1;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Two texts are the same title when one says no more than the other: equal,
// or one contained in the other (an anchor's full text usually wraps its own
// heading plus a duration and a byline).
function sameTitle(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
}

// Values that repeat across the cards of a set are labels, not content.
function uniformValues(items, candKey) {
  const n = items.length;
  const out = new Set();
  if (n < 3) return out;
  const counts = new Map();
  for (const it of items) {
    const seen = new Set();
    for (const c of it[candKey] || []) {
      if (seen.has(c.value)) continue;
      seen.add(c.value);
      counts.set(c.value, (counts.get(c.value) || 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(n * 0.6));
  for (const [value, count] of counts) if (count >= threshold) out.add(value);
  return out;
}

function summarizeOptions(items, candKey, chosenByItem, vetoed) {
  const n = items.length;
  const by = new Map();
  for (const it of items) {
    const seen = new Set();
    for (const c of it[candKey] || []) {
      if (seen.has(c.strategy)) continue;
      seen.add(c.strategy);
      if (!by.has(c.strategy)) by.set(c.strategy, { strategy: c.strategy, label: c.label, count: 0, samples: [], uniform: 0 });
      const o = by.get(c.strategy);
      o.count++;
      if (vetoed.has(c.value)) o.uniform++;
      if (o.samples.length < 3 && !o.samples.includes(c.value)) o.samples.push(c.value);
    }
  }
  const wins = new Map();
  for (const s of chosenByItem) if (s) wins.set(s, (wins.get(s) || 0) + 1);
  const options = Array.from(by.values()).map((o) => ({
    strategy: o.strategy,
    label: o.label,
    count: o.count,
    coverage: o.count / Math.max(1, n),
    samples: o.samples,
    repeats: o.count > 0 && o.uniform / o.count >= 0.6, // same value on most cards
    wins: wins.get(o.strategy) || 0,
  }));
  options.sort((a, b) => (b.wins - a.wins) || (b.coverage - a.coverage) || a.label.localeCompare(b.label));
  let chosen = null;
  let best = 0;
  for (const [s, w] of wins) if (w > best) { best = w; chosen = s; }
  return { options, chosen };
}

const strategyOfValue = (cands, value) => (cands || []).find((c) => c.value === value)?.strategy || null;

/**
 * Judge the title / thumbnail / video sources of one card set as a group.
 * Mutates each item's default title/thumbnail when set-level evidence shows
 * the per-card pick was a repeated label or a repeated logo, and marks
 * item.ambiguous = { title?, thumb?, video? } for cards with a real rival.
 *
 * @returns {{title, thumb, video}} each { strategy, ambiguous, ambiguousCount, options, note }
 */
function resolveSetFields(items, { isBadTitle = () => false } = {}) {
  const n = items.length;
  const needs = (count) => count > 0 && count >= Math.max(1, Math.ceil(n * 0.3));
  for (const it of items) it.ambiguous = {};

  // ---- title ----
  const repeatedTitles = uniformValues(items, 'titleCandidates');
  let titleFixed = 0;
  let titleAmbiguous = 0;
  const titleRivals = new Map(); // strategy -> cards where it competes
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  for (const it of items) {
    const cands = it.titleCandidates || [];
    const usable = (c) => !repeatedTitles.has(c.value) && !isBadTitle(c.value);
    if (it.title && (repeatedTitles.has(it.title) || isBadTitle(it.title))) {
      const better = cands.find(usable);
      if (better) { it.title = better.value; titleFixed++; }
    }
    // The chosen text is as trustworthy as its best source: a heading that the
    // link text merely repeats is still a heading.
    const tier = cands.reduce((t, c) => (c.value === it.title ? Math.max(t, titleTier(c.strategy)) : t), 1);
    const rivals = cands.filter((c) => usable(c) && titleTier(c.strategy) >= tier && !sameTitle(c.value, it.title));
    if (rivals.length) { it.ambiguous.title = true; titleAmbiguous++; }
    for (const s of new Set(rivals.map((c) => c.strategy))) bump(titleRivals, s);
  }
  const titleSummary = summarizeOptions(items, 'titleCandidates', items.map((it) => strategyOfValue(it.titleCandidates, it.title)), repeatedTitles);

  // ---- thumbnail ----
  const repeatedThumbs = uniformValues(items, 'thumbCandidates');
  let thumbFixed = 0;
  let thumbAmbiguous = 0;
  const thumbRivals = new Map();
  for (const it of items) {
    const cands = it.thumbCandidates || [];
    if (it.thumbnail && repeatedThumbs.has(it.thumbnail)) {
      const better = cands.find((c) => !repeatedThumbs.has(c.value));
      if (better) { it.thumbnail = better.value; thumbFixed++; }
    }
    // Distinct pictures, not distinct URLs: srcset sizes and lazy-load
    // attributes of one <img> are the same picture. The parser tags each
    // separate image element in a card as card-image:N.
    const pictures = cands.filter((c) => /^card-image:\d+$/.test(c.strategy) && !repeatedThumbs.has(c.value));
    if (pictures.length >= 2) {
      it.ambiguous.thumb = true;
      thumbAmbiguous++;
      for (const c of pictures) bump(thumbRivals, c.strategy);
    }
  }
  const thumbSummary = summarizeOptions(items, 'thumbCandidates', items.map((it) => strategyOfValue(it.thumbCandidates, it.thumbnail)), repeatedThumbs);

  // ---- video preview ----
  let videoAmbiguous = 0;
  const videoRivals = new Map();
  for (const it of items) {
    const values = new Set((it.videoCandidates || []).map((c) => c.value));
    if (values.size >= 2) {
      it.ambiguous.video = true;
      videoAmbiguous++;
      for (const s of new Set(it.videoCandidates.map((c) => c.strategy))) bump(videoRivals, s);
    }
  }
  const videoOf = (it) => it.video && (it.video.src || it.video.url);
  const videoSummary = summarizeOptions(items, 'videoCandidates', items.map((it) => strategyOfValue(it.videoCandidates, videoOf(it))), new Set());

  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([s]) => s);
  const field = (summary, ambiguousCount, fixed, what, rivals) => ({
    strategy: summary.chosen,
    ambiguous: needs(ambiguousCount),
    ambiguousCount,
    rivals: top(rivals), // the sources that compete with the pick, most frequent first
    corrected: fixed,
    note: fixed ? `${fixed} ${what} repeated across cards and ${fixed === 1 ? 'was' : 'were'} replaced` : '',
    options: summary.options,
  });
  return {
    title: field(titleSummary, titleAmbiguous, titleFixed, titleFixed === 1 ? 'title' : 'titles', titleRivals),
    thumb: field(thumbSummary, thumbAmbiguous, thumbFixed, thumbFixed === 1 ? 'image' : 'images', thumbRivals),
    video: field(videoSummary, videoAmbiguous, 0, '', videoRivals),
  };
}

export { detectCardSets, resolveSetFields, titleTier, sameTitle };
