/* =====================================================
   LINKFORGE — client-side HTML aggregator
   ===================================================== */

const state = {
  sources: [], // {id, name, html, items[]}
  items: [], // flattened, with .enabled flag
  site: { title: 'Daily Reader', tagline: 'A curated front page, built from the web.', template: 'editorial' },
};

// Source names are auto-derived from their position (Source 1, Source 2, …)
// unless the user has customized the name.

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 9);

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('screen--active'));
  $(`#${id}`).classList.add('screen--active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ---------- theme toggle ----------
(function initTheme() {
  const root = document.documentElement;
  let mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', mode);
  const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const render = () => {
    $$('[data-theme-toggle]').forEach((b) => {
      b.innerHTML = mode === 'dark' ? sunSvg : moonSvg;
      b.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
    });
  };
  render();
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    mode = mode === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', mode);
    render();
  });
})();

// ===================================================
// PARSING
// ===================================================

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'twitch.tv', 'dailymotion.com', 'wistia.com'];
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|$)/i;

function safeURL(href, base) {
  try {
    return new URL(href, base || 'https://example.com').toString();
  } catch {
    return null;
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isVideoHref(url) {
  const d = domainOf(url);
  return VIDEO_HOSTS.some((h) => d === h || d.endsWith('.' + h)) || VIDEO_EXT.test(url);
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

function vimeoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

function classify(item) {
  // Item already has href, possibly thumbnail, possibly video.
  if (item.video || isVideoHref(item.href)) return 'video';
  if (item.thumbnail) return 'article';
  // anchor with no media — pure link
  return 'link';
}

function getMetaImage(doc) {
  const sels = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ];
  for (const s of sels) {
    const el = doc.querySelector(s);
    if (el?.content) return el.content;
  }
  return null;
}

function extractImageFromAnchor(a) {
  // direct img child
  const img = a.querySelector('img');
  if (img) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (src) return src;
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (srcset) {
      const first = srcset.split(',')[0].trim().split(' ')[0];
      if (first) return first;
    }
  }
  // picture > source
  const source = a.querySelector('picture source[srcset], source[srcset]');
  if (source) {
    const ss = source.getAttribute('srcset');
    if (ss) return ss.split(',')[0].trim().split(' ')[0];
  }
  // background-image inline style
  const styled = Array.from(a.querySelectorAll('[style*="background"]'));
  for (const el of styled) {
    const m = el.getAttribute('style').match(/url\(['"]?([^'")]+)['"]?\)/i);
    if (m) return m[1];
  }
  return null;
}

function extractVideoFromAnchor(a) {
  const v = a.querySelector('video');
  if (v) {
    const src = v.getAttribute('src') || v.querySelector('source')?.getAttribute('src');
    const poster = v.getAttribute('poster');
    if (src || poster) return { src, poster };
  }
  const iframe = a.querySelector('iframe[src]');
  if (iframe) {
    const src = iframe.getAttribute('src');
    if (src && /youtube|vimeo|tiktok|wistia|dailymotion|twitch/i.test(src)) {
      return { src };
    }
  }
  return null;
}

function getAnchorTitle(a) {
  // prefer aria-label, then title attr, then text content, then nested heading, then img alt
  const aria = a.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const ttl = a.getAttribute('title');
  if (ttl?.trim()) return ttl.trim();
  const heading = a.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading?.textContent.trim()) return heading.textContent.trim();
  const text = a.textContent.replace(/\s+/g, ' ').trim();
  if (text && text.length > 2) return text;
  const img = a.querySelector('img[alt]');
  if (img?.getAttribute('alt')?.trim()) return img.getAttribute('alt').trim();
  return null;
}

