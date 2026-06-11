/* =====================================================
   LINKFORGE — output templates
   Each template is a self-contained function:
     buildXxx(ctx) -> { html: string }
   ctx = { title, tagline, articles, videos, gallery, links, all, today }
   Templates inline ALL CSS so the downloaded HTML is portable.
   ===================================================== */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const attr = esc;

// shared helpers
function mark(item) {
  return (item.domain || item.title || 'L').charAt(0).toUpperCase();
}

// ---------- registry ----------
const TEMPLATES = {
  editorial: {
    name: 'Editorial',
    desc: 'Big serif masthead with a hero article and tidy sections. Best for news, blogs, opinion.',
    fits: ['article'],
    preview: () => previewEditorial(),
    build: (ctx) => buildEditorial(ctx),
  },
  journal: {
    name: 'Journal',
    desc: 'Citation-style list with abstracts. Best for research papers, academic and reference links.',
    fits: ['link', 'article'],
    preview: () => previewJournal(),
    build: (ctx) => buildJournal(ctx),
  },
  gallery: {
    name: 'Gallery',
    desc: 'Edge-to-edge masonry of images. Best for photography, art, visual collections.',
    fits: ['gallery'],
    preview: () => previewGallery(),
    build: (ctx) => buildGallery(ctx),
  },
  screening: {
    name: 'Screening Room',
    desc: 'Dark, cinematic layout with large video cards. Best for video collections, talks, films.',
    fits: ['video'],
    preview: () => previewScreening(),
    build: (ctx) => buildScreening(ctx),
  },
  linklog: {
    name: 'Linklog',
    desc: 'Dense, readable list in the style of a curated bookmark log. Best for reading lists, link blogs.',
    fits: ['link'],
    preview: () => previewLinklog(),
    build: (ctx) => buildLinklog(ctx),
  },
  showcase: {
    name: 'Showcase',
    desc: 'Bento grid mixing tile sizes. Best for mixed-media portfolios, project pages.',
    fits: ['article', 'video', 'gallery'],
    preview: () => previewShowcase(),
    build: (ctx) => buildShowcase(ctx),
  },
};

// Pick the best default template based on content mix
function suggestTemplate(counts) {
  // counts = { article, video, gallery, link, total }
  const t = counts.total || 1;
  if (counts.video / t >= 0.5) return 'screening';
  if (counts.gallery / t >= 0.5) return 'gallery';
  if (counts.link / t >= 0.6 && counts.article + counts.video + counts.gallery < counts.link) return 'linklog';
  if (counts.article / t >= 0.5 && counts.video + counts.gallery > 0) return 'showcase';
  if (counts.article / t >= 0.5) return 'editorial';
  if (counts.link >= counts.article) return 'journal';
  return 'editorial';
}

// ============================================================
// SHARED CSS BASE — used by all templates, then overridden
// ============================================================

const baseCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  img { display: block; max-width: 100%; height: auto; }
  a { color: inherit; text-decoration: none; }
  button { font: inherit; cursor: pointer; }
`;

// Shared theme-toggle button (button HTML + paired JS).
// Templates that use this:
//   1. include themeToggleButton in their <body>
//   2. include themeToggleScript before </body>
//   3. scope their dark-mode CSS to both `:root[data-theme="dark"]` AND
//      `@media(prefers-color-scheme:dark){:root:not([data-theme="light"])}` so the
//      OS default still wins until the user clicks the toggle.
const themeToggleButton = `<button class="theme-toggle" data-theme-toggle aria-label="Toggle theme" type="button"><svg class="theme-toggle__sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg><svg class="theme-toggle__moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></button>`;

const themeToggleCSS = `
.theme-toggle{position:fixed;top:1rem;right:1rem;z-index:1000;width:38px;height:38px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--divider,rgba(0,0,0,.15));background:var(--surface,#fff);color:var(--text,#111);transition:transform .2s,background .2s,border-color .2s;backdrop-filter:blur(8px)}
.theme-toggle:hover{transform:scale(1.05)}
.theme-toggle svg{position:absolute;transition:opacity .2s,transform .25s}
.theme-toggle .theme-toggle__sun{opacity:0;transform:rotate(-30deg) scale(.6)}
.theme-toggle .theme-toggle__moon{opacity:1;transform:rotate(0) scale(1)}
:root[data-theme="dark"] .theme-toggle .theme-toggle__sun{opacity:1;transform:rotate(0) scale(1)}
:root[data-theme="dark"] .theme-toggle .theme-toggle__moon{opacity:0;transform:rotate(30deg) scale(.6)}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .theme-toggle .theme-toggle__sun{opacity:1;transform:rotate(0) scale(1)}:root:not([data-theme="light"]) .theme-toggle .theme-toggle__moon{opacity:0;transform:rotate(30deg) scale(.6)}}
`;

// In-memory theme toggle (no persistence to avoid the preview-iframe storage
// validator). Each page load starts from system preference, user can flip
// with the toggle button. Persistence will be added when this is wired into
// real templates in the next iteration.
const themeToggleScript = `<script>(function(){var r=document.documentElement;document.addEventListener('click',function(e){var b=e.target.closest('[data-theme-toggle]');if(!b)return;var cur=r.getAttribute('data-theme');var sysDark=matchMedia('(prefers-color-scheme:dark)').matches;var isDark=cur?cur==='dark':sysDark;r.setAttribute('data-theme',isDark?'light':'dark')});})();</script>`;

// ============================================================
// 1. EDITORIAL — newspaper / blog
// ============================================================

function buildEditorial(ctx) {
  const { title, tagline, articles, videos, gallery, links, today } = ctx;
  const hero = articles.find((a) => a.thumbnail) || articles[0] || videos[0] || ctx.all[0];
  const rest = articles.filter((a) => a !== hero);

  const card = (i, isVideo) => {
    const media = i.thumbnail
      ? `<div class="card__media ${isVideo ? 'card__media--video' : ''}"><img src="${attr(i.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('card__media--empty');this.remove();"/>${isVideo ? '<div class="card__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : ''}</div>`
      : `<div class="card__media card__media--empty"><span class="card__mark">${esc(mark(i))}</span></div>`;
    return `<a class="card" href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">${media}<div class="card__body"><span class="kicker">${esc(i.sourceName)} · ${esc(i.domain)}</span><p class="card__title">${esc(i.title)}</p></div></a>`;
  };

  const section = (title, items, isVideo = false) => `
    <section class="section">
      <h3 class="section__title">${esc(title)}<span class="section__count">${items.length}</span></h3>
      <div class="grid">${items.map((i) => card(i, isVideo)).join('')}</div>
    </section>`;

  const linkRows = links.map((i) => `
    <li><a href="${attr(i.href)}" target="_blank" rel="noopener noreferrer"><span>${esc(i.title)}</span><span class="link-list__src">${esc(i.domain)}</span></a></li>
  `).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<meta name="description" content="${attr(tagline)}"/>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin/>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=gambarino@400&display=swap" rel="stylesheet"/>
