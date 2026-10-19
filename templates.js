/* =====================================================
   LINKFORGE — output templates (v3: simplified + "More links" tail)

   Each template is a self-contained function:
     buildXxx(ctx) -> { html: string }
   ctx = { title, tagline, sourceGroups, all, today, articles, videos, gallery, links }

   Rules:
   1. Group strictly by source — never mix sources in one section.
   2. The top of every template renders ONLY items with a resolved thumbnail.
   3. Items without a thumbnail are pushed to a single "More links" section
      at the bottom of the page, grouped by source, as plain text links.
   4. No oversized text-over-image overlays — they break on long titles and
      look wrong without a real photo behind them.
   ===================================================== */

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

function smartLinksSection(linkGroups, { heading = 'More links' } = {}) {
  if (!linkGroups || !linkGroups.length) return '';
  const blocks = linkGroups.map((g) => {
    const lis = g.items.map((i) => `<li>
      <a href="${attr(i.href)}" target="_blank" rel="noopener">
        <span class="smart-links__title">${esc(i.title || i.href)}</span>
        <span class="smart-links__meta">
          ${i.domain ? `<span class="smart-links__domain">${esc(i.domain)}</span>` : ''}
        </span>
      </a>
    </li>`).join('');
    return `<section class="smart-links__group">
      <div class="smart-links__src">${esc(srcLabel(g))}</div>
      <ul class="smart-links__list">${lis}</ul>
    </section>`;
  }).join('');
  return `<section class="smart-links">
    <div class="smart-links__header">
      <h2 class="smart-links__heading">${esc(heading)}</h2>
      <p class="smart-links__desc">Links without usable previews stay readable and source-grouped.</p>
    </div>
    <div class="smart-links__grid">${blocks}</div>
  </section>`;
}

function tabLinksSection(group, heading = 'More from this source') {
  if (!group.linkItems || !group.linkItems.length) return '';
  return smartLinksSection([{ name: 'Saved links', items: group.linkItems }], { heading });
}

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
  .tab-btn__title { font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 13px; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; }
  .tab-btn__meta { font-family: 'IBM Plex Mono', monospace; font-size: 9px; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.1em; color: var(--tab-meta, inherit); opacity: 0.75; }
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
function moreLinksSection(linkGroups, { heading = 'More links' } = {}) {
  if (!linkGroups || !linkGroups.length) return '';
  const blocks = linkGroups.map((g) => {
    const lis = g.items.map((i) => `<li><a href="${attr(i.href)}" target="_blank" rel="noopener">${esc(i.title || i.href)}</a>${i.domain ? `<span class="more-links__domain">${esc(i.domain)}</span>` : ''}</li>`).join('');
    return `<div class="more-links__group">
      <div class="more-links__src">${esc(srcLabel(g))}</div>
      <ul class="more-links__list">${lis}</ul>
    </div>`;
  }).join('');
  return `<section class="more-links">
    <h2 class="more-links__heading">${esc(heading)}</h2>
    <div class="more-links__grid">${blocks}</div>
  </section>`;
}

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

// ---------- preview swatch generator ----------
function previewSvg(layout) {
  const layouts = {
    editorial: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" rx="14" fill="#faf8f2"/><rect x="10" y="10" width="84" height="46" rx="8" fill="#111827"/><rect x="100" y="10" width="50" height="22" rx="8" fill="#f59e0b"/><rect x="100" y="36" width="50" height="20" rx="8" fill="#ddd6fe"/><rect x="10" y="62" width="46" height="28" rx="8" fill="#ffffff" stroke="#d6d3d1"/><rect x="60" y="62" width="46" height="28" rx="8" fill="#ffffff" stroke="#d6d3d1"/><rect x="110" y="62" width="40" height="28" rx="8" fill="#ffffff" stroke="#d6d3d1"/></svg>`,
    stream: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><rect x="10" y="8" width="30" height="5" rx="1" fill="#18181b"/><rect x="10" y="20" width="42" height="28" rx="3" fill="#06b6d4"/><rect x="60" y="20" width="42" height="28" rx="3" fill="#a3e635"/><rect x="110" y="20" width="40" height="28" rx="3" fill="#f59e0b"/><rect x="10" y="58" width="30" height="4" rx="1" fill="#18181b"/><rect x="10" y="68" width="60" height="3" rx="1" fill="#999"/><rect x="10" y="75" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="68" width="60" height="3" rx="1" fill="#999"/><rect x="80" y="75" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    console: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0b0d10"/><rect x="8" y="8" width="50" height="4" rx="1" fill="#61dafb"/><rect x="8" y="18" width="80" height="3" rx="1" fill="#5c6370"/><rect x="8" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="50" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="58" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="66" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="74" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="82" width="60" height="3" rx="1" fill="#5c6370"/></svg>`,
    wall: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafafa"/><rect x="8" y="6" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="14" width="34" height="34" rx="3" fill="#dc2626"/><rect x="46" y="14" width="34" height="34" rx="3" fill="#7c3aed"/><rect x="84" y="14" width="34" height="34" rx="3" fill="#06b6d4"/><rect x="122" y="14" width="30" height="34" rx="3" fill="#f59e0b"/><rect x="8" y="56" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="71" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="80" y="71" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    timeline: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><line x1="22" y1="15" x2="22" y2="95" stroke="#e5e5e5" stroke-width="1"/><circle cx="22" cy="22" r="4" fill="#111"/><rect x="32" y="18" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="28" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="40" width="110" height="10" rx="2" fill="#f4f4f5"/><circle cx="22" cy="58" r="4" fill="#111"/><rect x="32" y="54" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="64" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="71" width="110" height="3" rx="1" fill="#bbb"/><rect x="32" y="78" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="85" width="110" height="3" rx="1" fill="#bbb"/></svg>`,
    broadsheet: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fbfaf5"/><rect x="8" y="8" width="144" height="6" rx="1" fill="#111827"/><rect x="8" y="20" width="68" height="44" rx="2" fill="#d6d3d1"/><rect x="82" y="20" width="70" height="5" rx="1" fill="#111827"/><rect x="82" y="30" width="70" height="3" rx="1" fill="#6b7280"/><rect x="82" y="38" width="70" height="3" rx="1" fill="#9ca3af"/><rect x="82" y="46" width="70" height="3" rx="1" fill="#9ca3af"/><line x1="8" y1="72" x2="152" y2="72" stroke="#111827" stroke-width="1"/><rect x="8" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="56" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="104" y="78" width="40" height="3" rx="1" fill="#111827"/></svg>`,
    signal: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#09111f"/><rect x="8" y="8" width="34" height="84" rx="6" fill="#0f1c34"/><rect x="50" y="8" width="102" height="20" rx="6" fill="#16233d"/><rect x="56" y="14" width="34" height="4" rx="1" fill="#f1f5f9"/><rect x="50" y="34" width="102" height="24" rx="6" fill="#16233d"/><rect x="50" y="64" width="102" height="24" rx="6" fill="#16233d"/><circle cx="64" cy="46" r="4" fill="#38bdf8"/><circle cx="64" cy="76" r="4" fill="#f97316"/><rect x="74" y="43" width="52" height="3" rx="1" fill="#f1f5f9"/><rect x="74" y="73" width="52" height="3" rx="1" fill="#f1f5f9"/></svg>`,
    flux: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#090d0f"/><rect x="9" y="10" width="48" height="8" fill="#edf5f4"/><rect x="9" y="23" width="29" height="3" fill="#86f4d3"/><rect x="9" y="36" width="66" height="29" rx="3" fill="#172327"/><rect x="80" y="36" width="34" height="29" rx="3" fill="#bce7f5"/><rect x="119" y="36" width="32" height="29" rx="3" fill="#24363c"/><rect x="9" y="71" width="43" height="18" rx="3" fill="#162025"/><rect x="57" y="71" width="43" height="18" rx="3" fill="#162025"/><rect x="105" y="71" width="46" height="18" rx="3" fill="#162025"/></svg>`,
    shelf: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#f7f8f8"/><rect x="8" y="9" width="36" height="5" fill="#1b2428"/><rect x="8" y="27" width="38" height="25" rx="3" fill="#dfe7ea"/><rect x="51" y="18" width="64" height="34" rx="3" fill="#bde5f4"/><rect x="120" y="18" width="32" height="34" rx="3" fill="#263843"/><rect x="8" y="58" width="47" height="33" rx="3" fill="#9ebbd6"/><rect x="60" y="58" width="38" height="33" rx="3" fill="#e6e8e9"/><rect x="103" y="58" width="49" height="33" rx="3" fill="#d9d4eb"/></svg>`,
  };
  layouts.front = `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#faf8f3"/><rect x="40" y="7" width="80" height="7" rx="1" fill="#121212"/><line x1="8" y1="18" x2="152" y2="18" stroke="#121212"/><rect x="8" y="24" width="88" height="34" fill="#cfc6b6"/><rect x="102" y="26" width="50" height="5" rx="1" fill="#121212"/><rect x="102" y="35" width="44" height="5" rx="1" fill="#121212"/><rect x="102" y="46" width="40" height="3" rx="1" fill="#8a8478"/><rect x="8" y="64" width="44" height="22" fill="#e1d9cb"/><rect x="58" y="64" width="44" height="22" fill="#e1d9cb"/><rect x="108" y="64" width="44" height="22" fill="#e1d9cb"/><rect x="8" y="90" width="36" height="3" rx="1" fill="#121212"/><rect x="58" y="90" width="36" height="3" rx="1" fill="#121212"/><rect x="108" y="90" width="36" height="3" rx="1" fill="#121212"/></svg>`;
  layouts.reading = `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fbfbf9"/><rect x="34" y="8" width="60" height="7" rx="1" fill="#1b1b1a"/><rect x="34" y="19" width="40" height="3" rx="1" fill="#3451c6"/><g fill="#1b1b1a"><rect x="34" y="32" width="70" height="4" rx="1"/><rect x="34" y="50" width="62" height="4" rx="1"/><rect x="34" y="68" width="74" height="4" rx="1"/><rect x="34" y="86" width="58" height="4" rx="1"/></g><g fill="#9a9994"><rect x="34" y="39" width="30" height="2" rx="1"/><rect x="34" y="57" width="26" height="2" rx="1"/><rect x="34" y="75" width="34" height="2" rx="1"/></g><rect x="110" y="30" width="16" height="12" rx="1" fill="#d9d8d2"/><rect x="110" y="66" width="16" height="12" rx="1" fill="#d9d8d2"/><g stroke="#e6e5e0"><line x1="34" y1="45" x2="126" y2="45"/><line x1="34" y1="63" x2="126" y2="63"/><line x1="34" y1="81" x2="126" y2="81"/></g></svg>`;
  layouts.mosaic = `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0d0d0f"/><rect x="8" y="7" width="58" height="10" fill="#f5f5f2"/><rect x="70" y="7" width="22" height="10" fill="#ffd23f"/><rect x="8" y="24" width="96" height="40" fill="#e63b2e"/><rect x="106" y="24" width="46" height="40" fill="#3b5bdb"/><rect x="8" y="66" width="46" height="26" fill="#17171a"/><rect x="56" y="66" width="47" height="26" fill="#ffd23f"/><rect x="105" y="66" width="47" height="26" fill="#2bb673"/></svg>`;
  return layouts[layout] || layouts.stream;
}

// =====================================================
// LINKFORGE DESIGN SYSTEM (WS4)
// Every registered template is a SKIN on one shared system:
//   - scales: type (--t-*), spacing (--space-*, --gutter), radii
//   - theme contract: each template supplies a light and a dark palette over
//     the same token names (THEME_TOKENS); shell() scopes them to
//     :root[data-theme], which the export's toggle flips (issue #2)
//   - components: page, section head, planned grid, card (+ wide-row and
//     hero variants), link tail — markup from the lf* helpers below, so a
//     template only decides layout, palette and typographic voice.
// =====================================================

// Token names every palette must define. Templates may add their own
// (e.g. legacy --paper / --flux-bg aliases, scrims) on top.
const THEME_TOKENS = [
  '--bg', '--surface', '--media', '--ink', '--ink-2', '--ink-3',
  '--line', '--line-strong', '--accent', '--accent-ink', '--on-accent',
];

function themeBlocksCSS(themes) {
  if (!themes) return '';
  const block = (name) => Object.entries(themes[name]).map(([k, v]) => `${k}: ${v};`).join(' ');
  return `
  :root[data-theme="light"] { ${block('light')} }
  :root[data-theme="dark"] { ${block('dark')} }`;
}

