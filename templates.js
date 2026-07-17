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
    reel: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0a0a0a"/><rect x="8" y="6" width="144" height="32" rx="3" fill="#1f1f23"/><rect x="8" y="40" width="80" height="4" rx="1" fill="#fff" opacity=".85"/><rect x="8" y="48" width="40" height="3" rx="1" fill="#888"/><rect x="8" y="58" width="34" height="20" rx="2" fill="#374151"/><rect x="46" y="58" width="34" height="20" rx="2" fill="#1f2937"/><rect x="84" y="58" width="34" height="20" rx="2" fill="#374151"/><rect x="122" y="58" width="30" height="20" rx="2" fill="#1f2937"/><rect x="8" y="84" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="91" width="60" height="3" rx="1" fill="#444"/></svg>`,
    console: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0b0d10"/><rect x="8" y="8" width="50" height="4" rx="1" fill="#61dafb"/><rect x="8" y="18" width="80" height="3" rx="1" fill="#5c6370"/><rect x="8" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="50" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="58" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="66" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="74" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="82" width="60" height="3" rx="1" fill="#5c6370"/></svg>`,
    wall: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafafa"/><rect x="8" y="6" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="14" width="34" height="34" rx="3" fill="#dc2626"/><rect x="46" y="14" width="34" height="34" rx="3" fill="#7c3aed"/><rect x="84" y="14" width="34" height="34" rx="3" fill="#06b6d4"/><rect x="122" y="14" width="30" height="34" rx="3" fill="#f59e0b"/><rect x="8" y="56" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="71" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="80" y="71" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    timeline: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><line x1="22" y1="15" x2="22" y2="95" stroke="#e5e5e5" stroke-width="1"/><circle cx="22" cy="22" r="4" fill="#111"/><rect x="32" y="18" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="28" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="40" width="110" height="10" rx="2" fill="#f4f4f5"/><circle cx="22" cy="58" r="4" fill="#111"/><rect x="32" y="54" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="64" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="71" width="110" height="3" rx="1" fill="#bbb"/><rect x="32" y="78" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="85" width="110" height="3" rx="1" fill="#bbb"/></svg>`,
    bento: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#f6efe4"/><rect x="8" y="8" width="90" height="50" rx="6" fill="#121212"/><rect x="104" y="8" width="48" height="24" rx="6" fill="#f97316"/><rect x="104" y="36" width="48" height="22" rx="6" fill="#14b8a6"/><rect x="8" y="64" width="34" height="24" rx="6" fill="#facc15"/><rect x="46" y="64" width="52" height="24" rx="6" fill="#ffffff" stroke="#d6d3d1"/><rect x="104" y="64" width="48" height="24" rx="6" fill="#ffffff" stroke="#d6d3d1"/></svg>`,
    broadsheet: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fbfaf5"/><rect x="8" y="8" width="144" height="6" rx="1" fill="#111827"/><rect x="8" y="20" width="68" height="44" rx="2" fill="#d6d3d1"/><rect x="82" y="20" width="70" height="5" rx="1" fill="#111827"/><rect x="82" y="30" width="70" height="3" rx="1" fill="#6b7280"/><rect x="82" y="38" width="70" height="3" rx="1" fill="#9ca3af"/><rect x="82" y="46" width="70" height="3" rx="1" fill="#9ca3af"/><line x1="8" y1="72" x2="152" y2="72" stroke="#111827" stroke-width="1"/><rect x="8" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="56" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="104" y="78" width="40" height="3" rx="1" fill="#111827"/></svg>`,
    signal: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#09111f"/><rect x="8" y="8" width="34" height="84" rx="6" fill="#0f1c34"/><rect x="50" y="8" width="102" height="20" rx="6" fill="#16233d"/><rect x="56" y="14" width="34" height="4" rx="1" fill="#f1f5f9"/><rect x="50" y="34" width="102" height="24" rx="6" fill="#16233d"/><rect x="50" y="64" width="102" height="24" rx="6" fill="#16233d"/><circle cx="64" cy="46" r="4" fill="#38bdf8"/><circle cx="64" cy="76" r="4" fill="#f97316"/><rect x="74" y="43" width="52" height="3" rx="1" fill="#f1f5f9"/><rect x="74" y="73" width="52" height="3" rx="1" fill="#f1f5f9"/></svg>`,
    marquee: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mqg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f97066"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs><rect width="160" height="100" fill="#08080b"/><circle cx="150" cy="10" r="42" fill="url(#mqg)" opacity="0.55"/><rect x="10" y="10" width="60" height="4" rx="1" fill="#f4f4f5"/><rect x="10" y="20" width="80" height="34" rx="4" fill="#18181b" stroke="#3f3f46"/><polygon points="46,32 46,42 56,37" fill="#f97066"/><rect x="94" y="20" width="56" height="34" rx="4" fill="#18181b" stroke="#3f3f46"/><rect x="104" y="30" width="36" height="4" rx="1" fill="#f4f4f5"/><rect x="104" y="40" width="24" height="3" rx="1" fill="#71717a"/><rect x="10" y="60" width="66" height="30" rx="4" fill="#18181b" stroke="#3f3f46"/><rect x="80" y="60" width="70" height="30" rx="4" fill="#18181b" stroke="#3f3f46"/><rect x="16" y="66" width="30" height="4" rx="1" fill="#f4f4f5"/><rect x="16" y="74" width="20" height="3" rx="1" fill="#f97066"/><rect x="86" y="66" width="30" height="4" rx="1" fill="#f4f4f5"/><rect x="86" y="74" width="20" height="3" rx="1" fill="#38bdf8"/></svg>`,
    firetv: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0a0c10"/><rect x="10" y="8" width="44" height="5" rx="1" fill="#f4f4f5"/><rect x="10" y="17" width="26" height="3" rx="1" fill="#71717a"/><rect x="10" y="28" width="26" height="3" rx="1" fill="#fbbf24"/><rect x="9" y="35" width="40" height="26" rx="3" fill="#1c222d" stroke="#fbbf24" stroke-width="2.5"/><polygon points="25,43 25,53 34,48" fill="#fbbf24"/><rect x="55" y="36" width="38" height="24" rx="3" fill="#171b22"/><rect x="99" y="36" width="38" height="24" rx="3" fill="#171b22"/><rect x="143" y="36" width="14" height="24" rx="3" fill="#171b22"/><rect x="10" y="68" width="26" height="3" rx="1" fill="#71717a"/><rect x="10" y="76" width="38" height="18" rx="3" fill="#171b22"/><rect x="52" y="76" width="38" height="18" rx="3" fill="#171b22"/><rect x="94" y="76" width="38" height="18" rx="3" fill="#171b22"/><rect x="136" y="76" width="21" height="18" rx="3" fill="#171b22"/><circle cx="146" cy="14" r="7" fill="none" stroke="#3f3f46" stroke-width="1.5"/><circle cx="146" cy="14" r="2.5" fill="#fbbf24"/></svg>`,
  };
  return layouts[layout] || layouts.stream;
}

