/* =====================================================
   LINKFORGE — output templates

   Every template is a PRESET: a small data object (fonts, colours, which
   layout, how a card looks) rendered by one shared engine. A preset contains
   no markup and no CSS of its own.

   ── HOW TO ADD A TEMPLATE ─────────────────────────────
   Add one object to PRESETS below. That is the whole change: it appears in
   the picker with a generated preview, loads its own Google Fonts, gets the
   source filter bar, the light/dark toggle, hover video previews and the
   link tail, and is covered by the template test suites automatically.

     {
       key: 'sunset',                    // unique id
       name: 'Sunset',                   // shown in the picker
       desc: 'One line for the picker.',
       focus: 'Video',                   // short tag in the picker
       bestFor: 'video',                 // video | gallery | article | link | mixed (drives the suggestion)
       theme: 'dark',                    // which theme the page opens in
       fonts: { display: 'Sora', body: 'Inter', meta: 'JetBrains Mono' },
                                         // Google Fonts family names. Append "@400" to pin weights
                                         // for families without 400-700 (e.g. 'Bebas Neue@400').
       colors: {                         // both themes, same seven names
         dark:  { bg, surface, text, muted, line, accent, onAccent },
         light: { bg, surface, text, muted, line, accent, onAccent },
       },                                // optional per theme: media, faint, accentText, glow
       hero: 'billboard',                // billboard | split | none
       layout: 'rails',                  // any key of LAYOUTS: rails | grid | posters | bento | list
       card: {
         ratio: '16 / 9',                // image shape (rails and list; grids take theirs from LAYOUTS)
         radius: 10,                     // px
         title: 'below',                 // below | overlay
         hover: 'zoom',                  // zoom | lift | glow | ring | none
         meta: 'domain',                 // domain | kind | both | none
         surface: false,                 // true = the card sits on a padded panel
       },
       type: { case: 'none', weight: 700, tracking: '-0.03em', titleWeight: 600 },   // optional
       background: 'flat',               // flat | aurora | grid | vignette
       css: '',                          // optional escape hatch, appended last
     }

   A new LAYOUT (a new way of arranging cards) is the only thing that needs
   engine code; see LAYOUTS and renderItems().
   ===================================================== */

const PRESETS = [
  {
    key: 'marquee',
    name: 'Marquee',
    desc: 'A cinematic billboard up top, then one swipeable rail of cards per source.',
    focus: 'Video',
    fit: 'Clips, episodes, reels and any collection you browse sideways',
    bestFor: 'video',
    featured: true,
    theme: 'dark',
    fonts: { display: 'Sora', body: 'Inter', meta: 'JetBrains Mono' },
    colors: {
      dark: { bg: '#08090c', surface: '#14161c', text: '#f5f6f8', muted: '#a2a7b4', line: '#242731', accent: '#ff6a3d', onAccent: '#0b0c0f' },
      light: { bg: '#f5f5f7', surface: '#ffffff', text: '#101216', muted: '#5a606c', line: '#e1e2e8', accent: '#d9431a', onAccent: '#ffffff' },
    },
    hero: 'billboard',
    layout: 'rails',
    card: { ratio: '16 / 9', radius: 10, title: 'below', hover: 'zoom', meta: 'domain' },
    type: { weight: 700, tracking: '-0.035em' },
    background: 'vignette',
  },
  {
    key: 'posters',
    name: 'Poster Wall',
    desc: 'A dense wall of tall posters with titles set over the artwork.',
    focus: 'Gallery',
    fit: 'Films, shows, covers, portraits and anything shot tall',
    bestFor: 'gallery',
    theme: 'dark',
    fonts: { display: 'Bebas Neue@400', body: 'DM Sans', meta: 'DM Sans' },
    colors: {
      dark: { bg: '#0a0c10', surface: '#141820', text: '#eef0f4', muted: '#98a0ae', line: '#232936', accent: '#ffc94d', onAccent: '#141006' },
      light: { bg: '#f8f7f3', surface: '#ffffff', text: '#15171c', muted: '#5f6673', line: '#e2e1d9', accent: '#8a5a00', onAccent: '#ffffff' },
    },
    hero: 'none',
    layout: 'posters',
    card: { radius: 8, title: 'overlay', hover: 'lift', meta: 'domain' },
    type: { case: 'uppercase', weight: 400, tracking: '0.01em', titleWeight: 600 },
    background: 'flat',
  },
  {
    key: 'pulse',
    name: 'Pulse',
    desc: 'A creator-channel grid on deep violet with glowing hover states.',
    focus: 'Creator',
    fit: 'Streams, gaming clips, music videos and creator drops',
    bestFor: 'video',
    theme: 'dark',
    fonts: { display: 'Space Grotesk', body: 'Space Grotesk', meta: 'JetBrains Mono' },
    colors: {
      dark: { bg: '#0b0816', surface: '#161226', text: '#f4f1ff', muted: '#aaa3c4', line: '#2a2442', accent: '#b6ff3c', onAccent: '#0d1400', glow: '#8b5cf6' },
      light: { bg: '#f6f4fb', surface: '#ffffff', text: '#130f24', muted: '#5d5678', line: '#e3deef', accent: '#6d28d9', onAccent: '#ffffff', glow: '#8b5cf6' },
    },
    hero: 'split',
    layout: 'grid',
    card: { radius: 14, title: 'below', hover: 'glow', meta: 'both' },
    type: { weight: 700, tracking: '-0.04em' },
    background: 'aurora',
  },
  {
    key: 'bento',
    name: 'Bento',
    desc: 'Rounded tiles in mixed sizes, each row packed edge to edge.',
    focus: 'Mixed media',
    fit: 'Portfolios, product drops and collections mixing video, images and articles',
    bestFor: 'mixed',
    theme: 'light',
    fonts: { display: 'Bricolage Grotesque', body: 'Inter', meta: 'Inter' },
    colors: {
      light: { bg: '#f1f1ee', surface: '#ffffff', text: '#101011', muted: '#5b5b60', line: '#e2e2dd', accent: '#2f54eb', onAccent: '#ffffff' },
      dark: { bg: '#09090b', surface: '#141416', text: '#fafafa', muted: '#a1a1aa', line: '#27272a', accent: '#8ea2ff', onAccent: '#0a0c1a' },
    },
    hero: 'none',
    layout: 'bento',
    card: { radius: 22, title: 'overlay', hover: 'lift', meta: 'kind' },
    type: { weight: 700, tracking: '-0.045em' },
    background: 'flat',
  },
  {
    key: 'glass',
    name: 'Glasshouse',
    desc: 'Frosted panels over a soft colour wash, with a featured story beside its picture.',
    focus: 'Showcase',
    fit: 'Launch pages, lookbooks and curated picks that should feel premium',
    bestFor: 'article',
    theme: 'dark',
    fonts: { display: 'Outfit', body: 'Manrope', meta: 'Manrope' },
    colors: {
      dark: { bg: '#070910', surface: '#121624', text: '#f2f5fb', muted: '#9ea7bd', line: '#262c40', accent: '#5eead4', onAccent: '#04201b', glow: '#3b82f6' },
      light: { bg: '#edf1f7', surface: '#ffffff', text: '#0e1220', muted: '#566078', line: '#d9dfea', accent: '#0f766e', onAccent: '#ffffff', glow: '#60a5fa' },
    },
    hero: 'split',
    layout: 'rails',
    card: { ratio: '4 / 3', radius: 18, title: 'below', hover: 'lift', meta: 'domain', surface: true },
    type: { weight: 600, tracking: '-0.035em' },
    background: 'aurora',
  },
  {
    key: 'queue',
    name: 'Queue',
    desc: 'A numbered watch-later list: small thumbnail, full title, one row each.',
    focus: 'Links',
    fit: 'Reading lists, playlists and link-heavy collections',
    bestFor: 'link',
    theme: 'dark',
    fonts: { display: 'Manrope', body: 'Manrope', meta: 'JetBrains Mono' },
    colors: {
      dark: { bg: '#0d0f10', surface: '#16191b', text: '#eef1f0', muted: '#9aa39f', line: '#242a28', accent: '#4ade80', onAccent: '#04130a' },
      light: { bg: '#f7f8f7', surface: '#ffffff', text: '#111413', muted: '#59625e', line: '#e0e4e2', accent: '#15803d', onAccent: '#ffffff' },
    },
    hero: 'none',
    layout: 'list',
    card: { ratio: '16 / 10', radius: 8, title: 'below', hover: 'ring', meta: 'both' },
    type: { weight: 700, tracking: '-0.03em' },
    background: 'flat',
  },
];