function parseSource(html, sourceName) {
  if (!html?.trim()) return [];
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return [];
  }

  // Try to detect a base URL from <base> or og:url
  let baseURL = doc.querySelector('base')?.href || null;
  if (!baseURL) {
    const ogu = doc.querySelector('meta[property="og:url"]')?.content;
    if (ogu) baseURL = ogu;
  }

  const fallbackImage = getMetaImage(doc);
  const items = [];
  const seen = new Set();

  // 1) anchors with href
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  for (const a of anchors) {
    const rawHref = a.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) continue;
    const href = safeURL(rawHref, baseURL);
    if (!href) continue;
    if (!/^https?:/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const title = getAnchorTitle(a) || domainOf(href);
    let thumb = extractImageFromAnchor(a);
    if (thumb) thumb = safeURL(thumb, baseURL) || thumb;
    const video = extractVideoFromAnchor(a);

    const item = {
      id: uid(),
      sourceName,
      href,
      title: title.slice(0, 280),
      thumbnail: thumb || null,
      video: video || null,
      domain: domainOf(href),
    };
    item.category = classify(item);
    items.push(item);
  }

  // 2) Standalone images on the page (often used in galleries)
  // Only add ones not already attached to anchors above
  const standaloneImgs = Array.from(doc.querySelectorAll('img')).filter((img) => !img.closest('a[href]'));
  for (const img of standaloneImgs) {
    let src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) continue;
    src = safeURL(src, baseURL) || src;
    if (!/^https?:/i.test(src)) continue;
    if (!IMAGE_EXT.test(src)) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    items.push({
      id: uid(),
      sourceName,
      href: src,
      title: img.getAttribute('alt')?.trim() || 'Image',
      thumbnail: src,
      video: null,
      domain: domainOf(src),
      category: 'gallery',
    });
  }

  // 3) Pure video tags / iframes without anchors
  const standaloneVideos = Array.from(doc.querySelectorAll('iframe[src], video')).filter(
    (v) => !v.closest('a[href]')
  );
  for (const v of standaloneVideos) {
    let src = v.getAttribute('src') || v.querySelector?.('source')?.getAttribute('src');
    if (!src) continue;
    src = safeURL(src, baseURL) || src;
    if (!/^https?:/i.test(src)) continue;
    if (seen.has(src)) continue;
    // only count actual video sources
    if (!isVideoHref(src) && !(v.tagName === 'VIDEO')) continue;
    seen.add(src);
    items.push({
      id: uid(),
      sourceName,
      href: src,
      title: v.getAttribute('title') || 'Video',
      thumbnail: v.getAttribute('poster') || null,
      video: { src },
      domain: domainOf(src),
      category: 'video',
    });
  }

  // Attach fallback image where missing for articles
  for (const it of items) {
    if (!it.thumbnail && it.category === 'article' && fallbackImage) {
      it.thumbnail = safeURL(fallbackImage, baseURL) || fallbackImage;
    }
    // Detect youtube/vimeo and synthesize a thumbnail
    if (it.category === 'video' && !it.thumbnail) {
      const yt = youtubeId(it.href) || (it.video?.src ? youtubeId(it.video.src) : null);
      if (yt) it.thumbnail = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
      const vi = vimeoId(it.href) || (it.video?.src ? vimeoId(it.video.src) : null);
      if (vi) it.thumbnail = null; // vimeo needs API; leave blank, will render styled card
    }
    it.enabled = true;
  }

  return items;
}

// ===================================================
// STEP 1 — SOURCE UI
// ===================================================

function addSource(prefill = {}) {
  const source = {
    id: uid(),
    name: prefill.name || '',          // empty = auto-named by position
    customName: !!prefill.name,        // true once user types something
    html: prefill.html || '',
    items: [],
  };
  state.sources.push(source);
  renderSources();
  return source;
}

function displayName(src, idx) {
  return src.customName && src.name ? src.name : `Source ${idx + 1}`;
}

function removeSource(id) {
  state.sources = state.sources.filter((s) => s.id !== id);
  if (state.sources.length === 0) addSource();
  renderSources();
}

function renderSources() {
  const root = $('#sources');
  root.innerHTML = '';
  state.sources.forEach((src, idx) => {
    const card = document.createElement('div');
    card.className = 'source-card';
    card.dataset.id = src.id;
    card.innerHTML = `
      <div class="source-card__head">
        <span class="source-card__label">${String(idx + 1).padStart(2, '0')}</span>
        <input class="source-card__name" type="text" value="${escapeAttr(displayName(src, idx))}" placeholder="Name this source (e.g. NYT homepage)" />
        <button class="source-card__remove" type="button" aria-label="Remove source" title="Remove source">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <textarea spellcheck="false" placeholder="Paste raw HTML here — &lt;html&gt;, a fragment, or anything that contains anchors, images, videos…">${escapeText(src.html)}</textarea>
      <div class="source-card__foot">
        <div class="source-card__stats">
          <span><strong>0</strong> links</span>
          <span><strong>0</strong> images</span>
          <span><strong>0</strong> videos</span>
        </div>
        <span class="source-card__hint"></span>
      </div>
    `;
    root.appendChild(card);

    const nameInput = card.querySelector('.source-card__name');
    const textarea = card.querySelector('textarea');
    const removeBtn = card.querySelector('.source-card__remove');

    nameInput.addEventListener('input', () => {
      src.name = nameInput.value;
      src.customName = nameInput.value.trim().length > 0;
    });
    textarea.addEventListener('input', () => {
      src.html = textarea.value;
      const quickItems = parseSource(src.html, src.name);
      src.items = quickItems;
      updateStats(card, quickItems);
      updateCounts();
    });
    removeBtn.addEventListener('click', () => removeSource(src.id));

    // initial stats if prefilled
    if (src.html) {
      const quickItems = parseSource(src.html, src.name);
      src.items = quickItems;
      updateStats(card, quickItems);
    }
  });
  updateCounts();
}

