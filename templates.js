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
    console: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0b0d10"/><rect x="8" y="8" width="50" height="4" rx="1" fill="#61dafb"/><rect x="8" y="18" width="80" height="3" rx="1" fill="#5c6370"/><rect x="8" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="50" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="58" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="66" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="74" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="82" width="60" height="3" rx="1" fill="#5c6370"/></svg>`,
    wall: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafafa"/><rect x="8" y="6" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="14" width="34" height="34" rx="3" fill="#dc2626"/><rect x="46" y="14" width="34" height="34" rx="3" fill="#7c3aed"/><rect x="84" y="14" width="34" height="34" rx="3" fill="#06b6d4"/><rect x="122" y="14" width="30" height="34" rx="3" fill="#f59e0b"/><rect x="8" y="56" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="71" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="80" y="71" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    timeline: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><line x1="22" y1="15" x2="22" y2="95" stroke="#e5e5e5" stroke-width="1"/><circle cx="22" cy="22" r="4" fill="#111"/><rect x="32" y="18" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="28" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="40" width="110" height="10" rx="2" fill="#f4f4f5"/><circle cx="22" cy="58" r="4" fill="#111"/><rect x="32" y="54" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="64" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="71" width="110" height="3" rx="1" fill="#bbb"/><rect x="32" y="78" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="85" width="110" height="3" rx="1" fill="#bbb"/></svg>`,
    broadsheet: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fbfaf5"/><rect x="8" y="8" width="144" height="6" rx="1" fill="#111827"/><rect x="8" y="20" width="68" height="44" rx="2" fill="#d6d3d1"/><rect x="82" y="20" width="70" height="5" rx="1" fill="#111827"/><rect x="82" y="30" width="70" height="3" rx="1" fill="#6b7280"/><rect x="82" y="38" width="70" height="3" rx="1" fill="#9ca3af"/><rect x="82" y="46" width="70" height="3" rx="1" fill="#9ca3af"/><line x1="8" y1="72" x2="152" y2="72" stroke="#111827" stroke-width="1"/><rect x="8" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="56" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="104" y="78" width="40" height="3" rx="1" fill="#111827"/></svg>`,
    signal: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#09111f"/><rect x="8" y="8" width="34" height="84" rx="6" fill="#0f1c34"/><rect x="50" y="8" width="102" height="20" rx="6" fill="#16233d"/><rect x="56" y="14" width="34" height="4" rx="1" fill="#f1f5f9"/><rect x="50" y="34" width="102" height="24" rx="6" fill="#16233d"/><rect x="50" y="64" width="102" height="24" rx="6" fill="#16233d"/><circle cx="64" cy="46" r="4" fill="#38bdf8"/><circle cx="64" cy="76" r="4" fill="#f97316"/><rect x="74" y="43" width="52" height="3" rx="1" fill="#f1f5f9"/><rect x="74" y="73" width="52" height="3" rx="1" fill="#f1f5f9"/></svg>`,
    flux: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#090d0f"/><rect x="9" y="10" width="48" height="8" fill="#edf5f4"/><rect x="9" y="23" width="29" height="3" fill="#86f4d3"/><rect x="9" y="36" width="66" height="29" rx="3" fill="#172327"/><rect x="80" y="36" width="34" height="29" rx="3" fill="#bce7f5"/><rect x="119" y="36" width="32" height="29" rx="3" fill="#24363c"/><rect x="9" y="71" width="43" height="18" rx="3" fill="#162025"/><rect x="57" y="71" width="43" height="18" rx="3" fill="#162025"/><rect x="105" y="71" width="46" height="18" rx="3" fill="#162025"/></svg>`,
    shelf: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#f7f8f8"/><rect x="8" y="9" width="36" height="5" fill="#1b2428"/><rect x="8" y="27" width="38" height="25" rx="3" fill="#dfe7ea"/><rect x="51" y="18" width="64" height="34" rx="3" fill="#bde5f4"/><rect x="120" y="18" width="32" height="34" rx="3" fill="#263843"/><rect x="8" y="58" width="47" height="33" rx="3" fill="#9ebbd6"/><rect x="60" y="58" width="38" height="33" rx="3" fill="#e6e8e9"/><rect x="103" y="58" width="49" height="33" rx="3" fill="#d9d4eb"/></svg>`,
  };
  return layouts[layout] || layouts.stream;
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
};