const DS_CSS = `
  .lf-ds {
    --gutter: clamp(16px, 3.2vw, 48px);
    --page-max: 1440px;
    --t-2xs: 10px; --t-xs: 11px; --t-sm: 13px; --t-base: 15px; --t-md: 17px;
    --t-lg: clamp(18px, 1.35vw, 21px); --t-xl: clamp(21px, 1.9vw, 27px);
    --t-2xl: clamp(26px, 3vw, 40px); --t-3xl: clamp(34px, 4.8vw, 64px);
    --t-display: clamp(44px, 8vw, 112px);
    --font-body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-display: var(--font-body);
    --font-serif: "Fraunces", Georgia, "Times New Roman", serif;
    --font-meta: "IBM Plex Mono", ui-monospace, Menlo, monospace;
    --radius-media: 6px;
    --row-gap: 32px; --col-gap: 16px; --card-gap: 12px;
    --title-font: var(--font-body); --title-size: var(--t-base); --title-weight: 600;
    --title-lh: 1.3; --title-tracking: -0.01em; --title-clamp: 3;
    --tab-nav-bg: var(--bg); --tab-border: var(--line); --tab-border-hover: var(--ink-3);
    --tab-text: var(--ink-2); --tab-active-bg: var(--ink); --tab-active-text: var(--bg);
    --lf-focus-color: var(--accent-ink);
    background: var(--bg); color: var(--ink);
    font-family: var(--font-body); font-size: var(--t-base); line-height: 1.5;
  }
  .lf-ds .lf-page { max-width: var(--page-max); margin: 0 auto; padding: clamp(20px, 3vw, 40px) var(--gutter) 48px; }
  .lf-ds .tab-panels { gap: clamp(48px, 6vw, 88px); }
  .lf-ds .lf-section__head { display: flex; align-items: baseline; gap: 12px; margin: 0 0 20px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .lf-ds .lf-section__title { margin: 0; min-width: 0; font: 600 var(--t-xs)/1.25 var(--font-meta); letter-spacing: .12em; text-transform: uppercase; color: var(--ink); overflow-wrap: anywhere; }
  .lf-ds .lf-section__count { margin-left: auto; flex: none; font: 400 var(--t-xs)/1 var(--font-meta); color: var(--ink-3); font-variant-numeric: tabular-nums; }

  /* Planned grid: column counts and per-card spans come from planGrid(). */
  .lf-ds .lf-grid { display: grid; grid-template-columns: repeat(var(--cols-lg), minmax(0, 1fr)); gap: var(--row-gap) var(--col-gap); align-items: start; }
  .lf-ds .lf-card { --s: var(--s-lg, 1); --ar: var(--ar-lg, 16 / 10); grid-column: span var(--s); display: flex; flex-direction: column; gap: var(--card-gap); min-width: 0; color: inherit; }
  @media (max-width: 1100px) {
    .lf-ds .lf-grid { grid-template-columns: repeat(var(--cols-md), minmax(0, 1fr)); }
    .lf-ds .lf-card { --s: var(--s-md, 1); --ar: var(--ar-md, 16 / 10); }
  }
  @media (max-width: 700px) {
    .lf-ds { --row-gap: 26px; }
    .lf-ds .lf-grid { grid-template-columns: repeat(var(--cols-sm), minmax(0, 1fr)); }
    .lf-ds .lf-card { --s: var(--s-sm, 1); --ar: var(--ar-sm, 16 / 10); }
  }
  .lf-ds .lf-card__media { position: relative; flex: none; aspect-ratio: var(--ar); overflow: hidden; border-radius: var(--radius-media); background: var(--media); }
  .lf-ds .lf-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--dur-slow) var(--ease-out); }
  .lf-ds .lf-card:hover .lf-card__media img { transform: scale(1.03); }
  .lf-ds .lf-card__media.is-broken::after { content: "Preview unavailable"; position: absolute; inset: 0; display: grid; place-items: center; font: 400 var(--t-2xs)/1 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .lf-ds .lf-card__play { position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px 5px 7px; border-radius: 999px; background: rgba(0, 0, 0, .64); color: #fff; font: 600 var(--t-2xs)/1 var(--font-meta); letter-spacing: .08em; text-transform: uppercase; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .lf-ds .lf-card__play svg { width: 11px; height: 11px; }
  .lf-ds .lf-card__body { display: grid; gap: 6px; min-width: 0; align-content: start; }
  .lf-ds .lf-card__kicker { font: 600 var(--t-2xs)/1.2 var(--font-meta); letter-spacing: .12em; text-transform: uppercase; color: var(--accent-ink); }
  .lf-ds .lf-card__title { margin: 0; font-family: var(--title-font); font-size: var(--title-size); font-weight: var(--title-weight); line-height: var(--title-lh); letter-spacing: var(--title-tracking); color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--title-clamp); overflow: hidden; transition: color var(--dur-base) var(--ease-out); }
  .lf-ds .lf-card:hover .lf-card__title, .lf-ds .lf-card:focus-visible .lf-card__title { color: var(--accent-ink); }
  .lf-ds .lf-card__meta { font: 400 var(--t-xs)/1.4 var(--font-meta); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Wide-row card (a promoted card in a wideCards grid): image left, text
     right, same height as its single neighbours so the row stays level. */
  /* Each variant is scoped to its own width range: a card carries classes for
     every breakpoint, and is only wide at the ones its plan promoted it. */
  @media (min-width: 1101px) { .lf-ds .lf-card.lf-row-lg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--col-gap); } .lf-ds .lf-card.lf-row-lg .lf-card__body { --title-size: var(--t-md); --title-clamp: 4; } }
  @media (min-width: 701px) and (max-width: 1100px) { .lf-ds .lf-card.lf-row-md { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--col-gap); } .lf-ds .lf-card.lf-row-md .lf-card__body { --title-size: var(--t-md); --title-clamp: 4; } }
  @media (max-width: 700px) { .lf-ds .lf-card.lf-row-sm { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); column-gap: 12px; } .lf-ds .lf-card.lf-row-sm .lf-card__body { --title-clamp: 4; } }

  /* Hero card (a full-row promotion in a heroRows grid, issue #3). */
  @media (min-width: 1101px) { .lf-ds .lf-card.lf-hero-lg { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); column-gap: clamp(20px, 2.4vw, 36px); align-items: center; } .lf-ds .lf-card.lf-hero-lg .lf-card__media { --ar: 16 / 9; } .lf-ds .lf-card.lf-hero-lg .lf-card__body { --title-size: var(--t-2xl); --title-lh: 1.12; --title-clamp: 5; gap: 12px; } }
  @media (min-width: 701px) and (max-width: 1100px) { .lf-ds .lf-card.lf-hero-md { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); column-gap: 24px; align-items: center; } .lf-ds .lf-card.lf-hero-md .lf-card__body { --title-size: var(--t-xl); --title-lh: 1.15; --title-clamp: 5; } }

  /* Link tail: items without a usable preview, still source-grouped. */
  .lf-ds .lf-links { margin-top: 28px; }
  .lf-ds .lf-links__heading { margin: 0 0 6px; font: 600 var(--t-2xs)/1.2 var(--font-meta); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
  .lf-ds .lf-links ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); column-gap: 32px; }
  .lf-ds .lf-links li { min-width: 0; border-bottom: 1px solid var(--line); }
  .lf-ds .lf-links a { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 12px 0; min-width: 0; }
  .lf-ds .lf-links__title { min-width: 0; font-size: var(--t-sm); line-height: 1.4; color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .lf-ds .lf-links__domain { flex: none; font: 400 var(--t-2xs)/1 var(--font-meta); color: var(--ink-3); }
  .lf-ds .lf-links a:hover .lf-links__title, .lf-ds .lf-links a:focus-visible .lf-links__title { color: var(--accent-ink); }
  .lf-ds .lf-empty { padding: 56px 20px; border-block: 1px solid var(--line); color: var(--ink-3); text-align: center; }
  .lf-ds .lf-theme-toggle { border-color: var(--line-strong); background: color-mix(in srgb, var(--bg) 82%, transparent); color: var(--ink); }
  .lf-ds .lf-theme-toggle:hover { border-color: var(--accent-ink); color: var(--accent-ink); }
`;

const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

// Plan a grid for n cards. `layout` maps breakpoint -> {
//   cols,                  grid columns at that width
//   shapes,                allowed row shapes (see planRows)
//   ar: '16 / 9' | { perSpan: k }   fixed media ratio, or span / k so a
//                          row of unequal spans shares one image height
//   variant: 'row' | 'hero'   inner layout for promoted (span > 1) cards
// }. Returns the grid's own style plus each card's classes and style.
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

function lfMedia(item, { play = true } = {}) {
  const isVideo = itemKind(item) === 'video';
  return `<div class="lf-card__media">${thumbImg(item, `decoding="async" ${BROKEN_IMG_ONERROR}`)}${
    play && isVideo ? `<span class="lf-card__play">${PLAY_ICON}Video</span>` : ''}</div>`;
}

function lfCard(item, plan, { kicker = '', meta = '', extraClass = '', play = true } = {}) {
  return `<a class="lf-card ${plan.cls}${extraClass ? ' ' + extraClass : ''}" style="${plan.style}" href="${attr(item.href)}" target="_blank" rel="noopener">
    ${lfMedia(item, { play })}
    <div class="lf-card__body">
      ${kicker ? `<span class="lf-card__kicker">${esc(kicker)}</span>` : ''}
      <h3 class="lf-card__title">${esc(item.title || item.href)}</h3>
      ${meta ? `<span class="lf-card__meta">${esc(meta)}</span>` : ''}
    </div>
  </a>`;
}

function lfGrid(items, layout, renderCard) {
  if (!items.length) return '';
  const { gridStyle, cards } = planGrid(items.length, layout);
  return `<div class="lf-grid" data-lf-grid style="${gridStyle}">${items.map((item, i) => renderCard(item, cards[i], i)).join('')}</div>`;
}

function lfSectionHead(group, label = 'items') {
  const count = (group.previewItems || []).length + (group.linkItems || []).length;
  return `<header class="lf-section__head">
    <h2 class="lf-section__title">${esc(srcLabel(group))}</h2>
    <span class="lf-section__count">${count} ${count === 1 ? label.replace(/s$/, '') : label}</span>
  </header>`;
}

function lfLinks(group, heading = 'More links') {
  if (!group.linkItems || !group.linkItems.length) return '';
  return `<div class="lf-links">
    <h3 class="lf-links__heading">${esc(heading)}</h3>
    <ul>${group.linkItems.map((item) => `<li><a href="${attr(item.href)}" target="_blank" rel="noopener">
      <span class="lf-links__title">${esc(item.title || item.href)}</span>
      ${item.domain ? `<span class="lf-links__domain">${esc(item.domain)}</span>` : ''}
    </a></li>`).join('')}</ul>
  </div>`;
}

function totalItems(groups) {
  return groups.reduce((sum, g) => sum + (g.previewItems || []).length + (g.linkItems || []).length, 0);
}

// ---------- palette helpers ----------
// `extra` carries a template's own tokens (legacy aliases the tests and older
// overrides read, scrims, signature colors) on top of THEME_TOKENS.
function palette(base, extra = {}) {
  return { ...base, ...extra };
}