function updateStats(card, items) {
  const stats = card.querySelector('.source-card__stats');
  const links = items.filter((i) => i.category === 'link' || i.category === 'article').length;
  const images = items.filter((i) => i.thumbnail).length;
  const videos = items.filter((i) => i.category === 'video').length;
  stats.innerHTML = `
    <span><strong>${links}</strong> links</span>
    <span><strong>${images}</strong> with image</span>
    <span><strong>${videos}</strong> videos</span>
  `;
}

function updateCounts() {
  const sourceCount = state.sources.filter((s) => s.html.trim()).length;
  const itemCount = state.sources.reduce((sum, s) => sum + s.items.length, 0);
  $('[data-count-sources]').textContent = `${sourceCount} source${sourceCount === 1 ? '' : 's'}`;
  $('[data-count-items]').textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} detected`;
  $('#btn-parse').disabled = itemCount === 0;
}

function escapeText(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ===================================================
// STEP 2 — REVIEW UI
// ===================================================

const CATEGORY_META = {
  article: { title: 'Articles', desc: 'Links with thumbnail previews — typical news, blogs, and editorial.' },
  video: { title: 'Videos', desc: 'YouTube, Vimeo, and embedded video content.' },
  gallery: { title: 'Images', desc: 'Standalone images, photo galleries, and visual posts.' },
  link: { title: 'Links', desc: 'Plain links with no media preview detected.' },
};

const CATEGORY_ORDER = ['article', 'video', 'gallery', 'link'];

function gotoReview() {
  // flatten and dedupe by href
  const all = [];
  const seen = new Set();
  for (const src of state.sources) {
    for (const it of src.items) {
      if (seen.has(it.href)) continue;
      seen.add(it.href);
      all.push({ ...it, enabled: true });
    }
  }
  state.items = all;
  renderReview();
  showScreen('step-review');
}

function renderReview() {
  const meta = $('[data-review-meta]');
  const sources = new Set(state.items.map((i) => i.sourceName));
  meta.innerHTML = `
    <span><strong>${state.items.length}</strong> items</span>
    <span>${sources.size} source${sources.size === 1 ? '' : 's'}</span>
  `;

  renderTemplatePicker();

  const root = $('#categories');
  root.innerHTML = '';

  const grouped = {};
  for (const it of state.items) (grouped[it.category] ||= []).push(it);

  let hasAny = false;
  for (const cat of CATEGORY_ORDER) {
    const items = grouped[cat];
    if (!items || items.length === 0) continue;
    hasAny = true;

    const section = document.createElement('section');
    section.className = 'category';
    section.innerHTML = `
      <div class="category__head">
        <div>
          <h3 class="category__title">${CATEGORY_META[cat].title}<span class="count">${items.length}</span></h3>
          <p class="category__desc">${CATEGORY_META[cat].desc}</p>
        </div>
      </div>
      <div class="category__grid"></div>
    `;
    const grid = section.querySelector('.category__grid');
    items.forEach((item) => grid.appendChild(renderItemCard(item)));
    root.appendChild(section);
  }

  if (!hasAny) {
    root.innerHTML = `
      <div class="empty">
        <h3>No items found.</h3>
        <p>Go back and paste HTML that contains anchor tags, images, or videos.</p>
      </div>
    `;
  }
}

function renderItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  if (!item.enabled) card.classList.add('item-card--off');
  card.dataset.id = item.id;

  const mediaHtml = renderMedia(item);
  card.innerHTML = `
    ${mediaHtml}
    <button class="item-card__toggle" type="button" aria-pressed="${item.enabled}" aria-label="Toggle inclusion">
      ${item.enabled
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'}
    </button>
    <div class="item-card__body">
      <span class="item-card__source">${escapeText(item.sourceName)} · ${escapeText(item.domain)}</span>
      <p class="item-card__title">${escapeText(item.title)}</p>
      <span class="item-card__url">${escapeText(item.href)}</span>
    </div>
  `;

  card.querySelector('.item-card__toggle').addEventListener('click', () => {
    item.enabled = !item.enabled;
    card.classList.toggle('item-card--off', !item.enabled);
    card.querySelector('.item-card__toggle').innerHTML = item.enabled
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  });

  return card;
}

function renderMedia(item) {
  const typeLabel = item.category === 'article' ? 'Article'
    : item.category === 'video' ? 'Video'
    : item.category === 'gallery' ? 'Image' : 'Link';
  const typeBadge = `<span class="item-card__type">${typeLabel}</span>`;
  if (item.thumbnail) {
    const videoOverlay = item.category === 'video' ? `
      <div class="item-card__play">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
      </div>` : '';
    return `
      <div class="item-card__media ${item.category === 'video' ? 'item-card__media--video' : ''}">
        ${typeBadge}
        <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('item-card__media--empty'); this.remove();" />
        ${videoOverlay}
      </div>
    `;
  }
  // empty card — show initial of domain
  const mark = (item.domain || item.title || 'L').charAt(0).toUpperCase();
  return `
    <div class="item-card__media item-card__media--empty">
      ${typeBadge}
      <span class="item-card__empty-mark">${escapeText(mark)}</span>
    </div>
  `;
}

// bulk actions
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bulk]');
  if (!btn) return;
  const mode = btn.dataset.bulk;
  for (const it of state.items) {
    if (mode === 'all') it.enabled = true;
    else if (mode === 'none') it.enabled = false;
    else if (mode === 'with-image') it.enabled = !!it.thumbnail;
  }
  renderReview();
});

// ===================================================
// STEP 3 — GENERATE FINAL SITE
// ===================================================

// ---------- TEMPLATE PICKER UI ----------
function countByCategory(items) {
  const c = { article: 0, video: 0, gallery: 0, link: 0, total: items.length };
  for (const i of items) c[i.category] = (c[i.category] || 0) + 1;
  return c;
}

function renderTemplatePicker() {
  const grid = $('#template-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const enabled = state.items.filter((i) => i.enabled);
  const counts = countByCategory(enabled);
  const suggested = window.LINKFORGE_SUGGEST(counts);

  // pick default if not already set
  if (!state.site.template || !window.LINKFORGE_TEMPLATES[state.site.template]) {
    state.site.template = suggested;
  }

  for (const [key, tpl] of Object.entries(window.LINKFORGE_TEMPLATES)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'template-card';
    if (state.site.template === key) card.classList.add('template-card--active');
    card.dataset.template = key;
    card.innerHTML = `
      ${key === suggested ? '<span class="template-card__suggested">Suggested</span>' : ''}
      <div class="template-card__preview">${tpl.preview()}</div>
      <div class="template-card__body">
        <div class="template-card__name">${escapeText(tpl.name)}</div>
        <div class="template-card__desc">${escapeText(tpl.desc)}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.site.template = key;
      $$('.template-card').forEach((c) => c.classList.toggle('template-card--active', c.dataset.template === key));
    });
    grid.appendChild(card);
  }
}