function suggestTemplate(counts) {
  const t = counts.total || 1;
  if (counts.gallery / t >= 0.4) return 'wall';
  if (counts.video / t >= 0.3) return 'youtube';
  if (counts.article / t >= 0.55) return 'shelf';
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
  .lf-template h4 { text-wrap: balance; }
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
    background: linear-gradient(120deg, transparent 25%, rgba(255,255,255,0.28) 50%, transparent 75%);
    transform: translateX(-60%);
    transition: opacity var(--dur-base) var(--ease-out);
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
function buildYoutube(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);
  const firstGroup = previewGroups[0];
  const hero = firstGroup?.items[0] || null;

  const image = (item, className = '') => `<img
    class="${className}"
    src="${attr(item.thumbnail)}"
    alt=""
    loading="lazy"
    onerror="this.hidden=true;this.parentElement.classList.add('is-broken')"
  />`;

  const card = (item, source) => `<a class="creator-card" href="${attr(item.href)}" target="_blank" rel="noopener noreferrer">
    <div class="creator-card__media">${image(item)}</div>
    <h3>${esc(item.title || item.href)}</h3>
    <div class="creator-card__source">${esc(source)}</div>
  </a>`;

  const sections = previewGroups.map((group, groupIndex) => {
    const source = srcLabel(group);
    const items = groupIndex === 0 && hero ? group.items.slice(1) : group.items;
    if (!items.length) return '';
    return `<section class="creator-section">
      <div class="creator-section__head">
        <h2>${esc(source)}</h2>
        <span aria-hidden="true"></span>
      </div>
      <div class="creator-grid">${items.map((item) => card(item, source)).join('')}</div>
    </section>`;
  }).join('');

  const heroHtml = hero ? `<a class="creator-hero" href="${attr(hero.href)}" target="_blank" rel="noopener noreferrer">
    <div class="creator-hero__media">${image(hero)}</div>
    <div class="creator-hero__shade"></div>
    <div class="creator-hero__copy">
      <h2>${esc(hero.title || hero.href)}</h2>
      <span>${esc(srcLabel(firstGroup))}</span>
    </div>
  </a>` : '';

  const linksHtml = linkGroups.length ? `<section class="creator-links">
    <div class="creator-section__head">
      <h2>More links</h2>
      <span aria-hidden="true"></span>
    </div>
    <div class="creator-links__groups">${linkGroups.map((group) => `<section>
      <h3>${esc(srcLabel(group))}</h3>
      <ul>${group.items.map((item) => `<li><a href="${attr(item.href)}" target="_blank" rel="noopener noreferrer">
        <span>${esc(item.title || item.href)}</span>
        ${item.domain ? `<small>${esc(item.domain)}</small>` : ''}
      </a></li>`).join('')}</ul>
    </section>`).join('')}</div>
  </section>` : '';

  const css = `
  :root { --creator-bg: #0b1014; --creator-panel: #12171c; --creator-line: #2a3035; --creator-text: #f4f1eb; --creator-muted: #92989e; --creator-accent: #ff5b3d; }
  body { background: var(--creator-bg); color: var(--creator-text); font-family: Inter, system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.4; }
  .creator-wrap { width: min(100%, 1600px); margin: 0 auto; padding: 18px 24px 72px; }
  .creator-masthead { display: flex; align-items: center; min-height: 52px; padding: 0 20px; border-bottom: 1px solid #1c2227; }
  .creator-masthead h1 { margin: 0; color: #fff; font-family: Fraunces, Georgia, serif; font-size: clamp(28px, 3vw, 38px); font-weight: 500; letter-spacing: -0.04em; line-height: 1; }
  .creator-hero { position: relative; display: block; min-height: clamp(270px, 25vw, 370px); margin-top: 0; overflow: hidden; background: var(--creator-panel); isolation: isolate; }
  .creator-hero__media, .creator-hero__media img { width: 100%; height: 100%; }
  .creator-hero__media { position: absolute; inset: 0; background: #171d22; }
  .creator-hero__media img { object-fit: cover; transition: transform 600ms var(--ease-out), opacity 180ms ease; }
  .creator-hero__media.is-broken { background: #171d22; }
  .creator-hero__media.is-broken img, .creator-card__media.is-broken img { display: none !important; }
  .creator-hero__shade { position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(5,8,10,.94) 0%, rgba(5,8,10,.68) 25%, rgba(5,8,10,.12) 58%, rgba(5,8,10,.08) 100%), linear-gradient(0deg, rgba(5,8,10,.35), transparent 48%); }
  .creator-hero__copy { position: absolute; z-index: 2; left: clamp(28px, 4vw, 52px); bottom: clamp(26px, 3.5vw, 48px); width: min(470px, 70%); }
  .creator-hero__copy h2 { margin: 0; color: #fff; font-family: Fraunces, Georgia, serif; font-size: clamp(34px, 3.8vw, 54px); font-weight: 500; letter-spacing: -0.04em; line-height: 1; }
  .creator-hero__copy span { display: block; margin-top: 14px; color: #b6b8b9; font-size: 11px; letter-spacing: .04em; }
  .creator-hero:hover .creator-hero__media img { transform: scale(1.018); }
  .creator-hero:focus-visible { outline-color: var(--creator-accent); outline-offset: 4px; }

  .creator-section { margin-top: 26px; }
  .creator-section__head { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .creator-section__head h2 { flex: 0 0 auto; margin: 0; color: #f3f0ea; font-family: "IBM Plex Mono", monospace; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .creator-section__head span { width: 100%; height: 1px; background: var(--creator-line); }
  .creator-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 28px 14px; }
  .creator-card { display: block; min-width: 0; }
  .creator-card__media { aspect-ratio: 1.72 / 1; overflow: hidden; background: var(--creator-panel); border: 1px solid #20272c; }
  .creator-card__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 350ms var(--ease-out), opacity 180ms ease; }
  .creator-card__media.is-broken { background: #171d22; }
  .creator-card h3 { display: -webkit-box; overflow: hidden; margin: 10px 0 0; color: #e7e7e5; font-size: 13px; font-weight: 500; letter-spacing: -.01em; line-height: 1.32; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .creator-card__source { overflow: hidden; margin-top: 5px; color: var(--creator-muted); font-size: 10px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
  .creator-card:hover .creator-card__media img { transform: scale(1.035); }
  .creator-card:hover h3, .creator-card:focus-visible h3 { color: var(--creator-accent); }
  .creator-card:focus-visible { outline-color: var(--creator-accent); outline-offset: 5px; }

  .creator-links { margin-top: 48px; padding-top: 4px; }
  .creator-links__groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px 40px; }
  .creator-links__groups h3 { margin: 0 0 8px; color: #c4c5c5; font-family: "IBM Plex Mono", monospace; font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  .creator-links ul { list-style: none; margin: 0; padding: 0; }
  .creator-links li { border-bottom: 1px solid #1e2429; }
  .creator-links li:last-child { border-bottom: 0; }
  .creator-links a { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; color: #cfd0cf; font-size: 12px; }
  .creator-links a > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .creator-links small { flex: 0 0 auto; color: #727980; font-size: 9px; }
  .creator-links a:hover, .creator-links a:focus-visible { color: var(--creator-accent); }
  .creator-empty { margin: 64px 0; padding: 40px 20px; border-block: 1px solid var(--creator-line); color: var(--creator-muted); text-align: center; }

  @media (max-width: 1180px) { .creator-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 780px) {
    .creator-wrap { padding: 12px 14px 56px; }
    .creator-masthead { min-height: 48px; padding: 0 4px 12px; }
    .creator-hero { min-height: 340px; }
    .creator-hero__shade { background: linear-gradient(0deg, rgba(5,8,10,.94) 0%, rgba(5,8,10,.22) 70%); }
    .creator-hero__copy { left: 22px; bottom: 24px; width: calc(100% - 44px); }
    .creator-hero__copy h2 { font-size: clamp(34px, 10vw, 52px); }
    .creator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 10px; }
    .creator-links__groups { grid-template-columns: 1fr; gap: 24px; }
  }
  @media (max-width: 420px) {
    .creator-hero { min-height: 310px; }
    .creator-card h3 { font-size: 12px; }
  }`;

  const body = `<div class="creator-wrap">
    <header class="creator-masthead"><h1>${esc(ctx.title)}</h1></header>
    ${heroHtml}
    ${sections}
    ${linksHtml}
    ${!heroHtml && !sections && !linksHtml ? '<div class="creator-empty">No links selected.</div>' : ''}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css, bodyClass: 'creator-theme' });
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
  const groups = (ctx.sourceGroups || []).map((group) => {
    const split = splitItems(group.items || []);
    return { ...group, previewItems: split.withPreview, linkItems: split.linkOnly };
  }).filter((group) => group.previewItems.length || group.linkItems.length);

  const css = `
  :root { --ink: #171715; --muted: #77746d; --line: #d9d6cf; --paper: #f7f6f2; --accent: #b4452f; }
  body { background: var(--paper); color: var(--ink); font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wall { max-width: 1440px; margin: 0 auto; padding: 34px clamp(18px, 3vw, 52px) 72px; }
  .site-head { padding: 0 0 26px; margin-bottom: clamp(42px, 7vw, 88px); border-bottom: 1px solid var(--ink); }
  .site-head h1 { margin: 0; font-family: "DM Serif Display", Georgia, serif; font-size: clamp(36px, 6vw, 76px); font-weight: 400; line-height: .95; letter-spacing: -.035em; }
  .source { margin: 0 0 clamp(58px, 8vw, 108px); }
  .source-head { display: flex; align-items: baseline; gap: 14px; padding-bottom: 10px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
  .source-name { min-width: 0; font-size: 12px; line-height: 1.2; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .source-count { flex: 0 0 auto; color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .source-rule { height: 1px; flex: 1; background: var(--line); }
  .gallery { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: clamp(14px, 1.7vw, 26px); align-items: start; }
  .work { grid-column: span 4; display: block; color: inherit; min-width: 0; }
  .work:nth-child(8n + 1), .work:nth-child(8n + 2) { grid-column: span 6; }
  .work:nth-child(8n + 4), .work:nth-child(8n + 7) { grid-column: span 5; }
  .work:nth-child(8n + 5), .work:nth-child(8n + 8) { grid-column: span 3; }
  .media { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #e8e5de; }
  .work:nth-child(8n + 1) .media, .work:nth-child(8n + 2) .media { aspect-ratio: 16 / 10; }
  .work:nth-child(8n + 4) .media, .work:nth-child(8n + 7) .media { aspect-ratio: 5 / 4; }
  .work:nth-child(8n + 5) .media, .work:nth-child(8n + 8) .media { aspect-ratio: 3 / 4; }
  .media img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: cover; transition: transform 500ms cubic-bezier(.2,.7,.2,1), filter 220ms ease; }
  .media-fallback { position: absolute; z-index: 0; inset: 0; display: grid; place-items: center; color: #918d84; font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  .work:hover .media img, .work:focus-visible .media img { transform: scale(1.025); filter: saturate(1.04); }
  .work:focus-visible { outline: 2px solid var(--accent); outline-offset: 5px; }
  .work h3 { margin: 10px 0 0; max-width: 34ch; font-size: clamp(13px, 1.15vw, 16px); font-weight: 500; line-height: 1.35; letter-spacing: -.01em; }
  .work-meta { display: block; margin-top: 4px; color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 9px; line-height: 1.4; }
  .work:hover h3 { color: var(--accent); }
  .plain-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; margin: 28px 0 0; padding: 14px 0 0; border-top: 1px solid var(--line); list-style: none; }
  .plain-links li { min-width: 0; border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent); }
  .plain-links a { display: flex; justify-content: space-between; gap: 14px; padding: 9px 0; color: var(--ink); font-size: 12px; line-height: 1.35; }
  .plain-links a:hover, .plain-links a:focus-visible { color: var(--accent); }
  .plain-links__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .plain-links__domain { flex: 0 0 auto; color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 9px; }
  .empty { padding: 44px 0; color: var(--muted); border-top: 1px solid var(--line); font-size: 13px; }
  @media (max-width: 860px) {
    .gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .work, .work:nth-child(n) { grid-column: span 1; }
    .work:nth-child(n) .media { aspect-ratio: 4 / 3; }
    .work:nth-child(4n + 1) { grid-column: 1 / -1; }
    .work:nth-child(4n + 1) .media { aspect-ratio: 16 / 9; }
  }
  @media (max-width: 560px) {
    .wall { padding-top: 24px; }
    .site-head { margin-bottom: 48px; }
    .gallery { grid-template-columns: 1fr; gap: 28px; }
    .work, .work:nth-child(n) { grid-column: 1; }
    .work:nth-child(n) .media { aspect-ratio: 4 / 3; }
    .source-head { gap: 9px; }
    .plain-links { grid-template-columns: 1fr; }
  }`;

  const sections = groups.map((group) => {
    const works = group.previewItems.map((item) => `<a class="work" href="${attr(item.href)}" target="_blank" rel="noopener">
      <div class="media">
        <span class="media-fallback" aria-hidden="true">Image unavailable</span>
        <img src="${attr(item.thumbnail)}" alt="" loading="lazy" onerror="this.remove()" />
      </div>
      <h3>${esc(item.title || item.href)}</h3>
      <span class="work-meta">${esc(item.domain || srcLabel(group))}</span>
    </a>`).join('');
    const links = group.linkItems.length ? `<ul class="plain-links">${group.linkItems.map((item) => `<li>
      <a href="${attr(item.href)}" target="_blank" rel="noopener">
        <span class="plain-links__title">${esc(item.title || item.href)}</span>
        <span class="plain-links__domain">${esc(item.domain || '')}</span>
      </a>
    </li>`).join('')}</ul>` : '';
    const count = group.previewItems.length;
    return `<section class="source">
      <header class="source-head">
        <h2 class="source-name">${esc(srcLabel(group))}</h2>
        <span class="source-rule" aria-hidden="true"></span>
        <span class="source-count">${count} ${count === 1 ? 'image' : 'images'}</span>
      </header>
      ${works ? `<div class="gallery">${works}</div>` : '<div class="empty">No images available for this source.</div>'}
      ${links}
    </section>`;
  }).join('');

  const body = `<main class="wall">
    <header class="site-head"><h1>${esc(ctx.title)}</h1></header>
    ${sections || '<div class="empty">No selected items to show.</div>'}
  </main>`;

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
function buildFlux(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const titleWords = String(ctx.title || '').trim().split(/\s+/).filter(Boolean);
  const displayTitle = titleWords.length > 1
    ? `${esc(titleWords[0])}<br>${esc(titleWords.slice(1).join(' '))}`
    : esc(ctx.title);
  const css = `
  :root { --flux-bg:#080c0e; --flux-panel:#10171a; --flux-line:#263238; --flux-text:#edf5f4; --flux-muted:#89979b; --flux-mint:#86f4d3; --flux-ice:#bceafa; --lf-focus-color:var(--flux-mint); }
  body { background:var(--flux-bg); color:var(--flux-text); font-family:"Manrope",system-ui,sans-serif; }
  .flux-shell { max-width:1480px; margin:0 auto; padding:28px 42px 48px; }
  .flux-top { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-bottom:24px; border-bottom:1px solid var(--flux-line); }
  .flux-mark { color:var(--flux-mint); font:600 10px/1 "IBM Plex Mono",monospace; letter-spacing:.18em; text-transform:uppercase; }
  .flux-count { color:var(--flux-muted); font:400 10px/1 "IBM Plex Mono",monospace; letter-spacing:.12em; text-transform:uppercase; }
  .flux-hero { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,.68fr); align-items:end; min-height:180px; padding:34px 0 24px; border-bottom:1px solid var(--flux-line); }
  .flux-hero h1 { max-width:900px; margin:0; font-size:clamp(48px,8vw,112px); font-weight:500; line-height:.84; letter-spacing:-.065em; text-transform:uppercase; }
  .flux-signal { display:grid; grid-template-columns:repeat(14,1fr); gap:8px; align-items:end; height:70px; padding-bottom:6px; }
  .flux-signal i { display:block; height:var(--h); background:#303b3f; }
  .flux-signal i:nth-child(4n+1) { background:var(--flux-mint); }
  .flux-signal i:nth-child(7n) { background:var(--flux-ice); }
  .tab-shell { gap:20px; padding-top:18px; }
  .tab-nav { flex-wrap:nowrap; overflow-x:auto; gap:0; border-bottom:1px solid var(--flux-line); }
  .tab-btn { min-width:max-content; min-height:42px; padding:0 22px 12px 0; border:0; border-radius:0; background:transparent; color:var(--flux-muted); }
  .tab-btn:hover,.tab-btn.active { background:transparent; color:var(--flux-text); box-shadow:none; transform:none; }
  .tab-btn.active { color:var(--flux-mint); }
  .tab-btn__title { font-family:"IBM Plex Mono",monospace; font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
  .tab-btn__meta { display:none; }
  .flux-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; }
  .flux-card { grid-column:span 3; min-width:0; overflow:hidden; border:1px solid var(--flux-line); border-radius:3px; background:var(--flux-panel); }
  .flux-card:nth-child(1),.flux-card:nth-child(2) { grid-column:span 6; }
  .flux-card:nth-child(6n+4) { grid-column:span 4; }
  .flux-card:nth-child(6n+5) { grid-column:span 5; }
  .flux-card:nth-child(6n+6) { grid-column:span 3; }
  .flux-card__media { position:relative; aspect-ratio:4/3; overflow:hidden; background:#172126; }
  .flux-card:nth-child(1) .flux-card__media,.flux-card:nth-child(2) .flux-card__media { aspect-ratio:16/9; }
  .flux-card__media img { width:100%; height:100%; object-fit:cover; filter:saturate(.82) contrast(1.04); transition:transform .4s var(--ease-out),filter .25s ease; }
  .flux-card:hover img { transform:scale(1.025); filter:saturate(1); }
  .flux-card__kind { position:absolute; left:12px; bottom:12px; padding:5px 7px; border:1px solid rgba(134,244,211,.45); background:rgba(8,12,14,.82); color:var(--flux-mint); font:600 9px/1 "IBM Plex Mono",monospace; letter-spacing:.08em; text-transform:uppercase; }
  .flux-card__body { display:grid; gap:7px; padding:12px; border-top:1px solid var(--flux-line); }
  .flux-card h2 { margin:0; overflow:hidden; font-size:14px; font-weight:500; line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
  .flux-card__meta { color:var(--flux-muted); font:400 9px/1.3 "IBM Plex Mono",monospace; }
  .flux-card:hover h2 { color:var(--flux-mint); }
  .flux-links { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .flux-links a { display:grid; grid-template-columns:1fr auto; gap:12px; padding:13px 14px; border:1px solid var(--flux-line); border-radius:3px; color:#c9d2d3; font:400 11px/1.35 "IBM Plex Mono",monospace; }
  .flux-links a::after { content:"↗"; color:var(--flux-mint); }
  .flux-links a:hover { border-color:#527067; color:var(--flux-text); }
  .flux-empty { padding:36px 0; color:var(--flux-muted); font:400 11px "IBM Plex Mono",monospace; }
  @media(max-width:900px){ .flux-shell{padding:24px}.flux-hero{grid-template-columns:1fr}.flux-signal{display:none}.flux-card,.flux-card:nth-child(n){grid-column:span 6}.flux-links{grid-template-columns:1fr 1fr} }
  @media(max-width:600px){ .flux-shell{padding:20px 14px 36px}.flux-top{padding-bottom:18px}.flux-hero{min-height:132px;padding:28px 0 18px}.flux-hero h1{font-size:clamp(42px,17vw,72px)}.flux-card,.flux-card:nth-child(n){grid-column:span 12}.flux-card__media,.flux-card:nth-child(n) .flux-card__media{aspect-ratio:16/10}.flux-links{grid-template-columns:1fr}.tab-btn{padding-right:18px} }
  `;
  const content = renderSourceTabs(groups, (group) => {
    const cards = group.previewItems.map((item) => `<a class="flux-card" href="${attr(item.href)}" target="_blank" rel="noopener">
      <div class="flux-card__media">${thumbImg(item, 'decoding="async" onerror="this.parentElement.parentElement.remove()"')}<span class="flux-card__kind">${esc(itemKindLabel(item))}</span></div>
      <div class="flux-card__body"><h2>${esc(item.title || item.href)}</h2><span class="flux-card__meta">${esc(item.domain || srcLabel(group))}</span></div>
    </a>`).join('');
    const links = group.linkItems.map((item) => `<a href="${attr(item.href)}" target="_blank" rel="noopener"><span>${esc(item.title || item.href)}</span></a>`).join('');
    return `${cards ? `<div class="flux-grid">${cards}</div>` : '<div class="flux-empty">No image previews in this source.</div>'}${links ? `<div class="flux-links">${links}</div>` : ''}`;
  }, { prefix:'flux-tabs', emptyHtml:'<div class="flux-empty">No items selected for this export yet.</div>' });
  const bars = [42,68,30,84,54,36,72,24,62,46,78,34,58,88].map((h) => `<i style="--h:${h}%"></i>`).join('');
  const total = groups.reduce((sum, group) => sum + group.previewItems.length + group.linkItems.length, 0);
  const body = `<div class="flux-shell"><header class="flux-top"><span class="flux-mark">Flux index</span><span class="flux-count">${total} curated ${total === 1 ? 'item' : 'items'}</span></header><section class="flux-hero"><h1>${displayTitle}</h1><div class="flux-signal" aria-hidden="true">${bars}</div></section><main>${content}</main></div>`;
  return shell({ title:ctx.title, tagline:ctx.tagline, today:ctx.today, body, css, bodyClass:'flux-theme' });
}

// =====================================================
// POP SHELF — light architectural media gallery
// =====================================================
function buildShelf(ctx) {
  const groups = buildSourceTabs(ctx.sourceGroups);
  const titleWords = String(ctx.title || '').trim().split(/\s+/).filter(Boolean);
  const displayTitle = titleWords.length > 1
    ? `${esc(titleWords[0])}<br>${esc(titleWords.slice(1).join(' '))}`
    : esc(ctx.title);
  const css = `
  :root { --shelf-bg:#f7f8f8; --shelf-text:#172126; --shelf-muted:#6e7b80; --shelf-line:#d9e0e2; --shelf-blue:#4f76e8; --shelf-ice:#dff4fb; --lf-focus-color:var(--shelf-blue); }
  body { background:var(--shelf-bg); color:var(--shelf-text); font-family:"Manrope",system-ui,sans-serif; }
  .shelf-shell { max-width:1460px; margin:0 auto; padding:24px 30px 44px; }
  .shelf-top { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-bottom:18px; border-bottom:1px solid var(--shelf-line); }
  .shelf-brand { font-size:14px; font-weight:600; letter-spacing:.22em; text-transform:uppercase; }
  .shelf-date { color:var(--shelf-muted); font:400 9px "IBM Plex Mono",monospace; letter-spacing:.1em; text-transform:uppercase; }
  .shelf-layout { display:grid; grid-template-columns:minmax(210px,.34fr) minmax(0,1fr); gap:28px; padding-top:30px; }
  .shelf-intro { position:sticky; top:24px; align-self:start; min-height:420px; display:flex; flex-direction:column; justify-content:space-between; }
  .shelf-intro h1 { margin:72px 0 0; font-size:clamp(42px,4.3vw,64px); font-weight:400; line-height:.92; letter-spacing:-.055em; text-transform:uppercase; overflow-wrap:normal; word-break:normal; }
  .shelf-index { color:var(--shelf-muted); font:400 10px "IBM Plex Mono",monospace; letter-spacing:.1em; text-transform:uppercase; }
  .tab-shell { gap:14px; }
  .tab-nav { flex-wrap:nowrap; overflow-x:auto; gap:4px; }
  .tab-btn { min-width:max-content; min-height:38px; padding:8px 12px; border:0; border-radius:3px; background:transparent; color:var(--shelf-muted); }
  .tab-btn:hover { background:#eef2f3; transform:none; }
  .tab-btn.active { border-color:transparent; background:var(--shelf-ice); color:#2459c4; box-shadow:none; }
  .tab-btn__title { font-size:11px; font-weight:600; }
  .tab-btn__meta { display:none; }
  .shelf-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-auto-flow:dense; gap:8px; }
  .shelf-card { grid-column:span 4; min-width:0; overflow:hidden; border:1px solid var(--shelf-line); border-radius:4px; background:#fff; }
  .shelf-card:nth-child(1){grid-column:span 7}.shelf-card:nth-child(2){grid-column:span 5}.shelf-card:nth-child(3){grid-column:span 5}.shelf-card:nth-child(4){grid-column:span 7}.shelf-card:nth-child(7n){grid-column:span 8}
  .shelf-card__media { position:relative; aspect-ratio:4/3; overflow:hidden; background:#e9eef0; }
  .shelf-card:nth-child(1) .shelf-card__media,.shelf-card:nth-child(4) .shelf-card__media,.shelf-card:nth-child(7n) .shelf-card__media{aspect-ratio:16/9}
  .shelf-card__media img { width:100%; height:100%; object-fit:cover; filter:saturate(.9); transition:transform .45s var(--ease-out),filter .25s ease; }
  .shelf-card:hover img { transform:scale(1.025); filter:saturate(1.05); }
  .shelf-card__body { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:end; padding:12px; }
  .shelf-card h2 { margin:0; font-size:13px; font-weight:600; line-height:1.25; }
  .shelf-card__meta { display:block; margin-top:5px; color:var(--shelf-muted); font:400 9px "IBM Plex Mono",monospace; }
  .shelf-card__arrow { color:var(--shelf-blue); font:500 14px "IBM Plex Mono",monospace; }
  .shelf-card:hover h2 { color:#2459c4; }
  .shelf-links { margin-top:8px; border:1px solid var(--shelf-line); border-radius:4px; background:#fff; }
  .shelf-links a { display:grid; grid-template-columns:1fr auto; gap:18px; padding:13px 14px; border-bottom:1px solid var(--shelf-line); font-size:12px; }
  .shelf-links a:last-child { border-bottom:0; }
  .shelf-links a::after { content:"↗"; color:var(--shelf-blue); font-family:"IBM Plex Mono",monospace; }
  .shelf-links a:hover { background:#f0f7fa; color:#2459c4; }
  .shelf-empty { padding:40px 0; color:var(--shelf-muted); font-size:13px; }
  @media(max-width:900px){.shelf-layout{grid-template-columns:1fr}.shelf-intro{position:static;min-height:0}.shelf-intro h1{margin:18px 0 8px}.shelf-index{display:none}}
  @media(max-width:620px){.shelf-shell{padding:18px 12px 36px}.shelf-date{display:none}.shelf-layout{padding-top:20px}.shelf-intro h1{font-size:clamp(44px,16vw,68px)}.shelf-card,.shelf-card:nth-child(n){grid-column:span 12}.shelf-card__media,.shelf-card:nth-child(n) .shelf-card__media{aspect-ratio:16/10}}
  `;
  const content = renderSourceTabs(groups, (group) => {
    const cards = group.previewItems.map((item) => `<a class="shelf-card" href="${attr(item.href)}" target="_blank" rel="noopener">
      <div class="shelf-card__media">${thumbImg(item, 'decoding="async" onerror="this.parentElement.parentElement.remove()"')}</div>
      <div class="shelf-card__body"><div><h2>${esc(item.title || item.href)}</h2><span class="shelf-card__meta">${esc(itemKindLabel(item))} · ${esc(item.domain || srcLabel(group))}</span></div><span class="shelf-card__arrow" aria-hidden="true">↗</span></div>
    </a>`).join('');
    const links = group.linkItems.map((item) => `<a href="${attr(item.href)}" target="_blank" rel="noopener"><span>${esc(item.title || item.href)}</span></a>`).join('');
    return `${cards ? `<div class="shelf-grid">${cards}</div>` : '<div class="shelf-empty">No image previews in this source.</div>'}${links ? `<div class="shelf-links">${links}</div>` : ''}`;
  }, { prefix:'shelf-tabs', emptyHtml:'<div class="shelf-empty">No items selected for this export yet.</div>' });
  const body = `<div class="shelf-shell"><header class="shelf-top"><span class="shelf-brand">Pop shelf</span><span class="shelf-date">${esc(ctx.today)}</span></header><div class="shelf-layout"><aside class="shelf-intro"><h1>${displayTitle}</h1><span class="shelf-index">Curated links / mixed media</span></aside><main>${content}</main></div></div>`;
  return shell({ title:ctx.title, tagline:ctx.tagline, today:ctx.today, body, css, bodyClass:'shelf-theme' });
}

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
  module.exports = { TEMPLATES, suggestTemplate, splitItems, partitionGroups };
}