// =====================================================
// CREATOR GRID — video-first channel wall (dark native)
// =====================================================
function buildYoutube(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    dark: palette({
      '--bg': '#0b1014', '--surface': '#12181d', '--media': '#182027', '--ink': '#f2efe9', '--ink-2': '#b4b9bd', '--ink-3': '#8a9197',
      '--line': '#232a30', '--line-strong': '#3a434b', '--accent': '#ff5b3d', '--accent-ink': '#ff7a60', '--on-accent': '#0b1014',
    }, { '--creator-bg': '#0b1014' }),
    light: palette({
      '--bg': '#f6f4ef', '--surface': '#ffffff', '--media': '#e6e2da', '--ink': '#15181b', '--ink-2': '#4a5056', '--ink-3': '#686e74',
      '--line': '#e1ddd4', '--line-strong': '#c9c3b8', '--accent': '#c93c1c', '--accent-ink': '#b5361a', '--on-accent': '#ffffff',
    }, { '--creator-bg': '#f6f4ef' }),
  };
  const layout = {
    lg: { cols: 6, shapes: SHAPES.wideCards(6), ar: '16 / 9', variant: 'row' },
    md: { cols: 4, shapes: SHAPES.wideCards(4), ar: '16 / 9', variant: 'row' },
    sm: { cols: 2, shapes: SHAPES.wideCards(2), ar: '16 / 9', variant: 'row' },
  };
  const css = `
  .creator-theme { --font-display: var(--font-serif); --title-size: 14px; --title-weight: 500; --title-lh: 1.35; --title-clamp: 2; --col-gap: 14px; --row-gap: 28px; --radius-media: 4px;
    --tab-active-bg: var(--accent); --tab-active-text: var(--on-accent); }
  .creator-masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .creator-masthead h1 { margin: 0; font: 500 var(--t-3xl)/0.95 var(--font-display); letter-spacing: -0.035em; }
  .creator-masthead p { margin: 10px 0 0; max-width: 56ch; color: var(--ink-2); font-size: var(--t-sm); }
  .creator-masthead__count { flex: none; font: 400 var(--t-xs)/1 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .creator-theme .tab-nav { margin-top: 8px; }
  .creator-hero { position: relative; display: block; margin-bottom: 28px; overflow: hidden; border-radius: 6px; background: var(--media); isolation: isolate; aspect-ratio: 21 / 8; }
  .creator-hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 700ms var(--ease-out); }
  .creator-hero:hover img { transform: scale(1.02); }
  .creator-hero__shade { position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(5,8,10,.9) 0%, rgba(5,8,10,.55) 34%, rgba(5,8,10,0) 68%), linear-gradient(0deg, rgba(5,8,10,.5), transparent 55%); }
  .creator-hero__copy { position: absolute; z-index: 2; left: clamp(20px, 3.4vw, 48px); bottom: clamp(20px, 3vw, 44px); width: min(560px, 62%); color: #fff; }
  .creator-hero__copy .lf-card__kicker { color: #ffb4a3; }
  .creator-hero__copy h2 { margin: 10px 0 0; font: 500 var(--t-2xl)/1.05 var(--font-display); letter-spacing: -0.03em; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .creator-hero__copy span.creator-hero__meta { display: block; margin-top: 12px; font: 400 var(--t-xs)/1 var(--font-meta); color: rgba(255,255,255,.72); }
  .creator-hero .lf-card__media { position: absolute; inset: 0; aspect-ratio: auto; border-radius: 0; }
  .creator-theme .lf-section__title { color: var(--ink); }
  @media (max-width: 1100px) { .creator-hero { aspect-ratio: 16 / 8; } }
  @media (max-width: 700px) {
    .creator-masthead { flex-direction: column; align-items: flex-start; }
    .creator-hero { aspect-ratio: 4 / 5; }
    .creator-hero__shade { background: linear-gradient(0deg, rgba(5,8,10,.92) 0%, rgba(5,8,10,.25) 62%, transparent); }
    .creator-hero__copy { width: calc(100% - 40px); }
  }`;
  const hero = groups.find((g) => g.previewItems.length)?.previewItems[0] || null;
  const content = renderSourceTabs(groups, (group) => {
    const isHeroGroup = hero && group.previewItems[0] === hero;
    const cardsItems = isHeroGroup ? group.previewItems.slice(1) : group.previewItems;
    const heroHtml = isHeroGroup ? `<a class="creator-hero" href="${attr(hero.href)}" target="_blank" rel="noopener">
      ${lfMedia(hero, { play: false })}
      <div class="creator-hero__shade"></div>
      <div class="creator-hero__copy">
        <span class="lf-card__kicker">${itemKind(hero) === 'video' ? 'Featured video' : 'Featured'}</span>
        <h2>${esc(hero.title || hero.href)}</h2>
        <span class="creator-hero__meta">${esc(hero.domain || srcLabel(group))}</span>
      </div>
    </a>` : '';
    return `${lfSectionHead(group)}${heroHtml}
      ${lfGrid(cardsItems, layout, (item, plan) => lfCard(item, plan, { meta: item.domain || srcLabel(group) }))}
      ${lfLinks(group)}`;
  }, { prefix: 'creator-sources', emptyHtml: '<div class="lf-empty">No links selected.</div>' });
  const total = totalItems(groups);
  const body = `<div class="lf-page">
    <header class="creator-masthead">
      <div><h1>${esc(ctx.title)}</h1>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div>
      <span class="creator-masthead__count">${total} ${total === 1 ? 'pick' : 'picks'}</span>
    </header>
    ${content}
  </div>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds creator-theme', defaultTheme: 'dark', themes });
}

// =====================================================
// PHOTO WALL — justified gallery rows (light native)
// =====================================================
function buildWall(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    light: palette({
      '--bg': '#f7f6f2', '--surface': '#ffffff', '--media': '#e8e5de', '--ink': '#171715', '--ink-2': '#4d4a44', '--ink-3': '#6c6862',
      '--line': '#dcd8cf', '--line-strong': '#171715', '--accent': '#b4452f', '--accent-ink': '#9e3a26', '--on-accent': '#ffffff',
    }, { '--paper': '#f7f6f2' }),
    dark: palette({
      '--bg': '#161512', '--surface': '#1d1c19', '--media': '#26241f', '--ink': '#f0ede6', '--ink-2': '#c4c0b6', '--ink-3': '#9a958b',
      '--line': '#34312b', '--line-strong': '#f0ede6', '--accent': '#e07a5f', '--accent-ink': '#ec8f75', '--on-accent': '#161512',
    }, { '--paper': '#161512' }),
  };
  // Rows of two (6+6) or three (4+5+3); image ratio = span / 3 so every
  // image in a row shares one height — a justified gallery, no ragged tails.
  const layout = {
    lg: { cols: 12, shapes: [{ spans: [6, 6], cost: 0.1 }, { spans: [4, 5, 3], cost: 0 }, { spans: [12], cost: 5 }], ar: { perSpan: 3 } },
    md: { cols: 2, shapes: SHAPES.wideCards(2), ar: { perSpan: 0.75 } },
    sm: { cols: 1, shapes: [{ spans: [1], cost: 0 }], ar: '4 / 5' },
  };
  const css = `
  .wall-theme { --font-display: var(--font-serif); --radius-media: 2px; --col-gap: clamp(12px, 1.6vw, 24px); --row-gap: clamp(26px, 3vw, 40px); --card-gap: 10px;
    --title-size: 14px; --title-weight: 500; --title-lh: 1.38; --title-clamp: 2; --tab-active-bg: var(--ink); --tab-active-text: var(--bg); }
  .wall-masthead { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; padding: clamp(8px, 2vw, 24px) 0 clamp(18px, 2.4vw, 28px); border-bottom: 1px solid var(--line-strong); }
  .wall-masthead h1 { margin: 0; font: 300 var(--t-display)/0.9 var(--font-display); letter-spacing: -0.045em; }
  .wall-masthead p { margin: 14px 0 0; max-width: 52ch; font: italic 400 var(--t-md)/1.45 var(--font-serif); color: var(--ink-2); }
  .wall-masthead__meta { text-align: right; font: 400 var(--t-xs)/1.6 var(--font-meta); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
  .wall-theme .tab-nav { margin-top: 12px; }
  .wall-theme .lf-card__meta { font-size: var(--t-2xs); }
  @media (max-width: 700px) { .wall-masthead { grid-template-columns: 1fr; } .wall-masthead__meta { text-align: left; } }`;
  const content = renderSourceTabs(groups, (group) => `${lfSectionHead(group)}
    ${lfGrid(group.previewItems, layout, (item, plan) => lfCard(item, plan, { meta: item.domain || srcLabel(group) }))}
    ${lfLinks(group)}`, { prefix: 'wall-sources', emptyHtml: '<div class="lf-empty">No selected items to show.</div>' });
  const total = totalItems(groups);
  const body = `<main class="lf-page">
    <header class="wall-masthead">
      <div><h1>${esc(ctx.title)}</h1>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div>
      <div class="wall-masthead__meta">${esc(ctx.today || '')}<br>${total} ${total === 1 ? 'work' : 'works'}</div>
    </header>
    ${content}
  </main>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds wall-theme', defaultTheme: 'light', themes });
}