// ---------- BUILD GENERATED SITE ----------
function buildGeneratedSite() {
  state.site.title = $('#site-title').value.trim() || 'Daily Reader';
  state.site.tagline = $('#site-tagline').value.trim() || '';

  const enabled = state.items.filter((i) => i.enabled);
  const articles = enabled.filter((i) => i.category === 'article');
  const videos = enabled.filter((i) => i.category === 'video');
  const gallery = enabled.filter((i) => i.category === 'gallery');
  const links = enabled.filter((i) => i.category === 'link');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const ctx = {
    title: state.site.title,
    tagline: state.site.tagline,
    articles, videos, gallery, links,
    all: enabled,
    today,
  };

  const tpl = window.LINKFORGE_TEMPLATES[state.site.template] || window.LINKFORGE_TEMPLATES.editorial;
  return tpl.build(ctx);
}

function _UNUSED() {
  const _html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeText(state.site.title)}</title>
  <meta name="description" content="${escapeAttr(state.site.tagline)}" />
  <link rel="preconnect" href="https://api.fontshare.com" crossorigin />
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=gambarino@400&display=swap" rel="stylesheet" />
  ${css}
</head>
<body>
  <header class="masthead">
    <div class="masthead__top">
      <span class="masthead__date">${escapeText(today)}</span>
      <span class="masthead__count">${enabled.length} ${enabled.length === 1 ? 'item' : 'items'}</span>
    </div>
    <h1 class="masthead__title">${escapeText(state.site.title)}</h1>
    ${state.site.tagline ? `<p class="masthead__tagline">${escapeText(state.site.tagline)}</p>` : ''}
  </header>

  ${hero ? renderHero(hero) : ''}

  ${restArticles.length ? renderSection('Articles', restArticles, state.site.layout) : ''}
  ${videos.length ? renderSection('Watch', videos, state.site.layout, true) : ''}
  ${gallery.length ? renderSection('Visuals', gallery, state.site.layout) : ''}
  ${links.length ? renderLinkList('More reading', links) : ''}

  <footer class="footer">
    <p>Compiled with Linkforge · ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
  return _html;
}

