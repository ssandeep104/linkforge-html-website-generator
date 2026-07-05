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
    <span class="${className}__badge">${esc(itemKindLabel(item))}</span>
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
          <span class="smart-links__type">${esc(itemKindLabel(i))}</span>
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

function srcLabel(group) {
  return group.name || (group.items[0]?.domain) || 'Source';
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
  for (const g of sourceGroups || []) {
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
    if (withPreview.length) previewGroups.push({ name: g.name, items: withPreview });
    if (linkOnly.length) linkGroups.push({ name: g.name, items: linkOnly });
  }
  return { previewGroups, linkGroups };
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
    editorial: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafaf7"/><rect x="10" y="10" width="60" height="40" rx="2" fill="#1a1a1a"/><rect x="75" y="10" width="35" height="18" rx="2" fill="#999"/><rect x="115" y="10" width="35" height="18" rx="2" fill="#999"/><rect x="75" y="32" width="35" height="18" rx="2" fill="#bbb"/><rect x="115" y="32" width="35" height="18" rx="2" fill="#bbb"/><line x1="10" y1="62" x2="150" y2="62" stroke="#1a1a1a" stroke-width="0.5"/><rect x="10" y="68" width="60" height="3" rx="1" fill="#666"/><rect x="10" y="76" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="68" width="60" height="3" rx="1" fill="#666"/><rect x="80" y="76" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    stream: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><rect x="10" y="8" width="30" height="5" rx="1" fill="#18181b"/><rect x="10" y="20" width="42" height="28" rx="3" fill="#06b6d4"/><rect x="60" y="20" width="42" height="28" rx="3" fill="#a3e635"/><rect x="110" y="20" width="40" height="28" rx="3" fill="#f59e0b"/><rect x="10" y="58" width="30" height="4" rx="1" fill="#18181b"/><rect x="10" y="68" width="60" height="3" rx="1" fill="#999"/><rect x="10" y="75" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="68" width="60" height="3" rx="1" fill="#999"/><rect x="80" y="75" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    reel: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0a0a0a"/><rect x="8" y="6" width="144" height="32" rx="3" fill="#1f1f23"/><rect x="8" y="40" width="80" height="4" rx="1" fill="#fff" opacity=".85"/><rect x="8" y="48" width="40" height="3" rx="1" fill="#888"/><rect x="8" y="58" width="34" height="20" rx="2" fill="#374151"/><rect x="46" y="58" width="34" height="20" rx="2" fill="#1f2937"/><rect x="84" y="58" width="34" height="20" rx="2" fill="#374151"/><rect x="122" y="58" width="30" height="20" rx="2" fill="#1f2937"/><rect x="8" y="84" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="91" width="60" height="3" rx="1" fill="#444"/></svg>`,
    console: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0b0d10"/><rect x="8" y="8" width="50" height="4" rx="1" fill="#61dafb"/><rect x="8" y="18" width="80" height="3" rx="1" fill="#5c6370"/><rect x="8" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="50" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="58" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="66" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="74" width="60" height="3" rx="1" fill="#61dafb"/><rect x="8" y="82" width="60" height="3" rx="1" fill="#5c6370"/></svg>`,
    wall: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafafa"/><rect x="8" y="6" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="14" width="34" height="34" rx="3" fill="#dc2626"/><rect x="46" y="14" width="34" height="34" rx="3" fill="#7c3aed"/><rect x="84" y="14" width="34" height="34" rx="3" fill="#06b6d4"/><rect x="122" y="14" width="30" height="34" rx="3" fill="#f59e0b"/><rect x="8" y="56" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="8" y="71" width="60" height="3" rx="1" fill="#bbb"/><rect x="80" y="64" width="60" height="3" rx="1" fill="#666"/><rect x="80" y="71" width="60" height="3" rx="1" fill="#bbb"/></svg>`,
    timeline: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><line x1="22" y1="15" x2="22" y2="95" stroke="#e5e5e5" stroke-width="1"/><circle cx="22" cy="22" r="4" fill="#111"/><rect x="32" y="18" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="28" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="40" width="110" height="10" rx="2" fill="#f4f4f5"/><circle cx="22" cy="58" r="4" fill="#111"/><rect x="32" y="54" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="64" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="71" width="110" height="3" rx="1" fill="#bbb"/><rect x="32" y="78" width="110" height="3" rx="1" fill="#666"/><rect x="32" y="85" width="110" height="3" rx="1" fill="#bbb"/></svg>`,
    bento: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#f6efe4"/><rect x="8" y="8" width="90" height="50" rx="6" fill="#121212"/><rect x="104" y="8" width="48" height="24" rx="6" fill="#f97316"/><rect x="104" y="36" width="48" height="22" rx="6" fill="#14b8a6"/><rect x="8" y="64" width="34" height="24" rx="6" fill="#facc15"/><rect x="46" y="64" width="52" height="24" rx="6" fill="#ffffff" stroke="#d6d3d1"/><rect x="104" y="64" width="48" height="24" rx="6" fill="#ffffff" stroke="#d6d3d1"/></svg>`,
    broadsheet: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fbfaf5"/><rect x="8" y="8" width="144" height="6" rx="1" fill="#111827"/><rect x="8" y="20" width="68" height="44" rx="2" fill="#d6d3d1"/><rect x="82" y="20" width="70" height="5" rx="1" fill="#111827"/><rect x="82" y="30" width="70" height="3" rx="1" fill="#6b7280"/><rect x="82" y="38" width="70" height="3" rx="1" fill="#9ca3af"/><rect x="82" y="46" width="70" height="3" rx="1" fill="#9ca3af"/><line x1="8" y1="72" x2="152" y2="72" stroke="#111827" stroke-width="1"/><rect x="8" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="56" y="78" width="40" height="3" rx="1" fill="#111827"/><rect x="104" y="78" width="40" height="3" rx="1" fill="#111827"/></svg>`,
    signal: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#09111f"/><rect x="8" y="8" width="34" height="84" rx="6" fill="#0f1c34"/><rect x="50" y="8" width="102" height="20" rx="6" fill="#16233d"/><rect x="56" y="14" width="34" height="4" rx="1" fill="#f1f5f9"/><rect x="50" y="34" width="102" height="24" rx="6" fill="#16233d"/><rect x="50" y="64" width="102" height="24" rx="6" fill="#16233d"/><circle cx="64" cy="46" r="4" fill="#38bdf8"/><circle cx="64" cy="76" r="4" fill="#f97316"/><rect x="74" y="43" width="52" height="3" rx="1" fill="#f1f5f9"/><rect x="74" y="73" width="52" height="3" rx="1" fill="#f1f5f9"/></svg>`,
  };
  return layouts[layout] || layouts.stream;
}