// =====================================================
// ENGINE
// =====================================================
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
const attr = esc;

// ---------- shared helpers ----------
// A failed thumbnail hides itself and flags its frame (.is-broken) so the
// template can show a fallback panel. The card stays: removing it would leave
// a hole in a planned grid row and drop the link from the page silently.
const BROKEN_IMG_ONERROR = `onerror="this.hidden=true;this.parentElement.classList.add('is-broken')"`;
function thumbImg(item, extraAttrs = '') {
  if (!item || !item.thumbnail) return '';
  return `<img src="${attr(item.thumbnail)}" alt="" loading="lazy" ${extraAttrs}/>`;
}

function itemKind(item) {
  if (!item) return 'link';
  if (item.category === 'video' || item.video) return 'video';
  if (item.category === 'gallery') return 'gallery';
  if (item.thumbnail) return 'article';
  return 'link';
}

function itemKindLabel(item) {
  const kind = itemKind(item);
  if (kind === 'video') return 'Video';
  if (kind === 'gallery') return 'Image';
  if (kind === 'article') return 'Article';
  return 'Link';
}

function mediaFrame(item, { className = 'media-frame', imageAttrs = '' } = {}) {
  if (!item || !item.thumbnail) return '';
  const kind = itemKind(item);
  return `<div class="${className} ${className}--${kind}">
    ${thumbImg(item, imageAttrs)}
    ${kind === 'video' ? `<span class="${className}__play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>` : ''}
  </div>`;
}

// ---------- balanced grids (issue #3 and every fixed-column grid) ----------
// A grid of N cards in C columns leaves an orphan row whenever N % C != 0. The
// fix here is editorial, not masonry (no grid-auto-flow: dense, which reorders
// cards): each grid declares the ROW SHAPES it allows, and planRows() picks a
// sequence of rows that holds exactly N cards, every row filled edge to edge.
//
//   A shape is { spans: [...], cost }. Spans are in grid-column units and must
//   sum to the grid's column count. Plain rows cost 0; promoted rows (a wide
//   feature card, a full-row hero) cost more, so they are used only as much as
//   needed to absorb the remainder. A one-card shape must exist so any N works.
//
//   Rows come out round-robin in the order shapes are declared, so promoted
//   rows lead and are spaced out between plain rows — the NYT / Guardian front:
//   Editorial, 7 cards  -> [hero] [1 1 1] [1 1 1]          (1 hero + 6)
//   Editorial, 11 cards -> [hero] [1 1 1] [hero] [1 1 1] [1 1 1]
//                          (2 heroes + 9, heroes at positions 1 and 5)
//
// Plans are made per breakpoint and handed to CSS as --s-lg / --s-md / --s-sm
// on each card; the grid's CSS picks the one for the current width.
function planRows(n, shapes) {
  const best = new Array(n + 1).fill(Infinity);
  const pick = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    shapes.forEach((shape, si) => {
      const k = shape.spans.length;
      if (k > i || best[i - k] === Infinity) return;
      const cost = best[i - k] + (shape.cost || 0);
      if (cost < best[i] - 1e-9) { best[i] = cost; pick[i] = si; }
    });
  }
  if (n > 0 && pick[n] === -1) throw new Error(`planRows: no shape sequence fits ${n} items`);
  const counts = shapes.map(() => 0);
  for (let i = n; i > 0; i -= shapes[pick[i]].spans.length) counts[pick[i]]++;
  const spans = [];
  while (spans.length < n) {
    shapes.forEach((shape, si) => {
      if (!counts[si]) return;
      counts[si]--;
      spans.push(...shape.spans);
    });
  }
  return spans;
}

// Common shape sets.
const SHAPES = {
  // C single cards, or one card promoted to a 2-column "wide" card per row.
  wideCards(cols) {
    const out = [{ spans: Array(cols).fill(1), cost: 0 }];
    if (cols === 1) return out;
    if (cols === 2) return [{ spans: [2], cost: 1 }, ...out];
    for (let wide = 1; wide <= Math.floor(cols / 2); wide++) {
      out.unshift({ spans: [...Array(wide).fill(2), ...Array(cols - 2 * wide).fill(1)], cost: wide });
    }
    // A lone card on a page still needs somewhere to go.
    out.push({ spans: [cols], cost: cols });
    return out;
  },
  // Editorial: C single cards, or one full-row hero (issue #3).
  heroRows(cols) {
    return cols === 1
      ? [{ spans: [1], cost: 0 }]
      : [{ spans: [cols], cost: 1 }, { spans: Array(cols).fill(1), cost: 0 }];
  },
};

function srcLabel(group) {
  return group.name || (group.items[0]?.domain) || 'Source';
}

function previewCoverage(group) {
  const preview = (group?.previewItems || []).length;
  const links = (group?.linkItems || []).length;
  const total = preview + links;
  if (!total) return 0;
  return Math.round((preview / total) * 100);
}

// Source filter bar — "All sources" plus one chip per source, shown at the top
// of every template. Clicking a chip hides every block that doesn't belong to
// that source, which is the point: a collection with a few hundred links is an
// unreadable single scroll otherwise.
//
// This CSS ships from shell(), not from the individual templates. It used to
// live in a constant that nothing referenced, so the tab markup and its click
// handler reached the page while the rules that hide the inactive content did
// not — the bar rendered, the buttons toggled classes, and nothing on the page
// changed. Keeping it in shell() means a template cannot forget it.
//
// Class names (.tab-nav / .tab-btn / .tab-btn__title / .tab-btn__meta) are the
// original ones so the per-theme overrides in each template still apply.
const SOURCE_FILTER_CSS = `
  .tab-shell { display: grid; gap: 24px; }
  .tab-panels { display: grid; gap: 24px; }
  .tab-nav {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 20px;
    padding: 12px 0;
    background: var(--tab-nav-bg, transparent);
  }
  .tab-btn {
    display: grid;
    gap: 3px;
    padding: 9px 15px;
    border: 1px solid var(--tab-border, rgba(128,128,128,0.45));
    border-radius: var(--lf-radius-full);
    background: var(--tab-bg, transparent);
    color: var(--tab-text, inherit);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
  }
  .tab-btn:hover { border-color: var(--tab-border-hover, currentColor); }
  .tab-btn.active {
    border-color: var(--tab-active-border, var(--tab-active-bg, currentColor));
    background: var(--tab-active-bg, currentColor);
    color: var(--tab-active-text, #fff);
  }
  .tab-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .tab-btn__title { font-size: 13px; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; }
  .tab-btn__meta { font-size: 9px; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.1em; color: var(--tab-meta, inherit); opacity: 0.75; }
  /* Templates set display:grid/flex on the blocks being filtered, which beats
     the UA's [hidden] rule on specificity — hence !important. */
  .lf-template [hidden] { display: none !important; }
  @media (max-width: 700px) {
    .tab-nav { gap: 6px; padding: 10px 0; }
    .tab-btn { padding: 8px 12px; }
    .tab-btn__title { font-size: 12px; }
  }
`;

// ---------- generated-output theme toggle (issue #2) ----------
// Generated pages used to ship a single fixed palette per template: there
// was no data-theme scoping anywhere in templates.js, so a theme toggle in
// the export had nothing to switch — cards and body could never restyle.
// The machinery now lives in shell(), next to the source-filter bar, for the
// same reason: a template cannot forget it.
//
// Contract:
//   - shell() stamps <html data-theme="…"> with the template's native theme
//     (dark-native templates: Creator Grid, Flux Index; light-native: Photo
//     Wall, Pop Shelf) and renders one toggle button + one small script on
//     every generated page.
//   - Each template's CSS carries a `:root[data-theme="…"]` block for the
//     OPPOSITE theme that reassigns its palette variables (plus overrides
//     for the hard-coded colors variables don't reach), so flipping the
//     attribute genuinely re-skins body, cards, headings and links.
//   - The script only flips the attribute. No localStorage: an export is a
//     standalone file the reader may open anywhere, and the issue's
//     validator explicitly ruled persistence out.
const THEME_TOGGLE_CSS = `
  :root[data-theme="dark"] { color-scheme: dark; }
  :root[data-theme="light"] { color-scheme: light; }
  .lf-theme-toggle {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 80;
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 9px 15px;
    border: 1px solid rgba(127, 127, 127, 0.5);
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.16);
    color: inherit;
    font: 600 12px/1 system-ui, -apple-system, sans-serif;
    letter-spacing: 0.02em;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .lf-theme-toggle:hover { border-color: currentColor; }
  /* Clearance so the floating toggle never sits on the page's last row. */
  body.lf-template { padding-bottom: 72px; }
  @media print { .lf-theme-toggle { display: none; } body.lf-template { padding-bottom: 0; } }
`;

const THEME_TOGGLE_BUTTON = `<button type="button" class="lf-theme-toggle" data-lf-theme-toggle aria-pressed="false" aria-label="Switch between dark and light theme"><span class="lf-theme-toggle__label">Theme</span></button>`;

function themeToggleScript() {
  return `<script>
  (function () {
    var btn = document.querySelector('[data-lf-theme-toggle]');
    if (!btn) return;
    var root = document.documentElement;
    function sync() {
      var dark = root.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      var label = btn.querySelector('.lf-theme-toggle__label');
      if (label) label.textContent = dark ? 'Light' : 'Dark';
    }
    btn.addEventListener('click', function () {
      root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      sync();
    });
    sync();
  })();
  </script>`;
}

function sourceFilterCount(group) {
  return (group?.previewItems || []).length + (group?.linkItems || []).length;
}

// The bar itself. Returns '' for a single-source page, where filtering to "the
// one source" and to "all" are the same view.
function sourceFilterNav(groups, prefix) {
  if (!groups || groups.length < 2) return '';
  const chip = (key, label, count, active) => `<button
      type="button"
      class="tab-btn${active ? ' active' : ''}"
      data-source-filter-key="${attr(key)}"
      aria-pressed="${active ? 'true' : 'false'}"
    >
      <span class="tab-btn__title">${esc(label)}</span>
      <span class="tab-btn__meta">${count} ${count === 1 ? 'item' : 'items'}</span>
    </button>`;
  const total = groups.reduce((sum, group) => sum + sourceFilterCount(group), 0);
  // "All" is the default so the page still reads as one whole collection on
  // open, and so the export degrades to today's behavior without JavaScript.
  return `<nav class="tab-nav" data-source-filter="${attr(prefix)}" aria-label="Filter by source">
    ${chip('all', 'All sources', total, true)}
    ${groups.map((group) => chip(group.key, srcLabel(group), sourceFilterCount(group), false)).join('')}
  </nav>`;
}

// Filtering contract for template markup:
//   data-source-key="<key>"  — a block belonging to exactly one source.
//   data-source-scope        — a wrapper (e.g. a "More links" section with its
//                              own heading) that should disappear when every
//                              keyed block inside it is hidden.
function sourceFilterScript(prefix) {
  return `<script>
  (function () {
    var nav = document.querySelector('[data-source-filter="${prefix}"]');
    if (!nav) return;
    var btns = Array.prototype.slice.call(nav.querySelectorAll('.tab-btn'));
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-source-key]'));
    var scopes = Array.prototype.slice.call(document.querySelectorAll('[data-source-scope]'));

    function apply(key) {
      targets.forEach(function (el) {
        el.hidden = key !== 'all' && el.getAttribute('data-source-key') !== key;
      });
      scopes.forEach(function (scope) {
        var kids = scope.querySelectorAll('[data-source-key]');
        var anyVisible = false;
        for (var i = 0; i < kids.length; i++) {
          if (!kids[i].hidden) { anyVisible = true; break; }
        }
        scope.hidden = kids.length > 0 && !anyVisible;
      });
      btns.forEach(function (btn) {
        var on = btn.getAttribute('data-source-filter-key') === key;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    btns.forEach(function (btn, index) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-source-filter-key'));
        // Filtering from halfway down a long page can leave the viewport past
        // the end of the now-shorter content, which reads as a blank screen.
        if (nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: 'start' });
      });
      btn.addEventListener('keydown', function (event) {
        var keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (keys.indexOf(event.key) === -1) return;
        event.preventDefault();
        var next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % btns.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + btns.length) % btns.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = btns.length - 1;
        btns[next].focus();
      });
    });
  })();
  </script>`;
}

// Items with a usable thumbnail get card treatment; items without get sent
// to the "More links" tail. We treat empty/falsy thumbnails as no-preview.
function hasPreview(item) {
  if (!item || !item.thumbnail) return false;
  const t = String(item.thumbnail).trim();
  return !!t;
}

// Split a flat item list into [withPreview, linkOnly] preserving order.
function splitItems(items) {
  const withPreview = [];
  const linkOnly = [];
  for (const it of items || []) {
    if (hasPreview(it)) withPreview.push(it);
    else linkOnly.push(it);
  }
  return { withPreview, linkOnly };
}

// Apply the split to every source group. Returns:
//   previewGroups: [{name, items}]  — only items that have a thumbnail
//   linkGroups:    [{name, items}]  — only items without a thumbnail
// Empty groups are dropped.
//
// Final-render guarantees (user spec):
//   1. No href appears more than once across the entire output.
//   2. If an item rendered as a preview card, it never also appears in
//      "More links" — even if a thinner duplicate of the same href exists
//      in another source group.
//   3. "More links" itself is href-deduped across groups.
function partitionGroups(sourceGroups, isPreview = hasPreview) {
  // Pass 1 — collect every href that will render as a preview card.
  const previewHrefs = new Set();
  for (const g of sourceGroups || []) {
    for (const it of g.items || []) {
      if (isPreview(it)) previewHrefs.add(it.href);
    }
  }
  // Pass 2 — build the two buckets, deduping each by href globally.
  const previewGroups = [];
  const linkGroups = [];
  const seenPreview = new Set();
  const seenLink = new Set();
  let sourceIndex = 0;
  for (const g of sourceGroups || []) {
    const key = g.key || `src-${sourceIndex}`;
    const withPreview = [];
    const linkOnly = [];
    for (const it of g.items || []) {
      if (isPreview(it)) {
        if (seenPreview.has(it.href)) continue;
        seenPreview.add(it.href);
        withPreview.push(it);
      } else {
        // If any source has a richer (thumb-bearing) version of this href,
        // the card already shows above — don't repeat it in More links.
        if (previewHrefs.has(it.href)) continue;
        if (seenLink.has(it.href)) continue;
        seenLink.add(it.href);
        linkOnly.push(it);
      }
    }
    if (withPreview.length) previewGroups.push({ key, sourceIndex, name: g.name, items: withPreview });
    if (linkOnly.length) linkGroups.push({ key, sourceIndex, name: g.name, items: linkOnly });
    sourceIndex += 1;
  }
  return { previewGroups, linkGroups };
}

function buildSourceTabs(sourceGroups) {
  const { previewGroups, linkGroups } = partitionGroups(sourceGroups);
  const tabs = [];
  const byKey = new Map();

  function ensure(group) {
    if (!byKey.has(group.key)) {
      const entry = {
        key: group.key,
        sourceIndex: group.sourceIndex,
        name: group.name,
        previewItems: [],
        linkItems: [],
      };
      byKey.set(group.key, entry);
      tabs.push(entry);
    }
    return byKey.get(group.key);
  }

  for (const group of previewGroups) ensure(group).previewItems = group.items;
  for (const group of linkGroups) ensure(group).linkItems = group.items;

  return tabs.filter((group) => group.previewItems.length || group.linkItems.length);
}

// Renders the filter bar plus one section per source, stacked. Every section
// is visible under "All sources"; picking a source hides the rest.
//
// This replaces a one-panel-at-a-time tab widget that could only ever show a
// single source — there was no way to see the whole collection, and the
// inactive panels were hidden with `max-height: 0`, which clipped rather than
// removed any source taller than the cap.
function renderSourceTabs(groups, renderPanel, { prefix = 'source-tabs', emptyHtml = '' } = {}) {
  if (!groups.length) return emptyHtml;

  const nav = sourceFilterNav(groups, prefix);
  const panels = `<div class="tab-panels">${groups.map((group, index) => `
    <section class="tab-panel" data-source-key="${attr(group.key)}" aria-label="${attr(srcLabel(group))}">
      ${renderPanel(group, index)}
    </section>
  `).join('')}</div>`;

  return `<div class="tab-shell" data-tab-shell="${prefix}">${nav}${panels}</div>${nav ? sourceFilterScript(prefix) : ''}`;
}

// Shared "More links" section. Same markup for every template — only the
// surrounding template's CSS styles it (each template scopes .more-links).
// Normalise ctx so we always have sourceGroups even if an older caller didn't pass it.
function normalize(ctx) {
  if (ctx.sourceGroups && ctx.sourceGroups.length) return ctx;
  const groups = new Map();
  for (const it of ctx.all || []) {
    const k = it.sourceName || it.domain || 'Source';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return { ...ctx, sourceGroups: Array.from(groups, ([name, items]) => ({ name, items })) };
}


// =====================================================
// LAYOUTS — the ways a source's cards can be arranged.
//   rail  horizontal, swipeable row (chunked so one source never makes one
//         endless strip)
//   list  one full-width row per card, numbered
//   grid  planned grid: each breakpoint declares its columns and the row
//         shapes it allows, and planRows() fills every row edge to edge.
//         `ar` is a fixed image ratio, or { perSpan: k } (ratio = span / k)
//         so cards of unequal width in one row share a height.
// =====================================================
const LAYOUTS = {
  rails: { kind: 'rail', chunk: 14 },
  list: { kind: 'list' },
  grid: {
    kind: 'grid',
    bps: {
      lg: { cols: 5, shapes: SHAPES.wideCards(5), ar: '16 / 9', variant: 'row' },
      md: { cols: 3, shapes: SHAPES.wideCards(3), ar: '16 / 9', variant: 'row' },
      sm: { cols: 2, shapes: SHAPES.wideCards(2), ar: '16 / 9', variant: 'row' },
    },
  },
  posters: {
    kind: 'grid',
    bps: {
      lg: { cols: 6, shapes: SHAPES.wideCards(6), ar: { perSpan: 1.5 } },
      md: { cols: 4, shapes: SHAPES.wideCards(4), ar: { perSpan: 1.5 } },
      sm: { cols: 2, shapes: SHAPES.wideCards(2), ar: { perSpan: 1.5 } },
    },
  },
  bento: {
    kind: 'grid',
    bps: {
      lg: { cols: 12, shapes: [{ spans: [7, 5], cost: 0 }, { spans: [4, 4, 4], cost: 0 }, { spans: [5, 7], cost: 0 }, { spans: [8, 4], cost: 0 }, { spans: [12], cost: 5 }], ar: { perSpan: 3 } },
      md: { cols: 2, shapes: SHAPES.wideCards(2), ar: { perSpan: 0.75 } },
      sm: { cols: 1, shapes: [{ spans: [1], cost: 0 }], ar: '16 / 10' },
    },
  },
};

const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

// Plan a grid for n cards: the grid's own style plus each card's classes and
// per-breakpoint span / ratio variables.
function planGrid(n, layout) {
  const bps = Object.entries(layout);
  const plans = bps.map(([bp, spec]) => [bp, spec, planRows(n, spec.shapes)]);
  const gridStyle = bps.map(([bp, spec]) => `--cols-${bp}:${spec.cols}`).join(';');
  const cards = Array.from({ length: n }, (_, i) => {
    const cls = [];
    const style = [];
    for (const [bp, spec, spans] of plans) {
      const s = spans[i];
      style.push(`--s-${bp}:${s}`);
      const ar = spec.ar && typeof spec.ar === 'object' ? `${s} / ${spec.ar.perSpan}` : spec.ar;
      if (ar) style.push(`--ar-${bp}:${ar}`);
      cls.push(`lf-${bp}-x${s}`);
      if (s > 1 && spec.variant) cls.push(`lf-${spec.variant}-${bp}`);
    }
    return { cls: cls.join(' '), style: style.join(';') };
  });
  return { gridStyle, cards };
}

// ---------- card parts ----------
// A card's video preview, when it is a file a <video> tag can play directly.
// Embeds and page URLs are destinations, not previews, and stay as the link.
function previewVideoSrc(item) {
  const src = item && item.video && (item.video.src || item.video.url);
  return src && /^https?:/i.test(src) && /\.(mp4|webm|ogg|ogv|mov|m4v)([?#]|$)/i.test(src) ? src : '';
}

// The preview sits over the thumbnail and loads nothing until the card is
// hovered or focused (preload="none"); see videoPreviewScript().
function previewVideo(item) {
  const src = previewVideoSrc(item);
  return src ? `<video class="lf-card__preview" data-lf-preview src="${attr(src)}" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video>` : '';
}

function metaText(item, group, mode) {
  const domain = item.domain || srcLabel(group);
  if (mode === 'none') return '';
  if (mode === 'kind') return itemKindLabel(item);
  if (mode === 'both') return `${itemKindLabel(item)} · ${domain}`;
  return domain;
}

function mediaHtml(item, inner = '') {
  const isVideo = itemKind(item) === 'video';
  const picture = item.thumbnail
    ? thumbImg(item, `decoding="async" ${BROKEN_IMG_ONERROR}`)
    : `<span class="lf-card__blank" aria-hidden="true">${esc((item.domain || item.title || '?').charAt(0).toUpperCase())}</span>`;
  return `<div class="lf-card__media">${picture}${previewVideo(item)}${
    isVideo ? `<span class="lf-card__play">${PLAY_ICON}</span>` : ''}${inner}</div>`;
}

function cardHtml(item, group, preset, plan = null, extraClass = '') {
  const overlay = preset.card.title === 'overlay';
  const meta = metaText(item, group, preset.card.meta);
  const body = `<div class="lf-card__body">
      <h3 class="lf-card__title">${esc(item.title || item.href)}</h3>
      ${meta ? `<span class="lf-card__meta">${esc(meta)}</span>` : ''}
    </div>`;
  const cls = ['lf-card', plan ? plan.cls : '', extraClass].filter(Boolean).join(' ');
  return `<a class="${cls}"${plan ? ` style="${plan.style}"` : ''} href="${attr(item.href)}" target="_blank" rel="noopener">
    ${mediaHtml(item, overlay ? body : '')}
    ${overlay ? '' : body}
  </a>`;
}

// ---------- layout renderers ----------
function renderItems(items, group, preset) {
  if (!items.length) return '';
  const layout = LAYOUTS[preset.layout] || LAYOUTS.grid;
  if (layout.kind === 'rail') {
    const rails = [];
    for (let i = 0; i < items.length; i += layout.chunk) rails.push(items.slice(i, i + layout.chunk));
    return rails.map((chunk, index) => `<div class="lf-rail-wrap">
      <button type="button" class="lf-rail__btn lf-rail__btn--prev" data-lf-rail-prev aria-label="Scroll ${attr(srcLabel(group))} back" hidden>‹</button>
      <div class="lf-rail" data-lf-rail role="list" aria-label="${attr(srcLabel(group))}${rails.length > 1 ? `, row ${index + 1}` : ''}">
        ${chunk.map((item) => `<div class="lf-rail__item" role="listitem">${cardHtml(item, group, preset)}</div>`).join('')}
      </div>
      <button type="button" class="lf-rail__btn lf-rail__btn--next" data-lf-rail-next aria-label="Scroll ${attr(srcLabel(group))} forward" hidden>›</button>
    </div>`).join('');
  }
  if (layout.kind === 'list') {
    return `<ol class="lf-list">${items.map((item, i) => {
      const meta = metaText(item, group, preset.card.meta);
      return `<li><a class="lf-row" href="${attr(item.href)}" target="_blank" rel="noopener">
        <span class="lf-row__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        ${mediaHtml(item)}
        <div class="lf-row__body">
          <h3 class="lf-card__title">${esc(item.title || item.href)}</h3>
          ${meta ? `<span class="lf-card__meta">${esc(meta)}</span>` : ''}
        </div>
        <span class="lf-row__go" aria-hidden="true">→</span>
      </a></li>`;
    }).join('')}</ol>`;
  }
  const { gridStyle, cards } = planGrid(items.length, layout.bps);
  return `<div class="lf-grid" data-lf-grid style="${gridStyle}">${items.map((item, i) => cardHtml(item, group, preset, cards[i])).join('')}</div>`;
}

function heroHtml(item, group, preset) {
  const kicker = itemKind(item) === 'video' ? 'Featured video' : 'Featured';
  return `<a class="lf-hero lf-hero--${preset.hero}" href="${attr(item.href)}" target="_blank" rel="noopener">
    ${mediaHtml(item)}
    <div class="lf-hero__copy">
      <span class="lf-hero__kicker">${kicker}</span>
      <h2 class="lf-hero__title">${esc(item.title || item.href)}</h2>
      <span class="lf-hero__meta">${esc(item.domain || srcLabel(group))}</span>
      <span class="lf-hero__cta">${itemKind(item) === 'video' ? `${PLAY_ICON}Watch` : 'Open'}</span>
    </div>
  </a>`;
}

function sectionHead(group) {
  const count = group.previewItems.length + group.linkItems.length;
  return `<header class="lf-section__head">
    <h2 class="lf-section__title">${esc(srcLabel(group))}</h2>
    <span class="lf-section__count">${count} ${count === 1 ? 'item' : 'items'}</span>
  </header>`;
}

// Items without a usable preview, still under their own source.
function linkTail(group) {
  if (!group.linkItems.length) return '';
  return `<div class="lf-links">
    <h3 class="lf-links__heading">More links</h3>
    <ul>${group.linkItems.map((item) => `<li><a href="${attr(item.href)}" target="_blank" rel="noopener">
      <span class="lf-links__title">${esc(item.title || item.href)}</span>
      ${item.domain ? `<span class="lf-links__domain">${esc(item.domain)}</span>` : ''}
    </a></li>`).join('')}</ul>
  </div>`;
}

// ---------- page scripts ----------
function videoPreviewScript() {
  return `<script>
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function hostOf(target) { return target && target.closest ? target.closest('.lf-card, .lf-hero, .lf-row') : null; }
  function start(e) {
    var host = hostOf(e.target);
    var video = host && host.querySelector('[data-lf-preview]');
    if (!video || host.classList.contains('is-previewing')) return;
    host.classList.add('is-previewing');
    var playing = video.play();
    if (playing && playing.catch) playing.catch(function () { host.classList.remove('is-previewing'); });
  }
  function stop(e) {
    var host = hostOf(e.target);
    if (!host || (e.relatedTarget && host.contains(e.relatedTarget))) return;
    var video = host.querySelector('[data-lf-preview]');
    if (!video) return;
    host.classList.remove('is-previewing');
    video.pause();
    try { video.currentTime = 0; } catch (err) {}
  }
  document.addEventListener('mouseover', start);
  document.addEventListener('focusin', start);
  document.addEventListener('mouseout', stop);
  document.addEventListener('focusout', stop);
})();
<\/script>`;
}

// Arrow buttons for rails: shown only while there is somewhere to scroll.
function railScript() {
  return `<script>