function renderHero(item) {
  return `
    <a class="hero" href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer">
      ${item.thumbnail ? `<div class="hero__img"><img src="${escapeAttr(item.thumbnail)}" alt="" /></div>` : ''}
      <div class="hero__body">
        <span class="kicker">${escapeText(item.sourceName)} · ${escapeText(item.domain)}</span>
        <h2 class="hero__title">${escapeText(item.title)}</h2>
        <span class="hero__cta">Read story →</span>
      </div>
    </a>
  `;
}

function renderSection(title, items, layout, isVideo = false) {
  const cards = items.map((i) => renderGenCard(i, isVideo)).join('');
  const cls = layout === 'masonry' ? 'grid grid--masonry' : 'grid grid--magazine';
  return `
    <section class="section">
      <h3 class="section__title">${escapeText(title)}<span class="section__count">${items.length}</span></h3>
      <div class="${cls}">${cards}</div>
    </section>
  `;
}

function renderGenCard(item, isVideo) {
  const mark = (item.domain || item.title || 'L').charAt(0).toUpperCase();
  const media = item.thumbnail
    ? `<div class="card__media ${isVideo ? 'card__media--video' : ''}">
         <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('card__media--empty'); this.remove();" />
         ${isVideo ? '<div class="card__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' : ''}
       </div>`
    : `<div class="card__media card__media--empty"><span class="card__mark">${escapeText(mark)}</span></div>`;
  return `
    <a class="card" href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer">
      ${media}
      <div class="card__body">
        <span class="kicker">${escapeText(item.sourceName)} · ${escapeText(item.domain)}</span>
        <p class="card__title">${escapeText(item.title)}</p>
      </div>
    </a>
  `;
}

function renderLinkList(title, items) {
  const rows = items.map((i) => `
    <li>
      <a href="${escapeAttr(i.href)}" target="_blank" rel="noopener noreferrer">
        <span class="link-list__title">${escapeText(i.title)}</span>
        <span class="link-list__src">${escapeText(i.domain)}</span>
      </a>
    </li>
  `).join('');
  return `
    <section class="section">
      <h3 class="section__title">${escapeText(title)}<span class="section__count">${items.length}</span></h3>
      <ul class="link-list">${rows}</ul>
    </section>
  `;
}