// =====================================================
// FLUX INDEX — technical media index (dark native)
// =====================================================
function buildFlux(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    dark: palette({
      '--bg': '#080c0e', '--surface': '#10171a', '--media': '#172126', '--ink': '#edf5f4', '--ink-2': '#b5c2c3', '--ink-3': '#8a989b',
      '--line': '#1f2a2e', '--line-strong': '#34454b', '--accent': '#86f4d3', '--accent-ink': '#86f4d3', '--on-accent': '#062019',
    }, { '--flux-bg': '#080c0e', '--flux-ice': '#bceafa', '--flux-bar': '#2a363a' }),
    light: palette({
      '--bg': '#f4f6f6', '--surface': '#ffffff', '--media': '#e3eaec', '--ink': '#0f1a1c', '--ink-2': '#41504f', '--ink-3': '#5b6b6e',
      '--line': '#d8e0e1', '--line-strong': '#b3c1c3', '--accent': '#0b7f62', '--accent-ink': '#0a7259', '--on-accent': '#ffffff',
    }, { '--flux-bg': '#f4f6f6', '--flux-ice': '#2b7a99', '--flux-bar': '#c5d1d3' }),
  };
  const layout = {
    lg: { cols: 12, shapes: [{ spans: [6, 6], cost: 0.1 }, { spans: [4, 4, 4], cost: 0 }, { spans: [3, 3, 3, 3], cost: 0.1 }, { spans: [12], cost: 5 }], ar: { perSpan: 3 } },
    md: { cols: 2, shapes: SHAPES.wideCards(2), ar: { perSpan: 0.75 } },
    sm: { cols: 1, shapes: [{ spans: [1], cost: 0 }], ar: '16 / 10' },
  };
  const titleWords = String(ctx.title || '').trim().split(/\s+/).filter(Boolean);
  const displayTitle = titleWords.length > 1 ? `${esc(titleWords[0])}<br>${esc(titleWords.slice(1).join(' '))}` : esc(ctx.title);
  const css = `
  .flux-theme { --font-body: "Manrope", system-ui, sans-serif; --font-display: "Space Grotesk", var(--font-body); --radius-media: 0; --col-gap: 12px; --row-gap: 12px; --card-gap: 0;
    --title-size: 14px; --title-weight: 600; --title-lh: 1.32; --title-clamp: 2; --tab-sheen: none; }
  .flux-top { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line); font: 600 var(--t-2xs)/1 var(--font-meta); letter-spacing: .18em; text-transform: uppercase; }
  .flux-top span:first-child { color: var(--accent-ink); }
  .flux-top span:last-child { color: var(--ink-3); }
  .flux-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, .6fr); align-items: end; gap: 32px; padding: clamp(28px, 4vw, 48px) 0 clamp(20px, 3vw, 32px); border-bottom: 1px solid var(--line); }
  .flux-hero h1 { margin: 0; font: 500 var(--t-display)/0.84 var(--font-display); letter-spacing: -0.06em; text-transform: uppercase; }
  .flux-hero p { margin: 18px 0 0; max-width: 46ch; color: var(--ink-2); font-size: var(--t-sm); }
  .flux-signal { display: grid; grid-template-columns: repeat(14, 1fr); gap: 7px; align-items: end; height: 72px; }
  .flux-signal i { display: block; height: var(--h); background: var(--flux-bar); }
  .flux-signal i:nth-child(4n+1) { background: var(--accent); }
  .flux-signal i:nth-child(7n) { background: var(--flux-ice); }
  .flux-theme .tab-nav { flex-wrap: nowrap; overflow-x: auto; gap: 0; margin-top: 4px; border-bottom: 1px solid var(--line); scrollbar-width: thin; }
  .flux-theme .tab-btn { min-width: max-content; padding: 0 22px 12px 0; border: 0; border-radius: 0; background: transparent; color: var(--ink-3); }
  .flux-theme .tab-btn:hover, .flux-theme .tab-btn.active { background: transparent; color: var(--ink); }
  .flux-theme .tab-btn.active { color: var(--accent-ink); box-shadow: inset 0 -2px 0 var(--accent); }
  .flux-theme .tab-btn__title { font: 600 var(--t-2xs)/1.2 var(--font-meta); letter-spacing: .14em; text-transform: uppercase; }
  .flux-theme .tab-btn__meta { display: none; }
  .flux-theme .lf-section__head { border-bottom-color: var(--line-strong); }
  .flux-theme .lf-section__title { color: var(--accent-ink); }
  .flux-theme .lf-card { border: 1px solid var(--line); background: var(--surface); transition: border-color var(--dur-base) var(--ease-out); }
  .flux-theme .lf-card:hover { border-color: var(--line-strong); }
  .flux-theme .lf-card__body { padding: 12px 14px 14px; border-top: 1px solid var(--line); }
  .flux-theme .lf-card__media img { filter: saturate(.86) contrast(1.04); }
  .flux-theme .lf-card:hover .lf-card__media img { filter: none; }
  .flux-theme .lf-card__kicker::before { content: "▸ "; }
  .flux-theme .lf-links ul { column-gap: 12px; row-gap: 12px; }
  .flux-theme .lf-links li { border: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .flux-theme .lf-links a { padding: 13px 14px; }
  .flux-theme .lf-links__title { font: 400 var(--t-xs)/1.45 var(--font-meta); }
  .flux-theme .lf-links a::after { content: "↗"; flex: none; color: var(--accent-ink); }
  .flux-theme .lf-links__domain { display: none; }
  @media (max-width: 900px) { .flux-hero { grid-template-columns: 1fr; } .flux-signal { display: none; } }
  @media (max-width: 700px) { .flux-hero h1 { font-size: clamp(40px, 14vw, 72px); } }`;
  const content = renderSourceTabs(groups, (group) => `${lfSectionHead(group)}
    ${lfGrid(group.previewItems, layout, (item, plan) => lfCard(item, plan, { kicker: itemKindLabel(item), meta: item.domain || srcLabel(group), play: false }))}
    ${lfLinks(group, 'Index links')}`, { prefix: 'flux-tabs', emptyHtml: '<div class="lf-empty">No items selected for this export yet.</div>' });
  const bars = [42, 68, 30, 84, 54, 36, 72, 24, 62, 46, 78, 34, 58, 88].map((h) => `<i style="--h:${h}%"></i>`).join('');
  const total = totalItems(groups);
  const body = `<div class="lf-page">
    <header class="flux-top"><span>Flux index</span><span>${total} curated ${total === 1 ? 'item' : 'items'}</span></header>
    <section class="flux-hero"><div><h1>${displayTitle}</h1>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div><div class="flux-signal" aria-hidden="true">${bars}</div></section>
    <main>${content}</main>
  </div>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds flux-theme', defaultTheme: 'dark', themes });
}

// =====================================================
// POP SHELF — airy showcase shelf with a sticky intro (light native)
// =====================================================
function buildShelf(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    light: palette({
      '--bg': '#f7f8f8', '--surface': '#ffffff', '--media': '#e9eef0', '--ink': '#172126', '--ink-2': '#44525a', '--ink-3': '#64717a',
      '--line': '#dde3e5', '--line-strong': '#b9c4c8', '--accent': '#3f66db', '--accent-ink': '#2f5bd3', '--on-accent': '#ffffff',
    }, { '--shelf-bg': '#f7f8f8', '--shelf-ice': '#dff4fb' }),
    dark: palette({
      '--bg': '#101619', '--surface': '#171e22', '--media': '#232d31', '--ink': '#eef3f4', '--ink-2': '#b9c4c8', '--ink-3': '#8f9ca1',
      '--line': '#263035', '--line-strong': '#3a474d', '--accent': '#7d9cf5', '--accent-ink': '#9db4ff', '--on-accent': '#0b1220',
    }, { '--shelf-bg': '#101619', '--shelf-ice': '#1d3038' }),
  };
  const layout = {
    lg: { cols: 12, shapes: [{ spans: [7, 5], cost: 0 }, { spans: [4, 4, 4], cost: 0 }, { spans: [5, 7], cost: 0 }, { spans: [6, 6], cost: 0.05 }, { spans: [12], cost: 5 }], ar: { perSpan: 3 } },
    md: { cols: 12, shapes: [{ spans: [7, 5], cost: 0 }, { spans: [5, 7], cost: 0 }, { spans: [6, 6], cost: 0 }, { spans: [12], cost: 5 }], ar: { perSpan: 3.6 } },
    sm: { cols: 1, shapes: [{ spans: [1], cost: 0 }], ar: '16 / 10' },
  };
  const titleWords = String(ctx.title || '').trim().split(/\s+/).filter(Boolean);
  const displayTitle = titleWords.length > 1 ? `${esc(titleWords[0])}<br>${esc(titleWords.slice(1).join(' '))}` : esc(ctx.title);
  const css = `
  .shelf-theme { --font-body: "Manrope", system-ui, sans-serif; --radius-media: 0; --col-gap: 10px; --row-gap: 10px; --card-gap: 0;
    --title-size: 14px; --title-weight: 600; --title-lh: 1.3; --title-clamp: 2; --tab-sheen: none; }
  .shelf-top { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .shelf-brand { font-size: var(--t-sm); font-weight: 700; letter-spacing: .24em; text-transform: uppercase; }
  .shelf-date { font: 400 var(--t-2xs)/1 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .shelf-layout { display: grid; grid-template-columns: minmax(220px, .3fr) minmax(0, 1fr); gap: clamp(24px, 3vw, 44px); padding-top: 32px; }
  .shelf-intro { position: sticky; top: 24px; align-self: start; display: grid; gap: 18px; }
  .shelf-intro h1 { margin: 40px 0 0; font: 300 clamp(40px, 4.2vw, 64px)/0.92 var(--font-body); letter-spacing: -0.055em; text-transform: uppercase; }
  .shelf-intro p { margin: 0; color: var(--ink-2); font-size: var(--t-sm); }
  .shelf-index { font: 400 var(--t-2xs)/1.6 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .shelf-theme .tab-nav { flex-wrap: nowrap; overflow-x: auto; gap: 4px; margin: 0 0 8px; padding-top: 0; }
  .shelf-theme .tab-btn { min-width: max-content; padding: 8px 12px; border: 0; border-radius: 4px; background: transparent; color: var(--ink-2); }
  .shelf-theme .tab-btn:hover { background: var(--surface); }
  .shelf-theme .tab-btn.active { background: var(--shelf-ice); color: var(--accent-ink); }
  .shelf-theme .tab-btn__title { font-size: var(--t-xs); font-weight: 700; }
  .shelf-theme .tab-btn__meta { display: none; }
  .shelf-theme .lf-section__head { border-bottom: 0; margin-bottom: 10px; padding-bottom: 0; }
  .shelf-theme .lf-card { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .shelf-theme .lf-card__body { grid-template-columns: minmax(0, 1fr) auto; column-gap: 12px; padding: 12px 14px 14px; }
  .shelf-theme .lf-card__body::after { content: "↗"; grid-column: 2; grid-row: 1 / span 3; align-self: end; color: var(--accent-ink); font-family: var(--font-meta); }
  .shelf-theme .lf-card__kicker, .shelf-theme .lf-card__title, .shelf-theme .lf-card__meta { grid-column: 1; }
  .shelf-theme .lf-links { margin-top: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); padding: 4px 14px; }
  .shelf-theme .lf-links li:last-child { border-bottom: 0; }
  @media (max-width: 1100px) { .shelf-layout { grid-template-columns: 1fr; padding-top: 20px; } .shelf-intro { position: static; } .shelf-intro h1 { margin-top: 8px; } .shelf-index { display: none; } }
  @media (max-width: 700px) { .shelf-date { display: none; } .shelf-intro h1 { font-size: clamp(40px, 14vw, 64px); } }`;
  const content = renderSourceTabs(groups, (group) => `${lfSectionHead(group)}
    ${lfGrid(group.previewItems, layout, (item, plan) => lfCard(item, plan, { meta: `${itemKindLabel(item)} · ${item.domain || srcLabel(group)}` }))}
    ${lfLinks(group)}`, { prefix: 'shelf-tabs', emptyHtml: '<div class="lf-empty">No items selected for this export yet.</div>' });
  const total = totalItems(groups);
  const body = `<div class="lf-page">
    <header class="shelf-top"><span class="shelf-brand">Pop shelf</span><span class="shelf-date">${esc(ctx.today || '')}</span></header>
    <div class="shelf-layout">
      <aside class="shelf-intro"><h1>${displayTitle}</h1>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}<span class="shelf-index">${total} curated ${total === 1 ? 'pick' : 'picks'} / ${groups.length} ${groups.length === 1 ? 'source' : 'sources'}</span></aside>
      <main>${content}</main>
    </div>
  </div>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds shelf-theme', defaultTheme: 'light', themes });
}

// =====================================================
// EDITORIAL FRONT — newspaper front page with hero rows (light native, new)
// Issue #3: the remainder of a 3-column grid is promoted to full-row heroes
// (7 -> 1 hero + 6, 11 -> 2 heroes + 9), never back-filled masonry-style.
// =====================================================
function buildEditorialFront(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    light: palette({
      '--bg': '#faf8f3', '--surface': '#ffffff', '--media': '#e7e2d8', '--ink': '#121212', '--ink-2': '#3d3a35', '--ink-3': '#66625b',
      '--line': '#d9d3c7', '--line-strong': '#121212', '--accent': '#a8201a', '--accent-ink': '#a8201a', '--on-accent': '#ffffff',
    }, { '--front-bg': '#faf8f3' }),
    dark: palette({
      '--bg': '#141311', '--surface': '#1b1a17', '--media': '#262420', '--ink': '#eeeae2', '--ink-2': '#c8c2b7', '--ink-3': '#9b958a',
      '--line': '#34312b', '--line-strong': '#eeeae2', '--accent': '#ff6b5e', '--accent-ink': '#ff8a7f', '--on-accent': '#141311',
    }, { '--front-bg': '#141311' }),
  };
  const layout = {
    lg: { cols: 3, shapes: SHAPES.heroRows(3), ar: '3 / 2', variant: 'hero' },
    md: { cols: 2, shapes: SHAPES.heroRows(2), ar: '3 / 2', variant: 'hero' },
    sm: { cols: 1, shapes: SHAPES.heroRows(1), ar: '3 / 2' },
  };
  const css = `
  .front-theme { --font-display: var(--font-serif); --title-font: var(--font-serif); --title-size: var(--t-lg); --title-weight: 600; --title-lh: 1.22; --title-tracking: -0.012em; --title-clamp: 4;
    --radius-media: 0; --col-gap: clamp(20px, 2.4vw, 36px); --row-gap: clamp(28px, 3vw, 44px); --card-gap: 12px;
    --tab-active-bg: var(--ink); --tab-active-text: var(--bg); }
  .front-masthead { text-align: center; padding: clamp(8px, 2vw, 20px) 0 0; }
  .front-masthead__top { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 10px; font: 400 var(--t-2xs)/1.2 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
  .front-masthead h1 { margin: 0; padding: clamp(10px, 1.6vw, 18px) 0; border-block: 1px solid var(--line-strong); font: 800 clamp(40px, 7.4vw, 104px)/0.95 var(--font-display); letter-spacing: -0.035em; }
  .front-masthead p { margin: 0; padding: 10px 0; border-bottom: 3px double var(--line-strong); font: italic 400 var(--t-md)/1.4 var(--font-serif); color: var(--ink-2); }
  .front-theme .tab-nav { justify-content: center; margin-top: 14px; }
  @media (max-width: 700px) { .front-theme .tab-nav { justify-content: flex-start; flex-wrap: nowrap; overflow-x: auto; } .front-theme .tab-btn { min-width: max-content; } }
  .front-theme .tab-btn { border-radius: 0; border-color: transparent; padding: 7px 12px; }
  .front-theme .tab-btn__title { font: 600 var(--t-xs)/1.2 var(--font-meta); letter-spacing: .1em; text-transform: uppercase; }
  .front-theme .tab-btn__meta { display: none; }
  .front-theme .lf-section__head { border-top: 3px solid var(--line-strong); border-bottom: 1px solid var(--line); padding: 10px 0 10px; }
  .front-theme .lf-section__title { font: 700 var(--t-md)/1.2 var(--font-serif); letter-spacing: 0; text-transform: none; }
  .front-theme .lf-card__meta { font-size: var(--t-2xs); letter-spacing: .04em; text-transform: uppercase; }
  .front-theme .lf-card.lf-hero-lg, .front-theme .lf-card.lf-hero-md { padding-bottom: clamp(24px, 2.6vw, 36px); border-bottom: 1px solid var(--line); }
  .front-theme .lf-links__heading { color: var(--accent-ink); }
  .front-theme .lf-links__title { font: 500 var(--t-md)/1.35 var(--font-serif); }`;
  const total = totalItems(groups);
  const content = renderSourceTabs(groups, (group) => `${lfSectionHead(group, 'stories')}
    ${lfGrid(group.previewItems, layout, (item, plan) => lfCard(item, plan, { meta: item.domain || srcLabel(group) }))}
    ${lfLinks(group, 'Also in this section')}`, { prefix: 'front-sources', emptyHtml: '<div class="lf-empty">No stories selected.</div>' });
  const body = `<div class="lf-page">
    <header class="front-masthead">
      <div class="front-masthead__top"><span>${esc(ctx.today || '')}</span><span>${total} ${total === 1 ? 'story' : 'stories'} · ${groups.length} ${groups.length === 1 ? 'source' : 'sources'}</span></div>
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}
    </header>
    ${content}
  </div>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds front-theme', defaultTheme: 'light', themes });
}

// =====================================================
// READING LIST — minimal single column (light native, new)
// Previews and plain links share one numbered list per source, so a
// link-heavy collection reads as a list rather than a short grid plus a
// long "more links" tail.
// =====================================================
function buildReading(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    light: palette({
      '--bg': '#fbfbf9', '--surface': '#ffffff', '--media': '#ecebe6', '--ink': '#1b1b1a', '--ink-2': '#4a4a46', '--ink-3': '#6b6b66',
      '--line': '#e6e5e0', '--line-strong': '#1b1b1a', '--accent': '#3b5bdb', '--accent-ink': '#3451c6', '--on-accent': '#ffffff',
    }, { '--reading-bg': '#fbfbf9' }),
    dark: palette({
      '--bg': '#121212', '--surface': '#1a1a1a', '--media': '#232323', '--ink': '#ebeae6', '--ink-2': '#c2c1bc', '--ink-3': '#9a9994',
      '--line': '#2a2a28', '--line-strong': '#ebeae6', '--accent': '#8ea2ff', '--accent-ink': '#a3b3ff', '--on-accent': '#121212',
    }, { '--reading-bg': '#121212' }),
  };
  const css = `
  .reading-theme { --font-display: var(--font-serif); --page-max: 760px; --tab-active-bg: var(--ink); --tab-active-text: var(--bg); }
  .reading-masthead { padding: clamp(16px, 4vw, 48px) 0 clamp(18px, 2.4vw, 28px); border-bottom: 1px solid var(--line); }
  .reading-masthead__kicker { font: 600 var(--t-2xs)/1 var(--font-meta); letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink); }
  .reading-masthead h1 { margin: 14px 0 0; font: 600 clamp(34px, 5vw, 52px)/1.04 var(--font-display); letter-spacing: -0.028em; }
  .reading-masthead p { margin: 12px 0 0; font: 400 var(--t-md)/1.55 var(--font-serif); color: var(--ink-2); }
  .reading-masthead__meta { margin-top: 16px; font: 400 var(--t-xs)/1 var(--font-meta); color: var(--ink-3); }
  .reading-theme .tab-nav { gap: 6px; margin-top: 4px; }
  .reading-theme .tab-btn { padding: 6px 12px; }
  .reading-theme .tab-btn__title { font-size: var(--t-xs); font-family: var(--font-body); }
  .reading-theme .tab-btn__meta { display: none; }
  .reading-theme .tab-panels { gap: clamp(36px, 5vw, 56px); }
  .reading-list { list-style: none; margin: 0; padding: 0; counter-reset: reading; }
  .reading-list li { counter-increment: reading; border-bottom: 1px solid var(--line); }
  .reading-item { display: grid; grid-template-columns: 2.2em minmax(0, 1fr) auto; column-gap: 14px; align-items: start; padding: 18px 0; color: inherit; }
  .reading-item::before { content: counter(reading, decimal-leading-zero); padding-top: 4px; font: 400 var(--t-xs)/1 var(--font-meta); color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .reading-item__title { margin: 0; font: 600 var(--t-lg)/1.3 var(--font-serif); letter-spacing: -0.01em; color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; transition: color var(--dur-base) var(--ease-out); }
  .reading-item__meta { display: block; margin-top: 6px; font: 400 var(--t-xs)/1.4 var(--font-meta); color: var(--ink-3); }
  .reading-item__meta b { font-weight: 600; color: var(--accent-ink); }
  .reading-item__thumb { width: 112px; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 4px; background: var(--media); }
  .reading-item__thumb img { width: 100%; height: 100%; object-fit: cover; }
  .reading-item__thumb.is-broken { visibility: hidden; }
  .reading-item:hover .reading-item__title, .reading-item:focus-visible .reading-item__title { color: var(--accent-ink); }
  @media (max-width: 700px) { .reading-item { grid-template-columns: minmax(0, 1fr) auto; } .reading-item::before { display: none; } .reading-item__thumb { width: 84px; } .reading-item__title { font-size: var(--t-md); } }`;
  const row = (item, group) => {
    const kind = itemKind(item);
    const label = kind === 'video' ? '<b>Video</b> · ' : kind === 'gallery' ? '<b>Image</b> · ' : '';
    return `<li><a class="reading-item" href="${attr(item.href)}" target="_blank" rel="noopener">
      <div><h3 class="reading-item__title">${esc(item.title || item.href)}</h3><span class="reading-item__meta">${label}${esc(item.domain || srcLabel(group))}</span></div>
      ${item.thumbnail ? `<div class="reading-item__thumb">${thumbImg(item, `decoding="async" ${BROKEN_IMG_ONERROR}`)}</div>` : ''}
    </a></li>`;
  };
  const content = renderSourceTabs(groups, (group) => `${lfSectionHead(group, 'reads')}
    <ol class="reading-list">${[...group.previewItems, ...group.linkItems].map((item) => row(item, group)).join('')}</ol>`,
  { prefix: 'reading-sources', emptyHtml: '<div class="lf-empty">Nothing on the list yet.</div>' });
  const total = totalItems(groups);
  const body = `<main class="lf-page">
    <header class="reading-masthead">
      <span class="reading-masthead__kicker">Reading list</span>
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}
      <div class="reading-masthead__meta">${total} ${total === 1 ? 'read' : 'reads'}${ctx.today ? ` · ${esc(ctx.today)}` : ''}</div>
    </header>
    ${content}
  </main>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds reading-theme', defaultTheme: 'light', themes });
}