// ---------- registry ----------
const TEMPLATES = {
  marquee: {
    name: 'Marquee',
    desc: 'A high-performance, streaming-style showcase: big autoplaying source tiles that loop MP4 previews or thumbnail slideshows — and videos (MP4, YouTube, Vimeo) play right on the page in a lightbox.',
    focus: 'Streaming',
    fit: 'Best when most of your picks are videos or rich thumbnails',
    featured: true,
    featuredLabel: 'Featured · Streaming',
    requires: 'multimedia',
    preview: () => previewSvg('marquee'),
    validate: (ctx) => marqueeValidate(ctx),
    build: (ctx) => buildMarquee(normalize(ctx)),
  },
  firetv: {
    name: 'Fire TV App',
    desc: 'A lean-back TV experience exported as an Android app project — remote-first shelf rows, D-pad navigation, and in-app playback: direct videos, YouTube, Vimeo, and Dailymotion all play inside the app.',
    focus: 'TV app',
    fit: 'Export as an APK for Fire TV / Android TV — drives entirely with the standard remote',
    featured: true,
    featuredLabel: 'New · Fire TV',
    export: 'apk',
    preview: () => previewSvg('firetv'),
    build: (ctx) => buildFireTv(normalize(ctx)),
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
    .lf-template .grid > :nth-child(1),  .lf-template .bento > :nth-child(1),  .lf-template .items > :nth-child(1),  .lf-template .stack > :nth-child(1),  .lf-template .briefs > :nth-child(1) { animation-delay: 0ms; }
    .lf-template .grid > :nth-child(2),  .lf-template .bento > :nth-child(2),  .lf-template .items > :nth-child(2),  .lf-template .stack > :nth-child(2),  .lf-template .briefs > :nth-child(2) { animation-delay: 40ms; }
    .lf-template .grid > :nth-child(3),  .lf-template .bento > :nth-child(3),  .lf-template .items > :nth-child(3),  .lf-template .stack > :nth-child(3),  .lf-template .briefs > :nth-child(3) { animation-delay: 80ms; }
    .lf-template .grid > :nth-child(4),  .lf-template .bento > :nth-child(4),  .lf-template .items > :nth-child(4),  .lf-template .stack > :nth-child(4),  .lf-template .briefs > :nth-child(4) { animation-delay: 120ms; }
    .lf-template .grid > :nth-child(5),  .lf-template .bento > :nth-child(5),  .lf-template .items > :nth-child(5),  .lf-template .stack > :nth-child(5),  .lf-template .briefs > :nth-child(5) { animation-delay: 160ms; }
    .lf-template .grid > :nth-child(6),  .lf-template .bento > :nth-child(6),  .lf-template .items > :nth-child(6),  .lf-template .stack > :nth-child(6),  .lf-template .briefs > :nth-child(6) { animation-delay: 200ms; }
    .lf-template .grid > :nth-child(n+7), .lf-template .bento > :nth-child(n+7), .lf-template .items > :nth-child(n+7), .lf-template .stack > :nth-child(n+7), .lf-template .briefs > :nth-child(n+7) { animation-delay: 240ms; }
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
  const ACCENT_COLORS = ['#2563eb','#f97316','#10b981','#8b5cf6','#ef4444','#06b6d4','#eab308','#6366f1','#ec4899','#14b8a6'];
  function srcAccent(label) {
    let h = 0;
    for (let i = 0; i < label.length; i++) h = Math.imul(h * 31 + label.charCodeAt(i), 1) | 0;
    return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
  }
  function srcInitials(label) {
    return (label || 'S').split(/[\s._/-]+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }

  const css = `
  :root { --accent: #22d3ee; --accent-contrast: #04222b; }
  body { background-color: #0b0e14; color: #e7edf3; font-family: "Inter", system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(231,237,243,0.1); }
  .site-head { display: flex; justify-content: space-between; gap: 20px; align-items: end; }
  .site h1 { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: #fff; }
  .site .tagline { color: #8a97a6; font-size: 15px; margin-top: 8px; }
  .site-stat { flex: 0 0 auto; padding: 12px 16px; border-radius: var(--lf-radius-md); background: #121722; border: 1px solid rgba(231,237,243,0.1); }
  .site-stat strong { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 24px; line-height: 1; font-weight: 700; color: var(--accent); }
  .site-stat span { display: block; margin-top: 4px; color: #8a97a6; font-size: 11px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; }
  .source-block { padding: 24px; border-radius: var(--lf-radius-xl); background: #121722; border: 1px solid rgba(231,237,243,0.1); box-shadow: none; }
  .source-hdr { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid rgba(231,237,243,0.08); }
  .source-hdr__main { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .src-avatar { width: 36px; height: 36px; border-radius: var(--lf-radius-full); display: flex; align-items: center; justify-content: center; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
  .src-info { min-width: 0; }
  .src-name { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #fff; line-height: 1.2; }
  .src-count { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #8a97a6; margin-top: 2px; }
  .src-health { display: grid; gap: 4px; min-width: 150px; }
  .src-health__label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); font-weight: 600; text-align: right; }
  .src-health__bar { height: 4px; border-radius: 999px; background: rgba(34, 211, 238, 0.14); overflow: hidden; }
  .src-health__bar > span { display: block; height: 100%; background: var(--accent); }

  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px 16px; }
  .card { display: block; min-width: 0; border-radius: var(--lf-radius-md); }
  .card .thumb-box { aspect-ratio: 16/9; overflow: hidden; background: #1a212e; border-radius: var(--lf-radius-md); border: 1px solid rgba(231,237,243,0.1); margin-bottom: 12px; position: relative; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb-badge { position: absolute; bottom: 8px; right: 8px; background: rgba(4,8,14,0.85); color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; text-transform: uppercase; }
  .card h3 { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; line-height: 1.4; margin: 0; color: #f1f5f9; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color var(--dur-base) var(--ease-out); }
  .card .card-meta { margin-top: 6px; font-family: 'IBM Plex Mono', monospace; color: #8a97a6; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card:hover h3, .card:focus-visible h3 { color: var(--accent); }
  .card:hover .thumb-box, .card:focus-visible .thumb-box { border-color: var(--accent); }

  .empty { margin-top: 34px; border: 1.5px dashed rgba(231,237,243,0.16); border-radius: var(--lf-radius-lg); padding: 32px; color: #8a97a6; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(18,23,34,0.5); }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #121722;
    --tab-text: #e7edf3;
    --tab-border: rgba(231,237,243,0.14);
    --tab-border-hover: #22d3ee;
    --tab-bg-hover: #171d29;
    --tab-active-bg: #22d3ee;
    --tab-active-border: #22d3ee;
    --tab-active-text: #04222b;
    --tab-meta: #8a97a6;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #04222b; opacity: 0.85; }

  ${MORE_LINKS_CSS_DARK}
  .more-links { border-top-color: rgba(231,237,243,0.1); margin-top: 48px; }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #fff; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: var(--accent); border-bottom-color: rgba(231,237,243,0.14); }
  .more-links__list li { border-bottom-color: rgba(231,237,243,0.08); }
  .more-links__list a { color: #e7edf3; font-weight: 500; }
  .more-links__list a:hover { color: var(--accent); }
  .more-links__domain { color: #8a97a6; }

  @media (max-width: 1220px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px)  { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 700px)  {
    .tab-nav { display: flex; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); }
    .tab-nav::-webkit-scrollbar { display: none; }
    .tab-nav .tab-btn { flex: 0 0 auto; width: auto; min-width: 170px; }
  }
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
        <div class="thumb-box">${thumbImg(i)}<span class="thumb-badge">${esc(badge)}</span></div>
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
  :root { --accent: #ff4d6d; }
  body { background-color: #000; color: #f5f5f7; font-family: "Inter", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .site-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: end; }
  .site h1 { font-family: 'Space Grotesk', sans-serif; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: #fff; }
  .site .tagline { font-size: 15px; color: #a1a1aa; margin-top: 8px; max-width: 62ch; }
  .site-stats { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .site-pill { padding: 12px 16px; border-radius: var(--lf-radius-md); border: 1px solid rgba(255,255,255,0.14); background: #0d0d0f; min-width: 120px; }
  .site-pill strong { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 22px; line-height: 1; font-weight: 700; color: var(--accent); }
  .site-pill span { display: block; color: #a1a1aa; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; margin-top: 4px; }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #0d0d0f;
    --tab-text: #a1a1aa;
    --tab-border: rgba(255,255,255,0.14);
    --tab-border-hover: var(--accent);
    --tab-bg-hover: #17171a;
    --tab-active-bg: #fff;
    --tab-active-border: #fff;
    --tab-active-text: #000;
    --tab-meta: #a1a1aa;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #000; opacity: 0.75; }

  /* Grid inside each panel */
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
  .tab-stage { padding: 24px; border-radius: var(--lf-radius-xl); background: #0d0d0f; border: 1px solid rgba(255,255,255,0.1); box-shadow: none; }
  .tab-stage__head { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 20px; }
  .tab-stage__title { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; color: #fff; }
  .tab-stage__meta { color: #a1a1aa; font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
  .tab-stage__health { display: grid; gap: 4px; min-width: 170px; }
  .tab-stage__health-label { color: var(--accent); font-family: 'IBM Plex Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }
  .tab-stage__health-bar { height: 4px; border-radius: 999px; background: rgba(255, 77, 109, 0.16); overflow: hidden; }
  .tab-stage__health-bar > span { display: block; height: 100%; background: var(--accent); }
  .tile { display: block; border-radius: var(--lf-radius-md); }
  .tile .thumb-box { position: relative; aspect-ratio: 3/4; border-radius: var(--lf-radius-md); overflow: hidden; background: #0d0d0f; margin-bottom: 0; border: 1px solid rgba(255,255,255,0.1); }
  .tile .thumb-box::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.85) 100%); pointer-events: none; }
  .tile .thumb-kind { position: absolute; left: 10px; top: 10px; z-index: 2; padding: 3px 7px; border-radius: 999px; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.16); color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tile h4 { position: relative; z-index: 2; margin: -52px 12px 0; padding-bottom: 12px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; color: #fff; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; transition: color var(--dur-base) var(--ease-out); }
  .tile .tile-meta { position: relative; z-index: 2; margin: 0 12px 10px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #c7c7cc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile:hover h4, .tile:focus-visible h4 { color: var(--accent); }
  .tile:hover .thumb-box, .tile:focus-visible .thumb-box { border-color: var(--accent); }

  .empty { border: 1.5px dashed rgba(255,255,255,0.16); border-radius: var(--lf-radius-lg); padding: 32px; color: #a1a1aa; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: rgba(13,13,15,0.6); }

  ${MORE_LINKS_CSS_DARK}
  .more-links { margin-top: 48px; border-top-color: rgba(255,255,255,0.12); }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #fff; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: var(--accent); border-bottom-color: rgba(255,255,255,0.14); }
  .more-links__list li { border-bottom-color: rgba(255,255,255,0.08); }
  .more-links__list a { color: #f5f5f7; font-weight: 500; }
  .more-links__list a:hover { color: var(--accent); }
  .more-links__domain { color: #a1a1aa; }

  @media (max-width: 1200px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 700px) {
    .wrap { padding: 32px 16px 64px; }
    .site-head { grid-template-columns: 1fr; gap: 16px; }
    .site h1 { font-size: 28px; }
    .site-stats { justify-content: flex-start; }
    .tab-stage { padding: 16px; border-radius: var(--lf-radius-lg); }
    .tab-stage__head { flex-direction: column; align-items: flex-start; gap: 10px; }
    .tab-stage__health { width: 100%; }
    .tab-stage__health-label { text-align: left; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .tile h4 { font-size: 13px; }
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
  :root { --accent: #d11f2d; }
  body { background-color: #fbfbfa; color: #111; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #111; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: end; }
  .site h1 { font-family: 'Space Grotesk', sans-serif; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: #111; }
  .site .tagline { color: #666; font-size: 15px; margin-top: 8px; max-width: 58ch; }
  .site-chip { padding: 10px 16px; border: 1px solid #111; min-width: 120px; }
  .site-chip strong { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 22px; line-height: 1; font-weight: 700; color: var(--accent); }
  .site-chip span { display: block; margin-top: 4px; color: #666; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; }
  .lf-template .source,
  .lf-template .source:hover { padding: 0; border-radius: 0; background: transparent; border: 0; box-shadow: none; }
  .source-hdr { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 12px; margin-bottom: 20px; border-bottom: 1px solid #111; }
  .source-hdr__main { display: flex; align-items: baseline; gap: 12px; min-width: 0; flex-wrap: wrap; }
  .src-pill { color: var(--accent); font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
  .src-name { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #111; }
  .src-count { color: #888; font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
  .src-health { display: grid; gap: 4px; min-width: 170px; }
  .src-health__label { color: var(--accent); font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; text-align: right; }
  .src-health__bar { height: 3px; background: #e5e5e5; overflow: hidden; }
  .src-health__bar > span { display: block; height: 100%; background: var(--accent); }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid #e5e5e5; border-left: 1px solid #e5e5e5; }
  .tile { display: block; background: #fbfbfa; border-right: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; }
  .lf-template .thumb-box,
  .lf-template .thumb-box img { border-radius: 0; }
  .tile .thumb-box { position: relative; aspect-ratio: 1; overflow: hidden; background: #eee; }
  .tile .thumb-kind { position: absolute; left: 8px; top: 8px; padding: 3px 6px; background: rgba(17,17,17,0.85); color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .tile h3 { padding: 12px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; line-height: 1.4; color: #111; margin: 0; border-top: 1px solid transparent; transition: color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out); }
  .tile:hover h3, .tile:focus-visible h3 { color: var(--accent); border-top-color: var(--accent); }
  .empty { padding: 32px; border: 1px dashed #ccc; color: #666; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: #fff; }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #fff;
    --tab-text: #111;
    --tab-border: #d4d4d4;
    --tab-border-hover: var(--accent);
    --tab-bg-hover: #fafafa;
    --tab-active-bg: #111;
    --tab-active-border: #111;
    --tab-active-text: #fff;
    --tab-meta: #888;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #888; opacity: 0.9; }

  ${MORE_LINKS_CSS_LIGHT}
  .more-links { border-top-color: #111; margin-top: 48px; }
  .more-links__heading { font-family: 'Space Grotesk', sans-serif; color: #111; }
  .more-links__src { font-family: 'Space Grotesk', sans-serif; color: var(--accent); border-bottom-color: #d4d4d4; }
  .more-links__list li { border-bottom-color: #eee; }
  .more-links__list a { color: #111; font-weight: 500; }
  .more-links__list a:hover { color: var(--accent); }
  .more-links__domain { color: #888; }

  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 700px) {
    .site-head { grid-template-columns: 1fr; gap: 16px; }
    .source-hdr { flex-direction: column; align-items: flex-start; gap: 10px; }
    .src-health { width: 100%; }
    .src-health__label { text-align: left; }
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }`;

  const sections = renderSourceTabs(tabGroups, (group, index) => {
    const coverage = previewCoverage(group);
    const tiles = group.previewItems.map((i) => `<a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <h3>${esc(i.title)}</h3>
    </a>`).join('');
    return `<section class="source">
      <div class="source-hdr">
        <div class="source-hdr__main">
          <span class="src-pill">${String(index + 1).padStart(2, '0')}</span>
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
  :root { --accent: #ff5a3c; --accent-contrast: #2a0800; }
  body { background-color: #f4f1ec; color: #14110c; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1240px; margin: 0 auto; padding: 48px 24px 96px; }
  header.site { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(20,17,12,0.12); }
  .eyebrow { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; padding: 5px 12px; border-radius: var(--lf-radius-full); background: var(--accent); color: #fff; font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1.2fr) 280px; gap: 32px; align-items: end; }
  .site h1 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 52px; line-height: 1.02; letter-spacing: -0.035em; font-weight: 700; color: #14110c; }
  .site .tagline { margin-top: 14px; max-width: 58ch; color: #5c5648; font-size: 16px; line-height: 1.55; }
  .site-note { padding: 20px; border-radius: var(--lf-radius-md); background: #fff; border: 1px solid rgba(20,17,12,0.12); }
  .site-note .label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  .site-note strong { display: block; margin-top: 8px; font-family: 'Space Grotesk', sans-serif; font-size: 28px; line-height: 1.1; font-weight: 700; color: #14110c; }
  .site-note span { display: block; margin-top: 6px; color: #5c5648; font-size: 12px; font-family: 'IBM Plex Mono', monospace; }

  .source { padding: 24px; border-radius: var(--lf-radius-xl); background: #fff; border: 1px solid rgba(20,17,12,0.1); box-shadow: var(--shadow-rest); }
  .source-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
  .source-name { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: #14110c; }
  .source-count { font-size: 11px; color: #8a8272; font-family: 'IBM Plex Mono', monospace; }
  .source-health { display: grid; gap: 4px; min-width: 170px; }
  .source-health__label { color: var(--accent); font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; text-align: right; }
  .source-health__bar { height: 4px; border-radius: 999px; background: rgba(255, 90, 60, 0.14); overflow: hidden; }
  .source-health__bar > span { display: block; height: 100%; background: var(--accent); }

  .bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; }
  .tile { display: flex; flex-direction: column; min-width: 0; border-radius: var(--lf-radius-lg); overflow: hidden; background: #fff; border: 1px solid rgba(20,17,12,0.1); box-shadow: var(--shadow-rest); }
  .tile:hover, .tile:focus-visible { transform: translateY(-2px); box-shadow: var(--shadow-lift); border-color: var(--accent); }
  .tile--lead { grid-column: span 7; min-height: 400px; }
  .tile--lead .media-frame { aspect-ratio: 16/10; }
  .tile--lead .body { padding: 22px; }
  .tile--lead h3 { font-family: 'Space Grotesk', sans-serif; font-size: 26px; line-height: 1.12; font-weight: 700; margin: 0 0 10px; letter-spacing: -0.01em; color: #14110c; transition: color var(--dur-base) var(--ease-out); }
  .tile--lead:hover h3 { color: var(--accent); }
  .tile--lead .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8a8272; }

  .tile--stack { grid-column: span 5; padding: 20px; justify-content: space-between; }
  .tile--stack .media-frame { aspect-ratio: 16/9; margin-bottom: 14px; }
  .tile--stack h3 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 19px; line-height: 1.25; font-weight: 700; color: #14110c; transition: color var(--dur-base) var(--ease-out); }
  .tile--stack:hover h3 { color: var(--accent); }
  .tile--stack .meta { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8a8272; }

  .tile--mini { grid-column: span 4; padding: 16px; }
  .tile--mini .media-frame { aspect-ratio: 4/3; margin-bottom: 12px; }
  .tile--mini h3 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.35; font-weight: 700; color: #14110c; transition: color var(--dur-base) var(--ease-out); }
  .tile--mini:hover h3 { color: var(--accent); }
  .tile--mini .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; color: #8a8272; }

  .media-frame { position: relative; border-radius: var(--lf-radius-md); overflow: hidden; background: #efe9df; border: 1px solid rgba(20,17,12,0.08); }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; }
  .media-frame__badge { position: absolute; left: 10px; top: 10px; padding: 3px 8px; border-radius: 4px; background: #14110c; color: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 8px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 10px; bottom: 10px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: #fff; }
  .media-frame__play svg { width: 14px; height: 14px; margin-left: 2px; }
  .pill { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 4px; background: #f4f1ec; color: #5c5648; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 600; text-transform: uppercase; }

  .smart-links { margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(20,17,12,0.12); }
  .smart-links__header { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 20px; }
  .smart-links__heading { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #14110c; }
  .smart-links__desc { margin: 0; color: #8a8272; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
  .smart-links__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .smart-links__group { padding: 18px; border-radius: var(--lf-radius-lg); background: #fff; border: 1px solid rgba(20,17,12,0.1); }
  .smart-links__src { margin-bottom: 12px; font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); }
  .smart-links__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .smart-links__list a { display: flex; justify-content: space-between; gap: 12px; align-items: start; color: #14110c; }
  .smart-links__title { flex: 1; min-width: 0; font-size: 14px; line-height: 1.4; transition: color var(--dur-base) var(--ease-out); }
  .smart-links__list a:hover .smart-links__title { color: var(--accent); }
  .smart-links__meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .smart-links__type, .smart-links__domain { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #8a8272; }
  .empty { padding: 32px; border-radius: var(--lf-radius-lg); border: 1.5px dashed rgba(20,17,12,0.18); color: #5c5648; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-align: center; background: #fff; }

  ${SOURCE_TABS_CSS}
  .tab-shell {
    --tab-bg: #fff;
    --tab-text: #14110c;
    --tab-border: rgba(20,17,12,0.14);
    --tab-border-hover: var(--accent);
    --tab-bg-hover: #fbfaf7;
    --tab-active-bg: #14110c;
    --tab-active-border: #14110c;
    --tab-active-text: #fff;
    --tab-meta: #8a8272;
  }
  .tab-shell .tab-btn.active .tab-btn__meta { color: #8a8272; opacity: 0.9; }

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
  .stack { columns: 2; column-gap: 16px; }
  .story { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 16px; padding: 16px 0; border: 0; border-bottom: 1px solid #1c3d69; border-radius: 0; break-inside: avoid; background: transparent; }
  .story:hover, .story:focus-visible { background: #0d203d; }
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
    .stack { columns: 1; }
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

// Anything the scraper captured as an <iframe> embed (TikTok, Instagram,
// Twitch, Wistia, and other allowlisted hosts in parser.js — not just the
// named providers in tvEmbedFor) gets played in a generic iframe instead of
// leaving the item as a plain link.
function genericEmbedSrc(item) {
  if (!item || extractVideoSrc(item)) return null;
  const src = item.video && typeof item.video === 'object' ? item.video.src || item.video.url : null;
  return src || null;
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
      const namedEmb = vsrc ? null : tvEmbedFor(it.href);
      const embSrc = namedEmb ? namedEmb.src : (vsrc ? null : genericEmbedSrc(it));
      const thumb = it.thumbnail || (it.video && it.video.poster) || null;
      const clean = {
        href: it.href,
        title: it.title || it.href,
        thumb: thumb || null,
        video: vsrc || null,
        embed: embSrc || null,
        domain: it.domain || '',
        kind: itemKind(it),
      };
      if (!vsrc && !thumb && !embSrc) {
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
  /* Static layered aurora — replaces the old perpetually-rotating 80vmax
     blur(120px) blob, which forced continuous compositing of a huge layer. */
  body::before {
    content: "";
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(52vmax 42vmax at 88% -12%, rgba(249,112,102,0.17), transparent 62%),
      radial-gradient(48vmax 40vmax at -14% 22%, rgba(56,189,248,0.10), transparent 65%),
      radial-gradient(42vmax 38vmax at 62% 118%, rgba(251,146,60,0.11), transparent 60%);
  }
  body::after {
    content: "";
    position: fixed; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 3px 3px;
    opacity: 0.28;
    z-index: 0; pointer-events: none;
  }

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

  /* TICKER — a literal marquee strip of sources (transform-only, cheap) */
  .mq-ticker {
    overflow: hidden; margin: 0 0 clamp(36px, 5vw, 64px);
    border-top: 1px solid var(--mq-border); border-bottom: 1px solid var(--mq-border);
    padding: 12px 0;
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }
  .mq-ticker__track { display: flex; width: max-content; will-change: transform; animation: mq-ticker var(--mq-ticker-dur, 36s) linear infinite; }
  .mq-ticker:hover .mq-ticker__track { animation-play-state: paused; }
  .mq-ticker__half { display: inline-flex; align-items: baseline; gap: 40px; padding-right: 40px; white-space: nowrap; }
  .mq-ticker__item { font-family: var(--mq-mono); font-size: 11.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--mq-muted); }
  .mq-ticker__item b { color: var(--mq-accent); font-weight: 600; margin-left: 8px; }
  .mq-ticker__sep { color: var(--mq-faint); font-size: 11px; }
  @keyframes mq-ticker { to { transform: translateX(-50%); } }

  /* Scroll reveal (transform/opacity only; neutralized for reduced motion) */
  .mq-reveal { opacity: 0; transform: translateY(18px); transition: opacity .6s var(--ease-out) var(--mq-d, 0ms), transform .6s var(--ease-out) var(--mq-d, 0ms); }
  .mq-reveal.is-in { opacity: 1; transform: none; }

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
  .mq-card { content-visibility: auto; contain-intrinsic-size: 420px 380px; }
  .mq-tile {
    position: relative; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden;
    background: #0d0d10; isolation: isolate;
  }
  /* shine sweep on hover — GPU transform only */
  .mq-tile::before {
    content: ""; position: absolute; inset: 0; z-index: 6; pointer-events: none;
    background: linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.09) 50%, transparent 58%);
    transform: translateX(-130%);
  }
  .mq-card:hover .mq-tile::before { transition: transform .8s var(--ease-out); transform: translateX(130%); }
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
  .mq-tile__toggle {
    position: absolute; bottom: 12px; left: 12px; z-index: 6;
    width: 34px; height: 34px; min-width: 44px; min-height: 44px;
    margin: -5px; display: grid; place-items: center;
    border-radius: 999px; border: 1px solid var(--mq-border);
    background: rgba(8,8,11,0.72); backdrop-filter: blur(10px);
    color: var(--mq-text); cursor: pointer; opacity: 0;
    transition: opacity var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out);
  }
  .mq-tile__toggle svg { width: 14px; height: 14px; }
  .mq-tile__toggle .mq-icon-pause { display: none; }
  .mq-tile.is-playing .mq-tile__toggle .mq-icon-play { display: none; }
  .mq-tile.is-playing .mq-tile__toggle .mq-icon-pause { display: block; }
  .mq-card:hover .mq-tile__toggle,
  .mq-card:focus-within .mq-tile__toggle,
  .mq-tile__toggle:focus-visible {
    opacity: 1;
  }
  .mq-tile__toggle:hover { background: rgba(8,8,11,0.92); }
  @media (hover: none) {
    .mq-tile__toggle { opacity: 1; }
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
    content-visibility: auto; contain-intrinsic-size: 320px 300px;
    transition: transform .3s ease, border-color .3s ease, background .3s ease, box-shadow .3s ease;
  }
  .mq-item:hover {
    transform: translateY(-4px);
    background: var(--mq-surface-hi);
    border-color: var(--mq-border-hi);
    box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6);
  }
  .mq-item--playable:hover { border-color: rgba(249,112,102,0.45); box-shadow: 0 20px 44px -18px rgba(249,112,102,0.3), 0 20px 40px -20px rgba(0,0,0,0.6); }
  .mq-item__thumb { position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; background: #0d0d10; }
  .mq-item__thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
  .mq-item:hover .mq-item__thumb img { transform: scale(1.04); }
  .mq-item__thumb::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.5) 100%);
  }
  .mq-item__play {
    position: absolute; right: 10px; bottom: 10px; z-index: 2;
    display: inline-flex; align-items: center; gap: 7px;
    height: 30px; padding: 0 12px 0 9px; border-radius: 999px;
    background: var(--mq-accent); color: #fff;
    font-family: var(--mq-mono); font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
    box-shadow: 0 6px 18px -6px rgba(249,112,102,0.65);
    transition: transform .25s var(--ease-out);
  }
  .mq-item:hover .mq-item__play { transform: scale(1.06); }
  .mq-item__play svg { width: 12px; height: 12px; }
  .mq-item__ext {
    position: absolute; right: 10px; bottom: 10px; z-index: 2;
    width: 30px; height: 30px; border-radius: 999px;
    display: grid; place-items: center;
    background: rgba(8,8,11,0.72); border: 1px solid var(--mq-border);
    color: var(--mq-muted);
  }
  .mq-item__ext svg { width: 12px; height: 12px; }

  /* LIGHTBOX — in-page player (native <video> or provider embed) */
  .mq-lightbox { position: fixed; inset: 0; z-index: 100; display: none; align-items: center; justify-content: center; padding: clamp(14px, 4vw, 48px); }
  .mq-lightbox.is-open { display: flex; }
  .mq-lightbox__backdrop { position: absolute; inset: 0; background: rgba(5,5,9,0.84); backdrop-filter: blur(16px) saturate(1.2); -webkit-backdrop-filter: blur(16px) saturate(1.2); }
  .mq-lightbox__panel {
    position: relative; z-index: 1; width: min(1080px, 100%); margin: 0;
    border-radius: 20px; overflow: hidden; background: #000;
    border: 1px solid var(--mq-border-hi);
    box-shadow: 0 50px 140px -30px rgba(0,0,0,0.85), 0 0 80px -40px rgba(249,112,102,0.5);
    animation: mq-pop .35s var(--ease-out);
  }
  @keyframes mq-pop { from { transform: translateY(18px) scale(.985); opacity: 0; } }
  .mq-lightbox__stage { aspect-ratio: 16 / 9; background: #000; }
  .mq-lightbox__stage video, .mq-lightbox__stage iframe { width: 100%; height: 100%; display: block; border: 0; background: #000; }
  .mq-lightbox__err { height: 100%; display: grid; place-content: center; gap: 10px; text-align: center; color: var(--mq-muted); font-size: 15px; padding: 24px; }
  .mq-lightbox__err a { color: var(--mq-accent); text-decoration: underline; }
  .mq-lightbox__bar {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 16px; background: rgba(12,12,16,0.96); border-top: 1px solid var(--mq-border);
  }
  .mq-lightbox__info { min-width: 0; display: grid; gap: 2px; }
  .mq-lightbox__title { font-family: var(--mq-serif); font-size: 16px; letter-spacing: -0.01em; color: var(--mq-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mq-lightbox__domain { font-family: var(--mq-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--mq-faint); }
  .mq-lightbox__actions { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
  .mq-lightbox__ext, .mq-lightbox__close {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 13px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--mq-border); background: var(--mq-surface);
    color: var(--mq-muted); font-family: var(--mq-mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
    transition: color .25s, border-color .25s, background .25s;
  }
  .mq-lightbox__ext:hover, .mq-lightbox__close:hover { color: var(--mq-text); border-color: var(--mq-border-hi); background: var(--mq-surface-hi); }
  @media (max-width: 640px) {
    .mq-lightbox__bar { flex-direction: column; align-items: stretch; }
    .mq-lightbox__actions { justify-content: flex-end; }
  }
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
  ::view-transition-old(root), ::view-transition-new(root) { animation-duration: .28s; }
  @media (prefers-reduced-motion: reduce) {
    .mq-tile__slides img, .mq-tile__video, .mq-tile__poster { transition: none; }
    .mq-reveal { opacity: 1; transform: none; transition: none; }
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
      tile.__togglePause = function(){
        if (tile.classList.contains('is-playing')) {
          if (timer) { clearTimeout(timer); timer = null; }
          try { video.pause(); } catch(e){}
          tile.classList.remove('is-playing');
        } else {
          tile.classList.add('is-playing');
          playAt(idx);
        }
      };
    } else if (images.length > 1) {
      var slides = tile.querySelectorAll('.mq-tile__slides img');
      if (slides.length < 2) return;
      // Preload only the upcoming slide (eagerly fetching the whole set
      // front-loaded dozens of image requests per tile).
      var slot = 0;
      var i = 0;
      slides[0].src = images[0]; slides[0].classList.add('is-visible');
      var warm = new Image(); warm.src = images[1];
      var interval = null;
      function tick() {
        i = (i + 1) % images.length;
        slot = 1 - slot;
        var incoming = slides[slot];
        var outgoing = slides[1 - slot];
        incoming.src = images[i];
        incoming.classList.add('is-visible');
        outgoing.classList.remove('is-visible');
        warm.src = images[(i + 1) % images.length];
      }
      function startSlideshow() { tile.classList.add('is-playing'); interval = setInterval(tick, SLIDESHOW_STEP_MS); }
      function stopSlideshow() { tile.classList.remove('is-playing'); if (interval) { clearInterval(interval); interval = null; } }
      startSlideshow();
      tile.__cleanup = stopSlideshow;
      tile.__togglePause = function(){
        if (interval) stopSlideshow(); else startSlideshow();
      };
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
  var revealObserver = null;
  function setupObserver(root) {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) activateTile(entry.target);
        else deactivateTile(entry.target);
      });
    }, { rootMargin: '10% 0px', threshold: 0.35 });
    root.querySelectorAll('.mq-tile[data-videos]').forEach(function(t){ observer.observe(t); });
    root.querySelectorAll('.mq-tile__toggle').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var tile = btn.closest('.mq-tile');
        if (tile && tile.__togglePause) tile.__togglePause();
        var playing = tile && tile.classList.contains('is-playing');
        btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
        btn.setAttribute('aria-label', playing ? 'Pause preview' : 'Play preview');
      });
    });
    // Scroll reveal: fade cards in as they enter, with a slight stagger.
    if (revealObserver) revealObserver.disconnect();
    var revealEls = root.querySelectorAll('.mq-reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function(el){ el.classList.add('is-in'); });
    } else {
      revealObserver = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
      revealEls.forEach(function(el){ revealObserver.observe(el); });
    }
  }

  // ---- Lightbox: play videos on the page instead of navigating away ----
  var lb = document.createElement('div');
  lb.className = 'mq-lightbox';
  lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML =
    '<div class="mq-lightbox__backdrop"></div>' +
    '<figure class="mq-lightbox__panel" role="dialog" aria-modal="true" aria-label="Video player">' +
      '<div class="mq-lightbox__stage"></div>' +
      '<figcaption class="mq-lightbox__bar">' +
        '<div class="mq-lightbox__info">' +
          '<span class="mq-lightbox__title"></span>' +
          '<span class="mq-lightbox__domain"></span>' +
        '</div>' +
        '<div class="mq-lightbox__actions">' +
          '<a class="mq-lightbox__ext" target="_blank" rel="noopener">Open original ↗</a>' +
          '<button type="button" class="mq-lightbox__close">Close · Esc</button>' +
        '</div>' +
      '</figcaption>' +
    '</figure>';
  document.body.appendChild(lb);
  var lbStage = lb.querySelector('.mq-lightbox__stage');
  var lbOpener = null;
  var pausedTiles = [];

  function pauseTiles() {
    document.querySelectorAll('.mq-tile.is-playing').forEach(function(t){
      if (t.__togglePause) { t.__togglePause(); pausedTiles.push(t); }
    });
  }
  function resumeTiles() {
    pausedTiles.forEach(function(t){
      if (t.__togglePause && !t.classList.contains('is-playing') && document.contains(t)) t.__togglePause();
    });
    pausedTiles = [];
  }
  function openLightbox(item, opener) {
    lbOpener = opener || null;
    pauseTiles();
    lbStage.innerHTML = '';
    if (item.video) {
      var v = document.createElement('video');
      v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'metadata';
      if (item.thumb) v.poster = item.thumb;
      v.src = item.video;
      v.addEventListener('error', function(){
        lbStage.innerHTML = '<div class="mq-lightbox__err"><span>This video couldn\\u2019t be played here.</span>' +
          '<a href="' + attr(item.href) + '" target="_blank" rel="noopener">Open the original instead \\u2197</a></div>';
      });
      lbStage.appendChild(v);
      var p = v.play(); if (p && p.catch) p.catch(function(){});
    } else if (item.embed) {
      var f = document.createElement('iframe');
      f.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
      f.setAttribute('allowfullscreen', '');
      f.src = item.embed;
      lbStage.appendChild(f);
    } else {
      return;
    }
    lb.querySelector('.mq-lightbox__title').textContent = item.title || '';
    lb.querySelector('.mq-lightbox__domain').textContent = item.domain || '';
    lb.querySelector('.mq-lightbox__ext').href = item.href;
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lb.querySelector('.mq-lightbox__close').focus();
  }
  function closeLightbox() {
    if (!lb.classList.contains('is-open')) return;
    var v = lbStage.querySelector('video');
    if (v) { try { v.pause(); } catch(e){} }
    lbStage.innerHTML = '';
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    resumeTiles();
    if (lbOpener && lbOpener.focus) { try { lbOpener.focus(); } catch(e){} }
    lbOpener = null;
  }
  lb.querySelector('.mq-lightbox__backdrop').addEventListener('click', closeLightbox);
  lb.querySelector('.mq-lightbox__close').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeLightbox(); });
  document.addEventListener('click', function(e){
    var el = e.target.closest ? e.target.closest('.mq-item--playable') : null;
    if (!el) return;
    var s = findSource(el.getAttribute('data-src'));
    var item = s && s.items && s.items[+el.getAttribute('data-i')];
    if (!item || (!item.video && !item.embed)) return;
    e.preventDefault();
    openLightbox(item, el);
  });

  // ---- Views ----
  function heroTitleHtml(t) {
    // Italic serif accent on the last word (skip one-word titles).
    var words = String(t || '').trim().split(/\\s+/);
    if (words.length < 2) return esc(t);
    var last = words.pop();
    return esc(words.join(' ')) + ' <em>' + esc(last) + '</em>';
  }

  function playableCount() {
    return data.sources.reduce(function(a, s){
      return a + (s.items || []).filter(function(it){ return it.video || it.embed; }).length;
    }, 0);
  }

  function tickerHtml() {
    if (!data.sources.length) return '';
    var seq = data.sources.map(function(s){
      return '<span class="mq-ticker__item">' + esc(s.name) + '<b>' + s.count + '</b></span>';
    }).join('<span class="mq-ticker__sep">\\u2726</span>');
    // Repeat until each half is comfortably wider than any viewport, then
    // duplicate the half — translateX(-50%) loops seamlessly.
    var reps = Math.max(1, Math.ceil(10 / data.sources.length));
    var parts = [];
    for (var i = 0; i < reps; i++) parts.push(seq);
    var half = '<span class="mq-ticker__half">' + parts.join('<span class="mq-ticker__sep">\\u2726</span>') + '</span>';
    var dur = Math.min(90, Math.max(24, reps * data.sources.length * 6));
    return '<div class="mq-ticker" aria-hidden="true"><div class="mq-ticker__track" style="--mq-ticker-dur:' + dur + 's">' + half + half + '</div></div>';
  }

  function renderHome() {
    if (crumbsEl) crumbsEl.innerHTML = '<span>Home</span>';
    var playable = playableCount();
    var stats =
      '<div class="mq-hero__stats">' +
        '<span><strong>' + data.sources.length + '</strong>Sources</span>' +
        '<span><strong>' + data.sources.reduce(function(a,s){return a+s.count;},0) + '</strong>Items</span>' +
        (playable ? '<span><strong>' + playable + '</strong>Play in page</span>' : '') +
        (data.today ? '<span>' + esc(data.today) + '</span>' : '') +
      '</div>';
    var hero =
      '<header class="mq-hero">' +
        '<span class="mq-hero__kicker">Now Playing</span>' +
        '<h1 class="mq-hero__title">' + heroTitleHtml(data.title) + '</h1>' +
        (data.tagline ? '<p class="mq-hero__tag">' + esc(data.tagline) + '</p>' : '') +
        stats +
      '</header>';

    var cards = data.sources.map(function(s, sIdx){
      var videos = s.videos || [];
      var images = s.images || [];
      var tile =
        '<div class="mq-tile" data-videos="' + attr(JSON.stringify(videos)) + '" data-images="' + attr(JSON.stringify(images)) + '">' +
          (s.cover ? '<img class="mq-tile__poster" src="' + attr(s.cover) + '" alt="" loading="lazy"/>' : '') +
          '<div class="mq-tile__slides"><img alt="" loading="lazy"/><img alt="" loading="lazy"/></div>' +
          (videos.length ? '<video class="mq-tile__video" muted playsinline preload="metadata" ' + (s.cover ? 'poster="' + attr(s.cover) + '"' : '') + '></video>' : '') +
          '<div class="mq-tile__scrim"></div>' +
          '<span class="mq-tile__count">' + s.count + ' items</span>' +
          ((videos.length || images.length > 1) ? (
            '<button type="button" class="mq-tile__toggle" aria-label="Pause preview" aria-pressed="false">' +
              '<svg class="mq-icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' +
              '<svg class="mq-icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '</button>'
          ) : '') +
        '</div>';
      var playHere = (s.items || []).filter(function(it){ return it.video || it.embed; }).length;
      return '<a class="mq-card mq-reveal" style="--mq-d:' + ((sIdx % 6) * 45) + 'ms" href="#/s/' + attr(s.slug) + '">' +
        tile +
        '<div class="mq-card__meta">' +
          '<div class="mq-card__title">' + esc(s.name) + '</div>' +
          '<div class="mq-card__sub"><span>' + s.count + ' picks</span>' +
            (playHere ? '<span class="type">' + playHere + ' play in page</span>' : '') +
            '<span style="margin-left:auto">Explore \\u2192</span></div>' +
        '</div>' +
      '</a>';
    }).join('');
    var grid = data.sources.length
      ? '<section class="mq-grid">' + cards + '</section>'
      : '<div class="mq-empty">No sources to show.</div>';
    app.innerHTML = '<div class="mq-view">' + hero + tickerHtml() + grid + '</div>';
    window.scrollTo(0, 0);
    setupObserver(app);
  }

  function renderSource(slug) {
    var s = findSource(slug);
    if (!s) { location.hash = '#/'; return; }
    if (crumbsEl) crumbsEl.innerHTML = '<a href="#/">Home</a><span class="sep">/</span><span>' + esc(s.name) + '</span>';
    var items = (s.items || []).map(function(it, i){
      var playable = !!(it.video || it.embed);
      var thumbHtml = it.thumb
        ? '<img src="' + attr(it.thumb) + '" alt="" loading="lazy" decoding="async"/>'
        : '<div class="mq-item__no-thumb"><span>' + esc(it.domain || 'video') + '</span></div>';
      var badge = playable
        ? '<span class="mq-item__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play</span>'
        : (it.kind === 'video'
          ? '<span class="mq-item__ext" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8"/></svg></span>'
          : '');
      // Playable items open the in-page lightbox (click intercepted via the
      // .mq-item--playable delegate); everything else opens the page.
      return '<a class="mq-item mq-reveal' + (playable ? ' mq-item--playable' : '') + '" style="--mq-d:' + ((i % 8) * 40) + 'ms"' +
        ' href="' + attr(it.href) + '"' +
        (playable ? ' data-src="' + attr(s.slug) + '" data-i="' + i + '" aria-haspopup="dialog"' : ' target="_blank" rel="noopener"') + '>' +
        '<div class="mq-item__thumb">' +
          thumbHtml +
          badge +
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
            (function(){ var p = (s.items || []).filter(function(it){ return it.video || it.embed; }).length;
              return p ? '<span>' + p + ' play in page</span>' : ''; })() +
            (s.images.length ? '<span>' + s.images.length + ' images</span>' : '') +
          '</div>' +
        '</header>' +
        (items ? '<section class="mq-items">' + items + '</section>' : '<div class="mq-empty">No preview items in this source.</div>') +
        linkItemsHtml +
      '</div>';
    app.innerHTML = body;
    window.scrollTo(0, 0);
    setupObserver(app);
  }

  var routedOnce = false;
  function route(targetHash) {
    var h = targetHash || location.hash || '#/';
    var m = h.match(/^#\\/s\\/(.+)$/);
    closeLightbox();
    var render = m
      ? function(){ renderSource(decodeURIComponent(m[1])); }
      : renderHome;
    // Cross-fade between views where the browser supports it (but render the
    // very first view synchronously — nothing to transition from yet).
    if (routedOnce && document.startViewTransition && !reduceMotion) document.startViewTransition(render);
    else render();
    routedOnce = true;
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

// =====================================================
// 11) FIRE TV — lean-back TV app template
// Exported as the HTML payload of an Android/Fire TV WebView app
// (see apk-export.js). Everything is driven by the remote:
//   - D-pad arrows move a focus ring across shelf rows
//   - OK/center opens the item: direct MP4/WebM plays in a built-in
//     fullscreen player; anything else navigates the WebView to the link
//   - Back closes the player / returns focus home (the Android wrapper
//     calls window.lfBack() before falling back to WebView history)
//   - Play/Pause, Rewind and Fast-Forward media keys work in the player
// No external fonts or scripts: the page must work self-contained from
// file:///android_asset/ with only the linked media loading over the network.
// =====================================================
// Map a watch-page URL from a known video host to an embeddable player URL.
// These all speak a postMessage protocol, so the TV runtime can keep D-pad
// focus on our page and still drive play/pause/seek inside the iframe.
function tvEmbedFor(href) {
  const h = String(href || '');
  let m = h.match(/youtube\.com\/watch[^#]*[?&]v=([\w-]{6,20})/i)
    || h.match(/(?:youtube\.com\/(?:shorts|live|embed)\/|youtu\.be\/)([\w-]{6,20})/i);
  if (m) {
    return {
      provider: 'yt',
      src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&playsinline=1&enablejsapi=1&rel=0`,
    };
  }
  m = h.match(/(?:player\.)?vimeo\.com\/(?:video\/|channels\/[\w-]+\/)?(\d+)(?:\/([a-f0-9]+))?/i);
  if (m) {
    return {
      provider: 'vimeo',
      src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&api=1${m[2] ? `&h=${m[2]}` : ''}`,
    };
  }
  m = h.match(/dailymotion\.com\/video\/([a-z0-9]+)/i);
  if (m) {
    return { provider: 'dm', src: `https://www.dailymotion.com/embed/video/${m[1]}?autoplay=1` };
  }
  return null;
}

function buildFireTv(ctx) {
  // Broader shelf test than the web templates: anything playable in-app
  // (direct file or embeddable host) or with a video poster earns a media
  // card even when the item has no thumbnail.
  const tvPreview = (it) => hasPreview(it) || !!extractVideoSrc(it) || !!tvEmbedFor(it && it.href) || !!genericEmbedSrc(it) || !!(it && it.video && it.video.poster);
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups, tvPreview);

  const mediaCard = (item) => {
    const play = extractVideoSrc(item);
    const namedEmbed = play ? null : tvEmbedFor(item.href);
    const genEmbed = play || namedEmbed ? null : genericEmbedSrc(item);
    const embedSrc = namedEmbed ? namedEmbed.src : genEmbed;
    const embedProvider = namedEmbed ? namedEmbed.provider : (genEmbed ? 'generic' : null);
    const kind = itemKind(item);
    const poster = item.thumbnail || (item.video && item.video.poster) || '';
    const mark = (item.domain || item.title || 'L').charAt(0).toUpperCase();
    return `<div class="tv-card" data-tv-card role="button" tabindex="-1"
      data-href="${attr(item.href)}"${play ? ` data-play="${attr(play)}"${poster ? ` data-poster="${attr(poster)}"` : ''}` : ''}${embedSrc ? ` data-embed="${attr(embedSrc)}" data-provider="${attr(embedProvider)}"` : ''}
      data-title="${attr(item.title || item.href)}">
      <div class="tv-card__media">
        ${poster
          ? `<img src="${attr(poster)}" alt="" loading="lazy" onerror="this.remove()"/>`
          : `<span class="tv-card__mark">${esc(mark)}</span>`}
        ${kind === 'video' ? `<span class="tv-card__badge${play || embedSrc ? ' tv-card__badge--play' : ''}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>` : ''}
      </div>
      <div class="tv-card__label">
        <span class="tv-card__title">${esc(item.title || item.href)}</span>
        <span class="tv-card__meta">${esc(item.domain || '')}${play || embedSrc ? ' · plays in app' : ''}</span>
      </div>
    </div>`;
  };

  const linkCard = (item) => `<div class="tv-card tv-card--link" data-tv-card role="button" tabindex="-1"
      data-href="${attr(item.href)}" data-title="${attr(item.title || item.href)}">
      <span class="tv-card__link-title">${esc(item.title || item.href)}</span>
      <span class="tv-card__meta">${esc(item.domain || '')}</span>
    </div>`;

  const row = (label, meta, cardsHtml) => `<section class="tv-row" data-tv-row>
      <h2 class="tv-row__label">${esc(label)} <span class="tv-row__meta">${esc(meta)}</span></h2>
      <div class="tv-row__track">${cardsHtml}</div>
    </section>`;

  const mediaRows = previewGroups
    .map((g) => row(srcLabel(g), `${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}`, g.items.map(mediaCard).join('')))
    .join('');
  const linkRows = linkGroups
    .map((g) => row(`${srcLabel(g)} — links`, `${g.items.length} ${g.items.length === 1 ? 'link' : 'links'}`, g.items.map(linkCard).join('')))
    .join('');

  const playableCount = ctx.sourceGroups.reduce(
    (n, g) => n + (g.items || []).filter((it) => extractVideoSrc(it) || tvEmbedFor(it.href) || genericEmbedSrc(it)).length, 0);

  const css = `<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { font-size: clamp(14px, 1.55vw, 22px); }
    body {
      font-family: 'Segoe UI', Roboto, system-ui, -apple-system, sans-serif;
      background: #0a0c10; color: #e7e9ee;
      overflow-x: hidden;
      /* overscan-safe gutters for TV panels */
      padding: 2.5rem 3rem 5rem;
    }
    img { display: block; }
    .tv-head { margin-bottom: 2rem; }
    .tv-head__kicker {
      font-size: .62rem; letter-spacing: .28em; text-transform: uppercase;
      color: #fbbf24; margin-bottom: .5rem;
    }
    .tv-head__title { font-size: 2.1rem; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
    .tv-head__tagline { font-size: .85rem; color: #9aa1ad; margin-top: .55rem; max-width: 40em; }
    .tv-head__date { font-size: .68rem; color: #5c6470; margin-top: .8rem; letter-spacing: .08em; text-transform: uppercase; }
    .tv-row { margin-bottom: 2.2rem; }
    .tv-row__label { font-size: .95rem; font-weight: 600; margin-bottom: .8rem; letter-spacing: .01em; }
    .tv-row__meta { font-size: .62rem; font-weight: 500; color: #5c6470; letter-spacing: .12em; text-transform: uppercase; margin-left: .6em; }
    .tv-row__track {
      display: flex; gap: 1rem; overflow-x: auto; scrollbar-width: none;
      padding: .55rem .4rem .7rem; margin: -.55rem -.4rem -.7rem;
    }
    .tv-row__track::-webkit-scrollbar { display: none; }
    .tv-card {
      flex: 0 0 auto; width: 14.5rem; cursor: pointer;
      border-radius: .45rem; outline: none;
      transition: transform .18s ease;
    }
    .tv-card__media {
      position: relative; aspect-ratio: 16/9; border-radius: .45rem; overflow: hidden;
      background: #171b22; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 3px transparent; transition: box-shadow .18s ease;
    }
    .tv-card__media img { width: 100%; height: 100%; object-fit: cover; }
    .tv-card__mark { font-size: 2.4rem; font-weight: 700; color: #39404d; }
    .tv-card__badge {
      position: absolute; right: .5rem; bottom: .5rem; width: 1.6rem; height: 1.6rem;
      border-radius: 50%; background: rgba(10,12,16,.78); color: #e7e9ee;
      display: flex; align-items: center; justify-content: center;
    }
    .tv-card__badge--play { background: #fbbf24; color: #0a0c10; }
    .tv-card__badge svg { width: 60%; height: 60%; }
    .tv-card__label { padding: .55rem .15rem 0; }
    .tv-card__title {
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      font-size: .74rem; line-height: 1.35; color: #c9cdd6;
    }
    .tv-card__meta { display: block; font-size: .58rem; color: #5c6470; margin-top: .3rem; letter-spacing: .06em; text-transform: uppercase; }
    .tv-card--link {
      width: 17rem; background: #12151c; border-radius: .45rem; padding: .9rem 1rem;
      box-shadow: 0 0 0 3px transparent; transition: box-shadow .18s ease, transform .18s ease;
    }
    .tv-card--link .tv-card__link-title {
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
      font-size: .74rem; line-height: 1.4; color: #c9cdd6;
    }
    .tv-card.is-focused { transform: scale(1.06); }
    .tv-card.is-focused .tv-card__media, .tv-card--link.is-focused { box-shadow: 0 0 0 3px #fbbf24, 0 10px 30px rgba(0,0,0,.5); }
    .tv-card.is-focused .tv-card__title, .tv-card.is-focused .tv-card__link-title { color: #fff; }
    .tv-hints {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      display: flex; gap: 1.6rem; justify-content: center;
      padding: .55rem 1rem .7rem; font-size: .6rem; color: #8b92a0;
      background: linear-gradient(transparent, rgba(10,12,16,.92) 45%);
      letter-spacing: .05em; pointer-events: none;
    }
    .tv-hints b { color: #e7e9ee; font-weight: 600; }
    .tv-player {
      position: fixed; inset: 0; z-index: 100; background: #000;
      display: none; align-items: center; justify-content: center;
    }
    .tv-player.is-open { display: flex; }
    .tv-player video { width: 100%; height: 100%; object-fit: contain; background: #000; }
    .tv-player__embed { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
    .tv-player__osd {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 3rem 3rem 1.6rem;
      background: linear-gradient(transparent, rgba(0,0,0,.85));
      opacity: 0; transition: opacity .25s ease; pointer-events: none;
    }
    .tv-player__osd.is-visible { opacity: 1; }
    .tv-player__title { font-size: 1rem; font-weight: 600; margin-bottom: .8rem; }
    .tv-player__bar { height: .28rem; border-radius: .2rem; background: rgba(255,255,255,.25); overflow: hidden; }
    .tv-player__fill { height: 100%; width: 0%; background: #fbbf24; border-radius: .2rem; }
    .tv-player__foot { display: flex; justify-content: space-between; margin-top: .55rem; font-size: .62rem; color: #b9bfca; }
    .tv-player__state {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 4.2rem; height: 4.2rem; border-radius: 50%;
      background: rgba(10,12,16,.75); color: #fff;
      display: none; align-items: center; justify-content: center;
    }
    .tv-player__state.is-visible { display: flex; }
    .tv-player__state svg { width: 46%; height: 46%; }
  </style>`;

  const body = `
  <header class="tv-head">
    <div class="tv-head__kicker">Linkforge · TV Edition</div>
    <h1 class="tv-head__title">${esc(ctx.title)}</h1>
    ${ctx.tagline ? `<p class="tv-head__tagline">${esc(ctx.tagline)}</p>` : ''}
    <div class="tv-head__date">${esc(ctx.today || '')}${playableCount ? ` · ${playableCount} playable video${playableCount === 1 ? '' : 's'}` : ''}</div>
  </header>
  <main>
    ${mediaRows}
    ${linkRows}
  </main>
  <footer class="tv-hints" aria-hidden="true">
    <span><b>◀ ▲ ▼ ▶</b> browse</span>
    <span><b>OK</b> open / play</span>
    <span><b>⏪ ⏯ ⏩</b> in player</span>
    <span><b>Back</b> close / return</span>
  </footer>
  <div class="tv-player" id="tv-player" aria-hidden="true">
    <video id="tv-video" preload="metadata" playsinline></video>
    <div class="tv-player__osd" id="tv-osd">
      <div class="tv-player__title" id="tv-player-title"></div>
      <div class="tv-player__bar"><div class="tv-player__fill" id="tv-player-fill"></div></div>
      <div class="tv-player__foot">
        <span id="tv-player-time">0:00 / 0:00</span>
        <span>OK play/pause · ◀ ▶ ±10s · Back close</span>
      </div>
    </div>
    <div class="tv-player__state" id="tv-player-state">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
    </div>
  </div>`;

  const runtime = `<script>
(function () {
  'use strict';
  // ----- collect the grid -----
  var rows = [];
  var rowEls = document.querySelectorAll('[data-tv-row]');
  for (var i = 0; i < rowEls.length; i++) {
    var cards = rowEls[i].querySelectorAll('[data-tv-card]');
    if (cards.length) rows.push(Array.prototype.slice.call(cards));
  }
  var r = 0;                       // focused row
  var cols = rows.map(function () { return 0; }); // remembered column per row
  var mode = 'grid';               // 'grid' | 'player'

  var player = document.getElementById('tv-player');
  var video = document.getElementById('tv-video');
  var osd = document.getElementById('tv-osd');
  var osdTitle = document.getElementById('tv-player-title');
  var osdFill = document.getElementById('tv-player-fill');
  var osdTime = document.getElementById('tv-player-time');
  var stateBadge = document.getElementById('tv-player-state');
  var osdTimer = null;

  function current() { return rows.length ? rows[r][cols[r]] : null; }

  function setFocus(nr, nc, instant) {
    if (!rows.length) return;
    var prev = current();
    if (prev) prev.classList.remove('is-focused');
    r = Math.max(0, Math.min(rows.length - 1, nr));
    cols[r] = Math.max(0, Math.min(rows[r].length - 1, nc));
    var el = current();
    el.classList.add('is-focused');
    try {
      el.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center', inline: 'center' });
    } catch (e) { el.scrollIntoView(); }
  }

  function move(dr, dc) {
    if (mode !== 'grid' || !rows.length) return;
    if (dr) setFocus(r + dr, cols[Math.max(0, Math.min(rows.length - 1, r + dr))]);
    else setFocus(r, cols[r] + dc);
  }

  // ----- built-in player -----
  // Two flavors behind one overlay:
  //   'file'  — direct MP4/WebM in the native <video> (hardware decode)
  //   'embed' — YouTube / Vimeo / Dailymotion in an iframe. The iframe never
  //             takes focus, so the D-pad stays on our document; playback is
  //             driven through each provider's postMessage protocol instead.
  var playerKind = null;      // 'file' | 'embed' while open
  var embedFrame = null;
  var embedProvider = null;   // 'yt' | 'vimeo' | 'dm'
  var embedInfo = { playing: true, time: 0, duration: 0 };
  var embedPoll = null;
  var openHref = '';          // href of the item playing (for error fallback)

  function fmt(t) {
    if (!isFinite(t)) return '0:00';
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function showOsd(sticky) {
    osd.classList.add('is-visible');
    if (osdTimer) clearTimeout(osdTimer);
    if (!sticky) osdTimer = setTimeout(function () { osd.classList.remove('is-visible'); }, 3000);
  }
  function setOsdProgress(time, duration) {
    if (isFinite(duration) && duration > 0) {
      osdFill.style.width = Math.max(0, Math.min(100, time / duration * 100)) + '%';
      osdTime.textContent = fmt(time) + ' / ' + fmt(duration);
    }
  }
  function openOverlay(card, kind) {
    mode = 'player';
    playerKind = kind;
    openHref = card.getAttribute('data-href') || '';
    osdTitle.textContent = card.getAttribute('data-title') || '';
    osdFill.style.width = '0%';
    osdTime.textContent = '0:00 / 0:00';
    stateBadge.classList.remove('is-visible');
    player.classList.add('is-open');
    player.setAttribute('aria-hidden', 'false');
    showOsd();
  }
  function openFile(card) {
    openOverlay(card, 'file');
    var poster = card.getAttribute('data-poster');
    if (poster) video.setAttribute('poster', poster); else video.removeAttribute('poster');
    video.src = card.getAttribute('data-play');
    var p = video.play();
    if (p && p.catch) p.catch(function () { showOsd(true); });
  }
  function openEmbed(card) {
    openOverlay(card, 'embed');
    embedProvider = card.getAttribute('data-provider');
    embedInfo = { playing: true, time: 0, duration: 0 };
    video.style.display = 'none';
    embedFrame = document.createElement('iframe');
    embedFrame.className = 'tv-player__embed';
    embedFrame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    embedFrame.setAttribute('allowfullscreen', '');
    embedFrame.setAttribute('tabindex', '-1');
    embedFrame.src = card.getAttribute('data-embed');
    if (embedProvider === 'generic') {
      // No postMessage protocol for arbitrary embeds, so we can't detect a
      // blocked/broken iframe directly. onerror rarely fires for cross-origin
      // frames, but it's a free safety net when it does.
      embedFrame.onerror = function () {
        if (mode === 'player' && playerKind === 'embed' && openHref) {
          var href = openHref;
          closePlayer();
          location.href = href;
        }
      };
    }
    player.insertBefore(embedFrame, player.firstChild);
    // Handshake loop: YouTube starts streaming infoDelivery (time/state)
    // once it hears "listening"; Vimeo needs event subscriptions. Re-sent on
    // an interval because the iframe may not be ready for the first ones.
    embedPoll = setInterval(function () {
      if (embedProvider === 'yt') {
        embedPost({ event: 'listening', id: 'lf' });
      } else if (embedProvider === 'vimeo') {
        embedPost({ method: 'addEventListener', value: 'playProgress' });
        embedPost({ method: 'addEventListener', value: 'pause' });
        embedPost({ method: 'addEventListener', value: 'play' });
        embedPost({ method: 'addEventListener', value: 'finish' });
      }
    }, 600);
  }
  function embedPost(data) {
    if (!embedFrame || !embedFrame.contentWindow) return;
    try { embedFrame.contentWindow.postMessage(JSON.stringify(data), '*'); } catch (e) {}
  }
  function closePlayer() {
    mode = 'grid';
    playerKind = null;
    openHref = '';
    if (embedPoll) { clearInterval(embedPoll); embedPoll = null; }
    if (embedFrame) {
      if (embedFrame.parentNode) embedFrame.parentNode.removeChild(embedFrame);
      embedFrame = null;
      embedProvider = null;
    }
    video.style.display = '';
    try { video.pause(); } catch (e) {}
    video.removeAttribute('src');
    video.load();
    player.classList.remove('is-open');
    player.setAttribute('aria-hidden', 'true');
  }
  function setPausedBadge(paused) {
    stateBadge.classList.toggle('is-visible', paused);
  }
  function togglePlay() {
    if (playerKind === 'embed') {
      var playing = embedInfo.playing;
      if (embedProvider === 'yt') embedPost({ event: 'command', func: playing ? 'pauseVideo' : 'playVideo', args: [] });
      else if (embedProvider === 'vimeo') embedPost({ method: playing ? 'pause' : 'play' });
      else embedPost({ command: playing ? 'pause' : 'play', parameters: [] });
      embedInfo.playing = !playing;
      setPausedBadge(!embedInfo.playing);
    } else if (video.paused) {
      video.play();
      setPausedBadge(false);
    } else {
      video.pause();
      setPausedBadge(true);
    }
    showOsd();
  }
  function seek(delta) {
    if (playerKind === 'embed') {
      var t = Math.max(0, embedInfo.time + delta);
      if (embedInfo.duration) t = Math.min(embedInfo.duration, t);
      if (embedProvider === 'yt') embedPost({ event: 'command', func: 'seekTo', args: [t, true] });
      else if (embedProvider === 'vimeo') embedPost({ method: 'setCurrentTime', value: t });
      else embedPost({ command: 'seek', parameters: [t] });
      embedInfo.time = t;
      setOsdProgress(embedInfo.time, embedInfo.duration);
    } else if (isFinite(video.duration)) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
    }
    showOsd();
  }
  video.addEventListener('timeupdate', function () {
    if (playerKind === 'file') setOsdProgress(video.currentTime, video.duration);
  });
  video.addEventListener('ended', function () { if (playerKind === 'file') closePlayer(); });
  video.addEventListener('error', function () {
    // Direct playback failed (codec, CORS, dead link) — fall back to the page.
    if (mode === 'player' && playerKind === 'file' && openHref) {
      var href = openHref;
      closePlayer();
      location.href = href;
    }
  });

  // Status flowing back from embedded players (time, state, errors).
  window.addEventListener('message', function (e) {
    if (!embedFrame || e.source !== embedFrame.contentWindow) return;
    var d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    if (!d || typeof d !== 'object') return;
    if (d.event === 'infoDelivery' && d.info) {              // YouTube
      if (typeof d.info.currentTime === 'number') embedInfo.time = d.info.currentTime;
      if (typeof d.info.duration === 'number' && d.info.duration > 0) embedInfo.duration = d.info.duration;
      if (typeof d.info.playerState === 'number') {
        if (d.info.playerState === 0) { closePlayer(); return; } // ended
        embedInfo.playing = d.info.playerState === 1 || d.info.playerState === 3;
        setPausedBadge(d.info.playerState === 2);
      }
      setOsdProgress(embedInfo.time, embedInfo.duration);
    } else if (d.event === 'onError') {                      // YouTube: embed blocked etc.
      if (mode === 'player' && playerKind === 'embed' && openHref) {
        var href = openHref;
        closePlayer();
        location.href = href;
      }
    } else if (d.event === 'playProgress' && d.data) {       // Vimeo
      if (typeof d.data.seconds === 'number') embedInfo.time = d.data.seconds;
      if (typeof d.data.duration === 'number' && d.data.duration > 0) embedInfo.duration = d.data.duration;
      embedInfo.playing = true;
      setOsdProgress(embedInfo.time, embedInfo.duration);
    } else if (d.event === 'pause') {                        // Vimeo
      embedInfo.playing = false;
      setPausedBadge(true);
    } else if (d.event === 'play') {                         // Vimeo
      embedInfo.playing = true;
      setPausedBadge(false);
    } else if (d.event === 'finish') {                       // Vimeo
      closePlayer();
    }
  });

  function activate(card) {
    if (!card) return;
    if (card.getAttribute('data-play')) openFile(card);
    else if (card.getAttribute('data-embed')) openEmbed(card);
    else location.href = card.getAttribute('data-href');
  }

  // The Android wrapper calls this before using WebView history for BACK.
  // Return true when the page consumed the press.
  window.lfBack = function () {
    if (mode === 'player') { closePlayer(); return true; }
    if (r !== 0 || cols[0] !== 0) { setFocus(0, 0); return true; }
    return false;
  };

  // ----- remote / keyboard input -----
  // Fire TV WebViews deliver the D-pad as arrow keys and center as Enter;
  // media buttons arrive as Media* keys (with legacy keyCodes as fallback).
  var CODE = { 37:'ArrowLeft', 38:'ArrowUp', 39:'ArrowRight', 40:'ArrowDown', 13:'Enter',
               27:'Escape', 8:'Backspace', 179:'MediaPlayPause', 85:'MediaPlayPause',
               415:'MediaPlay', 19:'MediaPause', 227:'MediaRewind', 228:'MediaFastForward',
               412:'MediaRewind', 417:'MediaFastForward', 461:'GoBack', 10009:'GoBack' };
  document.addEventListener('keydown', function (e) {
    var key = e.key && e.key !== 'Unidentified' ? e.key : CODE[e.keyCode];
    if (!key) return;
    var handled = true;
    if (mode === 'player') {
      switch (key) {
        case 'Enter': case 'MediaPlayPause': togglePlay(); break;
        case 'MediaPlay': if (playerKind === 'embed') { if (!embedInfo.playing) togglePlay(); } else video.play(); showOsd(); break;
        case 'MediaPause': if (playerKind === 'embed') { if (embedInfo.playing) togglePlay(); } else video.pause(); showOsd(); break;
        case 'ArrowLeft': case 'MediaRewind': seek(-10); break;
        case 'ArrowRight': case 'MediaFastForward': seek(10); break;
        case 'ArrowUp': seek(60); break;
        case 'ArrowDown': seek(-60); break;
        case 'Escape': case 'Backspace': case 'GoBack': closePlayer(); break;
        default: handled = false; showOsd();
      }
    } else {
      switch (key) {
        case 'ArrowLeft': move(0, -1); break;
        case 'ArrowRight': move(0, 1); break;
        case 'ArrowUp': move(-1, 0); break;
        case 'ArrowDown': move(1, 0); break;
        case 'Enter': activate(current()); break;
        case 'Escape': case 'Backspace': case 'GoBack':
          if (!window.lfBack()) handled = false;
          break;
        default: handled = false;
      }
    }
    if (handled) e.preventDefault();
  });

  // Pointer support so the page also works in a normal browser preview.
  document.addEventListener('click', function (e) {
    if (mode === 'player') {
      if (!osd.contains(e.target)) togglePlay();
      return;
    }
    var card = e.target.closest ? e.target.closest('[data-tv-card]') : null;
    if (!card) return;
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i].indexOf(card);
      if (c !== -1) { setFocus(i, c); break; }
    }
    activate(card);
  });

  if (rows.length) setFocus(0, 0, true);
})();
</script>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(ctx.title)}</title>
  ${ctx.tagline ? `<meta name="description" content="${attr(ctx.tagline)}" />` : ''}
  ${css}
</head>
<body class="lf-template lf-tv">
${body}
${runtime}
</body>
</html>`;
}

// ---------- expose ----------
if (typeof window !== 'undefined') {
  window.LINKFORGE_TEMPLATES = TEMPLATES;
  window.LINKFORGE_SUGGEST = suggestTemplate;
  window.LINKFORGE_SUGGEST_TEMPLATE = suggestTemplate;
  window.LINKFORGE_MARQUEE_VALIDATE = marqueeValidate;
}
if (typeof module !== 'undefined') {
  module.exports = { TEMPLATES, suggestTemplate, splitItems, partitionGroups, marqueeValidate, buildFireTv };
}