(function () {
  var wraps = document.querySelectorAll('.lf-rail-wrap');
  Array.prototype.forEach.call(wraps, function (wrap) {
    var rail = wrap.querySelector('[data-lf-rail]');
    var prev = wrap.querySelector('[data-lf-rail-prev]');
    var next = wrap.querySelector('[data-lf-rail-next]');
    if (!rail || !prev || !next) return;
    function sync() {
      var max = rail.scrollWidth - rail.clientWidth;
      prev.hidden = rail.scrollLeft <= 4;
      next.hidden = max <= 4 || rail.scrollLeft >= max - 4;
    }
    function move(dir) { rail.scrollBy({ left: dir * rail.clientWidth * 0.9, behavior: 'smooth' }); }
    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    rail.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });
})();
<\/script>`;
}

// ---------- preset -> CSS ----------
const FONT_FALLBACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const DEFAULT_WEIGHTS = '400;500;600;700';

// "Sora" -> all default weights; "Bebas Neue@400" -> only the pinned ones.
function fontSpec(entry) {
  const [family, weights] = String(entry || 'Inter').split('@');
  return { family: family.trim(), weights: (weights || DEFAULT_WEIGHTS).trim() };
}

function fontsHref(fonts) {
  const seen = new Map();
  for (const entry of Object.values(fonts || {})) {
    const spec = fontSpec(entry);
    if (!seen.has(spec.family)) seen.set(spec.family, spec.weights);
  }
  const families = [...seen].map(([family, weights]) => `family=${family.replace(/ /g, '+')}:wght@${weights}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// The seven colours a preset names, expanded to the tokens the CSS reads.