function generatedStyles(layout) {
  return `
    :root {
      --bg: #f5f3ee;
      --surface: #fbfaf6;
      --surface-2: #ffffff;
      --offset: #ebe8df;
      --border: #cac3ad;
      --divider: #d9d4c5;
      --text: #1a1a17;
      --muted: #6b665a;
      --faint: #a39c8a;
      --accent: #c63b1e;
      --accent-hover: #a82e14;
      --font-display: 'Gambarino', 'Iowan Old Style', Georgia, serif;
      --font-body: 'Satoshi', -apple-system, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #15140f;
        --surface: #1c1a14;
        --surface-2: #221f17;
        --offset: #2a261c;
        --border: #3d382c;
        --divider: #2d2920;
        --text: #ebe5d3;
        --muted: #8a8472;
        --faint: #5a5446;
        --accent: #ff6b4a;
        --accent-hover: #ff8868;
      }
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; }
    body {
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      padding: clamp(1rem, 4vw, 3rem);
      max-width: 1320px;
      margin: 0 auto;
    }
    img { display: block; max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; }

    .masthead {
      border-bottom: 2px solid var(--text);
      padding-bottom: 1.5rem;
      margin-bottom: 2.5rem;
    }
    .masthead__top {
      display: flex; justify-content: space-between;
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em;
      color: var(--muted); margin-bottom: 1rem;
    }
    .masthead__title {
      font-family: var(--font-display);
      font-size: clamp(2.5rem, 6vw, 5rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1;
    }
    .masthead__tagline {
      margin-top: 0.75rem;
      color: var(--muted);
      font-size: 1.125rem;
      font-style: italic;
      font-family: var(--font-display);
    }

    .hero {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 2.5rem;
      align-items: center;
      padding: 2rem 0;
      margin-bottom: 3rem;
      border-bottom: 1px solid var(--divider);
      transition: opacity 0.2s;
    }
    .hero:hover { opacity: 0.85; }
    @media (max-width: 800px) {
      .hero { grid-template-columns: 1fr; gap: 1.5rem; }
    }
    .hero__img {
      aspect-ratio: 4/3;
      overflow: hidden;
      background: var(--offset);
      border-radius: 4px;
    }
    .hero__img img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform 0.5s ease;
    }
    .hero:hover .hero__img img { transform: scale(1.03); }
    .kicker {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--accent);
      font-weight: 500;
      margin-bottom: 0.75rem;
    }
    .hero__title {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 3.5vw, 2.75rem);
      font-weight: 400;
      letter-spacing: -0.01em;
      line-height: 1.1;
      margin-bottom: 1rem;
    }
    .hero__cta {
      display: inline-block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--accent);
      border-bottom: 1px solid currentColor;
      padding-bottom: 2px;
    }

    .section {
      margin: 3rem 0;
    }
    .section__title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 400;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--text);
      display: flex; align-items: baseline; justify-content: space-between;
    }
    .section__count {
      font-size: 0.75rem;
      color: var(--faint);
      font-family: var(--font-body);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .grid {
      display: grid;
      gap: 1.5rem 1.5rem;
    }
    .grid--magazine {
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
    .grid--masonry {
      column-count: 3;
      column-gap: 1.5rem;
      display: block;
    }
    .grid--masonry .card { break-inside: avoid; margin-bottom: 1.5rem; display: inline-block; width: 100%; }
    @media (max-width: 900px) {
      .grid--masonry { column-count: 2; }
    }
    @media (max-width: 600px) {
      .grid--masonry { column-count: 1; }
    }

    .card {
      display: block;
      background: var(--surface);
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--divider);
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--muted);
      box-shadow: 0 12px 28px rgba(0,0,0,0.08);
    }
    .card__media {
      aspect-ratio: 16/10;
      overflow: hidden;
      background: var(--offset);
      position: relative;
    }
    .card__media img {
      width: 100%; height: 100%; object-fit: cover;
      transition: transform 0.5s ease;
    }
    .card:hover .card__media img { transform: scale(1.04); }
    .card__media--video::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(transparent 50%, rgba(0,0,0,0.55));
    }
    .card__media--empty {
      display: grid; place-items: center;
      background: linear-gradient(135deg, var(--offset), var(--surface-2));
    }
    .card__mark {
      font-family: var(--font-display);
      font-size: 3rem;
      color: var(--faint);
    }
    .card__play {
      position: absolute; inset: 0;
      display: grid; place-items: center;
      z-index: 1;
    }
    .card__play svg { width: 44px; height: 44px; color: #fff; filter: drop-shadow(0 3px 10px rgba(0,0,0,0.5)); }
    .card__body {
      padding: 1rem 1.125rem 1.25rem;
    }
    .card__title {
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.35;
      color: var(--text);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .link-list {
      list-style: none;
      border-top: 1px solid var(--divider);
    }
    .link-list li { border-bottom: 1px solid var(--divider); }
    .link-list a {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 1rem 0;
      gap: 1.5rem;
      transition: padding 0.2s;
    }
    .link-list a:hover { padding-left: 0.75rem; color: var(--accent); }
    .link-list__title {
      font-size: 1rem; font-weight: 500;
      flex: 1;
    }
    .link-list__src {
      font-size: 0.75rem;
      color: var(--faint);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      white-space: nowrap;
    }

    .footer {
      margin-top: 4rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--divider);
      font-size: 0.75rem;
      color: var(--muted);
      text-align: center;
    }

    ${layout === 'reader' ? `
      .grid--magazine, .grid--masonry { display: block; column-count: 1; }
      .grid--magazine .card, .grid--masonry .card {
        display: grid;
        grid-template-columns: 1fr 200px;
        gap: 1.5rem;
        margin-bottom: 1rem;
        border-radius: 4px;
      }
      .grid--magazine .card__media, .grid--masonry .card__media {
        order: 2; aspect-ratio: 4/3;
      }
      .grid--magazine .card__body, .grid--masonry .card__body {
        order: 1;
      }
      @media (max-width: 600px) {
        .grid--magazine .card, .grid--masonry .card {
          grid-template-columns: 1fr;
        }
        .grid--magazine .card__media, .grid--masonry .card__media { order: 0; }
      }
    ` : ''}
  `;
}

