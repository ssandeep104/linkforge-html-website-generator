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

const SOURCE_TABS_CSS = `
  .tab-shell { display: grid; gap: 24px; }
  .tab-nav { display: flex; flex-wrap: wrap; gap: 8px; }
  .tab-btn {
    min-width: 170px;
    display: grid;
    gap: 4px;
    padding: 12px 16px;
    border-radius: var(--lf-radius-md);
    border: 1.5px solid var(--tab-border, rgba(24,24,27,0.15));
    background: var(--tab-bg, rgba(255,255,255,0.72));
    color: var(--tab-text, inherit);
    box-shadow: none;
    cursor: pointer;
    text-align: left;
    transition: all .2s ease;
  }
  .tab-btn:hover {
    transform: translateY(-1px);
    border-color: var(--tab-border-hover, rgba(24,24,27,0.3));
    background: var(--tab-bg-hover, rgba(255,255,255,0.9));
  }
  .tab-btn.active {
    transform: none;
    border-color: var(--tab-active-border, #111);
    background: var(--tab-active-bg, #fff);
    color: var(--tab-active-text, #111);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  .tab-btn:focus-visible { outline: 2px solid var(--tab-active-border, currentColor); outline-offset: 4px; }
  .tab-btn__title { font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 14px; line-weight: 1.2; font-weight: 600; letter-spacing: -0.01em; }
  .tab-btn__meta { font-family: 'IBM Plex Mono', monospace; font-size: 9px; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.1em; color: var(--tab-meta, inherit); opacity: 0.75; }
  .tab-panels { position: relative; }
  .tab-panel {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    max-height: 0;
    overflow: hidden;
    transform: translateY(12px) scale(0.99);
    transform-origin: top center;
    transition: opacity .24s ease, transform .24s ease, max-height .3s ease, visibility 0s linear .24s;
  }
  .tab-panel.active {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    max-height: 12000px;
    overflow: visible;
    transform: none;
    transition: opacity .3s ease, transform .3s ease, max-height .4s ease;
  }
  @media (max-width: 700px) {
    .tab-nav { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .tab-btn { width: 100%; min-width: 0; }
  }
`;

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
function partitionGroups(sourceGroups) {
  // Pass 1 — collect every href that will render as a preview card.
  const previewHrefs = new Set();
  for (const g of sourceGroups || []) {
    for (const it of g.items || []) {
      if (hasPreview(it)) previewHrefs.add(it.href);
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
      if (hasPreview(it)) {
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

function renderSourceTabs(groups, renderPanel, { prefix = 'source-tabs', emptyHtml = '' } = {}) {
  if (!groups.length) return emptyHtml;

  const tabs = `<nav class="tab-nav" role="tablist" aria-label="Source tabs">${groups.map((group, index) => `
    <button
      class="tab-btn${index === 0 ? ' active' : ''}"
      type="button"
      role="tab"
      id="${prefix}-tab-${index}"
      aria-selected="${index === 0 ? 'true' : 'false'}"
      aria-controls="${prefix}-panel-${index}"
      data-tab-target="${prefix}-panel-${index}"
    >
      <span class="tab-btn__title">${esc(srcLabel(group))}</span>
      <span class="tab-btn__meta">${group.previewItems.length} ${group.previewItems.length === 1 ? 'preview' : 'previews'} · ${group.linkItems.length} ${group.linkItems.length === 1 ? 'link' : 'links'}</span>
    </button>
  `).join('')}</nav>`;

  const panels = `<div class="tab-panels">${groups.map((group, index) => `
    <section
      class="tab-panel${index === 0 ? ' active' : ''}"
      id="${prefix}-panel-${index}"
      role="tabpanel"
      aria-labelledby="${prefix}-tab-${index}"
      aria-hidden="${index === 0 ? 'false' : 'true'}"
    >
      ${renderPanel(group, index)}
    </section>
  `).join('')}</div>`;

  const script = `<script>
  (function() {
    var shell = document.querySelector('[data-tab-shell="${prefix}"]');
    if (!shell) return;
    var btns = Array.prototype.slice.call(shell.querySelectorAll('.tab-btn'));
    var panels = Array.prototype.slice.call(shell.querySelectorAll('.tab-panel'));
    function activate(btn) {
      var target = btn.getAttribute('data-tab-target');
      btns.forEach(function(node) {
        var active = node === btn;
        node.classList.toggle('active', active);
        node.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(function(panel) {
        var active = panel.id === target;
        panel.classList.toggle('active', active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    }

    btns.forEach(function(btn, index) {
      btn.addEventListener('click', function() { activate(btn); });
      btn.addEventListener('keydown', function(event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        var nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % btns.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + btns.length) % btns.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = btns.length - 1;
        btns[nextIndex].focus();
        activate(btns[nextIndex]);
      });
    });
  })();
  </script>`;

  return `<div class="tab-shell" data-tab-shell="${prefix}">${tabs}${panels}</div>${script}`;
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
    reel: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0a0a0a"/><rect x="8" y="6" width="144" height="32" rx="3" fill="#1f1f23"/><rect x="8" y="40" width="80" height="4" rx="1" fill="#fff" opacity=".85"/><rect x="8" y="48" width="40" height="3" rx="1" fill="#888"/><rect x="8" y="58" width="34" height="20" rx="2" fill="#374151"/><rect x="46" y="58" width="34" height="20" rx="2" fill="#1f2937"/><rect x="84" y="58" width="34" height="20" rx="2" fill="#374151"/><rect x="122" y="58" width="30" height="20" rx="2" fill="#1f2937"/><rect x="8" y="84" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="91" width="60" height="3" rx="1" fill="#444"/></svg>`,
    console: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0b0d10"/><rect x="8" y="8" width="50" height="4" rx="1" fill="#61dafb"/><rect x="8" y="18" width="80" height="3" rx="1" fill="#5c6370"/><rect x="8" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="50" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="58" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="66" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="74" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="82" width="60" height="3" rx="1" fill="#5c6370"/></svg>`,
    wall: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafafa"/><rect x="8" y="6" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="14" width="34" height="34" rx="3" fill="#dc2626"/><rect x="46" y="14" width="34" height="34" rx="3" fill="#7c3aed"/><rect x="84" y="14" width="34" height="34" rx="3" fill="#06b6d4"/><rect x="122" y="14" width="30" height="34" rx="3" fill="#f59e0b"/><rect x="8" y="56" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="71" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="80" y="71" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    timeline: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><line x1="22" y1="15" x2="22" y2="95" stroke="#e5e5e5" stroke-width="1"/><circle cx="22" cy="22" r="4" fill="#111"/><rect x="32" y="18" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="28" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="40" width="110" height="10" rx="2" fill="#f4f4f5"/><circle cx="22" cy="58" r="4" fill="#111"/><rect x="32" y="54" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="64" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="71" width="110" height="3" rx="1" fill="#bbb"/><rect x="32" y="78" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="85" width="110" height="3" rx="1" fill="#bbb"/></svg>`,
    bento: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#f6efe4"/><rect x="8" y="8" width="90" height="50" rx="6" fill="#121212"/><rect x="104" y="8" width="48" height="24" rx="6" fill="#f97316"/><rect x="104" y="36" width="48" height="22" rx="6" fill="#14b8a6"/><rect x="8" y="64" width="34" height="24" rx="6" fill="#facc15"/><rect x="46" y="64" width="52" height="24" rx="6" fill="#ffffff" stroke="#d6d3d1"/><rect x="104" y="64" width="48" height="24" rx="6" fill="#ffffff" stroke="#d6d3d1"/></svg>`,
    broadsheet: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fbfaf5"/><rect x="8" y="8" width="144" height="6" rx="1" fill="#111827"/><rect x="8" y="20" width="68" height="44" rx="2" fill="#d6d3d1"/><rect x="82" y="20" width="70" height="5" rx="1" fill="#111827"/><rect x="82" y="30" width="70" height="3" rx="1" fill="#6b7280"/><rect x="82" y="38" width="70" height="3" rx="1" fill="#9ca3af"/><rect x="82" y="46" width="70" height="3" rx="1" fill="#9ca3af"/><line x1="8" y1="72" x2="152" y2="72" stroke="#111827" stroke-width="1"/><rect x="8" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="56" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="104" y="78" width="40" height="3" rx="1" fill="#111827"/></svg>`,
    signal: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#09111f"/><rect x="8" y="8" width="34" height="84" rx="6" fill="#0f1c34"/><rect x="50" y="8" width="102" height="20" rx="6" fill="#16233d"/><rect x="56" y="14" width="34" height="4" rx="1" fill="#f1f5f9"/><rect x="50" y="34" width="102" height="24" rx="6" fill="#16233d"/><rect x="50" y="64" width="102" height="24" rx="6" fill="#16233d"/><circle cx="64" cy="46" r="4" fill="#38bdf8"/><circle cx="64" cy="76" r="4" fill="#f97316"/><rect x="74" y="43" width="52" height="3" rx="1" fill="#f1f5f9"/><rect x="74" y="73" width="52" height="3" rx="1" fill="#f1f5f9"/></svg>`,
    marquee: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mqg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f97066"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="160" height="100" fill="#08080b"/><circle cx="150" cy="10" r="42" fill="url(#mqg)" opacity="0.55"/><rect x="10" y="10" width="60" height="4" rx="1" fill="#f4f4f5"/><rect x="10" y="20" width="80" height="34" rx="4" fill="#18181b" stroke="#3f3f46"/><polygon points="46,32 46,42 56,37" fill="#f97066"/><rect x="94" y="20" width="56" height="34" rx="4" fill="#18181b" stroke="#3f3f46"/><rect x="104" y="30" width="36" height="4" rx="1" fill="#f4f4f5"/><rect x="104" y="40" width="24" height="3" rx="1" fill="#71717a"/><rect x="10" y="60" width="66" height="30" rx="4" fill="#18181b" stroke="#3f3f46"/><rect x="80" y="60" width="70" height="30" rx="4" fill="#18181b" stroke="#3f3f46"/><rect x="16" y="66" width="30" height="4" rx="1" fill="#f4f4f5"/><rect x="16" y="74" width="20" height="3" rx="1" fill="#f97066"/><rect x="86" y="66" width="30" height="4" rx="1" fill="#f4f4f5"/><rect x="86" y="74" width="20" height="3" rx="1" fill="#38bdf8"/></svg>`,
  };
  return layouts[layout] || layouts.stream;
}

// ---------- registry ----------
const TEMPLATES = {
  marquee: {
    name: 'Marquee',
    desc: 'A high-performance, streaming-style showcase: big autoplaying source tiles that loop MP4 previews or thumbnail slideshows as you scroll.',
    focus: 'Streaming',
    fit: 'Best when most of your picks are videos or rich thumbnails',
    featured: true,
    featuredLabel: 'Featured · Streaming',
    requires: 'multimedia',
    preview: () => previewSvg('marquee'),
    validate: (ctx) => marqueeValidate(ctx),
    build: (ctx) => buildMarquee(normalize(ctx)),
  },
  youtube: {
    name: 'Creator Grid',
    desc: 'Tabbed source channels with fast-scanning cards for clips, reels, and drops.',
    focus: 'Video',
    fit: 'Great for YouTube, TikTok, Vimeo, and mixed creator feeds',
    preview: () => previewSvg('stream'),
    build: (ctx) => buildYoutube(normalize(ctx)),
  },
  cinema: {
    name: 'Stream Catalog',
    desc: 'Lean-back dark catalog with source tabs, bigger key art, and a watchlist feel.',
    focus: 'Streaming',
    fit: 'Best for heavy video selections and living-room style browsing',
    preview: () => previewSvg('reel'),
    build: (ctx) => buildCinema(normalize(ctx)),
  },
  wall: {
    name: 'Photo Wall',
    desc: 'Tabbed gallery walls that keep each source in its own visual lane.',
    focus: 'Gallery',
    fit: 'Best for photography, lookbooks, product shots, and image sets',
    preview: () => previewSvg('wall'),
    build: (ctx) => buildWall(normalize(ctx)),
  },
  bento: {
    name: 'Spotlight Bento',
    desc: 'Source-tabbed featured cards plus supporting tiles for mixed media collections.',
    focus: 'Mixed media',
    fit: 'Best for launches, recaps, roundups, and mixed story + visual drops',
    preview: () => previewSvg('bento'),
    build: (ctx) => buildBento(normalize(ctx)),
  },
  signal: {
    name: 'Signal Board',
    desc: 'Dense dark source tabs with stronger metadata for frequent updates.',
    focus: 'Dashboard',
    fit: 'Best for recurring drops, research boards, and multi-source monitoring',
    preview: () => previewSvg('signal'),
    build: (ctx) => buildSignal(normalize(ctx)),
  },
  editorial: {
    name: 'Story Deck',
    desc: 'Story-led source tabs for article-heavy picks without the newspaper feel.',
    focus: 'Stories',
    fit: 'Best for mixed article links when you still want a calm visual rhythm',
    preview: () => previewSvg('editorial'),
    build: (ctx) => buildEditorial(normalize(ctx)),
  },
};

function suggestTemplate(counts) {
  const t = counts.total || 1;
  if (counts.video / t >= 0.55) return 'cinema';
  if (counts.gallery / t >= 0.4) return 'wall';
  if (counts.video / t >= 0.3) return 'youtube';
  if (counts.gallery / t >= 0.2 || counts.article / t >= 0.55) return 'bento';
  return 'signal';
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

function shell({ title, tagline, today, body, css, bodyClass = '' }) {
  const bodyClasses = ['lf-template', bodyClass].filter(Boolean).join(' ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(tagline || '')}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --lf-radius-sm: 4px;
    --lf-radius-md: 6px;
    --lf-radius-lg: 8px;
    --lf-radius-xl: 12px;
    --lf-shadow-soft: 0 4px 20px rgba(15, 23, 42, 0.05);
    --lf-shadow-deep: 0 12px 38px rgba(15, 23, 42, 0.1);
  }
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin: 0; padding: 0; }
  img { display: block; max-width: 100%; }
  a { color: inherit; text-decoration: none; transition: color .24s ease, transform .24s ease, box-shadow .24s ease; }
  .lf-template {
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .lf-template h1,
  .lf-template h2,
  .lf-template h3,
  .lf-template h4 { text-wrap: balance; }
  .lf-template p,
  .lf-template .tagline { text-wrap: pretty; }
  .lf-template a:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
    border-radius: 8px;
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
    transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease, background .28s ease;
  }
  .lf-template .tab-btn {
    position: relative;
    isolation: isolate;
    overflow: hidden;
  }
  .lf-template .tab-btn::after {
    content: "";
    position: absolute;
    inset: -2px;
    pointer-events: none;
    opacity: 0;
    background: linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.28) 50%, transparent 75%);
    transform: translateX(-60%);
    transition: opacity .24s ease;
  }
  .lf-template .tab-btn:hover::after,
  .lf-template .tab-btn.active::after {
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
    transition: transform .36s ease;
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
    box-shadow: var(--lf-shadow-soft);
  }
  .lf-template .source:hover,
  .lf-template .source-stage:hover,
  .lf-template .source-block:hover,
  .lf-template .tab-stage:hover,
  .lf-template .panel:hover {
    box-shadow: var(--lf-shadow-deep);
  }
  @keyframes lf-tab-sheen {
    from { transform: translateX(-60%); }
    to { transform: translateX(70%); }
  }
${css}
</style>
</head>
<body class="${bodyClasses}">
${body}
</body>
</html>`;
}

// =====================================================
// 1) STORY DECK — calm story-led layout for mixed article/image sets
// =====================================================
function buildEditorial(ctx) {
  const tabGroups = buildSourceTabs(ctx.sourceGroups);

  const css = `
  body { background-color: #fcf9f2; color: #1a140c; font-family: "Inter", system-ui, -apple-system, sans-serif; line-height: 1.6; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1.5px solid #c9bd9d; }
  .eyebrow { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 2px; background: #b23a2c; color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 32px; align-items: end; margin-top: 20px; }
  .site h1 { margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 52px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 800; color: #1a140c; }
  .site .tagline { margin-top: 14px; max-width: 60ch; color: #6b5e44; font-size: 16px; font-weight: 400; }
  .site-note { padding: 20px; border-radius: var(--lf-radius-md); background: #f7f1e1; border: 1.5px solid #c9bd9d; }
  .site-note strong { display: block; font-family: 'Fraunces', Georgia, serif; font-size: 28px; line-height: 1.1; font-weight: 700; color: #b23a2c; }
  .site-note span { display: block; margin-top: 8px; color: #6b5e44; font-size: 12px; font-family: 'IBM Plex Mono', monospace; }
  
  .source { margin-bottom: 48px; }
  .source-head { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 20px; }
  .source-name { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #1a140c; }
  .source-count { color: #8e8264; font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
  .source-progress { display: grid; gap: 4px; min-width: 160px; }
  .source-progress__label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #b23a2c; font-weight: 600; }
  .source-progress__bar { height: 4px; border-radius: 999px; background: rgba(178, 58, 44, 0.12); overflow: hidden; }
  .source-progress__bar > span { display: block; height: 100%; background: #b23a2c; }

  .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; }
  .story-card { display: flex; flex-direction: column; min-width: 0; padding: 16px; border-radius: var(--lf-radius-lg); background: #fbf6ea; border: 1.5px solid #c9bd9d; box-shadow: none; transition: all 0.22s ease; }
  .story-card:hover { transform: translateY(-2px); border-color: #b23a2c; box-shadow: 0 8px 24px rgba(178, 58, 44, 0.06); }
  .story-card--lead { grid-column: span 7; }
  .story-card--lead .media-frame { aspect-ratio: 16/10; margin-bottom: 16px; }
  .story-card--lead h3 { font-family: 'Fraunces', Georgia, serif; font-size: 28px; line-height: 1.15; font-weight: 800; color: #1a140c; }
  .story-card--support { grid-column: span 5; }
  .story-card--support .media-frame { aspect-ratio: 16/10; margin-bottom: 14px; }
  .story-card--support h3 { font-family: 'Fraunces', Georgia, serif; font-size: 20px; line-height: 1.2; font-weight: 800; color: #1a140c; }
  .story-card--mini { grid-column: span 4; }
  .story-card--mini .media-frame { aspect-ratio: 4/3; margin-bottom: 12px; }
  .story-card--mini h3 { font-family: 'Fraunces', Georgia, serif; font-size: 16px; line-height: 1.3; font-weight: 700; color: #1a140c; }
  .story-card h3 { margin: 0; transition: color 0.2s ease; }
  .story-card:hover h3 { color: #b23a2c; }
  .story-card .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .pill { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 2px; background: #e6dcc4; color: #6b5e44; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; }
  .media-frame { position: relative; overflow: hidden; border-radius: var(--lf-radius-md); background: #e6dcc4; border: 1px solid rgba(26, 20, 12, 0.1); }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; }
  .media-frame__badge { position: absolute; left: 10px; top: 10px; padding: 3px 8px; border-radius: 2px; background: #1a140c; color: #f1e9d7; font-family: 'IBM Plex Mono', monospace; font-size: 8px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 10px; bottom: 10px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: rgba(26, 20, 12, 0.9); color: #fff; }
  .media-frame__play svg { width: 14px; height: 14px; margin-left: 2px; }
  .source-stage { padding: 24px; border-radius: var(--lf-radius-xl); background: #fbf6ea; border: 1.5px solid #c9bd9d; box-shadow: none; }
  .source-stage__head { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 20px; }
  .source-stage__eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #b23a2c; font-weight: 700; }
  .empty { padding: 32px; border-radius: var(--lf-radius-lg); background: rgba(230, 220, 196, 0.3); border: 1.5px dashed #c9bd9d; color: #6b5e44; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #fbf6ea;
    --tab-text: #1a140c;
    --tab-border: #c9bd9d;
    --tab-border-hover: #b23a2c;
    --tab-bg-hover: #f7f1e1;
    --tab-active-bg: #1a140c;
    --tab-active-border: #1a140c;
    --tab-active-text: #f1e9d7;
    --tab-meta: #8e8264;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #8e8264; opacity: 0.9; }

  ${MORE_LINKS_CSS_LIGHT}
  .more-links { border-top-color: #c9bd9d; }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #1a140c; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: #b23a2c; border-bottom-color: #c9bd9d; }
  .more-links__list li { border-bottom-color: rgba(201, 189, 157, 0.4); }
  .more-links__list a { color: #1a140c; font-weight: 500; }
  .more-links__list a:hover { color: #b23a2c; }
  .more-links__domain { color: #8e8264; }

  @media (max-width: 980px) {
    .site-head { grid-template-columns: 1fr; gap: 16px; }
    .site h1 { font-size: 40px; }
    .story-card--lead, .story-card--support, .story-card--mini { grid-column: span 12; }
  }
  @media (max-width: 640px) {
    .wrap { padding: 32px 16px 64px; }
    .source-head { flex-direction: column; align-items: flex-start; gap: 10px; }
    .source-stage { padding: 16px; border-radius: var(--lf-radius-lg); }
    .source-stage__head { flex-direction: column; align-items: flex-start; gap: 10px; }
    .source-progress { min-width: 100%; }
    .story-card { border-radius: var(--lf-radius-lg); }
    .story-card--lead h3 { font-size: 22px; }
  }`;

  const sections = renderSourceTabs(tabGroups, (group) => {
    const coverage = previewCoverage(group);
    const cards = group.previewItems.map((i, idx) => {
      const cls = idx === 0 ? 'story-card story-card--lead' : idx === 1 ? 'story-card story-card--support' : 'story-card story-card--mini';
      return `<a class="${cls}" href="${attr(i.href)}" target="_blank" rel="noopener">
        ${mediaFrame(i)}
        <h3>${esc(i.title)}</h3>
        <div class="meta"><span class="pill">${esc(i.domain || srcLabel(group))}</span></div>
      </a>`;
    }).join('');
    return `<section class="source-stage">
      <div class="source-stage__head">
        <div>
          <div class="source-stage__eyebrow">Source ${group.sourceIndex + 1}</div>
          <div class="source-name">${esc(srcLabel(group))}</div>
        </div>
        <div class="source-progress">
          <div class="source-count">${group.previewItems.length} ${group.previewItems.length === 1 ? 'preview' : 'previews'} · ${group.linkItems.length} ${group.linkItems.length === 1 ? 'link' : 'links'}</div>
          <div class="source-progress__label">Preview coverage ${coverage}%</div>
          <div class="source-progress__bar"><span style="width:${coverage}%"></span></div>
        </div>
      </div>
      ${cards ? `<div class="grid">${cards}</div>` : '<div class="empty">This source has no thumbnail-ready items, but its saved links are still listed below.</div>'}
      ${tabLinksSection(group, 'More from this source')}
    </section>`;
  }, {
    prefix: 'story-deck-tabs',
    emptyHtml: '<div class="empty">No items selected for this export yet.</div>',
  });

  const body = `<div class="wrap">
    <header class="site">
      <div class="eyebrow">Story deck</div>
      <div class="site-head">
        <div>
          <h1>${esc(ctx.title)}</h1>
          ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        </div>
        <aside class="site-note">
          <strong>${ctx.all.length}</strong>
          <span>${ctx.sourceGroups.length} ${ctx.sourceGroups.length === 1 ? 'source' : 'sources'} arranged into featured and supporting story cards.</span>
        </aside>
      </div>
    </header>
    ${sections}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 2) TUBE GRID — compact 16:9 cards with channel-style source headers
// =====================================================
function buildYoutube(ctx) {
  const tabGroups = buildSourceTabs(ctx.sourceGroups);

  // Deterministic accent color per source based on name hash
  const ACCENT_COLORS = ['#1c62b9','#c2410c','#15803d','#7c3aed','#b91c1c','#0e7490','#92400e','#3730a3','#be185d','#0f766e'];
  function srcAccent(label) {
    let h = 0;
    for (let i = 0; i < label.length; i++) h = Math.imul(h * 31 + label.charCodeAt(i), 1) | 0;
    return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
  }
  function srcInitials(label) {
    return (label || 'S').split(/[\s._/-]+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }

  const css = `
  body { background-color: #fcf9f2; color: #1a140c; font-family: "Inter", system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1.5px solid #c9bd9d; }
  .site-head { display: flex; justify-content: space-between; gap: 20px; align-items: end; }
  .site h1 { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: #1a140c; }
  .site .tagline { color: #6b5e44; font-size: 15px; margin-top: 8px; }
  .site-stat { flex: 0 0 auto; padding: 12px 16px; border-radius: var(--lf-radius-md); background: #f7f1e1; border: 1.5px solid #c9bd9d; }
  .site-stat strong { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 24px; line-height: 1; font-weight: 700; color: #b23a2c; }
  .site-stat span { display: block; margin-top: 4px; color: #6b5e44; font-size: 11px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; }
  .source-block { padding: 24px; border-radius: var(--lf-radius-xl); background: #fbf6ea; border: 1.5px solid #c9bd9d; box-shadow: none; }
  .source-hdr { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1.5px solid #e6dcc4; }
  .source-hdr__main { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .src-avatar { width: 34px; height: 34px; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
  .src-info { min-width: 0; }
  .src-name { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #1a140c; line-height: 1.2; }
  .src-count { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #8e8264; margin-top: 2px; }
  .src-health { display: grid; gap: 4px; min-width: 150px; }
  .src-health__label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #b23a2c; font-weight: 600; text-align: right; }
  .src-health__bar { height: 4px; border-radius: 999px; background: rgba(178, 58, 44, 0.12); overflow: hidden; }
  .src-health__bar > span { display: block; height: 100%; background: #b23a2c; }

  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px 16px; }
  .card { display: block; min-width: 0; border-radius: var(--lf-radius-md); transition: all 0.2s ease; }
  .card .thumb-box { aspect-ratio: 16/9; overflow: hidden; background: #e6dcc4; border-radius: var(--lf-radius-md); border: 1px solid rgba(26, 20, 12, 0.1); margin-bottom: 12px; position: relative; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb-badge { position: absolute; bottom: 8px; right: 8px; background: rgba(26, 20, 12, 0.9); color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 2px; }
  .card h3 { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; line-height: 1.4; margin: 0; color: #1a140c; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color 0.2s ease; }
  .card .card-meta { margin-top: 6px; font-family: 'IBM Plex Mono', monospace; color: #8e8264; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card:hover h3 { color: #b23a2c; }
  .card:hover .thumb-box { border-color: #b23a2c; }

  .empty { margin-top: 34px; border: 1.5px dashed #c9bd9d; border-radius: var(--lf-radius-lg); padding: 32px; color: #6b5e44; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(230, 220, 196, 0.3); }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #fbf6ea;
    --tab-text: #1a140c;
    --tab-border: #c9bd9d;
    --tab-border-hover: #b23a2c;
    --tab-bg-hover: #f7f1e1;
    --tab-active-bg: #1a140c;
    --tab-active-border: #1a140c;
    --tab-active-text: #f1e9d7;
    --tab-meta: #8e8264;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #8e8264; opacity: 0.9; }

  ${MORE_LINKS_CSS_LIGHT}
  .more-links { border-top-color: #c9bd9d; margin-top: 48px; }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #1a140c; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: #b23a2c; border-bottom-color: #c9bd9d; }
  .more-links__list li { border-bottom-color: rgba(201, 189, 157, 0.4); }
  .more-links__list a { color: #1a140c; font-weight: 500; }
  .more-links__list a:hover { color: #b23a2c; }
  .more-links__domain { color: #8e8264; }

  @media (max-width: 1220px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px)  { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 600px)  {
    .wrap { padding: 32px 16px 64px; }
    .site-head { flex-direction: column; align-items: flex-start; gap: 12px; }
    .source-block { padding: 16px; border-radius: var(--lf-radius-lg); }
    .source-hdr { flex-direction: column; align-items: flex-start; gap: 10px; }
    .src-health { width: 100%; }
    .src-health__label { text-align: left; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; }
    .card h3 { font-size: 13px; }
  }`;

  const sections = renderSourceTabs(tabGroups, (group) => {
    const label = srcLabel(group);
    const color = srcAccent(label);
    const initials = srcInitials(label);
    const cards = group.previewItems.map((i) => {
      const kind = itemKind(i);
      const badge = kind === 'video' ? 'Video' : kind === 'gallery' ? 'Image' : 'Story';
      return `<a class="card" href="${attr(i.href)}" target="_blank" rel="noopener">
        <div class="thumb-box">${thumbImg(i)}</div>
        <h3>${esc(i.title)}</h3>
        ${i.domain ? `<div class="card-meta">${esc(i.domain)}</div>` : ''}
      </a>`;
    }).join('');
    const coverage = previewCoverage(group);
    return `<section class="source-block">
      <div class="source-hdr">
        <div class="source-hdr__main">
          <div class="src-avatar" style="background:${color}">${initials}</div>
          <div class="src-info">
            <div class="src-name">${esc(label)}</div>
            <div class="src-count">${group.previewItems.length} ${group.previewItems.length === 1 ? 'preview' : 'previews'} ready to watch</div>
          </div>
        </div>
        <div class="src-health">
          <div class="src-count">${group.linkItems.length} ${group.linkItems.length === 1 ? 'extra link' : 'extra links'}</div>
          <div class="src-health__label">Preview coverage ${coverage}%</div>
          <div class="src-health__bar"><span style="width:${coverage}%"></span></div>
        </div>
      </div>
      ${cards ? `<div class="grid">${cards}</div>` : '<div class="empty">This source only has saved links right now. The extra links list below still keeps them accessible.</div>'}
      ${tabLinksSection(group, 'Watchlist extras')}
    </section>`;
  }, {
    prefix: 'creator-grid-tabs',
    emptyHtml: '<div class="empty">No thumbnail-ready items selected. Enable links with previews in review to populate this layout.</div>',
  });

  const body = `<div class="wrap">
    <header class="site">
      <div class="site-head">
        <div>
          <h1>${esc(ctx.title)}</h1>
          ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        </div>
        <aside class="site-stat">
          <strong>${ctx.all.length}</strong>
          <span>${ctx.sourceGroups.length} ${ctx.sourceGroups.length === 1 ? 'source' : 'sources'} queued in creator-grid mode</span>
        </aside>
      </div>
    </header>
    ${sections}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 3) STREAM CATALOG — per-source tabs, large grid, built for TV/D-pad
// =====================================================
function buildCinema(ctx) {
  const tabGroups = buildSourceTabs(ctx.sourceGroups);

  const css = `
  body { background-color: #07101e; color: #e2ecf8; font-family: "Inter", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1.5px solid #1c3d69; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: end; }
  .site h1 { font-family: 'Space Grotesk', sans-serif; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: #fff; }
  .site .tagline { font-size: 15px; color: #8fa0b5; margin-top: 8px; max-width: 62ch; }
  .site-stats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .site-pill { padding: 12px 16px; border-radius: var(--lf-radius-md); border: 1.5px solid #1c3d69; background: #0a182e; min-width: 120px; }
  .site-pill strong { display: block; color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 22px; line-height: 1; font-weight: 700; color: #f0b340; }
  .site-pill span { display: block; color: #8fa0b5; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; margin-top: 4px; }
 
  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #0a182e;
    --tab-text: #8fa0b5;
    --tab-border: #1c3d69;
    --tab-border-hover: #4080ff;
    --tab-bg-hover: #0d203d;
    --tab-active-bg: #4080ff;
    --tab-active-border: #4080ff;
    --tab-active-text: #ffffff;
    --tab-meta: #8fa0b5;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #ffffff; opacity: 0.9; }

  /* Grid inside each panel */
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
  .tab-stage { padding: 24px; border-radius: var(--lf-radius-xl); background: #0a182e; border: 1.5px solid #1c3d69; box-shadow: none; }
  .tab-stage__head { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 20px; }
  .tab-stage__title { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; color: #fff; }
  .tab-stage__meta { color: #8fa0b5; font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
  .tab-stage__health { display: grid; gap: 4px; min-width: 170px; }
  .tab-stage__health-label { color: #f0b340; font-family: 'IBM Plex Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }
  .tab-stage__health-bar { height: 4px; border-radius: 999px; background: rgba(240, 179, 64, 0.12); overflow: hidden; }
  .tab-stage__health-bar > span { display: block; height: 100%; background: #f0b340; }
  .tile { display: block; border-radius: var(--lf-radius-md); }
  .tile .thumb-box { position: relative; aspect-ratio: 16/9; border-radius: var(--lf-radius-md); overflow: hidden; background: #0d203d; margin-bottom: 12px; border: 1.5px solid #1c3d69; }
  .tile .thumb-kind { position: absolute; left: 8px; top: 8px; padding: 3px 6px; border-radius: 2px; background: rgba(7, 16, 30, 0.9); border: 1px solid #1c3d69; color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tile h4 { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; margin: 0; color: #e2ecf8; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color 0.2s ease; }
  .tile .tile-meta { margin-top: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #8fa0b5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile:hover h4 { color: #4080ff; }
  .tile:hover .thumb-box { border-color: #4080ff; }

  .empty { border: 1.5px dashed #1c3d69; border-radius: var(--lf-radius-lg); padding: 32px; color: #8fa0b5; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(10, 24, 46, 0.4); }

  ${MORE_LINKS_CSS_DARK}
  .more-links { margin-top: 48px; border-top-color: #1c3d69; }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #fff; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: #f0b340; border-bottom-color: #1c3d69; }
  .more-links__list li { border-bottom-color: rgba(28, 61, 105, 0.4); }
  .more-links__list a { color: #e2ecf8; font-weight: 500; }
  .more-links__list a:hover { color: #4080ff; }
  .more-links__domain { color: #8fa0b5; }

  @media (max-width: 1200px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 700px) {
    .wrap { padding: 32px 16px 64px; }
    .site-head { grid-template-columns: 1fr; gap: 16px; }
    .site h1 { font-size: 28px; }
    .site-stats { justify-content: flex-start; }
    .tab-stage { padding: 16px; border-radius: var(--lf-radius-lg); }
    .tab-stage__head { flex-direction: column; align-items: flex-start; gap: 10px; }
    .tab-stage__health { width: 100%; }
    .tab-stage__health-label { text-align: left; }
    .grid { grid-template-columns: 1fr; gap: 20px; }
    .tile h4 { font-size: 14px; }
  }`;

  const tabsHtml = renderSourceTabs(tabGroups, (group) => {
    const coverage = previewCoverage(group);
    const tiles = group.previewItems.map((item) => `<a class="tile" href="${attr(item.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(item)}</div>
      <h4>${esc(item.title)}</h4>
      ${item.domain ? `<div class="tile-meta">${esc(item.domain)}</div>` : ''}
    </a>`).join('');
    return `<section class="tab-stage">
      <div class="tab-stage__head">
        <div>
          <div class="tab-stage__title">${esc(srcLabel(group))}</div>
          <div class="tab-stage__meta">${group.previewItems.length} ${group.previewItems.length === 1 ? 'preview card' : 'preview cards'} · ${group.linkItems.length} ${group.linkItems.length === 1 ? 'saved link' : 'saved links'}</div>
        </div>
        <div class="tab-stage__health">
          <div class="tab-stage__health-label">Preview coverage ${coverage}%</div>
          <div class="tab-stage__health-bar"><span style="width:${coverage}%"></span></div>
        </div>
      </div>
      ${tiles ? `<div class="grid">${tiles}</div>` : '<div class="empty">This source has no thumbnail-led entries selected yet.</div>'}
      ${tabLinksSection(group, 'Queue extras')}
    </section>`;
  }, {
    prefix: 'stream-catalog-tabs',
    emptyHtml: '<div class="empty">No thumbnail-ready items selected. Enable links with previews in review to populate this layout.</div>',
  });

  const body = `<div class="wrap">
    <header class="site">
      <div class="site-head">
        <div>
          <h1>${esc(ctx.title)}</h1>
          ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        </div>
        <div class="site-stats">
          <div class="site-pill"><strong>${ctx.all.length}</strong><span>Total items</span></div>
          <div class="site-pill"><strong>${ctx.sourceGroups.length}</strong><span>Sources</span></div>
        </div>
      </div>
    </header>
    ${tabsHtml}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

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
function buildWall(ctx) {
  const tabGroups = buildSourceTabs(ctx.sourceGroups);

  const css = `
  body { background-color: #fcf9f2; color: #1a140c; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1.5px solid #c9bd9d; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: end; }
  .site h1 { font-family: 'Space Grotesk', sans-serif; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: #1a140c; }
  .site .tagline { color: #6b5e44; font-size: 15px; margin-top: 8px; max-width: 58ch; }
  .site-chip { padding: 12px 16px; border-radius: var(--lf-radius-md); border: 1.5px solid #c9bd9d; background: #f7f1e1; min-width: 120px; }
  .site-chip strong { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 22px; line-height: 1; font-weight: 700; color: #b23a2c; }
  .site-chip span { display: block; margin-top: 4px; color: #6b5e44; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; }
  .source { padding: 24px; border-radius: var(--lf-radius-xl); background: #fbf6ea; border: 1.5px solid #c9bd9d; box-shadow: none; }
  .source-hdr { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1.5px solid #e6dcc4; }
  .source-hdr__main { display: flex; align-items: center; gap: 12px; min-width: 0; flex-wrap: wrap; }
  .src-pill { background: #1a140c; color: #f1e9d7; padding: 4px 8px; border-radius: 2px; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.05em; }
  .src-name { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #1a140c; }
  .src-count { color: #8e8264; font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
  .src-health { display: grid; gap: 4px; min-width: 170px; }
  .src-health__label { color: #b23a2c; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; text-align: right; }
  .src-health__bar { height: 4px; border-radius: 999px; background: rgba(178, 58, 44, 0.12); overflow: hidden; }
  .src-health__bar > span { display: block; height: 100%; background: #b23a2c; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .tile { display: block; border-radius: var(--lf-radius-md); overflow: hidden; background: #fbf6ea; border: 1.5px solid #c9bd9d; transition: all 0.2s ease; }
  .tile .thumb-box { position: relative; aspect-ratio: 1; overflow: hidden; background: #e6dcc4; }
  .tile .thumb-kind { position: absolute; left: 8px; top: 8px; padding: 3px 6px; border-radius: 2px; background: rgba(26, 20, 12, 0.9); color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .tile h3 { padding: 12px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; line-height: 1.4; color: #1a140c; margin: 0; transition: color 0.2s ease; }
  .tile:hover { transform: translateY(-2px); border-color: #b23a2c; }
  .tile:hover h3 { color: #b23a2c; }
  .empty { padding: 32px; border-radius: var(--lf-radius-lg); border: 1.5px dashed #c9bd9d; color: #6b5e44; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(230, 220, 196, 0.3); }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #fbf6ea;
    --tab-text: #1a140c;
    --tab-border: #c9bd9d;
    --tab-border-hover: #b23a2c;
    --tab-bg-hover: #f7f1e1;
    --tab-active-bg: #1a140c;
    --tab-active-border: #1a140c;
    --tab-active-text: #f1e9d7;
    --tab-meta: #8e8264;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #8e8264; opacity: 0.9; }

  ${MORE_LINKS_CSS_LIGHT}
  .more-links { border-top-color: #c9bd9d; margin-top: 48px; }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #1a140c; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: #b23a2c; border-bottom-color: #c9bd9d; }
  .more-links__list li { border-bottom-color: rgba(201, 189, 157, 0.4); }
  .more-links__list a { color: #1a140c; font-weight: 500; }
  .more-links__list a:hover { color: #b23a2c; }
  .more-links__domain { color: #8e8264; }

  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 700px) {
    .site-head { grid-template-columns: 1fr; gap: 16px; }
    .source { padding: 16px; border-radius: var(--lf-radius-lg); }
    .source-hdr { flex-direction: column; align-items: flex-start; gap: 10px; }
    .src-health { width: 100%; }
    .src-health__label { text-align: left; }
    .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  }
  @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }`;

  const sections = renderSourceTabs(tabGroups, (group) => {
    const coverage = previewCoverage(group);
    const tiles = group.previewItems.map((i) => `<a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <h3>${esc(i.title)}</h3>
    </a>`).join('');
    return `<section class="source">
      <div class="source-hdr">
        <div class="source-hdr__main">
          <span class="src-pill">${esc(srcLabel(group)).toUpperCase()}</span>
          <span class="src-name">${esc(srcLabel(group))}</span>
        </div>
        <div class="src-health">
          <span class="src-count">${group.previewItems.length} ${group.previewItems.length === 1 ? 'tile' : 'tiles'} · ${group.linkItems.length} ${group.linkItems.length === 1 ? 'link' : 'links'}</span>
          <span class="src-health__label">Preview coverage ${coverage}%</span>
          <span class="src-health__bar"><span style="width:${coverage}%"></span></span>
        </div>
      </div>
      ${tiles ? `<div class="grid">${tiles}</div>` : '<div class="empty">This source has no image tiles selected yet.</div>'}
      ${tabLinksSection(group, 'Gallery extras')}
    </section>`;
  }, {
    prefix: 'photo-wall-tabs',
    emptyHtml: '<div class="empty">No thumbnail-ready items selected. Enable links with previews in review to populate this layout.</div>',
  });

  const body = `<div class="wrap">
    <header class="site">
      <div class="site-head">
        <div>
          <h1>${esc(ctx.title)}</h1>
          ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        </div>
        <div class="site-chip">
          <strong>${ctx.all.length}</strong>
          <span>Wall items</span>
        </div>
      </div>
    </header>
    ${sections}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

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
// 7) BENTO — modular cards with a featured lead block per source
// =====================================================
function buildBento(ctx) {
  const tabGroups = buildSourceTabs(ctx.sourceGroups);

  const css = `
  body { background-color: #fcf9f2; color: #1a140c; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1.5px solid #c9bd9d; }
  .eyebrow { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; padding: 4px 10px; border-radius: 2px; background: #b23a2c; color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1.2fr) 280px; gap: 32px; align-items: end; }
  .site h1 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 48px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 700; color: #1a140c; }
  .site .tagline { margin-top: 14px; max-width: 58ch; color: #6b5e44; font-size: 16px; line-height: 1.55; }
  .site-note { padding: 20px; border-radius: var(--lf-radius-md); background: #f7f1e1; border: 1.5px solid #c9bd9d; }
  .site-note .label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #b23a2c; font-weight: 700; }
  .site-note strong { display: block; margin-top: 8px; font-family: 'Space Grotesk', sans-serif; font-size: 28px; line-height: 1.1; font-weight: 700; color: #1a140c; }
  .site-note span { display: block; margin-top: 6px; color: #6b5e44; font-size: 12px; font-family: 'IBM Plex Mono', monospace; }

  .source { padding: 24px; border-radius: var(--lf-radius-xl); background: #fbf6ea; border: 1.5px solid #c9bd9d; box-shadow: none; }
  .source-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
  .source-name { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: #1a140c; }
  .source-count { font-size: 11px; color: #8e8264; font-family: 'IBM Plex Mono', monospace; }
  .source-health { display: grid; gap: 4px; min-width: 170px; }
  .source-health__label { color: #b23a2c; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; text-align: right; }
  .source-health__bar { height: 4px; border-radius: 999px; background: rgba(178, 58, 44, 0.12); overflow: hidden; }
  .source-health__bar > span { display: block; height: 100%; background: #b23a2c; }

  .bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; }
  .tile { display: flex; flex-direction: column; min-width: 0; border-radius: var(--lf-radius-lg); overflow: hidden; background: #fbf6ea; border: 1.5px solid #c9bd9d; box-shadow: none; transition: all 0.2s ease; }
  .tile:hover { transform: translateY(-2px); border-color: #b23a2c; }
  .tile--lead { grid-column: span 7; min-height: 400px; }
  .tile--lead .media-frame { aspect-ratio: 16/10; }
  .tile--lead .body { padding: 20px; }
  .tile--lead h3 { font-family: 'Space Grotesk', sans-serif; font-size: 24px; line-height: 1.15; font-weight: 700; margin: 0 0 10px; color: #1a140c; transition: color 0.2s ease; }
  .tile--lead:hover h3 { color: #b23a2c; }
  .tile--lead .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8e8264; }

  .tile--stack { grid-column: span 5; padding: 20px; justify-content: space-between; }
  .tile--stack .media-frame { aspect-ratio: 16/9; margin-bottom: 14px; }
  .tile--stack h3 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 18px; line-height: 1.25; font-weight: 700; color: #1a140c; transition: color 0.2s ease; }
  .tile--stack:hover h3 { color: #b23a2c; }
  .tile--stack .meta { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8e8264; }

  .tile--mini { grid-column: span 4; padding: 16px; }
  .tile--mini .media-frame { aspect-ratio: 4/3; margin-bottom: 12px; }
  .tile--mini h3 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.35; font-weight: 700; color: #1a140c; transition: color 0.2s ease; }
  .tile--mini:hover h3 { color: #b23a2c; }
  .tile--mini .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8e8264; }

  .media-frame { position: relative; border-radius: var(--lf-radius-md); overflow: hidden; background: #e6dcc4; border: 1px solid rgba(26, 20, 12, 0.1); }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; }
  .media-frame__badge { position: absolute; left: 10px; top: 10px; padding: 3px 8px; border-radius: 2px; background: #1a140c; color: #f1e9d7; font-family: 'IBM Plex Mono', monospace; font-size: 8px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 10px; bottom: 10px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: rgba(26, 20, 12, 0.9); color: #fff; }
  .media-frame__play svg { width: 14px; height: 14px; margin-left: 2px; }
  .pill { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 2px; background: #e6dcc4; color: #6b5e44; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; }

  .smart-links { margin-top: 32px; padding-top: 24px; border-top: 1.5px solid #e6dcc4; }
  .smart-links__header { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 20px; }
  .smart-links__heading { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #1a140c; }
  .smart-links__desc { margin: 0; color: #8e8264; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
  .smart-links__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .smart-links__group { padding: 18px; border-radius: var(--lf-radius-lg); background: #fbf6ea; border: 1.5px solid #c9bd9d; }
  .smart-links__src { margin-bottom: 12px; font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #b23a2c; }
  .smart-links__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .smart-links__list a { display: flex; justify-content: space-between; gap: 12px; align-items: start; color: #1a140c; }
  .smart-links__title { flex: 1; min-width: 0; font-size: 14px; line-height: 1.4; transition: color 0.2s ease; }
  .smart-links__list a:hover .smart-links__title { color: #b23a2c; }
  .smart-links__meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .smart-links__type, .smart-links__domain { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #8e8264; }
  .empty { padding: 32px; border-radius: var(--lf-radius-lg); border: 1.5px dashed #c9bd9d; color: #6b5e44; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(230, 220, 196, 0.3); }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #fbf6ea;
    --tab-text: #1a140c;
    --tab-border: #c9bd9d;
    --tab-border-hover: #b23a2c;
    --tab-bg-hover: #f7f1e1;
    --tab-active-bg: #1a140c;
    --tab-active-border: #1a140c;
    --tab-active-text: #f1e9d7;
    --tab-meta: #8e8264;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #8e8264; opacity: 0.9; }

  @media (max-width: 980px) {
    .site-head { grid-template-columns: 1fr; }
    .site h1 { font-size: 42px; max-width: none; }
    .source { padding: 18px; border-radius: 24px; }
    .source-head { flex-direction: column; align-items: flex-start; }
    .source-health { width: 100%; }
    .source-health__label { text-align: left; }
    .tile--lead, .tile--stack, .tile--mini { grid-column: span 12; }
    .smart-links__grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .wrap { padding: 24px 16px 64px; }
    .source-name { font-size: 20px; }
    .tile { border-radius: 22px; }
    .tile--lead h3 { font-size: 24px; }
    .smart-links__header, .smart-links__list a { flex-direction: column; align-items: flex-start; }
  }`;

  const sections = renderSourceTabs(tabGroups, (group) => {
    const coverage = previewCoverage(group);
    const cards = group.previewItems.map((i, idx) => {
      const cls = idx === 0 ? 'tile tile--lead' : idx === 1 ? 'tile tile--stack' : 'tile tile--mini';
      return `<a class="${cls}" href="${attr(i.href)}" target="_blank" rel="noopener">
        ${mediaFrame(i)}
        <div class="body">
          <h3>${esc(i.title)}</h3>
          <div class="meta"><span class="pill">${esc(i.domain || srcLabel(group))}</span></div>
        </div>
      </a>`;
    }).join('');
    return `<section class="source">
      <div class="source-head">
        <div class="source-name">${esc(srcLabel(group))}</div>
        <div class="source-health">
          <div class="source-count">${group.previewItems.length} ${group.previewItems.length === 1 ? 'card' : 'cards'} · ${group.linkItems.length} ${group.linkItems.length === 1 ? 'link' : 'links'}</div>
          <div class="source-health__label">Preview coverage ${coverage}%</div>
          <div class="source-health__bar"><span style="width:${coverage}%"></span></div>
        </div>
      </div>
      ${cards ? `<div class="bento">${cards}</div>` : '<div class="empty">This source only has saved links right now, so the supporting list below is the primary view.</div>'}
      ${tabLinksSection(group, 'More from this source')}
    </section>`;
  }, {
    prefix: 'bento-tabs',
    emptyHtml: '<div class="empty">No thumbnail-ready items selected. Enable links with previews in review to populate this layout.</div>',
  });

  const body = `<div class="wrap">
    <header class="site">
      <div class="eyebrow">Modular layout</div>
      <div class="site-head">
        <div>
          <h1>${esc(ctx.title)}</h1>
          ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        </div>
        <aside class="site-note">
          <div class="label">Bento mode</div>
          <strong>${ctx.all.length}</strong>
          <span>${ctx.sourceGroups.length} ${ctx.sourceGroups.length === 1 ? 'source' : 'sources'} arranged into lead and supporting blocks.</span>
        </aside>
      </div>
    </header>
    ${sections}
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
// 9) SIGNAL — dark intelligence-style dashboard
// =====================================================
function buildSignal(ctx) {
  const tabGroups = buildSourceTabs(ctx.sourceGroups);

  const css = `
  body { background-color: #07101e; color: #e2ecf8; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .shell { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  .frame { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; }
  .sidebar, .panel, .story { border: 1.5px solid #1c3d69; background: #0a182e; box-shadow: none; }
  .sidebar { border-radius: var(--lf-radius-xl); padding: 24px; position: sticky; top: 24px; align-self: start; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 2px; background: #f0b340; color: #07101e; font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .sidebar h1 { margin: 18px 0 0; font-family: 'Space Grotesk', sans-serif; font-size: 36px; line-height: 1.1; font-weight: 700; color: #fff; }
  .sidebar .tagline { margin-top: 12px; color: #8fa0b5; font-size: 15px; line-height: 1.6; }
  .metrics { display: grid; gap: 10px; margin-top: 24px; }
  .metric { padding: 14px; border-radius: var(--lf-radius-md); background: #0d203d; border: 1px solid #1c3d69; }
  .metric strong { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 24px; line-height: 1; font-weight: 700; color: #f0b340; }
  .metric span { display: block; margin-top: 4px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8fa0b5; }

  .main { display: flex; flex-direction: column; gap: 24px; }
  .panel { border-radius: var(--lf-radius-xl); overflow: hidden; }
  .panel-head { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; padding: 16px 20px; border-bottom: 1.5px solid #1c3d69; background: #0d203d; }
  .panel-title { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #fff; }
  .panel-count { color: #8fa0b5; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
  .panel-health { display: grid; gap: 4px; min-width: 170px; }
  .panel-health__label { color: #4080ff; font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; text-align: right; }
  .panel-health__bar { height: 4px; border-radius: 999px; background: rgba(64, 128, 255, 0.12); overflow: hidden; }
  .panel-health__bar > span { display: block; height: 100%; background: #4080ff; }
  .stack { display: grid; gap: 1px; background: #1c3d69; }
  .story { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 20px; padding: 20px; border: 0; border-radius: 0; }
  .story:hover { background: #0d203d; }
  .media-frame { position: relative; aspect-ratio: 4/3; border-radius: var(--lf-radius-md); overflow: hidden; background: #0d203d; border: 1.5px solid #1c3d69; }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; }
  .media-frame__badge { position: absolute; left: 8px; top: 8px; padding: 3px 6px; border-radius: 2px; background: rgba(7, 16, 30, 0.9); border: 1px solid #1c3d69; color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 8px; bottom: 8px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: #4080ff; color: #fff; }
  .media-frame__play svg { width: 14px; height: 14px; margin-left: 2px; }
  .story h3 { margin: 0; font-family: 'Inter', sans-serif; font-size: 18px; line-height: 1.35; font-weight: 600; color: #fff; transition: color 0.2s ease; }
  .story:hover h3 { color: #4080ff; }
  .story .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chip { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 2px; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; }
  .chip--source { background: #1c3d69; color: #fff; }
  .chip--domain { background: rgba(240, 179, 64, 0.12); color: #f0b340; }
  .chip--kind { background: rgba(64, 128, 255, 0.12); color: #4080ff; }

  .smart-links { margin-top: 10px; padding-top: 18px; border-top: 1.5px solid #1c3d69; }
  .smart-links__header { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 18px; }
  .smart-links__heading { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #fff; }
  .smart-links__desc { margin: 0; font-size: 11px; color: #8fa0b5; font-family: 'IBM Plex Mono', monospace; }
  .smart-links__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .smart-links__group { padding: 18px; border-radius: var(--lf-radius-lg); border: 1.5px solid #1c3d69; background: #0a182e; }
  .smart-links__src { margin-bottom: 12px; font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #f0b340; }
  .smart-links__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .smart-links__list a { display: flex; justify-content: space-between; gap: 12px; align-items: start; color: #e2ecf8; }
  .smart-links__title { flex: 1; min-width: 0; font-size: 14px; line-height: 1.4; transition: color 0.2s ease; }
  .smart-links__list a:hover .smart-links__title { color: #4080ff; }
  .smart-links__meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .smart-links__type, .smart-links__domain { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #8fa0b5; }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #0a182e;
    --tab-text: #8fa0b5;
    --tab-border: #1c3d69;
    --tab-border-hover: #4080ff;
    --tab-bg-hover: #0d203d;
    --tab-active-bg: #4080ff;
    --tab-active-border: #4080ff;
    --tab-active-text: #ffffff;
    --tab-meta: #8fa0b5;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #ffffff; opacity: 0.9; }
  .empty { padding: 32px; border-radius: var(--lf-radius-lg); border: 1.5px dashed #1c3d69; color: #8fa0b5; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(10, 24, 46, 0.4); }

  @media (max-width: 1020px) {
    .frame { grid-template-columns: 1fr; }
    .sidebar { position: static; }
    .smart-links__grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .shell { padding: 32px 16px 64px; }
    .sidebar, .panel { border-radius: var(--lf-radius-lg); }
    .sidebar h1 { font-size: 28px; }
    .story { grid-template-columns: 1fr; }
    .story h3 { font-size: 16px; }
    .panel-health { width: 100%; }
    .panel-health__label { text-align: left; }
    .smart-links__header, .smart-links__list a { flex-direction: column; align-items: flex-start; }
  }`;

  const panels = renderSourceTabs(tabGroups, (group) => {
    const coverage = previewCoverage(group);
    const rows = group.previewItems.map((i) => `<a class="story" href="${attr(i.href)}" target="_blank" rel="noopener">
      ${mediaFrame(i)}
      <div>
        <h3>${esc(i.title)}</h3>
        <div class="meta">
          <span class="chip chip--source">${esc(srcLabel(group))}</span>
          <span class="chip chip--domain">${esc(i.domain || 'source')}</span>
        </div>
      </div>
    </a>`).join('');
    return `<section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">${esc(srcLabel(group))}</div>
          <div class="panel-count">${group.previewItems.length} ${group.previewItems.length === 1 ? 'signal' : 'signals'} · ${group.linkItems.length} ${group.linkItems.length === 1 ? 'saved link' : 'saved links'}</div>
        </div>
        <div class="panel-health">
          <div class="panel-health__label">Preview coverage ${coverage}%</div>
          <div class="panel-health__bar"><span style="width:${coverage}%"></span></div>
        </div>
      </div>
      ${rows ? `<div class="stack">${rows}</div>` : '<div class="empty">This source has no preview cards selected, but its saved links remain available below.</div>'}
      ${tabLinksSection(group, 'Supporting links')}
    </section>`;
  }, {
    prefix: 'signal-tabs',
    emptyHtml: '<div class="empty">No items selected for this export yet.</div>',
  });

  const body = `<div class="shell">
    <div class="frame">
      <aside class="sidebar">
        <div class="badge">Signal deck</div>
        <h1>${esc(ctx.title)}</h1>
        ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
        <div class="metrics">
          <div class="metric"><strong>${ctx.all.length}</strong><span>Total items</span></div>
          <div class="metric"><strong>${ctx.sourceGroups.length}</strong><span>Grouped sources</span></div>
          <div class="metric"><strong>${ctx.today || ''}</strong><span>Generated</span></div>
        </div>
      </aside>
      <main class="main">
        ${panels}
      </main>
    </div>
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'signal-theme' });
}

// =====================================================
// 10) MARQUEE — Featured streaming-style template
// Home = big source tiles with autoplaying previews.
// Click a source -> its own page with static thumbnail grid.
// Items with no thumbnail and no video are discarded.
// =====================================================
function slugify(s) {
  return String(s || 'source')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'source';
}

function extractVideoSrc(item) {
  if (!item) return null;
  if (item.video && typeof item.video === 'object') {
    const src = item.video.src || item.video.url || null;
    if (src && /\.(mp4|webm)(\?|$)/i.test(src)) return src;
  }
  if (item.href && /\.(mp4|webm)(\?|$)/i.test(item.href)) return item.href;
  return null;
}

// Count how many items across all sources have a thumbnail or a playable video.
// Used to (a) disable the Marquee card in the picker when there's nothing to
// show, and (b) hard-reject at build time with an actionable message.
function marqueeMediaCounts(ctx) {
  const groups = (ctx && ctx.sourceGroups) || [];
  let items = 0, videos = 0, images = 0, sources = 0;
  for (const g of groups) {
    let groupHas = false;
    for (const it of g.items || []) {
      const hasVid = !!extractVideoSrc(it);
      const hasImg = !!(it && (it.thumbnail || (it.video && it.video.poster)));
      if (hasVid) videos += 1;
      if (hasImg) images += 1;
      if (hasVid || hasImg) { items += 1; groupHas = true; }
    }
    if (groupHas) sources += 1;
  }
  return { items, videos, images, sources };
}

function marqueeValidate(ctx) {
  const c = marqueeMediaCounts(normalize(ctx));
  if (c.items === 0) {
    return {
      ok: false,
      reason: "Marquee needs autoplaying video previews or thumbnails to work. None of the selected sources have any multimedia content — pick a different template, or add sources with images or MP4 previews.",
      counts: c,
    };
  }
  if (c.items < 3) {
    return {
      ok: true,
      warning: `Marquee shines with lots of media. You only have ${c.items} item${c.items === 1 ? '' : 's'} with a preview — the streaming layout may feel sparse.`,
      counts: c,
    };
  }
  return { ok: true, counts: c };
}

function buildMarquee(ctx) {
  const check = marqueeValidate(ctx);
  if (!check.ok) throw new Error(check.reason);
  // Build per-source manifests. Include items without thumbnails as secondary links.
  const sources = [];
  const seenSlugs = new Set();
  for (const group of ctx.sourceGroups || []) {
    const items = [];
    const videos = [];
    const images = [];
    const linkItems = [];
    const seenHref = new Set();
    for (const it of group.items || []) {
      if (!it || !it.href) continue;
      if (seenHref.has(it.href)) continue;
      seenHref.add(it.href);
      const vsrc = extractVideoSrc(it);
      const thumb = it.thumbnail || (it.video && it.video.poster) || null;
      const clean = {
        href: it.href,
        title: it.title || it.href,
        thumb: thumb || null,
        video: vsrc || null,
        domain: it.domain || '',
        kind: itemKind(it),
      };
      if (!vsrc && !thumb) {
        linkItems.push(clean);
      } else {
        items.push(clean);
        if (vsrc) videos.push({ src: vsrc, poster: thumb || null });
        if (thumb) images.push(thumb);
      }
    }
    if (!items.length && !linkItems.length) continue;
    let base = slugify(group.name || group.key || 'source');
    let slug = base;
    let n = 2;
    while (seenSlugs.has(slug)) { slug = `${base}-${n++}`; }
    seenSlugs.add(slug);
    // Cover thumbnail for the source card: first video's poster, else first image.
    const cover = (videos.find((v) => v.poster) || {}).poster || images[0] || null;
    sources.push({
      slug,
      name: group.name || 'Source',
      count: items.length + linkItems.length,
      cover,
      videos,      // sequence of mp4/webm to chain
      images,      // slideshow fallback
      items,
      linkItems,
    });
  }

  const manifest = { title: ctx.title, tagline: ctx.tagline, today: ctx.today, sources };

  const css = `
  :root {
    --mq-bg: #08080b;
    --mq-bg-2: #101014;
    --mq-surface: rgba(255,255,255,0.045);
    --mq-surface-hi: rgba(255,255,255,0.09);
    --mq-border: rgba(255,255,255,0.08);
    --mq-border-hi: rgba(255,255,255,0.22);
    --mq-text: #f4f4f5;
    --mq-muted: #a1a1aa;
    --mq-faint: #71717a;
    --mq-accent: #f97066;
    --mq-accent-2: #fb923c;
    --mq-serif: "Fraunces", "Playfair Display", Georgia, "Times New Roman", serif;
    --mq-sans: "Inter", -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
    --mq-mono: ui-monospace, "SF Mono", Menlo, monospace;
  }
  html, body { background: var(--mq-bg); color: var(--mq-text); font-family: var(--mq-sans); }
  body { min-height: 100vh; position: relative; overflow-x: hidden; }
  body::before {
    content: "";
    position: fixed; inset: -40vmax -40vmax auto auto;
    width: 80vmax; height: 80vmax; border-radius: 50%;
    background: conic-gradient(from 210deg, rgba(249,112,102,0.22), rgba(251,146,60,0.08) 40%, rgba(56,189,248,0.16) 70%, rgba(249,112,102,0.22));
    filter: blur(120px);
    z-index: 0; pointer-events: none;
    animation: mq-spin 46s linear infinite;
  }
  body::after {
    content: "";
    position: fixed; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 3px 3px;
    opacity: 0.35; mix-blend-mode: overlay;
    z-index: 0; pointer-events: none;
  }
  @keyframes mq-spin { to { transform: rotate(360deg); } }

  .mq-app { position: relative; z-index: 1; }
  .mq-nav {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between; gap: 20px;
    padding: 18px clamp(20px, 4vw, 56px);
    backdrop-filter: blur(18px) saturate(1.4);
    -webkit-backdrop-filter: blur(18px) saturate(1.4);
    background: linear-gradient(180deg, rgba(8,8,11,0.72) 0%, rgba(8,8,11,0.36) 100%);
    border-bottom: 1px solid var(--mq-border);
  }
  .mq-nav__brand { display: flex; align-items: baseline; gap: 12px; }
  .mq-nav__logo {
    font-family: var(--mq-serif); font-size: 22px; font-weight: 700;
    letter-spacing: -0.02em; color: var(--mq-text);
  }
  .mq-nav__logo em { font-style: italic; color: var(--mq-accent); }
  .mq-nav__tag { font-family: var(--mq-mono); font-size: 10.5px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--mq-faint); }
  .mq-nav__crumbs { display: flex; align-items: center; gap: 10px; font-family: var(--mq-mono); font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mq-muted); }
  .mq-nav__crumbs a { color: var(--mq-muted); }
  .mq-nav__crumbs a:hover { color: var(--mq-text); }
  .mq-nav__crumbs .sep { color: var(--mq-faint); }
  .mq-nav__meta { font-family: var(--mq-mono); font-size: 10.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--mq-faint); }

  .mq-view { padding: clamp(32px, 6vw, 72px) clamp(20px, 4vw, 56px) 120px; max-width: 1600px; margin: 0 auto; }

  /* HERO */
  .mq-hero { display: grid; gap: 18px; margin-bottom: clamp(40px, 6vw, 72px); }
  .mq-hero__kicker { font-family: var(--mq-mono); font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--mq-accent); }
  .mq-hero__title {
    margin: 0; font-family: var(--mq-serif); font-weight: 500;
    font-size: clamp(44px, 8vw, 108px);
    letter-spacing: -0.045em; line-height: 0.95;
    background: linear-gradient(160deg, #ffffff 0%, #e4e4e7 45%, #a1a1aa 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .mq-hero__title em { font-style: italic; color: var(--mq-accent); background: none; -webkit-text-fill-color: var(--mq-accent); }
  .mq-hero__tag { margin: 0; max-width: 720px; color: var(--mq-muted); font-size: clamp(15px, 1.4vw, 18px); line-height: 1.55; }
  .mq-hero__stats { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 8px; font-family: var(--mq-mono); font-size: 11.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--mq-faint); }
  .mq-hero__stats strong { color: var(--mq-text); font-weight: 600; margin-right: 6px; font-family: var(--mq-serif); font-size: 20px; letter-spacing: -0.02em; }

  /* SOURCE GRID (home) */
  .mq-grid {
    display: grid; gap: clamp(20px, 2.5vw, 32px);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
  }
  .mq-card {
    display: flex; flex-direction: column; gap: 16px;
    padding: 14px; border-radius: 22px;
    background: var(--mq-surface); border: 1px solid var(--mq-border);
    color: inherit; text-decoration: none;
    transition: transform .4s cubic-bezier(.2,.7,.2,1), border-color .4s ease, background .4s ease, box-shadow .4s ease;
    will-change: transform;
  }
  .mq-card:hover, .mq-card:focus-visible {
    transform: translateY(-6px);
    background: var(--mq-surface-hi);
    border-color: var(--mq-border-hi);
    box-shadow: 0 30px 60px -20px rgba(249,112,102,0.28), 0 20px 40px -20px rgba(0,0,0,0.6);
    outline: none;
  }
  .mq-tile {
    position: relative; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden;
    background: #0d0d10; isolation: isolate;
  }
  .mq-tile__poster,
  .mq-tile__slides img,
  .mq-tile__video {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover;
  }
  .mq-tile__poster { z-index: 1; opacity: 1; transition: opacity .5s ease; }
  .mq-tile__slides { position: absolute; inset: 0; z-index: 2; }
  .mq-tile__slides img { opacity: 0; transition: opacity .5s ease; transform: scale(1.02); }
  .mq-tile__slides img.is-visible { opacity: 1; }
  .mq-tile__video { z-index: 3; opacity: 0; transition: opacity .35s ease; background: #000; }
  .mq-tile.is-playing .mq-tile__video { opacity: 1; }
  .mq-tile.is-playing .mq-tile__poster { opacity: 0; }
  .mq-tile__scrim {
    position: absolute; inset: 0; z-index: 4; pointer-events: none;
    background: linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.55) 100%);
  }
  .mq-tile__badge {
    position: absolute; top: 12px; left: 12px; z-index: 5;
    padding: 5px 10px; border-radius: 999px;
    background: rgba(8,8,11,0.72); backdrop-filter: blur(10px);
    color: var(--mq-text); font-family: var(--mq-mono);
    font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
    border: 1px solid var(--mq-border);
    display: inline-flex; align-items: center; gap: 6px;
  }
  .mq-tile__badge .dot { width: 6px; height: 6px; border-radius: 999px; background: var(--mq-accent); box-shadow: 0 0 8px var(--mq-accent); }
  .mq-tile__count {
    position: absolute; top: 12px; right: 12px; z-index: 5;
    padding: 5px 10px; border-radius: 999px;
    background: rgba(8,8,11,0.72); backdrop-filter: blur(10px);
    color: var(--mq-muted); font-family: var(--mq-mono);
    font-size: 10.5px; letter-spacing: 0.14em;
    border: 1px solid var(--mq-border);
  }
  .mq-tile__foot {
    position: absolute; bottom: 14px; left: 16px; right: 16px; z-index: 5;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
  }
  .mq-card__meta { display: flex; flex-direction: column; gap: 6px; padding: 4px 6px 10px; }
  .mq-card__title { font-family: var(--mq-serif); font-size: clamp(24px, 2.2vw, 30px); letter-spacing: -0.03em; line-height: 1.08; }
  .mq-card__sub { display: flex; align-items: center; gap: 12px; font-family: var(--mq-mono); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--mq-faint); }
  .mq-card__sub .type { color: var(--mq-accent); }

  /* SOURCE DETAIL PAGE */
  .mq-detail__head { display: grid; gap: 14px; margin-bottom: clamp(32px, 5vw, 56px); }
  .mq-detail__kicker { font-family: var(--mq-mono); font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--mq-accent); }
  .mq-detail__title { margin: 0; font-family: var(--mq-serif); font-weight: 500; font-size: clamp(36px, 6vw, 80px); letter-spacing: -0.04em; line-height: 0.98; color: var(--mq-text); }
  .mq-detail__meta { display: flex; flex-wrap: wrap; gap: 22px; font-family: var(--mq-mono); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--mq-faint); }
  .mq-back {
    display: inline-flex; align-items: center; gap: 8px;
    align-self: start; padding: 8px 14px; border-radius: 999px;
    border: 1px solid var(--mq-border); background: var(--mq-surface);
    font-family: var(--mq-mono); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--mq-muted);
    text-decoration: none; transition: background .3s, border-color .3s, color .3s;
  }
  .mq-back:hover { color: var(--mq-text); background: var(--mq-surface-hi); border-color: var(--mq-border-hi); }
  .mq-back svg { width: 14px; height: 14px; }

  .mq-items {
    display: grid; gap: clamp(18px, 2vw, 28px);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  }
  .mq-item {
    display: flex; flex-direction: column; gap: 12px;
    padding: 12px; border-radius: 18px;
    background: var(--mq-surface); border: 1px solid var(--mq-border);
    text-decoration: none; color: inherit;
    transition: transform .3s ease, border-color .3s ease, background .3s ease, box-shadow .3s ease;
  }
  .mq-item:hover {
    transform: translateY(-4px);
    background: var(--mq-surface-hi);
    border-color: var(--mq-border-hi);
    box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6);
  }
  .mq-item__thumb { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #0d0d10; }
  .mq-item__thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
  .mq-item:hover .mq-item__thumb img { transform: scale(1.04); }
  .mq-item__thumb::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.5) 100%);
  }
  .mq-item__play {
    position: absolute; right: 10px; bottom: 10px; z-index: 2;
    width: 34px; height: 34px; border-radius: 999px;
    display: grid; place-items: center;
    background: var(--mq-accent); color: #fff;
  }
  .mq-item__play svg { width: 14px; height: 14px; margin-left: 2px; }
  .mq-item__title { padding: 0 4px 8px; font-family: var(--mq-serif); font-size: 17px; line-height: 1.28; letter-spacing: -0.015em; color: var(--mq-text); }
  .mq-item__domain { padding: 0 4px 4px; font-family: var(--mq-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mq-faint); }

  .mq-empty { padding: 40px; text-align: center; color: var(--mq-muted); border: 1px dashed var(--mq-border); border-radius: 20px; }

  /* Fallback thumbnail for items without thumb */
  .mq-item__no-thumb {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
    color: var(--mq-muted); font-family: var(--mq-mono); font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; text-align: center;
    padding: 16px; box-sizing: border-box;
  }

  /* More links section */
  .mq-links { margin-top: 56px; padding-top: 28px; border-top: 1px solid var(--mq-border); }
  .mq-links__heading { font-family: var(--mq-serif); font-size: 20px; font-weight: 500; letter-spacing: -0.02em; color: var(--mq-text); margin: 0 0 20px; }
  .mq-links__list { list-style: none; margin: 0; padding: 0; }
  .mq-links__list li { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding: 10px 4px; font-size: 14.5px; line-height: 1.45; border-bottom: 1px solid var(--mq-border); }
  .mq-links__list li:last-child { border-bottom: 0; }
  .mq-links__list a { color: var(--mq-muted); flex: 1 1 auto; min-width: 0; transition: color .2s ease; }
  .mq-links__list a:hover { color: var(--mq-accent); text-decoration: underline; }
  .mq-links__domain { flex: 0 0 auto; font-size: 11px; color: var(--mq-faint); font-family: var(--mq-mono); letter-spacing: 0.02em; }

  @media (max-width: 640px) {
    .mq-nav { padding: 14px 18px; }
    .mq-view { padding: 24px 18px 90px; }
    .mq-hero__stats { gap: 14px; }
    .mq-card { padding: 10px; border-radius: 18px; }
  }
  @media (prefers-reduced-motion: reduce) {
    body::before { animation: none; }
    .mq-tile__slides img, .mq-tile__video, .mq-tile__poster { transition: none; }
    * { animation: none !important; }
  }
  `;

  const dataScript = `<script id="mq-data" type="application/json">${JSON.stringify(manifest).replace(/</g, '\\u003c')}</script>`;

  const runtime = `<script>
(function(){
  var data;
  try { data = JSON.parse(document.getElementById('mq-data').textContent); }
  catch (e) { console.error('Marquee: failed to parse data', e); return; }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOTAL_VIDEO_MS = 60000;
  var MIN_CLIP_MS = 2000;
  var SLIDESHOW_STEP_MS = 2000;
  var MAX_SLIDES = 15;

  var app = document.getElementById('mq-app');
  var crumbsEl = document.getElementById('mq-crumbs');

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function attr(s){ return esc(s); }
  function findSource(slug){ for (var i=0;i<data.sources.length;i++) if (data.sources[i].slug===slug) return data.sources[i]; return null; }

  // ---- Tile controller: mp4 sequence OR image slideshow ----
  function activateTile(tile) {
    if (tile.__started) return;
    tile.__started = true;
    var videos = JSON.parse(tile.dataset.videos || '[]');
    var images = JSON.parse(tile.dataset.images || '[]').slice(0, MAX_SLIDES);
    if (reduceMotion) return;

    if (videos.length) {
      var perClip = Math.max(MIN_CLIP_MS, Math.floor(TOTAL_VIDEO_MS / videos.length));
      var video = tile.querySelector('.mq-tile__video');
      if (!video) return;
      var idx = 0;
      var timer = null;
      var errorsInRow = 0;
      function playAt(i) {
        var v = videos[i % videos.length];
        video.src = v.src;
        if (v.poster) video.poster = v.poster;
        var promise = video.play();
        if (promise && promise.catch) promise.catch(function(){});
        if (timer) { clearTimeout(timer); timer = null; }
        timer = setTimeout(function(){ next(); }, perClip);
      }
      function next() {
        idx = (idx + 1) % videos.length;
        playAt(idx);
      }
      function onError() {
        errorsInRow += 1;
        if (errorsInRow >= videos.length) {
          // Every clip failed — stop trying, fall back to poster.
          if (timer) { clearTimeout(timer); timer = null; }
          tile.classList.remove('is-playing');
          try { video.pause(); video.removeAttribute('src'); video.load(); } catch(e){}
          return;
        }
        setTimeout(next, 250);
      }
      function onOk() { errorsInRow = 0; }
      video.addEventListener('ended', function(){ onOk(); next(); });
      video.addEventListener('playing', onOk);
      video.addEventListener('error', onError);
      video.addEventListener('loadedmetadata', function(){
        var natural = (video.duration || 0) * 1000;
        if (natural && natural < perClip) {
          if (timer) { clearTimeout(timer); timer = null; }
          timer = setTimeout(next, natural);
        }
      });
      tile.classList.add('is-playing');
      playAt(0);
      tile.__cleanup = function(){ if (timer) clearTimeout(timer); try { video.pause(); } catch(e){} };
    } else if (images.length > 1) {
      var slides = tile.querySelectorAll('.mq-tile__slides img');
      if (slides.length < 2) return;
      // Preload
      images.forEach(function(src){ var i = new Image(); i.src = src; });
      var slot = 0;
      var i = 0;
      slides[0].src = images[0]; slides[0].classList.add('is-visible');
      var interval = setInterval(function(){
        i = (i + 1) % images.length;
        slot = 1 - slot;
        var incoming = slides[slot];
        var outgoing = slides[1 - slot];
        incoming.src = images[i];
        incoming.classList.add('is-visible');
        outgoing.classList.remove('is-visible');
      }, SLIDESHOW_STEP_MS);
      tile.__cleanup = function(){ clearInterval(interval); };
    }
  }

  function deactivateTile(tile) {
    if (tile.__cleanup) { try { tile.__cleanup(); } catch(e){} tile.__cleanup = null; }
    tile.__started = false;
    tile.classList.remove('is-playing');
    var v = tile.querySelector('.mq-tile__video');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e){} }
    var slides = tile.querySelectorAll('.mq-tile__slides img');
    for (var i=0;i<slides.length;i++) { slides[i].classList.remove('is-visible'); slides[i].removeAttribute('src'); }
  }

  var observer = null;
  function setupObserver(root) {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) activateTile(entry.target);
        else deactivateTile(entry.target);
      });
    }, { rootMargin: '10% 0px', threshold: 0.35 });
    root.querySelectorAll('.mq-tile[data-videos]').forEach(function(t){ observer.observe(t); });
  }

  // ---- Views ----
  function renderHome() {
    if (crumbsEl) crumbsEl.innerHTML = '<span>Home</span>';
    var stats =
      '<div class="mq-hero__stats">' +
        '<span><strong>' + data.sources.length + '</strong>Sources</span>' +
        '<span><strong>' + data.sources.reduce(function(a,s){return a+s.count;},0) + '</strong>Items</span>' +
        (data.today ? '<span>' + esc(data.today) + '</span>' : '') +
      '</div>';
    var hero =
      '<header class="mq-hero">' +
        '<span class="mq-hero__kicker">Now Playing</span>' +
        '<h1 class="mq-hero__title">' + esc(data.title) + '</h1>' +
        (data.tagline ? '<p class="mq-hero__tag">' + esc(data.tagline) + '</p>' : '') +
        stats +
      '</header>';

    var cards = data.sources.map(function(s){
      var videos = s.videos || [];
      var images = s.images || [];
      var tile =
        '<div class="mq-tile" data-videos="' + attr(JSON.stringify(videos)) + '" data-images="' + attr(JSON.stringify(images)) + '">' +
          (s.cover ? '<img class="mq-tile__poster" src="' + attr(s.cover) + '" alt="" loading="lazy"/>' : '') +
          '<div class="mq-tile__slides"><img alt="" loading="lazy"/><img alt="" loading="lazy"/></div>' +
          (videos.length ? '<video class="mq-tile__video" muted playsinline preload="metadata" ' + (s.cover ? 'poster="' + attr(s.cover) + '"' : '') + '></video>' : '') +
          '<div class="mq-tile__scrim"></div>' +
          '<span class="mq-tile__count">' + s.count + ' items</span>' +
        '</div>';
      return '<a class="mq-card" href="#/s/' + attr(s.slug) + '">' +
        tile +
        '<div class="mq-card__meta">' +
          '<div class="mq-card__title">' + esc(s.name) + '</div>' +
          '<div class="mq-card__sub"><span>' + s.count + ' picks</span></div>' +
        '</div>' +
      '</a>';
    }).join('');
    var grid = data.sources.length
      ? '<section class="mq-grid">' + cards + '</section>'
      : '<div class="mq-empty">No sources to show.</div>';
    app.innerHTML = '<div class="mq-view">' + hero + grid + '</div>';
    window.scrollTo(0, 0);
    setupObserver(app);
  }

  function renderSource(slug) {
    var s = findSource(slug);
    if (!s) { location.hash = '#/'; return; }
    if (crumbsEl) crumbsEl.innerHTML = '<a href="#/">Home</a><span class="sep">/</span><span>' + esc(s.name) + '</span>';
    var items = (s.items || []).map(function(it){
      var isVideo = !!it.video;
      var thumbHtml = it.thumb
        ? '<img src="' + attr(it.thumb) + '" alt="" loading="lazy"/>'
        : '<div class="mq-item__no-thumb"><span>' + esc(it.domain || 'video') + '</span></div>';
      return '<a class="mq-item" href="' + attr(it.href) + '" target="_blank" rel="noopener">' +
        '<div class="mq-item__thumb">' +
          thumbHtml +
          (isVideo ? '<span class="mq-item__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' : '') +
        '</div>' +
        '<div class="mq-item__title">' + esc(it.title) + '</div>' +
        (it.domain ? '<div class="mq-item__domain">' + esc(it.domain) + '</div>' : '') +
      '</a>';
    }).join('');

    var linkItemsHtml = '';
    if (s.linkItems && s.linkItems.length) {
      var lis = s.linkItems.map(function(it){
        return '<li>' +
          '<a href="' + attr(it.href) + '" target="_blank" rel="noopener">' + esc(it.title) + '</a>' +
          (it.domain ? '<span class="mq-links__domain">' + esc(it.domain) + '</span>' : '') +
        '</li>';
      }).join('');
      linkItemsHtml =
        '<section class="mq-links">' +
          '<h2 class="mq-links__heading">More links from this source</h2>' +
          '<ul class="mq-links__list">' + lis + '</ul>' +
        '</section>';
    }

    var body =
      '<div class="mq-view">' +
        '<a class="mq-back" href="#/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>All sources</a>' +
        '<header class="mq-detail__head">' +
          '<span class="mq-detail__kicker">Source</span>' +
          '<h1 class="mq-detail__title">' + esc(s.name) + '</h1>' +
          '<div class="mq-detail__meta">' +
            '<span>' + s.count + ' items</span>' +
            (s.videos.length ? '<span>' + s.videos.length + ' videos</span>' : '') +
            (s.images.length ? '<span>' + s.images.length + ' images</span>' : '') +
          '</div>' +
        '</header>' +
        (items ? '<section class="mq-items">' + items + '</section>' : '<div class="mq-empty">No preview items in this source.</div>') +
        linkItemsHtml +
      '</div>';
    app.innerHTML = body;
    window.scrollTo(0, 0);
  }

  function route(targetHash) {
    var h = targetHash || location.hash || '#/';
    var m = h.match(/^#\\/s\\/(.+)$/);
    if (m) renderSource(decodeURIComponent(m[1]));
    else renderHome();
  }

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('#/') === 0) {
      e.preventDefault();
      try {
        location.hash = href;
      } catch (err) {}
      route(href);
    }
  });

  window.addEventListener('hashchange', function() {
    route();
  });
  route();
})();
</script>`;

  const body = `<div class="mq-app">
    <nav class="mq-nav">
      <div class="mq-nav__brand">
        <span class="mq-nav__logo">${esc(ctx.title)}</span>
        <span class="mq-nav__tag">Marquee Edition</span>
      </div>
      <div class="mq-nav__crumbs" id="mq-crumbs"><span>Home</span></div>
      <div class="mq-nav__meta">${esc(ctx.today || '')}</div>
    </nav>
    <main id="mq-app"></main>
  </div>
  ${dataScript}
  ${runtime}`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'marquee-theme' });
}

// ---------- expose ----------
if (typeof window !== 'undefined') {
  window.LINKFORGE_TEMPLATES = TEMPLATES;
  window.LINKFORGE_SUGGEST = suggestTemplate;
  window.LINKFORGE_SUGGEST_TEMPLATE = suggestTemplate;
  window.LINKFORGE_MARQUEE_VALIDATE = marqueeValidate;
}
if (typeof module !== 'undefined') {
  module.exports = { TEMPLATES, suggestTemplate, splitItems, partitionGroups, marqueeValidate };
}