function themeTokens(c) {
  return {
    '--bg': c.bg,
    '--surface': c.surface,
    '--media': c.media || c.surface,
    '--ink': c.text,
    '--ink-2': c.muted,
    '--ink-3': c.faint || `color-mix(in srgb, ${c.muted} 78%, ${c.bg})`,
    '--line': c.line,
    '--line-strong': `color-mix(in srgb, ${c.text} 32%, ${c.bg})`,
    '--accent': c.accent,
    '--accent-ink': c.accentText || c.accent,
    '--on-accent': c.onAccent,
    '--glow': c.glow || c.accent,
  };
}

function themeBlocksCSS(colors) {
  const block = (name) => Object.entries(themeTokens(colors[name])).map(([k, v]) => `${k}: ${v};`).join(' ');
  return `
  :root[data-theme="light"] { ${block('light')} }
  :root[data-theme="dark"] { ${block('dark')} }`;
}

function isTall(ratio) {
  const m = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(ratio || '');
  return !!m && Number(m[1]) < Number(m[2]);
}

function presetVarsCSS(preset) {
  const fonts = preset.fonts || {};
  const type = preset.type || {};
  const card = preset.card || {};
  const stack = (entry) => `"${fontSpec(entry).family}", ${FONT_FALLBACK}`;
  return `
  .lf-ds {
    --font-display: ${stack(fonts.display || fonts.body)};
    --font-body: ${stack(fonts.body)};
    --font-meta: ${fonts.meta ? `"${fontSpec(fonts.meta).family}", ui-monospace, Menlo, monospace` : 'var(--font-body)'};
    --display-weight: ${type.weight || 700};
    --display-tracking: ${type.tracking || '-0.03em'};
    --display-case: ${type.case || 'none'};
    --title-weight: ${type.titleWeight || 600};
    --radius: ${Number.isFinite(card.radius) ? card.radius : 10}px;
    --card-ar: ${card.ratio || '16 / 9'};
    --rail-w: ${isTall(card.ratio) ? 'clamp(140px, 15vw, 210px)' : 'clamp(220px, 23vw, 330px)'};
  }`;
}