// =====================================================
// MOSAIC — bold, tight visual grid with color-band captions (dark native, new)
// =====================================================
function buildMosaic(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const themes = {
    dark: palette({
      '--bg': '#0d0d0f', '--surface': '#17171a', '--media': '#1f1f24', '--ink': '#f5f5f2', '--ink-2': '#c9c9c4', '--ink-3': '#9a9a95',
      '--line': '#26262b', '--line-strong': '#f5f5f2', '--accent': '#ffd23f', '--accent-ink': '#ffd23f', '--on-accent': '#111111',
    }, { '--mosaic-bg': '#0d0d0f' }),
    light: palette({
      '--bg': '#f3f2ee', '--surface': '#ffffff', '--media': '#e2e0da', '--ink': '#111111', '--ink-2': '#3a3a38', '--ink-3': '#5f5f5b',
      '--line': '#d8d6cf', '--line-strong': '#111111', '--accent': '#d33025', '--accent-ink': '#c4291d', '--on-accent': '#ffffff',
    }, { '--mosaic-bg': '#f3f2ee' }),
  };
  const layout = {
    lg: { cols: 12, shapes: [{ spans: [8, 4], cost: 0 }, { spans: [4, 4, 4], cost: 0 }, { spans: [4, 8], cost: 0 }, { spans: [3, 3, 3, 3], cost: 0.05 }, { spans: [6, 6], cost: 0.1 }, { spans: [12], cost: 5 }], ar: { perSpan: 3 } },
    md: { cols: 2, shapes: SHAPES.wideCards(2), ar: { perSpan: 0.75 } },
    sm: { cols: 1, shapes: [{ spans: [1], cost: 0 }], ar: '4 / 3' },
  };
  const css = `
  .mosaic-theme { --font-display: "Space Grotesk", var(--font-body); --title-font: var(--font-display); --title-size: var(--t-md); --title-weight: 600; --title-lh: 1.2; --title-tracking: -0.02em; --title-clamp: 2;
    --gutter: clamp(12px, 2vw, 28px); --col-gap: 4px; --row-gap: 4px; --card-gap: 0; --radius-media: 0; --page-max: 1600px;
    --tab-active-bg: var(--accent); --tab-active-text: var(--on-accent); }
  .mosaic-masthead { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; padding: clamp(8px, 2vw, 24px) 0 clamp(16px, 2vw, 24px); }
  .mosaic-masthead h1 { margin: 0; font: 700 var(--t-display)/0.86 var(--font-display); letter-spacing: -0.065em; }
  .mosaic-masthead h1 span { color: var(--accent-ink); }
  .mosaic-masthead p { margin: 14px 0 0; max-width: 48ch; color: var(--ink-2); }
  .mosaic-masthead__count { font: 700 var(--t-3xl)/0.9 var(--font-display); letter-spacing: -0.04em; text-align: right; }
  .mosaic-masthead__count small { display: block; margin-top: 6px; font: 600 var(--t-2xs)/1 var(--font-meta); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
  .mosaic-theme .tab-btn__title { font-family: var(--font-display); }
  .mosaic-theme .lf-section__head { border-bottom: 0; margin-bottom: 8px; padding-bottom: 0; }
  .mosaic-theme .lf-section__title { font: 700 var(--t-xl)/1.1 var(--font-display); letter-spacing: -0.02em; text-transform: none; }
  .mosaic-theme .lf-card { background: var(--surface); transition: background var(--dur-base) var(--ease-out); }
  .mosaic-theme .lf-card__body { padding: 14px 16px 16px; }
  .mosaic-theme .lf-card:hover, .mosaic-theme .lf-card:focus-visible { background: var(--accent); }
  .mosaic-theme .lf-card:hover .lf-card__title, .mosaic-theme .lf-card:focus-visible .lf-card__title,
  .mosaic-theme .lf-card:hover .lf-card__meta, .mosaic-theme .lf-card:hover .lf-card__kicker { color: var(--on-accent); }
  .mosaic-theme .lf-links ul { column-gap: 4px; }
  .mosaic-theme .lf-links__title { font: 600 var(--t-md)/1.3 var(--font-display); }
  @media (max-width: 700px) { .mosaic-masthead { grid-template-columns: 1fr; } .mosaic-masthead__count { text-align: left; } }`;
  const words = String(ctx.title || '').trim().split(/\s+/).filter(Boolean);
  const title = words.length > 1 ? `${esc(words.slice(0, -1).join(' '))} <span>${esc(words[words.length - 1])}</span>` : esc(ctx.title);
  const content = renderSourceTabs(groups, (group) => `${lfSectionHead(group)}
    ${lfGrid(group.previewItems, layout, (item, plan) => lfCard(item, plan, { meta: item.domain || srcLabel(group) }))}
    ${lfLinks(group)}`, { prefix: 'mosaic-sources', emptyHtml: '<div class="lf-empty">Nothing selected.</div>' });
  const total = totalItems(groups);
  const body = `<div class="lf-page">
    <header class="mosaic-masthead">
      <div><h1>${title}</h1>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div>
      <div class="mosaic-masthead__count">${total}<small>${total === 1 ? 'pick' : 'picks'}</small></div>
    </header>
    ${content}
  </div>`;
  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'lf-ds mosaic-theme', defaultTheme: 'dark', themes });
}

