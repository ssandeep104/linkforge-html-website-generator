/* =====================================================
   LINKFORGE — output templates (v2: source-grouped, no chrome)
   Each template is a self-contained function:
     buildXxx(ctx) -> { html: string }
   ctx = { title, tagline, sourceGroups, all, today, articles, videos, gallery, links }
   sourceGroups: [{ name, items }]   ← canonical grouping
   Other fields kept for back-compat with code that hasn't migrated yet.

   Rules followed by every template here:
   1. Group strictly by source — never mix sources in one section.
   2. No "article"/"video"/"link"/"gallery" type chrome anywhere.
   3. Just thumbnail + title. Source is the section header.
   ===================================================== */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
const attr = esc;

// ---------- shared helpers ----------
function placeholderDataURI(text) {
  const t = String(text || 'Link');
  const letter = t.charAt(0).toUpperCase();
  let hue = 0;
  for (let i = 0; i < t.length; i++) hue = (hue + t.charCodeAt(i)) % 360;
  const bg = `hsl(${hue},38%,86%)`;
  const fg = `hsl(${hue},45%,32%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="${bg}"/><text x="200" y="158" font-size="120" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="600" text-anchor="middle" fill="${fg}">${letter}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function thumbImg(item, extraAttrs = '') {
  if (!item || !item.thumbnail) return '';
  const fallback = placeholderDataURI(item.title || item.domain);
  return `<img src="${attr(item.thumbnail)}" data-fallback="${attr(fallback)}" alt="" loading="lazy" onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback;}" ${extraAttrs}/>`;
}

// Used when a template needs to guarantee a visual (e.g. Wall, Board-style).
function thumbOrPlaceholder(item) {
  if (item && item.thumbnail) return thumbImg(item);
  const fallback = placeholderDataURI(item?.title || item?.domain);
  return `<img src="${attr(fallback)}" alt="" loading="lazy" />`;
}