const BASE_CSS = `
  :root { --lf-radius-full: 999px; --ease-out: cubic-bezier(.2,.8,.2,1); --dur-fast: 150ms; --dur-base: 220ms; --dur-slow: 420ms; }
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin: 0; padding: 0; }
  body { overflow-x: clip; }
  img, video { display: block; max-width: 100%; }
  a { color: inherit; text-decoration: none; }
  .lf-template { text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  .lf-template h1, .lf-template h2, .lf-template h3 { text-wrap: balance; overflow-wrap: break-word; }
  .lf-template a:focus-visible, .lf-template button:focus-visible, .lf-template [tabindex]:focus-visible { outline: 2px solid var(--accent-ink, currentColor); outline-offset: 3px; border-radius: 4px; }
  .lf-template .tab-btn { min-height: 44px; }
`;

const DS_CSS = `
  .lf-ds {
    --gutter: clamp(16px, 3.4vw, 52px); --page-max: 1520px; --row-gap: 30px; --col-gap: 16px;
    --tab-nav-bg: color-mix(in srgb, var(--bg) 76%, transparent); --tab-border: var(--line); --tab-border-hover: var(--ink-3);
    --tab-text: var(--ink-2); --tab-active-bg: var(--accent); --tab-active-text: var(--on-accent);
    min-height: 100vh; background: var(--bg); color: var(--ink);
    font-family: var(--font-body); font-size: 15px; line-height: 1.5;
  }
  .lf-ds .lf-page { max-width: var(--page-max); margin: 0 auto; padding: clamp(20px, 3vw, 44px) var(--gutter) 48px; }

  /* Masthead */
  .lf-ds .lf-mast { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 18px; }
  .lf-ds .lf-mast h1 { margin: 0; font: var(--display-weight) clamp(34px, 5.4vw, 76px)/0.98 var(--font-display); letter-spacing: var(--display-tracking); text-transform: var(--display-case); }
  .lf-ds .lf-mast p { margin: 12px 0 0; max-width: 60ch; color: var(--ink-2); font-size: 15px; }
  .lf-ds .lf-mast__count { flex: none; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; font: 500 11px/1 var(--font-meta); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }

  /* Source filter: sticky, translucent, edge to edge */
  .lf-ds .tab-nav { margin: 0 calc(var(--gutter) * -1) 8px; padding: 12px var(--gutter); flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; backdrop-filter: saturate(160%) blur(16px); -webkit-backdrop-filter: saturate(160%) blur(16px); }
  .lf-ds .tab-nav::-webkit-scrollbar { display: none; }
  .lf-ds .tab-btn { flex: none; }
  .lf-ds .tab-btn__title { font-family: var(--font-body); }
  .lf-ds .tab-btn__meta { font-family: var(--font-meta); }
  /* Single-track grids must not grow to fit a rail's full scroll width. */
  .lf-ds .tab-shell, .lf-ds .tab-panels { grid-template-columns: minmax(0, 1fr); }
  .lf-ds .tab-panel { min-width: 0; }
  .lf-ds .tab-panels { gap: clamp(40px, 5vw, 72px); }
  .lf-ds .lf-section__head { display: flex; align-items: baseline; gap: 12px; margin: 0 0 16px; }
  .lf-ds .lf-section__title { margin: 0; min-width: 0; font: var(--display-weight) clamp(20px, 2vw, 28px)/1.1 var(--font-display); letter-spacing: var(--display-tracking); text-transform: var(--display-case); overflow-wrap: anywhere; }
  .lf-ds .lf-section__count { flex: none; font: 500 11px/1 var(--font-meta); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); font-variant-numeric: tabular-nums; }

  /* Card */
  .lf-ds .lf-card { display: flex; flex-direction: column; gap: 10px; min-width: 0; color: inherit; }
  .lf-ds .lf-card__media { position: relative; flex: none; aspect-ratio: var(--ar, var(--card-ar)); overflow: hidden; border-radius: var(--radius); background: var(--media); isolation: isolate; }
  .lf-ds .lf-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--dur-slow) var(--ease-out); }
  .lf-ds .lf-card__media.is-broken::after { content: "Preview unavailable"; position: absolute; inset: 0; display: grid; place-items: center; font: 500 10px/1 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .lf-ds .lf-card__blank { position: absolute; inset: 0; display: grid; place-items: center; font: var(--display-weight) 28px/1 var(--font-display); color: var(--ink-3); background: linear-gradient(135deg, var(--surface), var(--media)); }
  .lf-ds .lf-card__preview { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; object-fit: cover; opacity: 0; pointer-events: none; transition: opacity var(--dur-base) var(--ease-out); }
  .lf-ds .is-previewing .lf-card__preview { opacity: 1; }
  .lf-ds .lf-card__play { position: absolute; z-index: 2; left: 10px; top: 10px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 999px; background: rgba(6, 7, 10, .62); color: #fff; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .lf-ds .lf-card__play svg { width: 13px; height: 13px; margin-left: 1px; }
  .lf-ds .lf-card__body { display: grid; gap: 4px; min-width: 0; align-content: start; }
  .lf-ds .lf-card__title { margin: 0; font: var(--title-weight) 15px/1.3 var(--font-body); letter-spacing: -0.01em; color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; transition: color var(--dur-base) var(--ease-out); }
  .lf-ds .lf-card__meta { font: 500 11px/1.4 var(--font-meta); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Title over the artwork */
  .lf-ds.lf-title-overlay .lf-card__media .lf-card__body { position: absolute; z-index: 2; inset: auto 0 0 0; padding: 44px 14px 12px; background: linear-gradient(0deg, rgba(6,7,10,.9) 0%, rgba(6,7,10,.6) 48%, rgba(6,7,10,0) 100%); }
  .lf-ds.lf-title-overlay .lf-card__media .lf-card__title { color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.5); }
  .lf-ds.lf-title-overlay .lf-card__media .lf-card__meta { color: rgba(255,255,255,.78); }

  /* Card on a padded panel */
  .lf-ds.lf-surface .lf-card { padding: 10px 10px 14px; border: 1px solid var(--line); border-radius: calc(var(--radius) + 8px); background: color-mix(in srgb, var(--surface) 74%, transparent); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
  .lf-ds.lf-surface .lf-card__body { padding: 0 4px; }
  @media (prefers-reduced-transparency: reduce) { .lf-ds.lf-surface .lf-card { background: var(--surface); backdrop-filter: none; -webkit-backdrop-filter: none; } }

  /* Hover and focus treatments */
  @media (hover: hover) {
    .lf-ds .lf-card:hover .lf-card__title, .lf-ds .lf-row:hover .lf-card__title { color: var(--accent-ink); }
    .lf-ds.lf-title-overlay .lf-card:hover .lf-card__media .lf-card__title { color: #fff; }
    .lf-ds.lf-hover-zoom .lf-card:hover .lf-card__media img, .lf-ds.lf-hover-glow .lf-card:hover .lf-card__media img { transform: scale(1.06); }
    .lf-ds.lf-hover-zoom .lf-card__media, .lf-ds.lf-hover-glow .lf-card__media, .lf-ds.lf-hover-ring .lf-card__media { transition: box-shadow var(--dur-base) var(--ease-out); }
    .lf-ds.lf-hover-zoom .lf-card:hover .lf-card__media { box-shadow: 0 0 0 2px var(--ink), 0 18px 40px -18px rgba(0,0,0,.7); }
    .lf-ds.lf-hover-glow .lf-card:hover .lf-card__media { box-shadow: 0 0 0 1px var(--accent), 0 0 34px -4px var(--glow); }
    .lf-ds.lf-hover-ring .lf-card:hover .lf-card__media, .lf-ds.lf-hover-ring .lf-row:hover .lf-card__media { box-shadow: 0 0 0 2px var(--accent); }
    .lf-ds.lf-hover-lift .lf-card { transition: transform var(--dur-base) var(--ease-out); }
    .lf-ds.lf-hover-lift .lf-card:hover { transform: translateY(-4px); }
    .lf-ds.lf-hover-lift .lf-card:hover .lf-card__media { box-shadow: 0 22px 44px -22px rgba(0,0,0,.55); }
  }

  /* Planned grid: column counts and per-card spans come from planGrid(). */
  .lf-ds .lf-grid { display: grid; grid-template-columns: repeat(var(--cols-lg), minmax(0, 1fr)); gap: var(--row-gap) var(--col-gap); align-items: start; }
  .lf-ds .lf-grid > .lf-card { --s: var(--s-lg, 1); --ar: var(--ar-lg, 16 / 9); grid-column: span var(--s); }
  @media (max-width: 1100px) {
    .lf-ds .lf-grid { grid-template-columns: repeat(var(--cols-md), minmax(0, 1fr)); }
    .lf-ds .lf-grid > .lf-card { --s: var(--s-md, 1); --ar: var(--ar-md, 16 / 9); }
  }
  @media (max-width: 700px) {
    .lf-ds { --row-gap: 24px; --col-gap: 12px; }
    .lf-ds .lf-grid { grid-template-columns: repeat(var(--cols-sm), minmax(0, 1fr)); }
    .lf-ds .lf-grid > .lf-card { --s: var(--s-sm, 1); --ar: var(--ar-sm, 16 / 9); }
  }
  /* A promoted (two-column) card in a 16:9 grid: picture left, text right, so
     it stays level with its single neighbours. Scoped per breakpoint. */
  @media (min-width: 1101px) { .lf-ds .lf-card.lf-row-lg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--col-gap); align-items: center; } .lf-ds .lf-card.lf-row-lg .lf-card__title { font-size: 19px; -webkit-line-clamp: 4; } }
  @media (min-width: 701px) and (max-width: 1100px) { .lf-ds .lf-card.lf-row-md { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--col-gap); align-items: center; } .lf-ds .lf-card.lf-row-md .lf-card__title { font-size: 18px; -webkit-line-clamp: 4; } }
  @media (max-width: 700px) { .lf-ds .lf-card.lf-row-sm { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); column-gap: 12px; align-items: center; } .lf-ds .lf-card.lf-row-sm .lf-card__title { -webkit-line-clamp: 4; } }
  .lf-ds.lf-layout-bento .lf-grid { --row-gap: var(--col-gap); }
  /* Cards of unequal width in one row differ in height by a few pixels (the
     wider one also spans a gap). With the title on the picture there is no
     text below to hide it, so the pictures stretch to the row instead. */
  .lf-ds.lf-title-overlay .lf-grid { align-items: stretch; }
  .lf-ds.lf-title-overlay .lf-grid > .lf-card .lf-card__media { flex: 1 1 auto; }

  /* Rails */
  .lf-ds .lf-rail-wrap { position: relative; margin: 0 calc(var(--gutter) * -1); }
  .lf-ds .lf-rail-wrap + .lf-rail-wrap { margin-top: 18px; }
  .lf-ds .lf-rail { display: flex; gap: var(--col-gap); padding: 8px var(--gutter) 12px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; scroll-padding-inline: var(--gutter); scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .lf-ds .lf-rail::-webkit-scrollbar { display: none; }
  .lf-ds .lf-rail__item { flex: 0 0 var(--rail-w); min-width: 0; scroll-snap-align: start; }
  .lf-ds .lf-rail__btn { position: absolute; z-index: 5; top: 8px; width: clamp(34px, 3.4vw, 52px); aspect-ratio: auto; height: calc(var(--rail-w) * 0.5); display: grid; place-items: center; border: 0; background: color-mix(in srgb, var(--bg) 72%, transparent); color: var(--ink); font: 400 28px/1 var(--font-body); cursor: pointer; opacity: 0; transition: opacity var(--dur-base) var(--ease-out); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .lf-ds .lf-rail__btn--prev { left: 0; border-radius: 0 8px 8px 0; }
  .lf-ds .lf-rail__btn--next { right: 0; border-radius: 8px 0 0 8px; }
  .lf-ds .lf-rail-wrap:hover .lf-rail__btn, .lf-ds .lf-rail__btn:focus-visible { opacity: 1; }
  @media (hover: none) { .lf-ds .lf-rail__btn { display: none; } }

  /* List */
  .lf-ds .lf-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
  .lf-ds .lf-list li { border-bottom: 1px solid var(--line); }
  .lf-ds .lf-row { display: grid; grid-template-columns: 34px clamp(96px, 16vw, 176px) minmax(0, 1fr) auto; align-items: center; gap: clamp(10px, 1.6vw, 20px); padding: 12px 6px; border-radius: 10px; transition: background-color var(--dur-base) var(--ease-out); }
  .lf-ds .lf-row__num { font: 500 12px/1 var(--font-meta); color: var(--ink-3); font-variant-numeric: tabular-nums; text-align: right; }
  .lf-ds .lf-row__body { display: grid; gap: 5px; min-width: 0; }
  .lf-ds .lf-row .lf-card__title { font-size: clamp(15px, 1.4vw, 19px); -webkit-line-clamp: 3; }
  .lf-ds .lf-row__go { color: var(--ink-3); font-size: 18px; transition: transform var(--dur-base) var(--ease-out), color var(--dur-base) var(--ease-out); }
  @media (hover: hover) { .lf-ds .lf-row:hover { background: var(--surface); } .lf-ds .lf-row:hover .lf-row__go { transform: translateX(4px); color: var(--accent-ink); } }
  @media (max-width: 700px) { .lf-ds .lf-row { grid-template-columns: 22px 96px minmax(0, 1fr); padding: 10px 0; } .lf-ds .lf-row__go { display: none; } }

  /* Hero */
  .lf-ds .lf-hero { position: relative; display: block; margin-bottom: 28px; color: inherit; }
  .lf-ds .lf-hero .lf-card__media { --ar: 21 / 9; border-radius: calc(var(--radius) + 6px); }
  /* Leave room for the first row of cards under the billboard. */
  .lf-ds .lf-hero--billboard .lf-card__media { max-height: min(52vh, 560px); width: 100%; }
  .lf-ds .lf-hero .lf-card__play { display: none; }
  .lf-ds .lf-hero__kicker { font: 600 11px/1 var(--font-meta); letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink); }
  .lf-ds .lf-hero__title { margin: 10px 0 0; font: var(--display-weight) clamp(26px, 3.6vw, 54px)/1.04 var(--font-display); letter-spacing: var(--display-tracking); text-transform: var(--display-case); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .lf-ds .lf-hero__meta { display: block; margin-top: 10px; font: 500 12px/1.3 var(--font-meta); color: var(--ink-2); }
  .lf-ds .lf-hero__cta { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 11px 20px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font: 700 13px/1 var(--font-body); letter-spacing: .01em; }
  .lf-ds .lf-hero__cta svg { width: 13px; height: 13px; }
  .lf-ds .lf-hero--billboard .lf-card__media::after { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(6,7,10,.92) 0%, rgba(6,7,10,.62) 36%, rgba(6,7,10,0) 70%), linear-gradient(0deg, rgba(6,7,10,.6), rgba(6,7,10,0) 55%); }
  .lf-ds .lf-hero--billboard .lf-card__preview { z-index: 0; }
  .lf-ds .lf-hero--billboard .lf-hero__copy { position: absolute; z-index: 2; left: clamp(18px, 3.4vw, 52px); bottom: clamp(18px, 3.2vw, 48px); width: min(600px, 64%); color: #fff; }
  .lf-ds .lf-hero--billboard .lf-hero__kicker { color: #fff; opacity: .86; }
  .lf-ds .lf-hero--billboard .lf-hero__meta { color: rgba(255,255,255,.78); }
  .lf-ds .lf-hero--split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); align-items: center; gap: clamp(20px, 3vw, 48px); padding: clamp(16px, 2.4vw, 32px); border: 1px solid var(--line); border-radius: calc(var(--radius) + 14px); background: color-mix(in srgb, var(--surface) 78%, transparent); }
  .lf-ds .lf-hero--split .lf-card__media { order: 2; --ar: 16 / 9; border-radius: var(--radius); }
  @media (hover: hover) { .lf-ds .lf-hero:hover .lf-card__media img { transform: scale(1.03); } }
  @media (max-width: 1100px) { .lf-ds .lf-hero .lf-card__media { --ar: 16 / 9; } }
  @media (max-width: 700px) {
    .lf-ds .lf-hero--billboard .lf-card__media { --ar: 4 / 5; }
    .lf-ds .lf-hero--billboard .lf-card__media::after { background: linear-gradient(0deg, rgba(6,7,10,.94) 0%, rgba(6,7,10,.4) 58%, rgba(6,7,10,0) 100%); }
    .lf-ds .lf-hero--billboard .lf-hero__copy { width: calc(100% - 36px); }
    .lf-ds .lf-hero--split { grid-template-columns: 1fr; }
    .lf-ds .lf-hero--split .lf-card__media { order: 0; }
  }

  /* Link tail: items without a usable preview, still source-grouped. */
  .lf-ds .lf-links { margin-top: 26px; }
  .lf-ds .lf-links__heading { margin: 0 0 6px; font: 600 11px/1.2 var(--font-meta); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
  .lf-ds .lf-links ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); column-gap: 32px; }
  .lf-ds .lf-links li { min-width: 0; border-bottom: 1px solid var(--line); }
  .lf-ds .lf-links a { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 12px 0; min-width: 0; }
  .lf-ds .lf-links__title { min-width: 0; font-size: 14px; line-height: 1.4; color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .lf-ds .lf-links__domain { flex: none; font: 500 10px/1 var(--font-meta); color: var(--ink-3); }
  .lf-ds .lf-links a:hover .lf-links__title, .lf-ds .lf-links a:focus-visible .lf-links__title { color: var(--accent-ink); }
  .lf-ds .lf-empty { padding: 56px 20px; border-block: 1px solid var(--line); color: var(--ink-3); text-align: center; }

  /* Page backgrounds */
  .lf-ds.lf-bg-vignette::before, .lf-ds.lf-bg-aurora::before, .lf-ds.lf-bg-grid::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; }
  .lf-ds.lf-bg-vignette::before { background: radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%); }
  .lf-ds.lf-bg-aurora::before { background: radial-gradient(60% 50% at 12% 0%, color-mix(in srgb, var(--glow) 30%, transparent), transparent 70%), radial-gradient(50% 45% at 92% 12%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%); }
  .lf-ds.lf-bg-grid::before { background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 44px 44px; opacity: .45; }

  .lf-ds .lf-theme-toggle { border-color: var(--line-strong); background: color-mix(in srgb, var(--bg) 82%, transparent); color: var(--ink); }
  .lf-ds .lf-theme-toggle:hover { border-color: var(--accent-ink); color: var(--accent-ink); }
  @media (prefers-reduced-motion: reduce) {
    .lf-ds *, .lf-ds *::before, .lf-ds *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; scroll-behavior: auto !important; }
    .lf-ds .lf-card:hover, .lf-ds .lf-card:hover .lf-card__media img, .lf-ds .lf-hero:hover .lf-card__media img { transform: none !important; }
  }
`;