// ---------- registry ----------
const TEMPLATES = {
  editorial: {
    name: 'Editorial',
    desc: 'Magazine grid for items with images, plain link list at the bottom for the rest.',
    preview: () => previewSvg('editorial'),
    build: (ctx) => buildEditorial(normalize(ctx)),
  },
  stream: {
    name: 'Stream',
    desc: 'Three-column card feed grouped by source. Items without images go to a list below.',
    preview: () => previewSvg('stream'),
    build: (ctx) => buildStream(normalize(ctx)),
  },
  reel: {
    name: 'Reel',
    desc: 'Horizontal rails of preview cards per source. Clean caption under each card, no text-on-image.',
    preview: () => previewSvg('reel'),
    build: (ctx) => buildReel(normalize(ctx)),
  },
  console: {
    name: 'Console',
    desc: 'Terminal/IDE aesthetic. Preview cards on top, link list at the bottom.',
    preview: () => previewSvg('console'),
    build: (ctx) => buildConsole(normalize(ctx)),
  },
  wall: {
    name: 'Wall',
    desc: 'Uniform image grid for previewable links. Plain link list at the bottom.',
    preview: () => previewSvg('wall'),
    build: (ctx) => buildWall(normalize(ctx)),
  },
  timeline: {
    name: 'Timeline',
    desc: 'Vertical spine grouped by source. Compact rows for previews, link list at the bottom.',
    preview: () => previewSvg('timeline'),
    build: (ctx) => buildTimeline(normalize(ctx)),
  },
  bento: {
    name: 'Bento',
    desc: 'Mixed-size modular cards with a featured lead tile per source and smaller supporting blocks around it.',
    preview: () => previewSvg('bento'),
    build: (ctx) => buildBento(normalize(ctx)),
  },
  broadsheet: {
    name: 'Broadsheet',
    desc: 'A modern newspaper front page with a lead story, supporting stack, and restrained serif presentation.',
    preview: () => previewSvg('broadsheet'),
    build: (ctx) => buildBroadsheet(normalize(ctx)),
  },
  signal: {
    name: 'Signal',
    desc: 'High-contrast intelligence dashboard with sharp metadata rails and stacked source-led story cards.',
    preview: () => previewSvg('signal'),
    build: (ctx) => buildSignal(normalize(ctx)),
  },
};