// ---------- registry ----------
const TEMPLATES = {
  youtube: {
    name: 'Creator Grid',
    desc: 'Tabbed source channels with fast-scanning cards for clips, reels, and drops.',
    focus: 'Video',
    fit: 'Great for YouTube, TikTok, Vimeo, and mixed creator feeds',
    preview: () => previewSvg('stream'),
    build: (ctx) => buildYoutube(normalize(ctx)),
  },
  wall: {
    name: 'Photo Wall',
    desc: 'Tabbed gallery walls that keep each source in its own visual lane.',
    focus: 'Gallery',
    fit: 'Best for photography, lookbooks, product shots, and image sets',
    preview: () => previewSvg('wall'),
    build: (ctx) => buildWall(normalize(ctx)),
  },
  flux: {
    name: 'Flux Index',
    desc: 'An obsidian media index with mint signals and crisp mono metadata.',
    focus: 'Mixed media',
    fit: 'Great for modern collections spanning video, images, products, and links',
    featured: true,
    preview: () => previewSvg('flux'),
    build: (ctx) => buildFlux(normalize(ctx)),
  },
  shelf: {
    name: 'Pop Shelf',
    desc: 'A bright, architectural gallery shelf with quiet icy-blue accents.',
    focus: 'Showcase',
    fit: 'Best for image-led portfolios, creator picks, products, and playlists',
    preview: () => previewSvg('shelf'),
    build: (ctx) => buildShelf(normalize(ctx)),
  },
  editorial: {
    name: 'Editorial Front',
    desc: 'A newspaper front page: serif headlines, section rules, and hero stories that keep every row whole.',
    focus: 'Articles',
    fit: 'Best for news, essays, newsletters, and article-led reading',
    preview: () => previewSvg('front'),
    build: (ctx) => buildEditorialFront(normalize(ctx)),
  },
  reading: {
    name: 'Reading List',
    desc: 'A quiet, numbered single column where links and previews read in one list.',
    focus: 'Links',
    fit: 'Great for link-heavy collections, research, and save-for-later lists',
    preview: () => previewSvg('reading'),
    build: (ctx) => buildReading(normalize(ctx)),
  },
  mosaic: {
    name: 'Mosaic',
    desc: 'A bold, edge-to-edge image grid with color-band captions.',
    focus: 'Visual',
    fit: 'Best for strong imagery: campaigns, portfolios, reels, and product drops',
    preview: () => previewSvg('mosaic'),
    build: (ctx) => buildMosaic(normalize(ctx)),
  },
};

function suggestTemplate(counts) {
  const t = counts.total || 1;
  if (counts.gallery / t >= 0.4) return 'wall';
  if (counts.video / t >= 0.3) return 'youtube';
  if (counts.article / t >= 0.55) return 'shelf';
  // Mostly preview-less links: every grid template would show a short grid
  // and a long tail, while the reading list gives them equal weight.
  if ((counts.link || 0) / t >= 0.5) return 'reading';
  return 'flux';
}

// =====================================================
// Shared shell + shared "More links" CSS (consistent across templates)
// Each template includes this CSS and may override pieces of it.
// =====================================================
const MORE_LINKS_CSS_LIGHT = `
  .more-links { margin-top: 56px; padding-top: 28px; border-top: 1px solid #e5e5e5; }
  .more-links__heading { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6b6b6b; margin: 0 0 24px; font-family: inherit; }
  .more-links__grid { display: flex; flex-direction: column; gap: 36px; }
  .more-links__group { min-width: 0; }
  .more-links__src { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #111; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #d4d4d4; }
  .more-links__list { list-style: none; margin: 0; padding: 0; }
  .more-links__list li { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding: 10px 0; font-size: 15px; line-height: 1.45; border-bottom: 1px solid #f4f4f5; }
  .more-links__list li:last-child { border-bottom: 0; }
  .more-links__list a { color: #0a0a0a; flex: 1 1 auto; min-width: 0; }
  .more-links__list a:hover { color: #2563eb; text-decoration: underline; }
  .more-links__domain { flex: 0 0 auto; font-size: 11px; color: #9a9a9a; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.02em; }
  @media (max-width: 600px) {
    .more-links__list li { flex-direction: column; align-items: flex-start; gap: 2px; }
    .more-links__domain { margin-top: 0; }
  }
`;

const MORE_LINKS_CSS_DARK = `
  .more-links { margin-top: 56px; padding-top: 28px; border-top: 1px solid #1f2228; }
  .more-links__heading { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #71717a; margin: 0 0 24px; font-family: inherit; }
  .more-links__grid { display: flex; flex-direction: column; gap: 36px; }
  .more-links__group { min-width: 0; }
  .more-links__src { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #e6e6e7; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #2c3340; }
  .more-links__list { list-style: none; margin: 0; padding: 0; }
  .more-links__list li { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding: 10px 0; font-size: 15px; line-height: 1.45; border-bottom: 1px solid #1a1d22; }
  .more-links__list li:last-child { border-bottom: 0; }
  .more-links__list a { color: #d4d4d8; flex: 1 1 auto; min-width: 0; }
  .more-links__list a:hover { color: #61dafb; text-decoration: underline; }
  .more-links__domain { flex: 0 0 auto; font-size: 11px; color: #6a7077; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.02em; }
  @media (max-width: 600px) {
    .more-links__list li { flex-direction: column; align-items: flex-start; gap: 2px; }
    .more-links__domain { margin-top: 0; }
  }
`;

function shell({ title, tagline, today, body, css, bodyClass = '', defaultTheme = 'light', themes = null }) {
  const bodyClasses = ['lf-template', bodyClass].filter(Boolean).join(' ');
  return `<!doctype html>
<html lang="en" data-theme="${defaultTheme === 'dark' ? 'dark' : 'light'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(tagline || '')}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    /* ---- radius / shadow (legacy aliases kept for existing per-family CSS) ---- */
    --lf-radius-sm: 8px;
    --lf-radius-md: 14px;
    --lf-radius-lg: 22px;
    --lf-radius-xl: 22px;
    --lf-radius-full: 999px;
    --lf-shadow-soft: 0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.06);
    --lf-shadow-deep: 0 8px 30px rgba(15, 23, 42, 0.14);

    /* ---- blueprint token layer ---- */
    --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
    --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px; --space-24: 96px;
    --ease-out: cubic-bezier(.22,1,.36,1);
    --dur-fast: 150ms; --dur-base: 240ms; --dur-slow: 400ms;
    --shadow-rest: var(--lf-shadow-soft);
    --shadow-lift: var(--lf-shadow-deep);
  }
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin: 0; padding: 0; }
  img { display: block; max-width: 100%; }
  a { color: inherit; text-decoration: none; transition: color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out); }
  .lf-template {
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .lf-template h1,
  .lf-template h2,
  .lf-template h3,
  .lf-template h4 { text-wrap: balance; overflow-wrap: break-word; }
  .lf-template p,
  .lf-template .tagline { text-wrap: pretty; }
  .lf-template a:focus-visible,
  .lf-template button:focus-visible,
  .lf-template [tabindex]:focus-visible {
    outline: 2px solid var(--lf-focus-color, currentColor);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .lf-template .source-count,
  .lf-template .src-count,
  .lf-template .tab-stage__meta,
  .lf-template .panel-count,
  .lf-template .more-links__domain,
  .lf-template .smart-links__domain {
    font-variant-numeric: tabular-nums;
  }
  .lf-template .tab-btn,
  .lf-template .card,
  .lf-template .tile,
  .lf-template .story-card,
  .lf-template .source,
  .lf-template .source-stage,
  .lf-template .source-block,
  .lf-template .tab-stage,
  .lf-template .panel,
  .lf-template .smart-links__group,
  .lf-template .more-links__group {
    transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out);
  }
  .lf-template .tab-btn {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: 44px;
  }
  .lf-template a.card,
  .lf-template a.tile,
  .lf-template a.story-card,
  .lf-template a.story,
  .lf-template a.row,
  .lf-template a.item,
  .lf-template a.lead,
  .lf-template a.brief,
  .lf-template a.stack-item {
    min-height: 44px;
  }
  .lf-template .tab-btn::after {
    content: "";
    position: absolute;
    inset: -2px;
    pointer-events: none;
    opacity: 0;
    /* Opt-out hook: templates whose chips are borderless text (Flux, Pop
       Shelf) set --tab-sheen: none, where a translucent slab sweeping across
       bare text reads as a rendering artifact rather than a flourish. */
    background: var(--tab-sheen, linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.28) 50%, transparent 75%));
    transform: translateX(-60%);
    transition: opacity var(--dur-base) var(--ease-out);
  }
  /* Hover-only. This used to stay at opacity:1 on the selected chip too, which
     parked a translucent white slab over it — invisible while the active class
     styled nothing, obvious once selection started rendering. */
  .lf-template .tab-btn:hover::after {
    opacity: 1;
    animation: lf-tab-sheen .9s ease;
  }
  .lf-template .media-frame,
  .lf-template .thumb-box {
    border-radius: var(--lf-radius-md);
    overflow: hidden;
  }
  .lf-template .media-frame img,
  .lf-template .thumb-box img {
    transform: translateZ(0);
    transition: transform var(--dur-slow) var(--ease-out);
  }
  .lf-template .story-card:hover .media-frame img,
  .lf-template .tile:hover .media-frame img,
  .lf-template .tile:hover .thumb-box img,
  .lf-template .card:hover .thumb-box img,
  .lf-template .story:hover .media-frame img {
    transform: scale(1.045);
  }
  .lf-template .source,
  .lf-template .source-stage,
  .lf-template .source-block,
  .lf-template .tab-stage,
  .lf-template .panel {
    border-radius: var(--lf-radius-xl);
    box-shadow: var(--shadow-rest);
  }
  .lf-template .source:hover,
  .lf-template .source-stage:hover,
  .lf-template .source-block:hover,
  .lf-template .tab-stage:hover,
  .lf-template .panel:hover {
    box-shadow: var(--shadow-lift);
  }
  .lf-template a:active,
  .lf-template button:active {
    transform: scale(.98);
    transition-duration: var(--dur-fast);
  }
  @keyframes lf-tab-sheen {
    from { transform: translateX(-60%); }
    to { transform: translateX(70%); }
  }
  @keyframes lf-rise {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .lf-template .card,
    .lf-template .tile,
    .lf-template .story-card,
    .lf-template .story,
    .lf-template .row,
    .lf-template .item,
    .lf-template .brief,
    .lf-template .stack-item {
      animation: lf-rise var(--dur-slow) var(--ease-out) both;
    }
    .lf-template .grid > :nth-child(1),  .lf-template .items > :nth-child(1),  .lf-template .stack > :nth-child(1),  .lf-template .briefs > :nth-child(1) { animation-delay: 0ms; }
    .lf-template .grid > :nth-child(2),  .lf-template .items > :nth-child(2),  .lf-template .stack > :nth-child(2),  .lf-template .briefs > :nth-child(2) { animation-delay: 40ms; }
    .lf-template .grid > :nth-child(3),  .lf-template .items > :nth-child(3),  .lf-template .stack > :nth-child(3),  .lf-template .briefs > :nth-child(3) { animation-delay: 80ms; }
    .lf-template .grid > :nth-child(4),  .lf-template .items > :nth-child(4),  .lf-template .stack > :nth-child(4),  .lf-template .briefs > :nth-child(4) { animation-delay: 120ms; }
    .lf-template .grid > :nth-child(5),  .lf-template .items > :nth-child(5),  .lf-template .stack > :nth-child(5),  .lf-template .briefs > :nth-child(5) { animation-delay: 160ms; }
    .lf-template .grid > :nth-child(6),  .lf-template .items > :nth-child(6),  .lf-template .stack > :nth-child(6),  .lf-template .briefs > :nth-child(6) { animation-delay: 200ms; }
    .lf-template .grid > :nth-child(n+7), .lf-template .items > :nth-child(n+7), .lf-template .stack > :nth-child(n+7), .lf-template .briefs > :nth-child(n+7) { animation-delay: 240ms; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lf-template *, .lf-template *::before, .lf-template *::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
      scroll-behavior: auto !important;
    }
    .lf-template a:hover, .lf-template a:active,
    .lf-template .card:hover, .lf-template .tile:hover, .lf-template .story-card:hover,
    .lf-template .story:hover, .lf-template .tab-btn:hover {
      transform: none !important;
    }
  }
${SOURCE_FILTER_CSS}
${themes ? DS_CSS + themeBlocksCSS(themes) : ''}
${THEME_TOGGLE_CSS}
${css}
</style>
</head>
<body class="${bodyClasses}">
${body}
${THEME_TOGGLE_BUTTON}
${themeToggleScript()}
</body>
</html>`;
}