// ---------- the page ----------
function shell(preset, { title, tagline, body }) {
  const native = preset.theme === 'light' ? 'light' : 'dark';
  const card = preset.card || {};
  const bodyClasses = [
    'lf-template', 'lf-ds', `tpl-${preset.key}`, `lf-layout-${preset.layout}`,
    `lf-title-${card.title === 'overlay' ? 'overlay' : 'below'}`,
    `lf-hover-${card.hover || 'none'}`, `lf-bg-${preset.background || 'flat'}`,
    card.surface ? 'lf-surface' : '',
  ].filter(Boolean).join(' ');
  return `<!doctype html>
<html lang="en" data-theme="${native}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(tagline || '')}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${attr(fontsHref(preset.fonts))}" rel="stylesheet" />
<style>
${BASE_CSS}
${SOURCE_FILTER_CSS}
${themeBlocksCSS(preset.colors)}
${presetVarsCSS(preset)}
${DS_CSS}
${THEME_TOGGLE_CSS}
${preset.css || ''}
</style>
</head>
<body class="${bodyClasses}">
${body}
${THEME_TOGGLE_BUTTON}
${themeToggleScript()}
${body.includes('data-lf-preview') ? videoPreviewScript() : ''}
${body.includes('data-lf-rail') ? railScript() : ''}
</body>
</html>`;
}