function suggestTemplate(counts) {
  const t = counts.total || 1;
  if (counts.video / t >= 0.5) return 'reel';
  if (counts.gallery / t >= 0.5) return 'wall';
  if (counts.link / t >= 0.6) return 'timeline';
  if (counts.article / t >= 0.5) return 'editorial';
  return 'stream';
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(tagline || '')}" />
<style>
  *,*::before,*::after { box-sizing: border-box; }
  html,body { margin: 0; padding: 0; }
  img { display: block; max-width: 100%; }
  a { color: inherit; text-decoration: none; }
${css}
</style>
</head>
<body class="${bodyClass}">
${body}
</body>
</html>`;
}

// =====================================================
// 1) EDITORIAL — magazine grid for images, plain list for the rest
// =====================================================
function buildEditorial(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #fafaf7; color: #1a1a1a; font-family: "Iowan Old Style", Iowan, Georgia, serif; line-height: 1.5; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 48px 32px 80px; }
  header.site { border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 40px; text-align: center; }
  .site h1 { font-size: 44px; letter-spacing: -0.02em; font-weight: 800; margin: 0; }
  .site .tagline { font-family: system-ui, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b6b6b; margin-top: 8px; }
  .source { margin-bottom: 48px; }
  .source-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 24px; }
  .source-name { font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; }
  .source-count { font-family: system-ui, sans-serif; font-size: 11px; color: #6b6b6b; letter-spacing: 0.08em; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
  .card .thumb-box { aspect-ratio: 16/10; overflow: hidden; margin-bottom: 12px; background: #eee; border-radius: 2px; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .card h3 { font-size: 19px; line-height: 1.25; letter-spacing: -0.005em; font-weight: 700; margin: 0; }
  .card:hover h3 { color: #6b3f1f; }
  ${MORE_LINKS_CSS_LIGHT}
  .more-links__heading { font-family: system-ui, sans-serif; }
  .more-links__src { font-family: system-ui, sans-serif; }
  @media (max-width: 768px) {
    .wrap { padding: 28px 18px 60px; }
    .site h1 { font-size: 30px; }
    .grid { grid-template-columns: 1fr; gap: 22px; }
  }`;

  const sections = previewGroups.map((g) => {
    const cards = g.items.map((i) => `<a class="card" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <h3>${esc(i.title)}</h3>
    </a>`).join('');
    return `<section class="source">
      <div class="source-head">
        <div class="source-name">${esc(srcLabel(g))}</div>
        <div class="source-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</div>
      </div>
      <div class="grid">${cards}</div>
    </section>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${sections}
    ${moreLinksSection(linkGroups)}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 2) STREAM — 3-col card feed for items with images, list below
// =====================================================
function buildStream(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #fff; color: #0f0f0f; font-family: "Inter", system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.5; }
  .wrap { max-width: 1280px; margin: 0 auto; padding: 32px 24px 80px; }
  header.site { margin-bottom: 32px; }
  .site h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.015em; margin: 0; }
  .site .tagline { color: #71717a; font-size: 14px; margin-top: 4px; }

  .source-block { margin-top: 40px; }
  .source-hdr { display: flex; align-items: baseline; gap: 12px; padding-bottom: 12px; margin-bottom: 18px; border-bottom: 1px solid #e5e5e5; }
  .src-pill { background: #18181b; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; padding: 4px 9px; border-radius: 4px; }
  .src-count { color: #a1a1aa; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .card { display: block; }
  .card .thumb-box { aspect-ratio: 16/9; overflow: hidden; background: #f4f4f5; border-radius: 8px; margin-bottom: 12px; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .card h3 { font-size: 16px; font-weight: 600; letter-spacing: -0.005em; line-height: 1.35; margin: 0; color: #0f0f0f; }
  .card:hover h3 { color: #2563eb; }
  ${MORE_LINKS_CSS_LIGHT}

  @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 16px; } }
  @media (max-width: 560px) {
    .wrap { padding: 20px 16px 60px; }
    .grid { grid-template-columns: 1fr; gap: 14px; }
  }`;

  const sections = previewGroups.map((g) => {
    const cards = g.items.map((i) => `<a class="card" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <h3>${esc(i.title)}</h3>
    </a>`).join('');
    return `<section class="source-block">
      <div class="source-hdr">
        <span class="src-pill">${esc(srcLabel(g)).toUpperCase()}</span>
        <span class="src-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div class="grid">${cards}</div>
    </section>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${sections}
    ${moreLinksSection(linkGroups)}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 3) REEL — horizontal rails per source, clean captions (no overlay text)
// =====================================================
function buildReel(ctx) {
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #0a0a0a; color: #f5f5f7; font-family: "Inter", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { padding: 32px 0 80px; max-width: 1400px; margin: 0 auto; }
  header.site { padding: 0 48px 32px; }
  .site h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.015em; margin: 0; color: #fff; }
  .site .tagline { font-size: 14px; color: #a1a1a6; margin-top: 4px; }

  .rail { margin-bottom: 40px; }
  .rail-head { display: flex; justify-content: space-between; align-items: baseline; padding: 0 48px 14px; }
  .rail-title { font-size: 16px; font-weight: 600; letter-spacing: -0.005em; color: #fff; }
  .rail-count { color: #71717a; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
  .rail-track { display: flex; gap: 16px; overflow-x: auto; padding: 0 48px 8px; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .rail-track::-webkit-scrollbar { display: none; }

  .tile { flex-shrink: 0; scroll-snap-align: start; width: 300px; }
  .tile .thumb-box { aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; background: #1a1a1f; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s ease; }
  .tile:hover .thumb-box img { transform: scale(1.03); }
  .tile h4 { font-size: 14px; font-weight: 500; margin: 10px 2px 0; padding: 0; color: #f5f5f7; letter-spacing: -0.005em; line-height: 1.35; }

  ${MORE_LINKS_CSS_DARK}
  .more-links { margin: 56px 48px 0; }

  @media (max-width: 768px) {
    header.site { padding: 0 16px 24px; }
    .rail-head { padding: 0 16px 10px; }
    .rail-track { padding: 0 16px 8px; gap: 12px; }
    .tile { width: 240px; }
    .more-links { margin: 40px 16px 0; }
  }`;

  const rails = previewGroups.map((g) => {
    const tiles = g.items.map((i) => `<a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <h4>${esc(i.title)}</h4>
    </a>`).join('');
    return `<div class="rail">
      <div class="rail-head">
        <div class="rail-title">${esc(srcLabel(g))}</div>
        <span class="rail-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div class="rail-track">${tiles}</div>
    </div>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${rails}
    ${moreLinksSection(linkGroups)}
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
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: #fafafa; color: #0f0f0f; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 32px 24px 80px; }
  header.site { margin-bottom: 32px; }
  .site h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.015em; margin: 0; }
  .site .tagline { color: #71717a; font-size: 14px; margin-top: 4px; }

  .source { margin-bottom: 48px; }
  .source-hdr { display: flex; align-items: baseline; gap: 12px; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid #e5e5e5; }
  .src-pill { background: #111; color: #fff; padding: 3px 8px; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; }
  .src-name { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
  .src-count { color: #71717a; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .tile { display: block; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .tile .thumb-box { aspect-ratio: 1; overflow: hidden; background: #f4f4f5; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
  .tile:hover .thumb-box img { transform: scale(1.04); }
  .tile h3 { padding: 10px 12px 12px; font-size: 13px; font-weight: 500; line-height: 1.35; letter-spacing: -0.005em; margin: 0; }

  ${MORE_LINKS_CSS_LIGHT}

  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 700px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
  @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }`;

  const sections = previewGroups.map((g) => {
    const tiles = g.items.map((i) => `<a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbImg(i)}</div>
      <h3>${esc(i.title)}</h3>
    </a>`).join('');
    return `<section class="source">
      <div class="source-hdr">
        <span class="src-pill">${esc(srcLabel(g)).toUpperCase()}</span>
        <span class="src-name">${esc(srcLabel(g))}</span>
        <span class="src-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div class="grid">${tiles}</div>
    </section>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${sections}
    ${moreLinksSection(linkGroups)}
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
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: linear-gradient(180deg, #f8f1e7 0%, #f4ede2 100%); color: #161515; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 1320px; margin: 0 auto; padding: 32px 24px 88px; }
  header.site { margin-bottom: 34px; }
  .eyebrow { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 8px 14px; border-radius: 999px; background: rgba(249, 115, 22, 0.08); color: #c2410c; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .eyebrow::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
  .site-head { display: grid; grid-template-columns: minmax(0, 1.2fr) 260px; gap: 26px; align-items: end; }
  .site h1 { margin: 0; font-size: 56px; line-height: 0.92; letter-spacing: -0.055em; font-weight: 800; max-width: 10ch; }
  .site .tagline { margin-top: 12px; max-width: 58ch; color: #5f5448; font-size: 16px; line-height: 1.55; }
  .site-note { padding: 18px 20px; border-radius: 24px; background: rgba(255,255,255,0.82); border: 1px solid rgba(18,18,18,0.08); box-shadow: 0 14px 34px rgba(34, 26, 15, 0.08); }
  .site-note .label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #8b7b6a; font-weight: 700; }
  .site-note strong { display: block; margin-top: 10px; font-size: 30px; line-height: 1; letter-spacing: -0.05em; }
  .site-note span { display: block; margin-top: 8px; color: #5f5448; font-size: 13px; line-height: 1.45; }

  .source { margin-bottom: 44px; }
  .source-head { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
  .source-name { font-size: 24px; letter-spacing: -0.03em; font-weight: 800; }
  .source-count { font-size: 12px; color: #7c6e60; font-family: ui-monospace, Menlo, monospace; }

  .bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
  .tile { display: flex; flex-direction: column; min-width: 0; border-radius: 28px; overflow: hidden; background: rgba(255,255,255,0.88); border: 1px solid rgba(18,18,18,0.08); box-shadow: 0 18px 46px rgba(34, 26, 15, 0.08); }
  .tile:hover .media-frame img { transform: scale(1.03); }
  .tile--lead { grid-column: span 7; min-height: 420px; }
  .tile--lead .media-frame { aspect-ratio: 16/10; }
  .tile--lead .body { padding: 22px 24px 24px; }
  .tile--lead h3 { font-size: 30px; line-height: 1.02; letter-spacing: -0.04em; font-weight: 800; margin: 0 0 12px; }
  .tile--lead .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #8b7b6a; }

  .tile--stack { grid-column: span 5; padding: 18px; justify-content: space-between; }
  .tile--stack .media-frame { aspect-ratio: 16/9; margin-bottom: 14px; }
  .tile--stack h3 { margin: 0; font-size: 18px; line-height: 1.14; letter-spacing: -0.03em; font-weight: 750; }
  .tile--stack .meta { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b7b6a; }

  .tile--mini { grid-column: span 4; padding: 16px; }
  .tile--mini .media-frame { aspect-ratio: 4/3; margin-bottom: 12px; }
  .tile--mini h3 { margin: 0; font-size: 15px; line-height: 1.22; letter-spacing: -0.02em; font-weight: 700; }
  .tile--mini .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b7b6a; }

  .media-frame { position: relative; border-radius: 18px; overflow: hidden; background: #e7dfd2; }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; transition: transform .32s ease; }
  .media-frame__badge { position: absolute; left: 12px; top: 12px; padding: 5px 9px; border-radius: 999px; background: rgba(255,255,255,0.88); color: #161515; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 12px; bottom: 12px; width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center; background: rgba(16,16,16,0.78); color: #fff; }
  .media-frame__play svg { width: 18px; height: 18px; margin-left: 2px; }
  .pill { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: rgba(18,18,18,0.06); }

  .smart-links { margin-top: 26px; padding-top: 24px; border-top: 1px solid rgba(18,18,18,0.1); }
  .smart-links__header { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 18px; }
  .smart-links__heading { margin: 0; font-size: 14px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #8b7b6a; }
  .smart-links__desc { margin: 0; color: #8b7b6a; font-size: 13px; }
  .smart-links__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .smart-links__group { padding: 18px; border-radius: 22px; background: rgba(255,255,255,0.72); border: 1px solid rgba(18,18,18,0.08); }
  .smart-links__src { margin-bottom: 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #8b7b6a; }
  .smart-links__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .smart-links__list a { display: flex; justify-content: space-between; gap: 12px; align-items: start; color: #161515; }
  .smart-links__title { flex: 1; min-width: 0; font-size: 15px; line-height: 1.35; }
  .smart-links__meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .smart-links__type, .smart-links__domain { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8b7b6a; }

  @media (max-width: 980px) {
    .site-head { grid-template-columns: 1fr; }
    .site h1 { font-size: 42px; max-width: none; }
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

  const sections = previewGroups.map((g) => {
    const cards = g.items.map((i, idx) => {
      const cls = idx === 0 ? 'tile tile--lead' : idx === 1 ? 'tile tile--stack' : 'tile tile--mini';
      return `<a class="${cls}" href="${attr(i.href)}" target="_blank" rel="noopener">
        ${mediaFrame(i)}
        <div class="body">
          <h3>${esc(i.title)}</h3>
          <div class="meta"><span class="pill">${esc(itemKindLabel(i))}</span><span class="pill">${esc(i.domain || srcLabel(g))}</span></div>
        </div>
      </a>`;
    }).join('');
    return `<section class="source">
      <div class="source-head">
        <div class="source-name">${esc(srcLabel(g))}</div>
        <div class="source-count">${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}</div>
      </div>
      <div class="bento">${cards}</div>
    </section>`;
  }).join('');

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
    ${smartLinksSection(linkGroups, { heading: 'Plain links' })}
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
        <div class="meta"><span class="pill">${esc(itemKindLabel(i))}</span><span class="pill">${esc(i.domain || srcLabel(g))}</span></div>
      </div>
    </a>`).join('');
    const briefs = rest.slice(3).map((i) => `<a class="brief" href="${attr(i.href)}" target="_blank" rel="noopener">
      <h4>${esc(i.title)}</h4>
      <div class="meta"><span class="pill">${esc(itemKindLabel(i))}</span><span class="pill">${esc(i.domain || srcLabel(g))}</span></div>
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
          <div class="meta"><span class="pill">${esc(itemKindLabel(lead))}</span><span class="pill">${esc(lead.domain || srcLabel(g))}</span></div>
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
  const { previewGroups, linkGroups } = partitionGroups(ctx.sourceGroups);

  const css = `
  body { background: radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 26%), linear-gradient(180deg, #09111f 0%, #0c1422 100%); color: #edf4ff; font-family: "Inter", system-ui, -apple-system, sans-serif; }
  .shell { max-width: 1380px; margin: 0 auto; padding: 24px 22px 88px; }
  .frame { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 20px; }
  .sidebar, .panel, .story { border: 1px solid rgba(148, 163, 184, 0.14); background: rgba(14, 23, 38, 0.86); backdrop-filter: blur(14px); }
  .sidebar { border-radius: 28px; padding: 24px; position: sticky; top: 24px; align-self: start; }
  .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(56, 189, 248, 0.12); color: #7dd3fc; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .badge::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: currentColor; }
  .sidebar h1 { margin: 18px 0 0; font-size: 44px; line-height: 0.94; letter-spacing: -0.06em; font-weight: 800; }
  .sidebar .tagline { margin-top: 12px; color: #98a7bc; font-size: 15px; line-height: 1.6; }
  .metrics { display: grid; gap: 10px; margin-top: 24px; }
  .metric { padding: 14px 16px; border-radius: 18px; background: rgba(22, 34, 56, 0.9); }
  .metric strong { display: block; font-size: 26px; line-height: 1; letter-spacing: -0.04em; }
  .metric span { display: block; margin-top: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #8ca0bc; }

  .main { display: flex; flex-direction: column; gap: 18px; }
  .panel { border-radius: 28px; overflow: hidden; }
  .panel-head { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; padding: 18px 22px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); }
  .panel-title { font-size: 19px; font-weight: 700; letter-spacing: -0.03em; }
  .panel-count { color: #8ca0bc; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .stack { display: grid; gap: 1px; background: rgba(148, 163, 184, 0.09); }
  .story { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 18px; padding: 18px; border: 0; border-radius: 0; }
  .story:hover .media-frame img { transform: scale(1.03); }
  .media-frame { position: relative; aspect-ratio: 4/3; border-radius: 18px; overflow: hidden; background: #132239; }
  .media-frame img { width: 100%; height: 100%; object-fit: cover; transition: transform .32s ease; }
  .media-frame__badge { position: absolute; left: 12px; top: 12px; padding: 5px 9px; border-radius: 999px; background: rgba(9, 17, 31, 0.84); color: #e0f2fe; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .media-frame__play { position: absolute; right: 12px; bottom: 12px; width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center; background: rgba(249, 115, 22, 0.88); color: #fff; }
  .media-frame__play svg { width: 18px; height: 18px; margin-left: 2px; }
  .story h3 { margin: 0; font-size: 24px; line-height: 1.02; letter-spacing: -0.04em; font-weight: 760; color: #f5f9ff; }
  .story .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .chip { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; }
  .chip--source { background: rgba(56, 189, 248, 0.12); color: #7dd3fc; }
  .chip--domain { background: rgba(249, 115, 22, 0.12); color: #fdba74; }
  .chip--kind { background: rgba(167, 139, 250, 0.14); color: #ddd6fe; }

  .smart-links { margin-top: 10px; padding-top: 18px; border-top: 1px solid rgba(148, 163, 184, 0.12); }
  .smart-links__header { display: flex; justify-content: space-between; gap: 18px; align-items: end; margin-bottom: 18px; }
  .smart-links__heading { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #8ca0bc; }
  .smart-links__desc { margin: 0; font-size: 13px; color: #8ca0bc; }
  .smart-links__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .smart-links__group { padding: 18px; border-radius: 24px; border: 1px solid rgba(148, 163, 184, 0.12); background: rgba(14, 23, 38, 0.7); }
  .smart-links__src { margin-bottom: 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #8ca0bc; }
  .smart-links__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .smart-links__list a { display: flex; justify-content: space-between; gap: 12px; align-items: start; color: #edf4ff; }
  .smart-links__title { flex: 1; min-width: 0; font-size: 15px; line-height: 1.35; }
  .smart-links__meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .smart-links__type, .smart-links__domain { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8ca0bc; }

  @media (max-width: 1020px) {
    .frame { grid-template-columns: 1fr; }
    .sidebar { position: static; }
    .smart-links__grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .shell { padding: 16px 14px 64px; }
    .sidebar, .panel { border-radius: 22px; }
    .sidebar h1 { font-size: 34px; }
    .story { grid-template-columns: 1fr; }
    .story h3 { font-size: 20px; }
    .smart-links__header, .smart-links__list a { flex-direction: column; align-items: flex-start; }
  }`;

  const panels = previewGroups.map((g) => {
    const rows = g.items.map((i) => `<a class="story" href="${attr(i.href)}" target="_blank" rel="noopener">
      ${mediaFrame(i)}
      <div>
        <h3>${esc(i.title)}</h3>
        <div class="meta">
          <span class="chip chip--source">${esc(srcLabel(g))}</span>
          <span class="chip chip--kind">${esc(itemKindLabel(i))}</span>
          <span class="chip chip--domain">${esc(i.domain || 'source')}</span>
        </div>
      </div>
    </a>`).join('');
    return `<section class="panel">
      <div class="panel-head">
        <div class="panel-title">${esc(srcLabel(g))}</div>
        <div class="panel-count">${g.items.length} ${g.items.length === 1 ? 'signal' : 'signals'}</div>
      </div>
      <div class="stack">${rows}</div>
    </section>`;
  }).join('');

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
        ${smartLinksSection(linkGroups, { heading: 'Supplemental links' })}
      </main>
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
