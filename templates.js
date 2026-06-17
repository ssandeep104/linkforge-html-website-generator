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

function srcLabel(group) {
  return group.name || (group.items[0]?.domain) || 'Source';
}

// Items with a usable thumbnail get card treatment; items without get sent
// to the "More links" tail. We treat empty/falsy thumbnails as no-preview.
function hasPreview(item) {
  if (!item || !item.thumbnail) return false;
  const t = String(item.thumbnail).trim();
  if (!t) return false;
  // Defense in depth: reject any synthetic letter/placeholder thumbnail.
  // Real thumbs are http(s) or absolute paths; synthetic ones are inline
  // SVG data URIs flagged via item.thumbnailIsPlaceholder.
  if (item.thumbnailIsPlaceholder) return false;
  return true;
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
function partitionGroups(sourceGroups) {
  const previewGroups = [];
  const linkGroups = [];
  for (const g of sourceGroups || []) {
    const { withPreview, linkOnly } = splitItems(g.items);
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
  .more-links__heading { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6b6b6b; margin: 0 0 20px; font-family: inherit; }
  .more-links__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px 40px; }
  .more-links__group { min-width: 0; }
  .more-links__src { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #111; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #d4d4d4; }
  .more-links__list { list-style: none; margin: 0; padding: 0; }
  .more-links__list li { padding: 6px 0; font-size: 14px; line-height: 1.45; border-bottom: 1px solid #f4f4f5; }
  .more-links__list li:last-child { border-bottom: 0; }
  .more-links__list a { color: #0a0a0a; }
  .more-links__list a:hover { color: #2563eb; text-decoration: underline; }
  .more-links__domain { display: block; font-size: 11px; color: #9a9a9a; margin-top: 2px; font-family: ui-monospace, Menlo, monospace; }
  @media (max-width: 700px) { .more-links__grid { grid-template-columns: 1fr; gap: 24px; } }
`;

const MORE_LINKS_CSS_DARK = `
  .more-links { margin-top: 56px; padding-top: 28px; border-top: 1px solid #1f2228; }
  .more-links__heading { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #71717a; margin: 0 0 20px; font-family: inherit; }
  .more-links__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px 40px; }
  .more-links__group { min-width: 0; }
  .more-links__src { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #e6e6e7; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #2c3340; }
  .more-links__list { list-style: none; margin: 0; padding: 0; }
  .more-links__list li { padding: 6px 0; font-size: 14px; line-height: 1.45; border-bottom: 1px solid #1a1d22; }
  .more-links__list li:last-child { border-bottom: 0; }
  .more-links__list a { color: #d4d4d8; }
  .more-links__list a:hover { color: #61dafb; text-decoration: underline; }
  .more-links__domain { display: block; font-size: 11px; color: #6a7077; margin-top: 2px; font-family: ui-monospace, Menlo, monospace; }
  @media (max-width: 700px) { .more-links__grid { grid-template-columns: 1fr; gap: 24px; } }
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

// ---------- expose ----------
if (typeof window !== 'undefined') {
  window.LINKFORGE_TEMPLATES = TEMPLATES;
  window.LINKFORGE_SUGGEST = suggestTemplate;
  window.LINKFORGE_SUGGEST_TEMPLATE = suggestTemplate;
}
if (typeof module !== 'undefined') {
  module.exports = { TEMPLATES, suggestTemplate, splitItems, partitionGroups };
}