function buildFromPreset(preset, ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const layout = LAYOUTS[preset.layout] || LAYOUTS.grid;
  const hero = preset.hero && preset.hero !== 'none'
    ? groups.find((g) => g.previewItems.length)?.previewItems[0] || null
    : null;
  const content = renderSourceTabs(groups, (group) => {
    const isHeroGroup = !!hero && group.previewItems[0] === hero;
    let items = isHeroGroup ? group.previewItems.slice(1) : group.previewItems;
    let tail = linkTail(group);
    // A list gives every item the same row, preview or not: no separate tail.
    if (layout.kind === 'list') { items = items.concat(group.linkItems); tail = ''; }
    return `${sectionHead(group)}${isHeroGroup ? heroHtml(hero, group, preset) : ''}
      ${renderItems(items, group, preset)}
      ${tail}`;
  }, { prefix: `${preset.key}-sources`, emptyHtml: '<div class="lf-empty">No cards selected.</div>' });
  const total = groups.reduce((sum, g) => sum + g.previewItems.length + g.linkItems.length, 0);
  const body = `<div class="lf-page">
    <header class="lf-mast">
      <div><h1>${esc(ctx.title)}</h1>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div>
      <span class="lf-mast__count">${total} ${total === 1 ? 'pick' : 'picks'}</span>
    </header>
    ${content}
  </div>`;
  return shell(preset, { title: ctx.title, tagline: ctx.tagline, body });
}