// =====================================================
// 1) STORY DECK — calm story-led layout for mixed article/image sets
// =====================================================
function buildEditorial(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const leadGroup = groups.find((group) => group.previewItems.length);
  const lead = leadGroup?.previewItems[0] || null;

  const picture = (item, className) => `<div class="${className}">
    <img src="${attr(item.thumbnail)}" alt="" loading="lazy"
      onerror="this.parentElement.classList.add('is-broken');this.remove()" />
    <span class="image-fallback" aria-hidden="true">No preview</span>
  </div>`;

  const leadHtml = lead ? `<a class="lead" href="${attr(lead.href)}" target="_blank" rel="noopener">
    ${picture(lead, 'lead__image')}
    <div class="lead__copy">
      <span class="source-label">${esc(lead.domain || srcLabel(leadGroup))}</span>
      <h2>${esc(lead.title || lead.href)}</h2>
    </div>
  </a>` : '';

  const sourceSections = groups.map((group) => {
    const items = group.previewItems.filter((item) => item !== lead);
    if (!items.length) return '';
    const stories = items.map((item) => `<a class="story" href="${attr(item.href)}" target="_blank" rel="noopener">
      ${picture(item, 'story__image')}
      <h3>${esc(item.title || item.href)}</h3>
      <span class="story__domain">${esc(item.domain || srcLabel(group))}</span>
    </a>`).join('');
    return `<section class="source">
      <div class="source__head">
        <h2>${esc(srcLabel(group))}</h2>
      </div>
      <div class="stories">${stories}</div>
    </section>`;
  }).join('');

  const linkGroups = groups.filter((group) => group.linkItems.length);
  const linksHtml = linkGroups.length ? `<section class="links-tail">
    <h2>More links</h2>
    <div class="links-tail__groups">
      ${linkGroups.map((group) => `<section class="link-group">
        <h3>${esc(srcLabel(group))}</h3>
        <ul>
          ${group.linkItems.map((item) => `<li><a href="${attr(item.href)}" target="_blank" rel="noopener">
            <span>${esc(item.title || item.href)}</span>
            <small>${esc(item.domain || srcLabel(group))}</small>
          </a></li>`).join('')}
        </ul>
      </section>`).join('')}
    </div>
  </section>` : '';

  const emptyHtml = !leadHtml && !sourceSections && !linksHtml
    ? '<p class="empty">No stories selected.</p>'
    : '';

  const css = `
  body {
    background: #f6f0e5;
    color: #211d18;
    font-family: Inter, system-ui, -apple-system, sans-serif;
    line-height: 1.45;
  }
  .wrap { width: min(1420px, calc(100% - 64px)); margin: 0 auto; padding: 32px 0 80px; }
  .masthead { padding: 0 0 24px; border-bottom: 1px solid #b9aa96; }
  .masthead h1 {
    margin: 0;
    font-family: Fraunces, Georgia, serif;
    font-size: clamp(34px, 4vw, 58px);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.045em;
  }
  .lead {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, .75fr);
    gap: clamp(28px, 4vw, 68px);
    align-items: center;
    padding: clamp(34px, 5vw, 72px) 0;
    border-bottom: 1px solid #b9aa96;
  }
  .lead__image, .story__image {
    position: relative;
    overflow: hidden;
    background: #ded3c2;
  }
  .lead__image { aspect-ratio: 16 / 9; }
  .story__image { aspect-ratio: 16 / 10; }
  .lead__image img, .story__image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform .35s ease, opacity .2s ease;
  }
  .lead:hover img, .story:hover img { transform: scale(1.018); }
  .image-fallback {
    display: none;
    position: absolute;
    inset: 0;
    place-items: center;
    color: #756958;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .is-broken .image-fallback { display: grid; }
  .lead__copy { max-width: 520px; }
  .source-label, .story__domain {
    color: #b0442d;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .lead h2 {
    margin: 18px 0 0;
    font-family: Fraunces, Georgia, serif;
    font-size: clamp(38px, 4.3vw, 70px);
    font-weight: 650;
    letter-spacing: -.045em;
    line-height: 1.02;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }
  .lead:hover h2, .story:hover h3, .link-group a:hover span { color: #b0442d; }
  .source {
    padding: 42px 0 48px;
    border-bottom: 1px solid #b9aa96;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .source:hover { box-shadow: none !important; }
  .source__head {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 22px;
  }
  .source__head::after { content: ""; height: 1px; flex: 1; background: #b9aa96; }
  .source__head h2 {
    margin: 0;
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .stories { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 20px; }
  .story { display: block; min-width: 0; }
  .story h3 {
    margin: 13px 0 6px;
    font-family: Fraunces, Georgia, serif;
    font-size: clamp(18px, 1.7vw, 25px);
    font-weight: 600;
    line-height: 1.16;
    letter-spacing: -.025em;
    transition: color .2s ease;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .story__domain { color: #756958; font-size: 9px; }
  .links-tail { padding-top: 42px; }
  .links-tail > h2 {
    margin: 0 0 24px;
    font-family: Fraunces, Georgia, serif;
    font-size: 28px;
    font-weight: 650;
  }
  .links-tail__groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 34px 52px; }
  .link-group h3 {
    margin: 0;
    padding-bottom: 9px;
    border-bottom: 1px solid #b9aa96;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .link-group ul { list-style: none; padding: 0; margin: 0; }
  .link-group li { border-bottom: 1px solid rgba(185, 170, 150, .48); }
  .link-group a {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: baseline;
    padding: 11px 0;
    font-family: Fraunces, Georgia, serif;
    font-size: 16px;
    line-height: 1.25;
  }
  .link-group small {
    color: #756958;
    font-family: "IBM Plex Mono", monospace;
    font-size: 9px;
    letter-spacing: .04em;
  }
  .empty { padding: 72px 0; color: #756958; font-family: "IBM Plex Mono", monospace; }
  @media (max-width: 980px) {
    .wrap { width: min(100% - 40px, 820px); }
    .lead { grid-template-columns: 1fr; gap: 24px; align-items: start; }
    .lead__copy { max-width: 680px; }
    .stories { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .wrap { width: calc(100% - 28px); padding-top: 24px; }
    .masthead { padding-bottom: 18px; }
    .lead { padding: 28px 0 34px; }
    .lead h2 { margin-top: 12px; font-size: 35px; }
    .source { padding: 32px 0 36px; }
    .stories, .links-tail__groups { grid-template-columns: 1fr; }
    .stories { gap: 28px; }
    .link-group a { grid-template-columns: 1fr; gap: 4px; }
  }`;

  const body = `<div class="wrap">
    <header class="masthead"><h1>${esc(ctx.title)}</h1></header>
    <main>
      ${leadHtml}
      ${sourceSections}
      ${linksHtml}
      ${emptyHtml}
    </main>
  </div>`;

  return shell({ title: ctx.title, tagline: '', today: ctx.today, body, css });
}

// =====================================================
// 2) TUBE GRID — compact 16:9 cards with channel-style source headers
// =====================================================