function gotoOutput() {
  const html = buildGeneratedSite();
  const iframe = $('#preview-frame');
  iframe.srcdoc = html;
  iframe._html = html;
  showScreen('step-output');
}

function downloadHtml() {
  const html = $('#preview-frame')._html || buildGeneratedSite();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const slug = (state.site.title || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug || 'site'}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Downloaded ' + a.download);
}

// ===================================================
// EVENTS
// ===================================================

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-add-source]')) {
    addSource();
    return;
  }
  if (e.target.closest('[data-back-to-input]')) {
    showScreen('step-input');
    return;
  }
  if (e.target.closest('[data-back-to-review]')) {
    showScreen('step-review');
    return;
  }
  if (e.target.closest('[data-load-sample]')) {
    loadSample();
    return;
  }
});

$('#btn-parse').addEventListener('click', gotoReview);
$('#btn-generate').addEventListener('click', gotoOutput);
$('#btn-download').addEventListener('click', downloadHtml);

// file upload
$('#file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const html = await file.text();
    const src = addSource({ name: file.name.replace(/\.html?$/i, ''), html });
    // re-render so the textarea picks up content
  }
  renderSources();
  e.target.value = '';
});

// drag and drop on textareas
document.addEventListener('dragover', (e) => {
  if (e.target.closest('.source-card')) e.preventDefault();
});
document.addEventListener('drop', async (e) => {
  const card = e.target.closest('.source-card');
  if (!card) return;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  e.preventDefault();
  const html = await file.text();
  const src = state.sources.find((s) => s.id === card.dataset.id);
  if (src) {
    src.html = html;
    src.name = file.name.replace(/\.html?$/i, '');
    renderSources();
  }
});

// ===================================================
// SAMPLE DATA
// ===================================================

function loadSample() {
  state.sources = [];

  addSource({
    name: 'Editorial Weekly',
    html: `<!doctype html><html><head><meta property="og:url" content="https://example-news.com/"></head><body>
      <article>
        <a href="https://example-news.com/the-quiet-rise-of-small-towns">
          <img src="https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=800" alt="Sunset over a small town" />
          <h2>The quiet rise of America's smallest towns</h2>
        </a>
      </article>
      <article>
        <a href="https://example-news.com/inside-the-new-space-race">
          <img src="https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800" alt="Rocket launch at night" />
          <h2>Inside the new space race — and who's actually winning</h2>
        </a>
      </article>
      <article>
        <a href="https://example-news.com/what-coffee-says-about-us">
          <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800" alt="Pour over coffee" />
          <h2>What our morning coffee says about the way we live now</h2>
        </a>
      </article>
      <a href="https://example-news.com/opinion/why-cities-still-matter">Why cities still matter — an opinion column</a>
    </body></html>`,
  });

  addSource({
    name: 'Visual Stories',
    html: `<!doctype html><html><body>
      <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
        <h3>Behind the scenes of a quiet record</h3>
      </a>
      <a href="https://www.youtube.com/watch?v=9bZkp7q19f0">
        <h3>A morning at the harbor — short film</h3>
      </a>
      <a href="https://vimeo.com/76979871">A film about typography</a>
      <img src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900" alt="Foggy mountain road" />
      <img src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900" alt="Lake at dawn" />
    </body></html>`,
  });

  showToast('Sample sources loaded');
}

// ===================================================
// INIT
// ===================================================

addSource();