// ---------- picker preview, drawn from the preset itself ----------
function previewSvg(preset) {
  const c = preset.colors[preset.theme === 'light' ? 'light' : 'dark'];
  const r = Math.min(6, Math.round((preset.card?.radius ?? 10) / 3));
  const tile = (x, y, w, h, fill = c.surface, stroke = c.line) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`;
  let y = 22;
  let art = `<rect x="10" y="9" width="46" height="6" rx="1.5" fill="${c.text}"/><rect x="132" y="10" width="18" height="4" rx="2" fill="${c.accent}"/>`;
  if (preset.hero === 'billboard') {
    art += `${tile(10, y, 140, 30, c.surface)}<rect x="16" y="${y + 14}" width="44" height="4" rx="1" fill="${c.text}"/><rect x="16" y="${y + 21}" width="18" height="5" rx="2.5" fill="${c.accent}"/>`;
    y += 36;
  } else if (preset.hero === 'split') {
    art += `${tile(10, y, 140, 30, 'none')}<rect x="16" y="${y + 9}" width="40" height="4" rx="1" fill="${c.text}"/><rect x="16" y="${y + 17}" width="18" height="5" rx="2.5" fill="${c.accent}"/>${tile(78, y + 4, 66, 22, c.surface)}`;
    y += 36;
  }
  const room = 92 - y;
  const kind = (LAYOUTS[preset.layout] || LAYOUTS.grid).kind;
  if (kind === 'rail') {
    const h = Math.min(26, room - 8);
    for (let i = 0; i < 4; i++) art += tile(10 + i * 40, y, 36, h, i === 0 ? c.accent : c.surface);
    art += `<rect x="10" y="${y + h + 4}" width="26" height="3" rx="1" fill="${c.muted}"/><rect x="50" y="${y + h + 4}" width="22" height="3" rx="1" fill="${c.muted}"/>`;
  } else if (kind === 'list') {
    for (let i = 0; i < Math.floor(room / 15); i++) {
      const ry = y + i * 15;
      art += `${tile(18, ry, 22, 11, i === 0 ? c.accent : c.surface)}<rect x="46" y="${ry + 2}" width="${70 - i * 8}" height="3" rx="1" fill="${c.text}"/><rect x="46" y="${ry + 7}" width="30" height="2" rx="1" fill="${c.muted}"/><rect x="10" y="${ry + 4}" width="4" height="3" rx="1" fill="${c.muted}"/>`;
    }
  } else if (preset.layout === 'posters') {
    for (let i = 0; i < 6; i++) art += tile(10 + i * 23.6, y, 20.6, Math.min(room, 32), i === 1 ? c.accent : c.surface);
    if (room > 40) for (let i = 0; i < 6; i++) art += tile(10 + i * 23.6, y + 35, 20.6, room - 35, c.surface);
  } else if (preset.layout === 'bento') {
    const h = (room - 4) / 2;
    art += tile(10, y, 80, h, c.accent) + tile(94, y, 56, h) + tile(10, y + h + 4, 44, h) + tile(58, y + h + 4, 44, h) + tile(106, y + h + 4, 44, h);
  } else {
    const rows = room > 44 ? 2 : 1;
    const h = (room - (rows - 1) * 5) / rows - 6;
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < 4; i++) {
        const ry = y + row * (h + 11);
        art += `${tile(10 + i * 36, ry, 32, h, row === 0 && i === 0 ? c.accent : c.surface)}<rect x="${10 + i * 36}" y="${ry + h + 2.5}" width="22" height="2.5" rx="1" fill="${c.muted}"/>`;
      }
    }
  }
  return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="${c.bg}"/>${art}</svg>`;
}

// ---------- registry ----------
const TEMPLATES = Object.fromEntries(PRESETS.map((preset) => [preset.key, {
  name: preset.name,
  desc: preset.desc,
  focus: preset.focus,
  fit: preset.fit,
  featured: !!preset.featured,
  preset,
  preview: () => previewSvg(preset),
  build: (ctx) => buildFromPreset(preset, normalize(ctx)),
}]));

// Suggest the first preset that declares itself best for what the collection
// mostly is. Driven by each preset's `bestFor`, so new presets take part
// without touching this function.
function suggestTemplate(counts) {
  const t = counts.total || 1;
  let want = 'mixed';
  if ((counts.gallery || 0) / t >= 0.4) want = 'gallery';
  else if ((counts.video || 0) / t >= 0.3) want = 'video';
  else if ((counts.link || 0) / t >= 0.5) want = 'link';
  else if ((counts.article || 0) / t >= 0.55) want = 'article';
  const match = PRESETS.find((p) => p.bestFor === want) || PRESETS.find((p) => p.featured) || PRESETS[0];
  return match.key;
}

// ---------- expose ----------
if (typeof window !== 'undefined') {
  window.LINKFORGE_TEMPLATES = TEMPLATES;
  window.LINKFORGE_SUGGEST = suggestTemplate;
  window.LINKFORGE_SUGGEST_TEMPLATE = suggestTemplate;
}
if (typeof module !== 'undefined') {
  module.exports = { TEMPLATES, PRESETS, LAYOUTS, suggestTemplate, splitItems, partitionGroups, planRows, planGrid, SHAPES, fontsHref };
}