<style>${baseCSS}
:root{--bg:#f5f3ee;--surface:#fbfaf6;--offset:#ebe8df;--text:#1a1a17;--muted:#6b665a;--faint:#a39c8a;--divider:#d9d4c5;--accent:#c63b1e;--fd:'Gambarino','Iowan Old Style',Georgia,serif;--fb:'Satoshi',-apple-system,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#15140f;--surface:#1c1a14;--offset:#2a261c;--text:#ebe5d3;--muted:#8a8472;--faint:#5a5446;--divider:#2d2920;--accent:#ff6b4a}}
body{font-family:var(--fb);background:var(--bg);color:var(--text);line-height:1.55;padding:clamp(1rem,4vw,3rem);max-width:1320px;margin:0 auto}
.masthead{border-bottom:2px solid var(--text);padding-bottom:1.5rem;margin-bottom:2.5rem}
.masthead__top{display:flex;justify-content:space-between;font-size:.75rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:1rem}
.masthead__title{font-family:var(--fd);font-size:clamp(2.5rem,6vw,5rem);font-weight:400;letter-spacing:-.02em;line-height:1}
.masthead__tagline{margin-top:.75rem;color:var(--muted);font-size:1.125rem;font-style:italic;font-family:var(--fd)}
.hero{display:grid;grid-template-columns:1.4fr 1fr;gap:2.5rem;align-items:center;padding:2rem 0;margin-bottom:3rem;border-bottom:1px solid var(--divider);transition:opacity .2s}
.hero:hover{opacity:.85}
@media(max-width:800px){.hero{grid-template-columns:1fr;gap:1.5rem}}
.hero__img{aspect-ratio:4/3;overflow:hidden;background:var(--offset);border-radius:4px}
.hero__img img{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}
.hero:hover .hero__img img{transform:scale(1.03)}
.kicker{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);font-weight:500;margin-bottom:.75rem}
.hero__title{font-family:var(--fd);font-size:clamp(1.75rem,3.5vw,2.75rem);font-weight:400;letter-spacing:-.01em;line-height:1.1;margin-bottom:1rem}
.hero__cta{display:inline-block;font-size:.875rem;font-weight:500;color:var(--accent);border-bottom:1px solid currentColor;padding-bottom:2px}
.section{margin:3rem 0}
.section__title{font-family:var(--fd);font-size:1.5rem;font-weight:400;margin-bottom:1.5rem;padding-bottom:.75rem;border-bottom:1px solid var(--text);display:flex;align-items:baseline;justify-content:space-between}
.section__count{font-size:.75rem;color:var(--faint);font-family:var(--fb);text-transform:uppercase;letter-spacing:.1em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.5rem}
.card{display:block;background:var(--surface);border-radius:6px;overflow:hidden;border:1px solid var(--divider);transition:transform .25s,border-color .25s,box-shadow .25s}
.card:hover{transform:translateY(-3px);border-color:var(--muted);box-shadow:0 12px 28px rgba(0,0,0,.08)}
.card__media{aspect-ratio:16/10;overflow:hidden;background:var(--offset);position:relative}
.card__media img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.card:hover .card__media img{transform:scale(1.04)}
.card__media--video::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(0,0,0,.55))}
.card__media--empty{display:grid;place-items:center;background:linear-gradient(135deg,var(--offset),var(--surface))}
.card__mark{font-family:var(--fd);font-size:3rem;color:var(--faint)}
.card__play{position:absolute;inset:0;display:grid;place-items:center;z-index:1}
.card__play svg{width:44px;height:44px;color:#fff;filter:drop-shadow(0 3px 10px rgba(0,0,0,.5))}
.card__body{padding:1rem 1.125rem 1.25rem}
.card__title{font-size:1rem;font-weight:500;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.link-list{list-style:none;border-top:1px solid var(--divider)}
.link-list li{border-bottom:1px solid var(--divider)}
.link-list a{display:flex;justify-content:space-between;gap:1.5rem;padding:1rem 0;transition:padding .2s}
.link-list a:hover{padding-left:.75rem;color:var(--accent)}
.link-list__src{font-size:.75rem;color:var(--faint);text-transform:uppercase;letter-spacing:.1em;white-space:nowrap}
.footer{margin-top:4rem;padding-top:1.5rem;border-top:1px solid var(--divider);font-size:.75rem;color:var(--muted);text-align:center}
</style></head><body>
<header class="masthead">
  <div class="masthead__top"><span>${esc(today)}</span><span>${ctx.all.length} ${ctx.all.length === 1 ? 'item' : 'items'}</span></div>
  <h1 class="masthead__title">${esc(title)}</h1>
  ${tagline ? `<p class="masthead__tagline">${esc(tagline)}</p>` : ''}
</header>
${hero ? `<a class="hero" href="${attr(hero.href)}" target="_blank" rel="noopener noreferrer">${hero.thumbnail ? `<div class="hero__img"><img src="${attr(hero.thumbnail)}" alt=""/></div>` : ''}<div><span class="kicker">${esc(hero.sourceName)} · ${esc(hero.domain)}</span><h2 class="hero__title">${esc(hero.title)}</h2><span class="hero__cta">Read story →</span></div></a>` : ''}
${rest.length ? section('Articles', rest) : ''}
${videos.length ? section('Watch', videos, true) : ''}
${gallery.length ? section('Visuals', gallery) : ''}
${links.length ? `<section class="section"><h3 class="section__title">More reading<span class="section__count">${links.length}</span></h3><ul class="link-list">${linkRows}</ul></section>` : ''}
<footer class="footer">Compiled with Linkforge · ${new Date().getFullYear()}</footer>
</body></html>`;
}

// ============================================================
// 2. JOURNAL — academic / research
// ============================================================

function buildJournal(ctx) {
  const { title, tagline, all, today } = ctx;
  // group by source
  const groups = {};
  for (const i of all) (groups[i.sourceName] ||= []).push(i);

  const entries = (items) => items.map((i, idx) => `
    <li class="entry">
      <div class="entry__num">${String(idx + 1).padStart(2, '0')}</div>
      <div class="entry__body">
        <a class="entry__title" href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a>
        <div class="entry__meta">
          <span class="entry__src">${esc(i.domain)}</span>
          <span class="entry__type">${esc(i.category)}</span>
        </div>
      </div>
    </li>
  `).join('');

  const groupBlocks = Object.entries(groups).map(([name, items]) => `
    <section class="group">
      <header class="group__head">
        <h2 class="group__name">${esc(name)}</h2>
        <span class="group__count">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</span>
      </header>
      <ol class="entries">${entries(items)}</ol>
    </section>
  `).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin/>
<link href="https://api.fontshare.com/v2/css?f[]=gambarino@400&f[]=satoshi@400,500&display=swap" rel="stylesheet"/>
<style>${baseCSS}
:root{--bg:#fbfaf6;--paper:#fff;--ink:#1a1a17;--muted:#6b665a;--faint:#a39c8a;--rule:#e8e3d4;--accent:#5a3f2b;--fd:'Gambarino',Georgia,serif;--fb:'Satoshi',-apple-system,sans-serif;--fm:'Iowan Old Style',Georgia,serif}
@media(prefers-color-scheme:dark){:root{--bg:#15140f;--paper:#1a1814;--ink:#ebe5d3;--muted:#8a8472;--faint:#5a5446;--rule:#2d2920;--accent:#d4a574}}
body{font-family:var(--fb);background:var(--bg);color:var(--ink);line-height:1.6;padding:clamp(1.5rem,4vw,4rem) clamp(1rem,4vw,3rem);max-width:880px;margin:0 auto}
.masthead{text-align:center;padding-bottom:2.5rem;margin-bottom:3rem;border-bottom:3px double var(--ink)}
.masthead__eyebrow{font-size:.7rem;text-transform:uppercase;letter-spacing:.3em;color:var(--muted);margin-bottom:1rem}
.masthead__title{font-family:var(--fd);font-size:clamp(2rem,5vw,3.5rem);font-weight:400;letter-spacing:-.01em;line-height:1.05}
.masthead__tagline{font-family:var(--fd);font-style:italic;color:var(--muted);font-size:1.125rem;margin-top:.75rem}
.masthead__date{font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;color:var(--faint);margin-top:1.5rem}
.group{margin-bottom:3.5rem}
.group__head{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:.75rem;margin-bottom:1.5rem;border-bottom:1px solid var(--ink)}
.group__name{font-family:var(--fd);font-size:1.5rem;font-weight:400;font-style:italic}
.group__count{font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--faint)}
.entries{list-style:none}
.entry{display:grid;grid-template-columns:48px 1fr;gap:1.5rem;padding:1.25rem 0;border-bottom:1px solid var(--rule);align-items:start}
.entry:last-child{border-bottom:0}
.entry__num{font-family:var(--fm);font-size:1.5rem;color:var(--faint);font-style:italic;line-height:1}
.entry__title{font-family:var(--fm);font-size:1.125rem;line-height:1.4;color:var(--ink);display:block;margin-bottom:.4rem;border-bottom:1px solid transparent;transition:border-color .2s}
.entry__title:hover{border-bottom-color:var(--accent);color:var(--accent)}
.entry__meta{display:flex;gap:1rem;font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.entry__type{color:var(--accent);font-weight:500}
.footer{margin-top:4rem;padding-top:2rem;border-top:3px double var(--ink);text-align:center;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
</style></head><body>
<header class="masthead">
  <div class="masthead__eyebrow">A compendium</div>
  <h1 class="masthead__title">${esc(title)}</h1>
  ${tagline ? `<p class="masthead__tagline">${esc(tagline)}</p>` : ''}
  <div class="masthead__date">${esc(today)} · ${all.length} entries</div>
</header>
${groupBlocks}
<footer class="footer">Compiled with Linkforge · ${new Date().getFullYear()}</footer>
</body></html>`;
}

// ============================================================
// 3. GALLERY — image-first
// ============================================================

function buildGallery(ctx) {
  const { title, tagline, all, today } = ctx;
  // every item with a thumbnail becomes a tile; group by source
  const tiles = all.filter((i) => i.thumbnail);
  const noThumb = all.filter((i) => !i.thumbnail);

  const tileHtml = tiles.map((i) => `
    <a class="tile" href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">
      <img src="${attr(i.thumbnail)}" alt="${attr(i.title)}" loading="lazy" onerror="this.parentElement.style.display='none'"/>
      <div class="tile__overlay">
        <span class="tile__src">${esc(i.sourceName)} · ${esc(i.domain)}</span>
        <span class="tile__title">${esc(i.title)}</span>
      </div>
    </a>
  `).join('');

  const noThumbList = noThumb.length ? `<section class="extras">
    <h3>Also</h3>
    <ul>${noThumb.map((i) => `<li><a href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">${esc(i.title)} <span>${esc(i.domain)}</span></a></li>`).join('')}</ul>
  </section>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin/>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet"/>
<style>${baseCSS}
:root{--bg:#0e0e0c;--text:#f5f3ee;--muted:#a39c8a;--accent:#fff;--fb:'Satoshi',-apple-system,sans-serif}
body{font-family:var(--fb);background:var(--bg);color:var(--text);min-height:100vh}
.masthead{padding:clamp(2rem,6vw,4rem) clamp(1rem,4vw,3rem) 2rem;text-align:center}
.masthead__title{font-size:clamp(2rem,5vw,3.5rem);font-weight:700;letter-spacing:-.03em;line-height:1}
.masthead__tagline{color:var(--muted);font-size:1rem;margin-top:.75rem;max-width:48ch;margin-inline:auto}
.masthead__meta{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:1.5rem}
.gallery{column-count:4;column-gap:4px;padding:0 4px 4px}
@media(max-width:1100px){.gallery{column-count:3}}
@media(max-width:700px){.gallery{column-count:2}}
@media(max-width:480px){.gallery{column-count:1}}
.tile{position:relative;display:block;break-inside:avoid;margin-bottom:4px;overflow:hidden;background:#1a1916}
.tile img{width:100%;height:auto;display:block;transition:transform .6s ease}
.tile:hover img{transform:scale(1.04)}
.tile__overlay{position:absolute;inset:auto 0 0 0;padding:1.25rem 1rem .75rem;background:linear-gradient(transparent,rgba(0,0,0,.85));opacity:0;transition:opacity .25s;color:#fff}
.tile:hover .tile__overlay{opacity:1}
.tile__src{display:block;font-size:.65rem;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.7);margin-bottom:.25rem}
.tile__title{display:block;font-size:.875rem;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.extras{padding:4rem clamp(1rem,4vw,3rem);max-width:880px;margin:0 auto}
.extras h3{font-size:.7rem;text-transform:uppercase;letter-spacing:.2em;color:var(--muted);margin-bottom:1.5rem}
.extras ul{list-style:none}
.extras li{border-bottom:1px solid rgba(255,255,255,.08)}
.extras a{display:flex;justify-content:space-between;padding:1rem 0;font-size:.95rem;transition:color .2s}
.extras a:hover{color:var(--accent)}
.extras a span{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.footer{padding:2rem;text-align:center;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);border-top:1px solid rgba(255,255,255,.08)}
</style></head><body>
<header class="masthead">
  <h1 class="masthead__title">${esc(title)}</h1>
  ${tagline ? `<p class="masthead__tagline">${esc(tagline)}</p>` : ''}
  <div class="masthead__meta">${esc(today)} · ${tiles.length} visuals</div>
</header>
<div class="gallery">${tileHtml}</div>
${noThumbList}
<footer class="footer">Linkforge · ${new Date().getFullYear()}</footer>
</body></html>`;
}

// ============================================================
// 4. SCREENING ROOM — video-first, dark cinematic
// ============================================================

function buildScreening(ctx) {
  const { title, tagline, all, videos, today } = ctx;
  // promote videos to top; mix in articles/gallery below
  const featured = videos[0] || all.find((i) => i.thumbnail);
  const restVideos = videos.filter((v) => v !== featured);
  const other = all.filter((i) => i.category !== 'video');

  const vcard = (i) => `
    <a class="vcard" href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">
      <div class="vcard__media">
        ${i.thumbnail ? `<img src="${attr(i.thumbnail)}" alt="" loading="lazy"/>` : `<div class="vcard__empty">${esc(mark(i))}</div>`}
        <div class="vcard__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
      </div>
      <div class="vcard__body">
        <span class="vcard__src">${esc(i.sourceName)} · ${esc(i.domain)}</span>
        <h3 class="vcard__title">${esc(i.title)}</h3>
      </div>
    </a>
  `;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin/>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet"/>
<style>${baseCSS}
:root{--bg:#0a0a0a;--surface:#141414;--surface-2:#1c1c1c;--text:#f5f5f5;--muted:#888;--faint:#555;--accent:#ff3d3d;--fb:'Satoshi',-apple-system,sans-serif}
body{font-family:var(--fb);background:var(--bg);color:var(--text);padding:clamp(1.5rem,4vw,3rem);max-width:1400px;margin:0 auto;min-height:100vh}
.masthead{padding-bottom:2.5rem;margin-bottom:2.5rem;border-bottom:1px solid #222}
.masthead__top{display:flex;justify-content:space-between;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
.masthead__top .live{display:inline-flex;align-items:center;gap:.5rem}
.masthead__top .live::before{content:'';width:8px;height:8px;background:var(--accent);border-radius:50%;animation:pulse 1.6s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.masthead__title{font-size:clamp(2rem,5vw,3.5rem);font-weight:700;letter-spacing:-.03em;line-height:1}
.masthead__tagline{color:var(--muted);font-size:1rem;margin-top:.75rem;max-width:48ch}
.featured{margin-bottom:3rem}
.featured a{display:block;position:relative;aspect-ratio:21/9;overflow:hidden;border-radius:8px;background:var(--surface)}
.featured img{width:100%;height:100%;object-fit:cover}
.featured__overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(1.5rem,4vw,3rem);background:linear-gradient(to top,rgba(0,0,0,.95) 0%,rgba(0,0,0,.5) 50%,transparent 100%);color:#fff}
.featured__kicker{display:inline-flex;align-items:center;gap:.5rem;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);font-weight:500;margin-bottom:1rem}
.featured__title{font-size:clamp(1.5rem,3.5vw,2.5rem);font-weight:700;letter-spacing:-.02em;line-height:1.1;max-width:24ch}
.featured__meta{margin-top:1rem;font-size:.875rem;color:var(--muted)}
.featured__play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80px;height:80px;border-radius:50%;background:rgba(0,0,0,.6);display:grid;place-items:center;backdrop-filter:blur(8px);border:2px solid rgba(255,255,255,.3);transition:transform .25s,background .25s}
.featured a:hover .featured__play{transform:translate(-50%,-50%) scale(1.1);background:var(--accent);border-color:var(--accent)}
.featured__play svg{width:32px;height:32px;color:#fff;margin-left:4px}
.section-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:.75rem;border-bottom:1px solid #222}
.section-head h2{font-size:1.125rem;font-weight:600;letter-spacing:-.01em}
.section-head .count{font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--faint)}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.5rem;margin-bottom:3rem}
.vcard{display:block;transition:transform .25s}
.vcard:hover{transform:translateY(-3px)}
.vcard__media{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:6px;background:var(--surface);margin-bottom:.875rem}
.vcard__media img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.vcard:hover .vcard__media img{transform:scale(1.05)}
.vcard__media::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 60%,rgba(0,0,0,.7));pointer-events:none}
.vcard__empty{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(135deg,var(--surface),var(--surface-2));font-size:3rem;color:var(--faint);font-weight:700}
.vcard__play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.7);display:grid;place-items:center;transition:transform .25s,background .25s;z-index:1}
.vcard:hover .vcard__play{background:var(--accent);transform:translate(-50%,-50%) scale(1.1)}
.vcard__play svg{width:20px;height:20px;color:#fff;margin-left:2px}
.vcard__src{display:block;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem}
.vcard__title{font-size:.95rem;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.footer{margin-top:4rem;padding-top:1.5rem;border-top:1px solid #222;text-align:center;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
</style></head><body>
<header class="masthead">
  <div class="masthead__top"><span class="live">Now showing</span><span>${esc(today)} · ${videos.length} videos</span></div>
  <h1 class="masthead__title">${esc(title)}</h1>
  ${tagline ? `<p class="masthead__tagline">${esc(tagline)}</p>` : ''}
</header>
${featured ? `<section class="featured">
  <a href="${attr(featured.href)}" target="_blank" rel="noopener noreferrer">
    ${featured.thumbnail ? `<img src="${attr(featured.thumbnail)}" alt=""/>` : ''}
    <div class="featured__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
    <div class="featured__overlay">
      <span class="featured__kicker">Featured · ${esc(featured.sourceName)}</span>
      <h2 class="featured__title">${esc(featured.title)}</h2>
      <div class="featured__meta">${esc(featured.domain)}</div>
    </div>
  </a>
</section>` : ''}
${restVideos.length ? `<div class="section-head"><h2>More to watch</h2><span class="count">${restVideos.length} videos</span></div><div class="vgrid">${restVideos.map(vcard).join('')}</div>` : ''}
${other.length ? `<div class="section-head"><h2>Adjacent</h2><span class="count">${other.length} items</span></div><div class="vgrid">${other.map(vcard).join('')}</div>` : ''}
<footer class="footer">Linkforge · ${new Date().getFullYear()}</footer>
</body></html>`;
}

// ============================================================
// 5. LINKLOG — dense reading list (Daring Fireball / Pinboard)
// ============================================================

function buildLinklog(ctx) {
  const { title, tagline, all, today } = ctx;

  const groups = {};
  for (const i of all) (groups[i.sourceName] ||= []).push(i);

  const items = (list) => list.map((i) => `
    <article class="post">
      <h2 class="post__title"><a href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a> <span class="post__star">★</span></h2>
      <div class="post__meta">
        <a href="${attr(i.href)}" target="_blank" rel="noopener noreferrer" class="post__permalink">${esc(i.domain)}</a>
        <span class="post__type">${esc(i.category)}</span>
        <span class="post__src">via ${esc(i.sourceName)}</span>
      </div>
    </article>
  `).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin/>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500&display=swap" rel="stylesheet"/>
<style>${baseCSS}
:root{--bg:#fdfcf9;--surface:#fff;--ink:#1a1a17;--muted:#6b665a;--faint:#a39c8a;--rule:#e8e3d4;--accent:#0e7c66;--fb:'Satoshi',-apple-system,sans-serif;--fm:'Iowan Old Style',Georgia,serif}
@media(prefers-color-scheme:dark){:root{--bg:#15140f;--surface:#1c1a14;--ink:#ebe5d3;--muted:#8a8472;--faint:#5a5446;--rule:#2d2920;--accent:#5fb8a3}}
body{font-family:var(--fb);background:var(--bg);color:var(--ink);line-height:1.55;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,2rem);max-width:680px;margin:0 auto}
.masthead{padding-bottom:1.5rem;margin-bottom:2rem;border-bottom:1px solid var(--rule)}
.masthead__title{font-size:1.5rem;font-weight:700;letter-spacing:-.01em}
.masthead__tagline{color:var(--muted);font-size:.95rem;margin-top:.25rem}
.masthead__meta{font-size:.75rem;color:var(--faint);margin-top:.75rem;letter-spacing:.05em}
.day-head{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin:2.5rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid var(--rule)}
.post{padding:1.25rem 0;border-bottom:1px solid var(--rule)}
.post:last-child{border-bottom:0}
.post__title{font-family:var(--fm);font-size:1.25rem;font-weight:500;line-height:1.35;margin-bottom:.5rem}
.post__title a{color:var(--ink);border-bottom:1px solid transparent;transition:border-color .2s,color .2s}
.post__title a:hover{color:var(--accent);border-bottom-color:var(--accent)}
.post__star{color:var(--accent);font-size:.9em;margin-left:.25rem}
.post__meta{font-size:.8rem;color:var(--muted);display:flex;gap:1rem;flex-wrap:wrap;align-items:center}
.post__permalink{color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;transition:color .2s}
.post__permalink:hover{color:var(--accent)}
.post__type{padding:1px 8px;background:var(--rule);border-radius:999px;font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.post__src{font-style:italic;color:var(--faint);font-size:.75rem}
.footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--rule);font-size:.75rem;color:var(--muted);text-align:center}
</style></head><body>
<header class="masthead">
  <h1 class="masthead__title">${esc(title)}</h1>
  ${tagline ? `<p class="masthead__tagline">${esc(tagline)}</p>` : ''}
  <div class="masthead__meta">${esc(today)} · ${all.length} links</div>
</header>
${Object.entries(groups).map(([name, list]) => `<div class="day-head">${esc(name)}</div>${items(list)}`).join('')}
<footer class="footer">Linkforge · ${new Date().getFullYear()}</footer>
</body></html>`;
}

// ============================================================
// 6. SHOWCASE — bento mixed
// ============================================================

function buildShowcase(ctx) {
  const { title, tagline, all, today } = ctx;
  // assign tile sizes — larger for items with thumbnails, smaller for plain links
  const tiles = all.map((i, idx) => {
    let size = 'sm';
    if (i.thumbnail && idx % 7 === 0) size = 'xl';
    else if (i.thumbnail && idx % 5 === 0) size = 'lg';
    else if (i.thumbnail) size = 'md';
    return { ...i, size };
  });

  const tile = (i) => {
    const isVideo = i.category === 'video';
    const media = i.thumbnail
      ? `<div class="bento__media ${isVideo ? 'bento__media--video' : ''}"><img src="${attr(i.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('bento__media--empty');this.remove();"/>${isVideo ? '<div class="bento__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : ''}</div>`
      : `<div class="bento__media bento__media--empty"><span class="bento__mark">${esc(mark(i))}</span></div>`;
    return `<a class="bento bento--${i.size}" href="${attr(i.href)}" target="_blank" rel="noopener noreferrer">
      ${media}
      <div class="bento__body">
        <span class="bento__src">${esc(i.sourceName)} · ${esc(i.domain)}</span>
        <h3 class="bento__title">${esc(i.title)}</h3>
        <span class="bento__type">${esc(i.category)}</span>
      </div>
    </a>`;
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin/>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=gambarino@400&display=swap" rel="stylesheet"/>
<style>${baseCSS}
:root{--bg:#f4f2ed;--surface:#fff;--ink:#15140f;--muted:#6b665a;--faint:#a39c8a;--accent:#7c3aed;--fd:'Gambarino',Georgia,serif;--fb:'Satoshi',-apple-system,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#0e0c14;--surface:#181522;--ink:#f5f3ee;--muted:#8a8290;--faint:#5a546b;--accent:#a78bfa}}
body{font-family:var(--fb);background:var(--bg);color:var(--ink);padding:clamp(1.5rem,4vw,3rem);max-width:1400px;margin:0 auto}
.masthead{margin-bottom:2.5rem;display:grid;grid-template-columns:1fr auto;align-items:end;gap:2rem;padding-bottom:2rem;border-bottom:1px solid var(--ink)}
.masthead__title{font-family:var(--fd);font-size:clamp(2.5rem,6vw,5rem);font-weight:400;letter-spacing:-.03em;line-height:.95}
.masthead__tagline{font-size:1rem;color:var(--muted);margin-top:.75rem;max-width:48ch}
.masthead__meta{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);text-align:right;white-space:nowrap}
@media(max-width:700px){.masthead{grid-template-columns:1fr}.masthead__meta{text-align:left}}
.grid{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:140px;grid-auto-flow:dense;gap:.875rem}
@media(max-width:1000px){.grid{grid-template-columns:repeat(6,1fr)}}
@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr);grid-auto-rows:160px}}
.bento{display:flex;flex-direction:column;background:var(--surface);border-radius:14px;overflow:hidden;position:relative;transition:transform .25s,box-shadow .25s;color:var(--ink)}
.bento:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(0,0,0,.1)}
.bento--sm{grid-column:span 3;grid-row:span 1}
.bento--md{grid-column:span 4;grid-row:span 2}
.bento--lg{grid-column:span 6;grid-row:span 2}
.bento--xl{grid-column:span 8;grid-row:span 3}
@media(max-width:1000px){.bento--sm{grid-column:span 3}.bento--md{grid-column:span 3}.bento--lg{grid-column:span 6}.bento--xl{grid-column:span 6}}
@media(max-width:600px){.bento--sm,.bento--md,.bento--lg,.bento--xl{grid-column:span 2;grid-row:span 1}}
.bento__media{flex:1;position:relative;overflow:hidden;background:linear-gradient(135deg,var(--bg),color-mix(in oklab,var(--accent) 8%,var(--bg)))}
.bento__media img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.bento:hover .bento__media img{transform:scale(1.05)}
.bento__media--video::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(0,0,0,.5))}
.bento__media--empty{display:grid;place-items:center}
.bento__mark{font-family:var(--fd);font-size:3rem;color:var(--faint)}
.bento__play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.6);display:grid;place-items:center;z-index:1}
.bento__play svg{width:20px;height:20px;color:#fff;margin-left:2px}
.bento__body{padding:.875rem 1rem 1rem;background:var(--surface)}
.bento__src{display:block;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem}
.bento__title{font-family:var(--fd);font-size:.95rem;font-weight:400;line-height:1.25;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.3rem}
.bento--lg .bento__title,.bento--xl .bento__title{font-size:1.25rem;-webkit-line-clamp:3}
.bento__type{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:500}
.footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--faint);text-align:center;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
</style></head><body>
<header class="masthead">
  <div><h1 class="masthead__title">${esc(title)}</h1>${tagline ? `<p class="masthead__tagline">${esc(tagline)}</p>` : ''}</div>
  <div class="masthead__meta">${esc(today)}<br>${all.length} pieces</div>