// Hostname pretty-print for fallback when no sourceName.
function srcLabel(group) {
  return group.name || (group.items[0]?.domain) || 'Source';
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
// Each template gets a tiny inline SVG showing its layout schematic.
function previewSvg(layout) {
  const layouts = {
    editorial: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafaf7"/><rect x="10" y="10" width="60" height="40" rx="2" fill="#1a1a1a"/><rect x="75" y="10" width="35" height="18" rx="2" fill="#999"/><rect x="115" y="10" width="35" height="18" rx="2" fill="#999"/><rect x="75" y="32" width="35" height="18" rx="2" fill="#bbb"/><rect x="115" y="32" width="35" height="18" rx="2" fill="#bbb"/><rect x="10" y="60" width="30" height="22" rx="2" fill="#1a1a1a"/><rect x="45" y="60" width="30" height="22" rx="2" fill="#999"/><rect x="80" y="60" width="30" height="22" rx="2" fill="#999"/><rect x="115" y="60" width="30" height="22" rx="2" fill="#999"/></svg>`,
    stream: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><rect x="10" y="8" width="30" height="5" rx="1" fill="#18181b"/><rect x="10" y="20" width="42" height="28" rx="3" fill="#06b6d4"/><rect x="60" y="20" width="42" height="28" rx="3" fill="#a3e635"/><rect x="110" y="20" width="40" height="28" rx="3" fill="#f59e0b"/><rect x="10" y="58" width="30" height="5" rx="1" fill="#18181b"/><rect x="10" y="68" width="42" height="24" rx="3" fill="#7c3aed"/><rect x="60" y="68" width="42" height="24" rx="3" fill="#be185d"/><rect x="110" y="68" width="40" height="24" rx="3" fill="#0891b2"/></svg>`,
    reel: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#000"/><rect x="8" y="6" width="144" height="36" rx="3" fill="url(#g)"/><defs><linearGradient id="g"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><rect x="8" y="34" width="60" height="6" rx="1" fill="#fff" opacity=".9"/><rect x="8" y="48" width="22" height="4" rx="1" fill="#888"/><rect x="8" y="56" width="30" height="18" rx="2" fill="#dc2626"/><rect x="42" y="56" width="30" height="18" rx="2" fill="#7c3aed"/><rect x="76" y="56" width="30" height="18" rx="2" fill="#1e293b"/><rect x="110" y="56" width="30" height="18" rx="2" fill="#0891b2"/><rect x="8" y="80" width="22" height="4" rx="1" fill="#888"/><rect x="8" y="88" width="22" height="10" rx="2" fill="#0f172a"/><rect x="34" y="88" width="22" height="10" rx="2" fill="#059669"/><rect x="60" y="88" width="22" height="10" rx="2" fill="#ea580c"/></svg>`,
    console: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#0b0d10"/><rect x="8" y="8" width="50" height="4" rx="1" fill="#61dafb"/><rect x="8" y="18" width="80" height="3" rx="1" fill="#5c6370"/><rect x="8" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="28" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="50" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="58" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="58" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="106" y="58" width="45" height="14" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="8" y="80" width="60" height="3" rx="1" fill="#5c6370"/><rect x="8" y="88" width="45" height="8" rx="2" fill="#11141a" stroke="#1f2228"/><rect x="57" y="88" width="45" height="8" rx="2" fill="#11141a" stroke="#1f2228"/></svg>`,
    wall: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fafafa"/><rect x="8" y="6" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="14" width="34" height="34" rx="3" fill="#dc2626"/><rect x="46" y="14" width="34" height="34" rx="3" fill="#7c3aed"/><rect x="84" y="14" width="34" height="34" rx="3" fill="#06b6d4"/><rect x="122" y="14" width="30" height="34" rx="3" fill="#f59e0b"/><rect x="8" y="54" width="50" height="4" rx="1" fill="#111"/><rect x="8" y="62" width="34" height="32" rx="3" fill="#059669"/><rect x="46" y="62" width="34" height="32" rx="3" fill="#0f172a"/><rect x="84" y="62" width="34" height="32" rx="3" fill="#be185d"/><rect x="122" y="62" width="30" height="32" rx="3" fill="#ea580c"/></svg>`,
    timeline: `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="#fff"/><line x1="22" y1="15" x2="22" y2="95" stroke="#e5e5e5" stroke-width="1"/><circle cx="22" cy="22" r="4" fill="#111"/><rect x="32" y="18" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="28" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="40" width="110" height="10" rx="2" fill="#f4f4f5"/><circle cx="22" cy="58" r="4" fill="#111"/><rect x="32" y="54" width="28" height="4" rx="1" fill="#18181b"/><rect x="32" y="64" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="76" width="110" height="10" rx="2" fill="#f4f4f5"/><rect x="32" y="88" width="110" height="8" rx="2" fill="#f4f4f5"/></svg>`,
  };
  return layouts[layout] || layouts.stream;
}

// ---------- registry ----------
const TEMPLATES = {
  editorial: {
    name: 'Editorial',
    desc: 'Magazine: serif masthead, big lead per source, smaller satellites below.',
    preview: () => previewSvg('editorial'),
    build: (ctx) => buildEditorial(normalize(ctx)),
  },
  stream: {
    name: 'Stream',
    desc: 'Three-column card feed, grouped by source. Clean, scannable.',
    preview: () => previewSvg('stream'),
    build: (ctx) => buildStream(normalize(ctx)),
  },
  reel: {
    name: 'Reel',
    desc: 'Apple-TV-style: hero + horizontal rails per source. Best when you have videos.',
    preview: () => previewSvg('reel'),
    build: (ctx) => buildReel(normalize(ctx)),
  },
  console: {
    name: 'Console',
    desc: 'Terminal/IDE aesthetic. Source as a // comment header. Dense and dark.',
    preview: () => previewSvg('console'),
    build: (ctx) => buildConsole(normalize(ctx)),
  },
  wall: {
    name: 'Wall',
    desc: 'Uniform grid gallery, every tile same size. Source as section header.',
    preview: () => previewSvg('wall'),
    build: (ctx) => buildWall(normalize(ctx)),
  },
  timeline: {
    name: 'Timeline',
    desc: 'Vertical activity spine with date markers. Source-grouped, dense and scannable.',
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
// Shared HTML scaffold
// =====================================================
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
// 1) EDITORIAL — magazine, source per section
// =====================================================
function buildEditorial(ctx) {
  const css = `
  body { background: #fafaf7; color: #1a1a1a; font-family: "Iowan Old Style", Iowan, Georgia, serif; line-height: 1.5; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 48px 32px 80px; }
  header.site { border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 40px; text-align: center; }
  .site h1 { font-size: 48px; letter-spacing: -0.02em; font-weight: 800; margin: 0; }
  .site .tagline { font-family: system-ui, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b6b6b; margin-top: 8px; }
  .source { margin-bottom: 56px; }
  .source-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 24px; }
  .source-name { font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; }
  .source-count { font-family: system-ui, sans-serif; font-size: 11px; color: #6b6b6b; letter-spacing: 0.08em; }
  .grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 24px; }
  .grid .lead { grid-row: span 2; }
  .card .thumb-box { aspect-ratio: 4/3; overflow: hidden; margin-bottom: 12px; background: #eee; }
  .lead .thumb-box { aspect-ratio: 16/9; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .card h3 { font-size: 22px; line-height: 1.2; letter-spacing: -0.01em; font-weight: 700; margin: 0; }
  .card.lead h3 { font-size: 32px; }
  .card.small h3 { font-size: 16px; }
  @media (max-width: 768px) {
    .wrap { padding: 24px 16px; }
    .site h1 { font-size: 32px; }
    .grid { grid-template-columns: 1fr; }
    .grid .lead { grid-row: auto; }
    .card.lead h3 { font-size: 24px; }
  }`;

  const sections = ctx.sourceGroups.map((g) => {
    const items = g.items;
    if (!items.length) return '';
    const [lead, ...rest] = items;
    const leadHtml = `<a class="card lead" href="${attr(lead.href)}" target="_blank" rel="noopener">
      ${lead.thumbnail ? `<div class="thumb-box">${thumbImg(lead)}</div>` : ''}
      <h3>${esc(lead.title)}</h3>
    </a>`;
    const restHtml = rest.map((i) => `<a class="card small" href="${attr(i.href)}" target="_blank" rel="noopener">
      ${i.thumbnail ? `<div class="thumb-box">${thumbImg(i)}</div>` : ''}
      <h3>${esc(i.title)}</h3>
    </a>`).join('');
    return `<section class="source">
      <div class="source-head">
        <div class="source-name">${esc(srcLabel(g))}</div>
        <div class="source-count">${items.length} ${items.length === 1 ? 'item' : 'items'}</div>
      </div>
      <div class="grid">${leadHtml}${restHtml}</div>
    </section>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${sections}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 2) STREAM — 3-col card feed, source-grouped
// =====================================================
function buildStream(ctx) {
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

  @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 16px; } }
  @media (max-width: 560px) {
    .wrap { padding: 20px 16px 60px; }
    .grid { grid-template-columns: 1fr; gap: 14px; }
    .card .thumb-box { aspect-ratio: 16/9; }
  }`;

  const sections = ctx.sourceGroups.map((g) => {
    const cards = g.items.map((i) => `<a class="card" href="${attr(i.href)}" target="_blank" rel="noopener">
      ${i.thumbnail ? `<div class="thumb-box">${thumbImg(i)}</div>` : `<div class="thumb-box">${thumbOrPlaceholder(i)}</div>`}
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
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 3) REEL — Apple TV style, hero + rails per source
//    Rails are conditional: a rail only renders if the source has items.
//    We pick rail layout per source based on the items present:
//      - if all items have video → landscape video rail
//      - otherwise → landscape image rail
//    Hero is the first item of the first source.
// =====================================================
function buildReel(ctx) {
  const css = `
  body { background: #000; color: #f5f5f7; font-family: "Inter", system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { padding: 24px 0 80px; }
  header.site { padding: 0 48px 24px; display: flex; justify-content: space-between; align-items: center; }
  .site h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.015em; margin: 0; }
  .site .tagline { font-size: 13px; color: #a1a1a6; }

  .hero { position: relative; margin: 0 48px 40px; aspect-ratio: 21/9; border-radius: 16px; overflow: hidden; background: #1a1a1f; }
  .hero img { width: 100%; height: 100%; object-fit: cover; }
  .hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%); }
  .hero-meta { position: absolute; bottom: 32px; left: 32px; right: 32px; z-index: 2; }
  .hero-src { display: inline-block; background: rgba(255,255,255,0.18); backdrop-filter: blur(12px); padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; margin-bottom: 12px; }
  .hero h2 { font-size: 42px; line-height: 1.05; letter-spacing: -0.02em; font-weight: 700; max-width: 60%; margin: 0; color: #fff; }

  .rail { margin-bottom: 36px; }
  .rail-head { display: flex; justify-content: space-between; align-items: baseline; padding: 0 48px 12px; }
  .rail-title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: center; gap: 10px; }
  .src-badge { background: rgba(255,255,255,0.1); color: #fff; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; padding: 2px 7px; border-radius: 3px; }
  .rail-count { color: #71717a; font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
  .rail-track { display: flex; gap: 14px; overflow-x: auto; padding: 0 48px 8px; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .rail-track::-webkit-scrollbar { display: none; }

  .tile { flex-shrink: 0; scroll-snap-align: start; width: 320px; }
  .tile .thumb-box { aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; background: #1a1a1f; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .tile h4 { font-size: 13px; font-weight: 500; margin: 8px 2px 0; padding: 0; color: #f5f5f7; letter-spacing: -0.005em; line-height: 1.35; }

  @media (max-width: 768px) {
    header.site { padding: 0 16px 16px; }
    .hero { margin: 0 16px 24px; }
    .hero h2 { font-size: 24px; max-width: 100%; }
    .hero-meta { left: 16px; right: 16px; bottom: 16px; }
    .rail-head { padding: 0 16px 10px; }
    .rail-track { padding: 0 16px 8px; gap: 10px; }
    .tile { width: 240px; }
  }`;

  // Hero: first item from first source group (any source that has items).
  const first = ctx.sourceGroups[0];
  const hero = first ? first.items[0] : null;
  const heroHtml = hero ? `<a class="hero" href="${attr(hero.href)}" target="_blank" rel="noopener">
    ${hero.thumbnail ? thumbImg(hero) : ''}
    <div class="hero-meta">
      <span class="hero-src">FROM ${esc(srcLabel(first)).toUpperCase()}</span>
      <h2>${esc(hero.title)}</h2>
    </div>
  </a>` : '';

  // Each source becomes one rail. Skip the hero item from its source so we don't repeat it.
  const rails = ctx.sourceGroups.map((g, idx) => {
    const items = idx === 0 ? g.items.slice(1) : g.items;
    if (!items.length) return '';
    const tiles = items.map((i) => `<a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbOrPlaceholder(i)}</div>
      <h4>${esc(i.title)}</h4>
    </a>`).join('');
    return `<div class="rail">
      <div class="rail-head">
        <div class="rail-title"><span class="src-badge">${esc(srcLabel(g)).toUpperCase()}</span></div>
        <span class="rail-count">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div class="rail-track">${tiles}</div>
    </div>`;
  }).join('');

  const body = `<div class="wrap">
    <header class="site">
      <h1>${esc(ctx.title)}</h1>
      ${ctx.tagline ? `<div class="tagline">${esc(ctx.tagline)}</div>` : ''}
    </header>
    ${heroHtml}
    ${rails}
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 4) CONSOLE — terminal/IDE, source as // comment
// =====================================================
function buildConsole(ctx) {
  const css = `
  body { background: #0b0d10; color: #c6c8cc; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; line-height: 1.55; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
  header.site { border-bottom: 1px solid #1f2228; padding-bottom: 16px; margin-bottom: 24px; }
  .site h1 { color: #e6e6e7; font-size: 18px; font-weight: 600; letter-spacing: -0.005em; font-family: "Inter", system-ui, sans-serif; margin: 0; }
  .site .meta { margin-top: 6px; color: #6a7077; font-size: 12px; }
  .site .meta .accent { color: #61dafb; }

  .group { margin-bottom: 28px; }
  .group-comment { color: #5c6370; margin-bottom: 8px; font-size: 12px; white-space: nowrap; overflow: hidden; }
  .group-comment .tag { color: #98c379; }
  .group-comment .count { color: #d19a66; }

  .items { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .item { background: #11141a; border: 1px solid #1f2228; border-radius: 6px; padding: 12px; display: flex; gap: 10px; }
  .item:hover { background: #161a21; border-color: #2c3340; }
  .item .thumb-box { width: 60px; height: 60px; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: #1a1a1f; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .item .body { min-width: 0; flex: 1; }
  .item h3 { color: #e6e6e7; font-size: 13px; font-weight: 500; line-height: 1.35; font-family: "Inter", system-ui, sans-serif; letter-spacing: -0.005em; margin: 0 0 4px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .item .url { color: #61dafb; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .statusbar { margin-top: 40px; padding-top: 12px; border-top: 1px solid #1f2228; display: flex; justify-content: space-between; font-size: 11px; color: #5c6370; }
  .statusbar .left { display: flex; gap: 16px; }
  .statusbar .dot { color: #98c379; }
  @media (max-width: 900px) { .items { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .wrap { padding: 16px; } .items { grid-template-columns: 1fr; } }`;

  const sections = ctx.sourceGroups.map((g) => {
    const tiles = g.items.map((i) => `<a class="item" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbOrPlaceholder(i)}</div>
      <div class="body">
        <h3>${esc(i.title)}</h3>
        <div class="url">${esc(i.domain || '')}</div>
      </div>
    </a>`).join('');
    const dashes = '─'.repeat(60);
    return `<section class="group">
      <div class="group-comment">// <span class="tag">${esc(srcLabel(g)).toLowerCase().replace(/\s+/g, '-')}</span> <span class="count">[${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}]</span> ${dashes}</div>
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
    <div class="statusbar">
      <div class="left"><span class="dot">●</span> ready <span>${total} items</span> <span>${ctx.sourceGroups.length} sources</span></div>
      <div>linkforge</div>
    </div>
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 5) WALL — uniform-grid gallery, source as section header
// =====================================================
function buildWall(ctx) {
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

  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 700px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
  @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }`;

  const sections = ctx.sourceGroups.map((g) => {
    const tiles = g.items.map((i) => `<a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbOrPlaceholder(i)}</div>
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
  </div>`;

  return shell({ title: ctx.title, tagline: ctx.tagline, today: ctx.today, body, css });
}

// =====================================================
// 6) TIMELINE — vertical activity spine with date markers
// =====================================================
function buildTimeline(ctx) {
  const css = `
  body { background: #fff; color: #0f0f0f; font-family: "Inter", system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.55; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }
  header.site { margin-bottom: 32px; }
  .site h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
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
  .row .thumb-box { width: 80px; height: 60px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #f4f4f5; }
  .thumb-box img { width: 100%; height: 100%; object-fit: cover; }
  .row .body { min-width: 0; flex: 1; }
  .row h3 { font-size: 15px; font-weight: 500; line-height: 1.4; letter-spacing: -0.005em; color: #0f0f0f; margin: 0; }
  .row:hover h3 { color: #2563eb; }
  .row .meta { color: #a1a1aa; font-size: 12px; margin-top: 4px; font-family: ui-monospace, Menlo, monospace; }

  @media (max-width: 560px) {
    .wrap { padding: 24px 14px 60px; }
    .spine { padding-left: 22px; }
    .group::before { left: -22px; }
    .row .thumb-box { width: 60px; height: 48px; }
    .row h3 { font-size: 14px; }
  }`;

  const groups = ctx.sourceGroups.map((g) => {
    const rows = g.items.map((i) => `<a class="row" href="${attr(i.href)}" target="_blank" rel="noopener">
      <div class="thumb-box">${thumbOrPlaceholder(i)}</div>
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
    <div class="spine">${groups}</div>
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
  module.exports = { TEMPLATES, suggestTemplate };
}