// =====================================================
// 4) CONSOLE — terminal/IDE, image cards on top, link list below
// =====================================================
function buildConsole(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #0b0d10; color: #c6c8cc; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; line-height: 1.55; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 28px 24px 80px; }
  header.site { border-bottom: 1px solid #1f2228; padding-bottom: 16px; margin-bottom: 28px; }
  .site h1 { color: #e6e6e7; font-size: 18px; font-weight: 600; letter-spacing: -0.005em; font-family: "Inter", system-ui, sans-serif; margin: 0; }
  .site .meta { margin-top: 6px; color: #6a7077; font-size: 12px; }
  .site .meta .accent { color: #61dafb; }

  .group { margin-bottom: 28px; }
  .group-comment { color: #5c6370; margin-bottom: 10px; font-size: 12px; }
  .group-comment .tag { color: #98c379; }
  .group-comment .count { color: #d19a66; }

  .items { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .item { background: #11141a; border: 1px solid #1f2228; border-radius: 6px; padding: 12px; display: flex; gap: 12px; }
  .item:hover { background: #161a21; border-color: #2c3340; }
  .item .thumb-box { width: 72px; height: 72px; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: #1a1a1f; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .item .body { min-width: 0; flex: 1; }
  .item h3 { color: #e6e6e7; font-size: 13px; font-weight: 500; line-height: 1.35; font-family: "Inter", system-ui, sans-serif; letter-spacing: -0.005em; margin: 0 0 4px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .item .url { color: #61dafb; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  ${MORE_LINKS_CSS_DARK}
  .more-links__heading { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .more-links__src { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  .statusbar { margin-top: 40px; padding-top: 12px; border-top: 1px solid #1f2228; display: flex; justify-content: space-between; font-size: 11px; color: #5c6370; }
  .statusbar .dot { color: #98c379; }
  @media (max-width: 900px) { .items { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .wrap { padding: 18px 14px; } .items { grid-template-columns: 1fr; } }`;

  const sections = previewGroups.map((g) => {
    const tiles = g.items.map((i) => `<a class="item" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <div class="body">
        <h3>${esc(i.title)}</h3>
        <div class="url">${esc(i.domain || '')}</div>
      </div>
    </a>`).join('');
    return `<section class="group">
      <div class="group-comment">// <span class="tag">${esc(srcLabel(g)).toLowerCase().replace(/\s+/g, '-')}</span> <span class="count">[${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}]</span></div>
      <div class="items">${tiles}</div>
    </section>`;
  }).join('');

  const total = ctx.all.length;
  const body = `<div class="wrap">
    <header class="site">
      <h1>~/${esc((ctx.title || 'untitled').toLowerCase().replace(/\s+/g, '-'))}</h1>
      <div class="meta"><span>// ${total} ${total === 1 ? 'item' : 'items'} · ${ctx.sourceGroups.length} ${ctx.sourceGroups.length === 1 ? 'source' : 'sources'} · </span><span class="accent">$ linkforge --template console</span></div>
    </header>
    ${sections}
    ${moreLinksSection(linkGroups)}
    <div class="statusbar">
      <span><span class="dot">●</span> ready · ${total} items · ${ctx.sourceGroups.length} sources</span>
      <span>linkforge</span>
    </div>
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 5) WALL — uniform image grid (only items with previews), list below
// =====================================================

// =====================================================
// 6) TIMELINE — vertical spine with image rows, link list below
// =====================================================
function buildTimeline(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #fff; color: #0f0f0f; font-family: "Inter", system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.55; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }
  header.site { margin-bottom: 32px; }
  .site h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
  .site .tagline { color: #71717a; font-size: 14px; margin-top: 4px; }

  .spine { position: relative; padding-left: 28px; }
  .spine::before { content: ""; position: absolute; left: 6px; top: 8px; bottom: 0; width: 1px; background: #e5e5e5; }
  .group { margin-bottom: 36px; position: relative; }
  .group::before { content: ""; position: absolute; left: -28px; top: 4px; width: 13px; height: 13px; border-radius: 50%; background: #111; border: 3px solid #fff; box-shadow: 0 0 0 1px #111; }
  .group-hdr { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
  .src-pill { background: #18181b; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 4px; }
  .src-count { color: #a1a1aa; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
  .row { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid #f4f4f5; }
  .row:last-child { border-bottom: 0; }
  .row .thumb-box { width: 96px; height: 64px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #f4f4f5; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .row .body { min-width: 0; flex: 1; }
  .row h3 { font-size: 15px; font-weight: 500; line-height: 1.4; letter-spacing: -0.005em; color: #0f0f0f; margin: 0; }
  .row:hover h3 { color: #2563eb; }
  .row .meta { color: #a1a1aa; font-size: 12px; margin-top: 4px; font-family: ui-monospace, Menlo, monospace; }

  ${MORE_LINKS_CSS_LIGHT}

  @media (max-width: 560px) {
    .wrap { padding: 24px 14px 60px; }
    .spine { padding-left: 22px; }
    .group::before { left: -22px; }
    .row .thumb-box { width: 72px; height: 54px; }
    .row h3 { font-size: 14px; }
  }`;

  const groups = previewGroups.map((g) => {
    const rows = g.items.map((i) => `<a class="row" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <div class="body">
        <h3>${esc(i.title)}</h3>
        <div class="meta">${esc(i.domain || '')}</div>
      </div>
    </a>`).join('');
    return `<section class="group">
      <div class="group-hdr">
        <span class="src-pill">${esc(srcLabel(g)).toUpperCase()}</span>
        <span class="src-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</span>
      </div>
      ${rows}
    </section>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${previewGroups.length ? `<div class="spine">${groups}</div>` : ''}
    ${moreLinksSection(linkGroups)}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 8) BROADSHEET — newspaper front page with lead + side stack
// =====================================================
function buildBroadsheet(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #fbfaf5; color: #111111; font-family: "Iowan Old Style", Iowan, Georgia, serif; }
  .wrap { max-width: 1220px; margin: 0 auto; padding: 28px 26px 88px; }
  header.site { border-top: 4px solid #121212; border-bottom: 1px solid #121212; padding: 18px 0 22px; margin-bottom: 28px; }
  .kicker { display: flex; justify-content: space-between; gap: 16px; font-family: "Inter", system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #6a6258; margin-bottom: 16px; }
  .masthead { display: grid; grid-template-columns: 1fr 320px; gap: 28px; align-items: end; }
  .site h1 { margin: 0; font-size: 64px; line-height: 0.92; font-weight: 800; letter-spacing: -0.06em; }
  .site .tagline { margin-top: 10px; max-width: 60ch; font-family: "Inter", system-ui, sans-serif; font-size: 15px; line-height: 1.55; color: #544c42; }
  .edition { border-left: 1px solid #d7d0c4; padding-left: 18px; font-family: "Inter", system-ui, sans-serif; }
  .edition strong { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #6a6258; margin-bottom: 10px; }
  .edition span { display: block; font-size: 28px; line-height: 1; letter-spacing: -0.04em; font-weight: 700; }

  .sheet { border-top: 1px solid #d7d0c4; padding-top: 24px; margin-bottom: 34px; }
  .sheet-head { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; margin-bottom: 18px; }
  .sheet-name { font-family: "Inter", system-ui, sans-serif; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
  .sheet-count { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #6a6258; }
  .front { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr); gap: 22px; }
  .lead { display: block; }
  .lead .media-frame { aspect-ratio: 16/10; margin-bottom: 16px; }
  .lead h2 { margin: 0 0 12px; font-size: 40px; line-height: 0.95; letter-spacing: -0.05em; font-weight: 800; }
  .lead .meta { display: flex; flex-wrap: wrap; gap: 8px; font-family: "Inter", system-ui, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: #6a6258; }

  .stack { display: flex; flex-direction: column; gap: 0; border-top: 1px solid #d7d0c4; }
  .stack-item { display: grid; grid-template-columns: 120px 1fr; gap: 14px; align-items: start; padding: 16px 0; border-bottom: 1px solid #e5dfd4; }
  .stack-item .media-frame { aspect-ratio: 4/3; }
  .stack-item h3 { margin: 0; font-size: 21px; line-height: 1.04; letter-spacing: -0.035em; font-weight: 700; }
  .stack-item .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; font-family: "Inter", system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #7b7268; }

  .briefs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
  .brief { display: block; padding-top: 14px; border-top: 1px solid #d7d0c4; }
  .brief h4 { margin: 0; font-size: 18px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 700; }
  .brief .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; font-family: "Inter", system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #7b7268; }

  .media-frame { position: relative; border-radius: 2px; overflow: hidden; background: #e6ded0; }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; }
  .media-frame__badge { position: absolute; left: 10px; top: 10px; padding: 4px 8px; background: rgba(251,250,245,0.92); color: #111; font-family: "Inter", system-ui, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 10px; bottom: 10px; width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; background: rgba(17,17,17,0.78); color: #fff; }
  .media-frame__play svg { width: 16px; height: 16px; margin-left: 2px; }
  .pill { display: inline-flex; align-items: center; padding: 4px 8px; background: #f0ebe0; }

  .smart-links { margin-top: 34px; padding-top: 20px; border-top: 1px solid #d7d0c4; }
  .smart-links__header { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 18px; }
  .smart-links__heading { margin: 0; font-family: "Inter", system-ui, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #6a6258; }
  .smart-links__desc { margin: 0; font-family: "Inter", system-ui, sans-serif; font-size: 13px; color: #6a6258; }
  .smart-links__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .smart-links__group { padding-top: 12px; border-top: 1px solid #d7d0c4; }
  .smart-links__src { margin-bottom: 10px; font-family: "Inter", system-ui, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6a6258; }
  .smart-links__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .smart-links__list a { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; color: #111; }
  .smart-links__title { flex: 1; min-width: 0; font-size: 16px; line-height: 1.28; }
  .smart-links__meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .smart-links__type, .smart-links__domain { font-family: "Inter", system-ui, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6a6258; }

  @media (max-width: 980px) {
    .masthead, .front { grid-template-columns: 1fr; }
    .site h1 { font-size: 48px; }
    .briefs { grid-template-columns: 1fr; }
    .smart-links__grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .wrap { padding: 22px 16px 64px; }
    .site h1 { font-size: 38px; }
    .lead h2 { font-size: 30px; }
    .stack-item { grid-template-columns: 96px 1fr; }
    .stack-item h3 { font-size: 18px; }
    .smart-links__header, .smart-links__list a { flex-direction: column; align-items: flex-start; }
  }`;

  const sections = previewGroups.map((g) => {
    const [lead, ...rest] = g.items;
    const stackItems = rest.slice(0, 3).map((i) => `<a class="stack-item" href="${attr(i.href)}" target="_blank" rel="noopener">
      ${mediaFrame(i)}
      <div>
        <h3>${esc(i.title)}</h3>
        <div class="meta"><span class="pill">${esc(i.domain || srcLabel(g))}</span></div>
      </div>
    </a>`).join('');
    const briefs = rest.slice(3).map((i) => `<a class="brief" href="${attr(i.href)}" target="_blank" rel="noopener">
      <h4>${esc(i.title)}</h4>
      <div class="meta"><span class="pill">${esc(i.domain || srcLabel(g))}</span></div>
    </a>`).join('');
    return `<section class="sheet">
      <div class="sheet-head">
        <div class="sheet-name">${esc(srcLabel(g))}</div>
        <div class="sheet-count">${g.items.length} ${g.items.length === 1 ? 'story' : 'stories'}</div>
      </div>
      <div class="front">
        <a class="lead" href="${attr(lead.href)}" target="_blank" rel="noopener">
          ${mediaFrame(lead)}
          <h2>${esc(lead.title)}</h2>
          <div class="meta"><span class="pill">${esc(lead.domain || srcLabel(g))}</span></div>
        </a>
        <div class="stack">${stackItems}</div>
      </div>
      ${briefs ? `<div class="briefs">${briefs}</div>` : ''}
    </section>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <div class="kicker"><span>Broadsheet edition</span><span>${esc(ctx.today || '')}</span></div>
      <div class="masthead">
        <div>
          <h1>${esc(ctx.title)}</h1>
          ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        </div>
        <aside class="edition">
          <strong>Front page</strong>
          <span>${ctx.sourceGroups.length}</span>
          <div>${ctx.sourceGroups.length === 1 ? 'source in this edition' : 'sources in this edition'}</div>
        </aside>
      </div>
    </header>
    ${sections}
    ${smartLinksSection(linkGroups, { heading: 'Further reading' })}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// FLUX INDEX — obsidian mixed-media index
// =====================================================

// =====================================================
// POP SHELF — light architectural media gallery
// =====================================================

// =====================================================
// 9) SIGNAL — retired dark intelligence-style dashboard
// =====================================================
function buildSignal(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const css = `
  :root { --signal-blue: #1848d8; --signal-ink: #17191d; --signal-line: #d8d6cf; }
  body { background: #f3f1eb; color: var(--signal-ink); font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .shell { max-width: 1380px; margin: 0 auto; padding: 28px 28px 80px; }
  .masthead { padding: 4px 0 28px; border-bottom: 1px solid var(--signal-ink); }
  .masthead h1 { margin: 0; font-family: "Space Grotesk", sans-serif; font-size: clamp(34px, 5vw, 68px); line-height: .94; letter-spacing: -.055em; }
  .layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 48px; padding-top: 32px; }
  .source-index { position: sticky; top: 24px; align-self: start; }
  .source-index__label { margin-bottom: 14px; color: #6d6d68; font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .11em; text-transform: uppercase; }
  .source-index a { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; padding: 10px 0; border-top: 1px solid var(--signal-line); }
  .source-index a:last-child { border-bottom: 1px solid var(--signal-line); }
  .source-index__num { color: var(--signal-blue); font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; }
  .source-index__name { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .source-index a:hover .source-index__name { color: var(--signal-blue); }
  .feed { min-width: 0; }
  .source-section { margin-bottom: 56px; scroll-margin-top: 24px; }
  .source-head { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--signal-ink); }
  .source-head h2 { margin: 0; font-family: "Space Grotesk", sans-serif; font-size: 17px; letter-spacing: -.02em; }
  .source-head span { color: #777772; font-family: "IBM Plex Mono", monospace; font-size: 10px; text-transform: uppercase; }
  .visual-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 18px; padding-top: 18px; }
  .signal-story { grid-column: span 4; min-width: 0; }
  .signal-story:first-child { grid-column: span 6; }
  .signal-story:nth-child(2) { grid-column: span 6; }
  .signal-story__media { aspect-ratio: 16/10; overflow: hidden; background: #dfddd7; }
  .signal-story__media img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.92); transition: transform .4s var(--ease-out), filter .25s ease; }
  .signal-story:hover img { transform: scale(1.025); filter: saturate(1.08); }
  .signal-story h3 { margin: 10px 0 0; font-family: "Fraunces", Georgia, serif; font-size: 18px; line-height: 1.17; font-weight: 650; letter-spacing: -.015em; }
  .signal-story:first-child h3, .signal-story:nth-child(2) h3 { font-size: 22px; }
  .signal-story:hover h3 { color: var(--signal-blue); }
  .signal-story__meta { display: block; margin-top: 6px; color: #777772; font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .link-block { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; margin-top: 24px; border-top: 1px solid var(--signal-line); }
  .link-block a { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--signal-line); font-family: "Fraunces", Georgia, serif; font-size: 14px; line-height: 1.25; }
  .link-block a:hover { color: var(--signal-blue); }
  .link-block small { flex: 0 0 auto; color: #85857f; font-family: "IBM Plex Mono", monospace; font-size: 9px; }
  .empty { padding: 22px 0; border-bottom: 1px solid var(--signal-line); color: #777772; font-size: 13px; }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; gap: 32px; }
    .source-index { position: static; display: flex; gap: 18px; overflow-x: auto; padding-bottom: 8px; }
    .source-index__label { display: none; }
    .source-index a { min-width: 150px; border-bottom: 1px solid var(--signal-line); }
  }
  @media (max-width: 680px) {
    .shell { padding: 22px 16px 56px; }
    .masthead { padding-bottom: 20px; }
    .visual-grid { gap: 14px; }
    .signal-story, .signal-story:first-child, .signal-story:nth-child(2) { grid-column: span 12; }
    .signal-story h3, .signal-story:first-child h3, .signal-story:nth-child(2) h3 { font-size: 18px; }
    .link-block { grid-template-columns: 1fr; }
  }`;

  const index = groups.map((group, idx) => `<a href="#signal-source-${idx + 1}">
    <span class="source-index__num">${String(idx + 1).padStart(2, '0')}</span>
    <span class="source-index__name">${esc(srcLabel(group))}</span>
  </a>`).join('');

  const sections = groups.map((group, groupIdx) => {
    const stories = group.previewItems.map((item) => `<a class="signal-story" href="${attr(item.href)}" target="_blank" rel="noopener">
      <div class="signal-story__media">${thumbImg(item, 'decoding="async" onerror="this.remove()"')}</div>
      <h3>${esc(item.title || item.href)}</h3>
      <span class="signal-story__meta">${esc(item.domain || srcLabel(group))}</span>
    </a>`).join('');
    const links = group.linkItems.map((item) => `<a href="${attr(item.href)}" target="_blank" rel="noopener">
      <span>${esc(item.title || item.href)}</span>
      <small>${esc(item.domain || 'link')}</small>
    </a>`).join('');
    return `<section class="source-section" id="signal-source-${groupIdx + 1}">
      <div class="source-head">
        <h2>${esc(srcLabel(group))}</h2>
        <span>${group.previewItems.length + group.linkItems.length} ${group.previewItems.length + group.linkItems.length === 1 ? 'item' : 'items'}</span>
      </div>
      ${stories ? `<div class="visual-grid">${stories}</div>` : '<div class="empty">No image previews in this source.</div>'}
      ${links ? `<div class="link-block">${links}</div>` : ''}
    </section>`;
  }).join('');

  const body = `<div class="shell">
    <header class="masthead"><h1>${esc(ctx.title)}</h1></header>
    <div class="layout">
      <nav class="source-index" aria-label="Sources">
        <div class="source-index__label">Source index</div>
        ${index}
      </nav>
      <main class="feed">${sections || '<div class="empty">No items selected for this export yet.</div>'}</main>
    </div>
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'signal-theme' });
}

// ---------- expose ----------
if (typeof window !== 'undefined') {
  window.LINKFORGE_TEMPLATES = TEMPLATES;
  window.LINKFORGE_SUGGEST = suggestTemplate;
  window.LINKFORGE_SUGGEST_TEMPLATE = suggestTemplate;
}
if (typeof module !== 'undefined') {
  module.exports = { TEMPLATES, suggestTemplate, splitItems, partitionGroups, planRows, planGrid, SHAPES };
}