</header>
<div class="grid">${tiles.map(tile).join('')}</div>
<footer class="footer">Linkforge · ${new Date().getFullYear()}</footer>
</body></html>`;
}

// ============================================================
// SVG MINI-PREVIEWS (shown in the template picker)
// ============================================================

function previewEditorial() {
  return `<svg viewBox="0 0 220 137" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="220" height="137" fill="#f5f3ee"/>
    <rect x="14" y="14" width="80" height="6" fill="#1a1a17"/>
    <rect x="14" y="24" width="50" height="3" fill="#c63b1e"/>
    <line x1="14" y1="34" x2="206" y2="34" stroke="#1a1a17" stroke-width="1"/>
    <rect x="14" y="44" width="84" height="60" fill="#d4c7a8"/>
    <rect x="108" y="48" width="40" height="2.5" fill="#c63b1e"/>
    <rect x="108" y="56" width="98" height="5" fill="#1a1a17"/>
    <rect x="108" y="65" width="80" height="5" fill="#1a1a17"/>
    <rect x="108" y="80" width="50" height="2" fill="#6b665a"/>
    <rect x="108" y="86" width="80" height="2" fill="#6b665a"/>
    <rect x="108" y="92" width="60" height="2" fill="#6b665a"/>
    <line x1="14" y1="114" x2="206" y2="114" stroke="#d9d4c5"/>
    <rect x="14" y="120" width="55" height="10" fill="#cac3ad"/>
    <rect x="83" y="120" width="55" height="10" fill="#cac3ad"/>
    <rect x="152" y="120" width="55" height="10" fill="#cac3ad"/>
  </svg>`;
}

function previewJournal() {
  return `<svg viewBox="0 0 220 137" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="220" height="137" fill="#fbfaf6"/>
    <rect x="78" y="14" width="64" height="3" fill="#a39c8a"/>
    <rect x="60" y="22" width="100" height="8" fill="#1a1a17"/>
    <line x1="40" y1="38" x2="180" y2="38" stroke="#1a1a17" stroke-width="1.5"/>
    <line x1="40" y1="40.5" x2="180" y2="40.5" stroke="#1a1a17" stroke-width="0.5"/>
    <rect x="40" y="52" width="14" height="3" fill="#a39c8a"/>
    <rect x="60" y="50" width="90" height="4" fill="#1a1a17"/>
    <rect x="60" y="58" width="50" height="2" fill="#6b665a"/>
    <line x1="40" y1="68" x2="180" y2="68" stroke="#e8e3d4"/>
    <rect x="40" y="76" width="14" height="3" fill="#a39c8a"/>
    <rect x="60" y="74" width="100" height="4" fill="#1a1a17"/>
    <rect x="60" y="82" width="45" height="2" fill="#6b665a"/>
    <line x1="40" y1="92" x2="180" y2="92" stroke="#e8e3d4"/>
    <rect x="40" y="100" width="14" height="3" fill="#a39c8a"/>
    <rect x="60" y="98" width="80" height="4" fill="#1a1a17"/>
    <rect x="60" y="106" width="55" height="2" fill="#6b665a"/>
  </svg>`;
}

function previewGallery() {
  return `<svg viewBox="0 0 220 137" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="220" height="137" fill="#0e0e0c"/>
    <rect x="80" y="10" width="60" height="6" fill="#f5f3ee"/>
    <rect x="6" y="24" width="50" height="46" fill="#3d3a32"/>
    <rect x="60" y="24" width="50" height="32" fill="#4f4a3e"/>
    <rect x="114" y="24" width="50" height="60" fill="#332e26"/>
    <rect x="168" y="24" width="46" height="40" fill="#42392c"/>
    <rect x="6" y="74" width="50" height="34" fill="#2e2a24"/>
    <rect x="60" y="60" width="50" height="48" fill="#3a352b"/>
    <rect x="114" y="88" width="50" height="20" fill="#46402f"/>
    <rect x="168" y="68" width="46" height="40" fill="#3d3a30"/>
    <rect x="6" y="112" width="50" height="20" fill="#332f29"/>
    <rect x="60" y="112" width="50" height="20" fill="#2a2620"/>
    <rect x="114" y="112" width="50" height="20" fill="#3a342a"/>
    <rect x="168" y="112" width="46" height="20" fill="#322e26"/>
  </svg>`;
}

function previewScreening() {
  return `<svg viewBox="0 0 220 137" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="220" height="137" fill="#0a0a0a"/>
    <rect x="14" y="10" width="36" height="3" fill="#ff3d3d"/>
    <rect x="14" y="17" width="68" height="6" fill="#f5f5f5"/>
    <rect x="14" y="32" width="192" height="56" fill="#1c1c1c" rx="3"/>
    <circle cx="110" cy="60" r="14" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    <path d="M105 53 L120 60 L105 67 Z" fill="#fff"/>
    <rect x="14" y="74" width="50" height="3" fill="#ff3d3d"/>
    <rect x="14" y="80" width="80" height="5" fill="#f5f5f5"/>
    <rect x="14" y="98" width="58" height="30" fill="#1c1c1c" rx="2"/>
    <rect x="78" y="98" width="58" height="30" fill="#1c1c1c" rx="2"/>
    <rect x="142" y="98" width="58" height="30" fill="#1c1c1c" rx="2"/>
    <circle cx="43" cy="113" r="5" fill="rgba(255,255,255,0.15)"/>
    <circle cx="107" cy="113" r="5" fill="rgba(255,255,255,0.15)"/>
    <circle cx="171" cy="113" r="5" fill="rgba(255,255,255,0.15)"/>
  </svg>`;
}

function previewLinklog() {
  return `<svg viewBox="0 0 220 137" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="220" height="137" fill="#fdfcf9"/>
    <rect x="40" y="14" width="50" height="5" fill="#1a1a17"/>
    <rect x="40" y="22" width="80" height="2" fill="#a39c8a"/>
    <line x1="40" y1="32" x2="180" y2="32" stroke="#e8e3d4"/>
    <rect x="40" y="40" width="36" height="3" fill="#a39c8a"/>
    <rect x="40" y="50" width="120" height="4" fill="#1a1a17"/>
    <rect x="40" y="58" width="40" height="2" fill="#6b665a"/>
    <rect x="86" y="58" width="20" height="2" fill="#0e7c66"/>
    <line x1="40" y1="68" x2="180" y2="68" stroke="#e8e3d4"/>
    <rect x="40" y="76" width="100" height="4" fill="#1a1a17"/>
    <rect x="40" y="84" width="35" height="2" fill="#6b665a"/>
    <rect x="81" y="84" width="20" height="2" fill="#0e7c66"/>
    <line x1="40" y1="94" x2="180" y2="94" stroke="#e8e3d4"/>
    <rect x="40" y="102" width="110" height="4" fill="#1a1a17"/>
    <rect x="40" y="110" width="38" height="2" fill="#6b665a"/>
    <rect x="84" y="110" width="20" height="2" fill="#0e7c66"/>
    <line x1="40" y1="120" x2="180" y2="120" stroke="#e8e3d4"/>
  </svg>`;
}

function previewShowcase() {
  return `<svg viewBox="0 0 220 137" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="220" height="137" fill="#f4f2ed"/>
    <rect x="14" y="10" width="80" height="6" fill="#15140f"/>
    <rect x="14" y="22" width="50" height="2" fill="#6b665a"/>
    <line x1="14" y1="30" x2="206" y2="30" stroke="#15140f" stroke-width="0.5"/>
    <rect x="14" y="38" width="80" height="50" rx="4" fill="#d4ccdf"/>
    <rect x="98" y="38" width="50" height="30" rx="4" fill="#7c3aed" opacity="0.3"/>
    <rect x="152" y="38" width="54" height="30" rx="4" fill="#c8c0d6"/>
    <rect x="98" y="72" width="50" height="16" rx="4" fill="#a59fb4"/>
    <rect x="152" y="72" width="54" height="16" rx="4" fill="#d4ccdf"/>
    <rect x="14" y="92" width="40" height="34" rx="4" fill="#c8c0d6"/>
    <rect x="58" y="92" width="56" height="34" rx="4" fill="#7c3aed" opacity="0.4"/>
    <rect x="118" y="92" width="40" height="34" rx="4" fill="#a59fb4"/>
    <rect x="162" y="92" width="44" height="34" rx="4" fill="#d4ccdf"/>
  </svg>`;
}

// expose
window.LINKFORGE_TEMPLATES = TEMPLATES;
window.LINKFORGE_SUGGEST = suggestTemplate;
