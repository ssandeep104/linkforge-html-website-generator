/* =====================================================
   LINKFORGE — client-side HTML aggregator
   ===================================================== */

const DEFAULT_SITE_TITLE = 'My Collection';
const DEFAULT_SITE_TAGLINE = '';

// Exposed on window for in-browser test diagnostics (no behavior change).
const state = window.__lfState = {
  sources: [], // {id, name, html, items[]}
  items: [], // flattened, with .enabled flag
  site: { title: DEFAULT_SITE_TITLE, tagline: DEFAULT_SITE_TAGLINE, template: 'youtube' },
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
  const getSavedMode = () => {
    try {
      const saved = localStorage.getItem('lf-theme');
      return saved === 'dark' || saved === 'light' ? saved : null;
    } catch (_) {
      return null;
    }
  };
  const saveMode = (value) => {
    try { localStorage.setItem('lf-theme', value); } catch (_) {}
  };
  const savedMode = getSavedMode();
  const systemMode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let mode = savedMode === 'dark' || savedMode === 'light' ? savedMode : systemMode;
  root.setAttribute('data-theme', mode);
  const sunSvg = '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  const moonSvg = '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const render = () => {
    $$('[data-theme-toggle]').forEach((b) => {
      b.innerHTML = mode === 'dark' ? sunSvg : moonSvg;
      const label = `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`;
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
    });
  };
  render();
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    mode = mode === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', mode);
    saveMode(mode);
    render();
  });
  const media = matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener?.('change', (event) => {
    if (getSavedMode()) return;
    mode = event.matches ? 'dark' : 'light';
    root.setAttribute('data-theme', mode);
    render();
  });
})();


// ===================================================
// PARSING — see parser.js (parseSource, parseSourceWithMeta)
// ===================================================

// ===================================================
// STEP 1 — SOURCE UI
// ===================================================

function addSource(prefill = {}) {
  const initialFragments = Array.isArray(prefill.fragments) && prefill.fragments.length
    ? prefill.fragments.map((frag) => ({
        id: frag.id || uid(),
        name: frag.name || 'HTML fragment',
        html: frag.html || '',
        kind: frag.kind || 'file',
      }))
    : [{ id: uid(), name: 'Pasted HTML', html: prefill.html || '', kind: 'manual' }];
  const source = {
    id: uid(),
    name: prefill.name || '',          // empty = auto-named by position
    customName: !!prefill.name,        // true once user types something
    html: '',
    fragments: initialFragments,
    items: [],
    overrideBase: null,                // set when user manually provides a domain
    unresolvedCount: 0,                // # of relative anchors that need a domain
    domainValidationState: 'idle',     // 'idle' | 'checking' | 'ok' | 'failed'
  };
  syncSourceHtml(source);
  state.sources.push(source);
  renderSources();
  return source;
}

function ensureSourceFragments(src) {
  if (Array.isArray(src.fragments) && src.fragments.length) return src.fragments;
  src.fragments = [{ id: uid(), name: 'Pasted HTML', html: src.html || '', kind: 'manual' }];
  return src.fragments;
}

function primaryFragment(src) {
  const fragments = ensureSourceFragments(src);
  return fragments.find((frag) => frag.kind === 'manual') || fragments[0];
}

function syncSourceHtml(src) {
  const fragments = ensureSourceFragments(src);
  src.html = fragments
    .map((frag) => (frag.html || '').trim())
    .filter(Boolean)
    .join('\n\n<!-- LINKFORGE SOURCE SPLIT -->\n\n');
}

async function appendFilesToSource(src, files) {
  if (!src || !files?.length) return;
  ensureSourceFragments(src);
  for (const file of files) {
    const html = await file.text();
    src.fragments.push({
      id: uid(),
      name: file.name,
      html,
      kind: 'file',
    });
  }
  syncSourceHtml(src);
}

function removeSourceFragment(src, fragmentId) {
  if (!src) return;
  const fragments = ensureSourceFragments(src);
  const frag = fragments.find((item) => item.id === fragmentId);
  if (!frag) return;
  if (frag.kind === 'manual') {
    frag.html = '';
  } else {
    src.fragments = fragments.filter((item) => item.id !== fragmentId);
  }
  syncSourceHtml(src);
}

function displayName(src, idx) {
  return src.name ? src.name : `Source ${idx + 1}`;
}

function removeSource(id) {
  state.sources = state.sources.filter((s) => s.id !== id);
  if (state.sources.length === 0) addSource();
  renderSources();
}

// Reorder a source by swapping it with its neighbour (delta -1 up, +1 down).
// Items keep their sourceId binding, so review grouping and selections survive
// the move; only the display order (and position-based "Source N" labels for
// unnamed sources) changes.
function moveSource(id, delta) {
  const idx = state.sources.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const next = idx + delta;
  if (next < 0 || next >= state.sources.length) return;
  const [moved] = state.sources.splice(idx, 1);
  state.sources.splice(next, 0, moved);
  renderSources();
}

// Clear a single source back to a blank card (keeps its position in the list).
// Wipes pasted HTML, attached files, name, parsed items, and any per-field
// strategy overrides — but does NOT remove the card. Confirms first when the
// source actually has content, so an accidental click can't destroy work.
function resetSource(id) {
  const src = state.sources.find((s) => s.id === id);
  if (!src) return;
  const hasContent = !!(src.html && src.html.trim());
  if (hasContent && !confirm('Clear this source? Its pasted HTML and attached files will be removed.')) {
    return;
  }
  src.fragments = [{ id: uid(), name: 'Pasted HTML', html: '', kind: 'manual' }];
  src.name = '';
  src.customName = false;
  src.items = [];
  src.overrideBase = null;
  src.unresolvedCount = 0;
  src.domainValidationState = 'idle';
  src.strategyByPattern = {};
  src.detectedBase = null;
  src.emptyAfterParse = false;
  syncSourceHtml(src);
  renderSources();
  if (hasContent) showToast('Source cleared');
}

// Wipe every source and start over with a single blank card. Confirms first
// when any source has content.
function resetAllSources() {
  const hasContent = state.sources.some((s) => s.html && s.html.trim());
  if (hasContent && !confirm('Reset all sources? Everything you have pasted will be cleared.')) {
    return;
  }
  state.sources = [];
  state.items = [];
  reviewState.activeSourceId = null;
  addSource(); // re-renders with one empty source
  if (hasContent) showToast('All sources cleared');
}

function renderSources() {
  const root = $('#sources');
  root.innerHTML = '';
  state.sources.forEach((src, idx) => {
    ensureSourceFragments(src);
    const primary = primaryFragment(src);
    const fileFragments = src.fragments.filter((frag) => frag.kind === 'file');
    const inputId = `source-file-${src.id}`;
    const card = document.createElement('div');
    card.className = 'source-card';
    card.dataset.id = src.id;
    card.innerHTML = `
      <div class="source-card__head">
        <span class="source-card__label">${String(idx + 1).padStart(2, '0')}</span>
        <input class="source-card__name" type="text" value="${escapeAttr(displayName(src, idx))}" placeholder="Name this source (e.g. NYT homepage)" />
        <div class="source-card__move" role="group" aria-label="Reorder source">
          <button class="source-card__move-btn" type="button" data-move="up" aria-label="Move source up" title="Move source up" ${idx === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button class="source-card__move-btn" type="button" data-move="down" aria-label="Move source down" title="Move source down" ${idx === state.sources.length - 1 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
        <button class="source-card__reset" type="button" aria-label="Reset this source" title="Clear this source's pasted HTML and files">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          <span>Reset</span>
        </button>
        <button class="source-card__remove" type="button" aria-label="Remove source" title="Remove source">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <textarea spellcheck="false" placeholder="Paste raw HTML here — &lt;html&gt;, a fragment, or anything that contains anchors, images, videos…">${escapeText(primary.html || '')}</textarea>
      <div class="source-card__files">
        <div class="source-card__files-head">
          <span class="source-card__files-label">Additional HTML files</span>
          <label class="source-card__files-btn" for="${escapeAttr(inputId)}">
            + Add files to this source
            <input id="${escapeAttr(inputId)}" type="file" accept=".html,.htm,text/html" multiple hidden data-source-file-input />
          </label>
        </div>
        ${fileFragments.length ? `
          <div class="source-card__file-list">
            ${fileFragments.map((frag) => `
              <div class="source-card__file-chip">
                <span class="source-card__file-name">${escapeText(frag.name)}</span>
                <button type="button" class="source-card__file-remove" data-fragment-id="${escapeAttr(frag.id)}" aria-label="Remove ${escapeAttr(frag.name)}" title="Remove ${escapeAttr(frag.name)}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            `).join('')}
          </div>
        ` : `<p class="source-card__files-empty">No extra files attached. Add multiple HTML files here when they belong to the same source.</p>`}
      </div>
      <div class="source-card__banner" data-banner hidden></div>
      <div class="source-card__foot">
        <div class="source-card__stats">
          <span><strong>0</strong> items</span>
          <span><strong>0</strong> with image</span>
          <span><strong>0</strong> videos</span>
        </div>
        <span class="source-card__hint"></span>
      </div>
    `;
    root.appendChild(card);

    const nameInput = card.querySelector('.source-card__name');
    const textarea = card.querySelector('textarea');
    const removeBtn = card.querySelector('.source-card__remove');
    const resetBtn = card.querySelector('.source-card__reset');
    const fileInput = card.querySelector('[data-source-file-input]');

    nameInput.addEventListener('input', () => {
      src.name = nameInput.value;
      src.customName = nameInput.value.trim().length > 0;
      // Re-stamp already-parsed items with the new source name so the rendered
      // page groups them under the typed label instead of UNSOURCED. Without
      // this, items keep whatever sourceName they got at paste time (often '').
      if (src.items && src.items.length) {
        const nextSourceName = displayName(src, idx);
        for (const it of src.items) it.sourceName = nextSourceName;
      }
      updateCounts();
    });
    textarea.addEventListener('input', () => {
      primary.html = textarea.value;
      syncSourceHtml(src);
      runParse(src, card);
    });
    removeBtn.addEventListener('click', () => removeSource(src.id));
    resetBtn.addEventListener('click', () => resetSource(src.id));
    card.querySelector('[data-move="up"]')?.addEventListener('click', () => moveSource(src.id, -1));
    card.querySelector('[data-move="down"]')?.addEventListener('click', () => moveSource(src.id, 1));
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      await appendFilesToSource(src, files);
      renderSources();
      e.target.value = '';
    });
    card.querySelectorAll('[data-fragment-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeSourceFragment(src, btn.dataset.fragmentId);
        renderSources();
      });
    });

    // initial stats if prefilled
    if (src.html) runParse(src, card);
  });
  updateCounts();
}

// Parse a source and update its card UI (stats + unresolved-domain banner).
function runParse(src, card) {
  const meta = parseSourceWithMeta(src.html, src.name, {
    overrideBase: src.overrideBase || undefined,
  });
  // Stamp every item with the source id so the renderer can group them even
  // if the user later edits the source name (sourceName captured at parse
  // time would otherwise be stale or empty).
  for (const it of meta.items) it.sourceId = src.id;
  src.items = meta.items;
  src.unresolvedCount = meta.unresolvedCount;
  src.detectedBase = meta.baseURL;

  // Auto-populate the source name based on the detected base URL/domain if not custom-named
  const idx = state.sources.indexOf(src);
  if (!src.customName) {
    if (meta.baseURL) {
      const domain = domainOf(meta.baseURL);
      src.name = domain || '';
    } else {
      src.name = '';
    }
    const nameInput = card.querySelector('.source-card__name');
    if (nameInput) {
      nameInput.value = displayName(src, idx);
    }
  }

  // Update item source names with the final display name
  const finalSourceName = displayName(src, idx);
  for (const it of src.items) {
    it.sourceName = finalSourceName;
  }

  // "Empty source" — we got non-empty HTML but zero items. Likely a JS-rendered
  // page or a snippet that needs different selectors. Track so we can show a hint.
  src.emptyAfterParse = !!(src.html.trim() && meta.items.length === 0 && meta.unresolvedCount === 0);
  updateStats(card, meta.items, meta.jsonLdMeta);
  renderBanner(src, card);
  updateCounts();
}

// Show / hide the yellow "unresolved domain" banner under the textarea.
function renderBanner(src, card) {
  const banner = card.querySelector('[data-banner]');
  if (!banner) return;

  // Empty-source hint takes over when there's no unresolved-domain situation.
  if (!src.unresolvedCount && src.emptyAfterParse) {
    banner.hidden = false;
    banner.className = 'source-card__banner is-empty';
    banner.innerHTML = `
      <div class="banner__msg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>No links, images, or videos detected. This may be a JS-rendered page — try “View Page Source” in your browser and paste that instead of inspecting the rendered DOM.</span>
      </div>
    `;
    return;
  }

  if (!src.unresolvedCount) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  const stateClass = src.domainValidationState === 'checking' ? 'is-checking'
                  : src.domainValidationState === 'failed' ? 'is-failed'
                  : src.domainValidationState === 'ok' ? 'is-ok' : '';
  const msg = src.domainValidationState === 'checking' ? 'Checking that host…'
           : src.domainValidationState === 'failed' ? "Couldn't reach that host — check the spelling, or use \"Skip & drop these links\"."
           : src.domainValidationState === 'ok' ? 'Got it — links will use this domain.'
           : `${src.unresolvedCount} link${src.unresolvedCount === 1 ? '' : 's'} ${src.unresolvedCount === 1 ? 'has' : 'have'} no domain. What site are these from?`;
  banner.className = `source-card__banner ${stateClass}`;
  banner.innerHTML = `
    <div class="banner__msg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      <span>${escapeText(msg)}</span>
    </div>
    <form class="banner__form" data-banner-form>
      <input type="text" class="banner__input" placeholder="e.g. example.com" value="${escapeAttr(src.overrideBase || '')}" autocomplete="off" spellcheck="false" />
      <button type="submit" class="banner__btn banner__btn--primary">Use this domain</button>
      <button type="button" class="banner__btn banner__btn--ghost" data-banner-skip>Skip & drop these links</button>
    </form>
  `;
  const form = banner.querySelector('[data-banner-form]');
  const input = banner.querySelector('.banner__input');
  const skipBtn = banner.querySelector('[data-banner-skip]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    const origin = normalizeHostToOrigin(raw);
    if (!origin) {
      src.domainValidationState = 'failed';
      renderBanner(src, card);
      return;
    }
    src.domainValidationState = 'checking';
    renderBanner(src, card);
    const ok = await probeHost(origin);
    if (!ok) {
      src.domainValidationState = 'failed';
      renderBanner(src, card);
      return;
    }
    src.overrideBase = origin;
    src.domainValidationState = 'ok';
    runParse(src, card); // re-parse with the new base
  });
  skipBtn.addEventListener('click', () => {
    // Mark as resolved-by-skipping: clear unresolvedCount so banner hides;
    // the unresolved anchors are already excluded from items so they get dropped.
    src.unresolvedCount = 0;
    src.domainValidationState = 'idle';
    renderBanner(src, card);
    updateCounts();
  });
}

// Accept anything from "example.com" to "https://www.example.com/path"
// and return a clean "https://host" origin string. Returns null if invalid.
function normalizeHostToOrigin(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

// Best-effort reachability test. Uses no-cors so an opaque success still means
// the host resolved. AbortController gives us a 5s timeout.
async function probeHost(origin) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    await fetch(origin, { mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(tid);
    return true;
  } catch {
    return false;
  }
}

function updateStats(card, items, jsonLdMeta) {
  const stats = card.querySelector('.source-card__stats');
  const nonVideo = items.filter((i) => i.category === 'link' || i.category === 'article').length;
  const images = items.filter((i) => i.thumbnail).length;
  const videos = items.filter((i) => i.category === 'video').length;
  // JSON-LD badge: shows when the source had at least one <script type="application/ld+json">
  // we successfully parsed. Even zero matched entries is interesting signal — it tells the
  // user the page exposes structured data we read.
  let jsonLdBadge = '';
  if (jsonLdMeta && jsonLdMeta.scriptCount > 0) {
    const n = jsonLdMeta.entryCount || 0;
    const label = n === 1 ? '1 schema indexed' : `${n} schemas indexed`;
    const title = `${jsonLdMeta.scriptCount} <script type="application/ld+json"> block${jsonLdMeta.scriptCount === 1 ? '' : 's'} parsed · ${jsonLdMeta.matchedCount} matched to anchors · ${jsonLdMeta.orphanCount} orphan${jsonLdMeta.orphanCount === 1 ? '' : 's'}`;
    jsonLdBadge = `<span class="source-card__schema-badge" title="${escapeAttr(title)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>${escapeText(label)}</span>`;
  }
  stats.innerHTML = `
    <span><strong>${nonVideo}</strong> items</span>
    <span><strong>${images}</strong> with image</span>
    <span><strong>${videos}</strong> videos</span>
    ${jsonLdBadge}
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
  return String(s).replace(/[&"'<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ===================================================
// STEP 2 — REVIEW UI
// ===================================================

const CATEGORY_META = {
  'article': { title: 'Media links', desc: 'Links with image previews.' },
  'video': { title: 'Videos', desc: 'Links with video players or previews.' },
  'gallery': { title: 'Images', desc: 'Standalone images and visual assets.' },
  'link': { title: 'Links', desc: 'Links without an image or video preview.' },
};

const CATEGORY_ORDER = ['article', 'video', 'gallery', 'link'];

const reviewState = {
  activeSourceId: null,
  filter: 'all',
};

// Map the internal item.category to the user-facing bucket above.
function bucketOf(item) {
  if (item.category === 'video') return 'with-video';
  if (item.thumbnail) return 'with-image'; // includes article + gallery
  return 'plain';
}

function reviewFilterOf(item) {
  if (item.category === 'video') return 'video';
  if (item.thumbnail) return 'image';
  return 'link';
}

// Does an item belong to the category the user is currently filtering to?
// 'all' matches everything.
function reviewItemMatchesFilter(item, filter = reviewState.filter || 'all') {
  return filter === 'all' || reviewFilterOf(item) === filter;
}

// The items actually visible in the review list right now: the ACTIVE source's
// items, narrowed to the ACTIVE filter. The selection summary and the bulk
// Select/Deselect actions operate on exactly this set, so the count always
// matches "what you see and picked in this list" — not a global tally that
// silently includes hidden categories or other sources.
function getReviewScopedItems() {
  const active = getActiveReviewSource();
  return state.items.filter((it) =>
    (active ? it.sourceId === active.id : true) && reviewItemMatchesFilter(it));
}

// Update the "N selected" summary shown above the list to reflect the current
// view scope (active source + active filter).
function updateReviewSelectionSummary() {
  const summary = $('[data-review-selection-summary]');
  if (!summary) return;
  const scoped = getReviewScopedItems();
  const selected = scoped.filter((it) => it.enabled).length;
  const filter = reviewState.filter || 'all';
  // Noun follows the active filter: "images"/"videos"/"links", or the neutral
  // "links" when viewing everything.
  const noun = filter === 'image' ? 'image' : filter === 'video' ? 'video' : 'link';
  const plural = scoped.length === 1 ? '' : 's';
  summary.textContent = `${selected} of ${scoped.length} ${noun}${plural} selected`;
}

function applyReviewItemFilter() {
  const filter = reviewState.filter || 'all';
  $$('[data-review-filter]').forEach((button) => {
    const active = button.dataset.reviewFilter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  $$('.item-row', $('#categories')).forEach((row) => {
    row.hidden = filter !== 'all' && row.dataset.reviewFilterKind !== filter;
  });
  $$('.group-panel', $('#categories')).forEach((panel) => {
    panel.hidden = !panel.querySelector('.item-row:not([hidden])');
  });
}

function getReviewableSources() {
  return state.sources.filter((src) => (src.items || []).length > 0);
}

function ensureActiveReviewSource() {
  const reviewable = getReviewableSources();
  if (!reviewable.length) {
    reviewState.activeSourceId = null;
    return null;
  }
  if (!reviewState.activeSourceId || !reviewable.some((src) => src.id === reviewState.activeSourceId)) {
    reviewState.activeSourceId = reviewable[0].id;
  }
  return reviewState.activeSourceId;
}

function getActiveReviewSource() {
  const id = ensureActiveReviewSource();
  if (!id) return getReviewableSources()[0] || null;
  return state.sources.find((src) => src.id === id) || null;
}

function getActiveReviewItems() {
  const active = getActiveReviewSource();
  if (!active) return [];
  return state.items.filter((it) => it.sourceId === active.id);
}

function getActiveReviewIndex() {
  const reviewable = getReviewableSources();
  const idx = reviewable.findIndex((src) => src.id === reviewState.activeSourceId);
  return { reviewable, idx: idx < 0 ? 0 : idx };
}

function canAdvanceToNextSource() {
  const { reviewable, idx } = getActiveReviewIndex();
  return reviewable.length > 1 && idx < reviewable.length - 1;
}

function updateReviewPrimaryAction() {
  const btn = $('#btn-generate');
  const label = $('#review-primary-label');
  if (!btn || !label) return;
  if (canAdvanceToNextSource()) {
    label.textContent = 'Next source';
    btn.setAttribute('aria-label', 'Go to next source');
  } else {
    label.textContent = 'Generate site';
    btn.setAttribute('aria-label', 'Generate site');
  }
}

function handleReviewPrimaryAction() {
  if (canAdvanceToNextSource()) {
    changeActiveReviewSource(1);
    return;
  }
  gotoOutput();
}

function changeActiveReviewSource(delta) {
  const reviewable = getReviewableSources();
  if (!reviewable.length) return;
  const idx = reviewable.findIndex((src) => src.id === reviewState.activeSourceId);
  const safeIdx = idx < 0 ? 0 : idx;
  const nextIdx = Math.min(reviewable.length - 1, Math.max(0, safeIdx + delta));
  reviewState.activeSourceId = reviewable[nextIdx].id;
  renderReview();
}

function renderReviewSourceStepper() {
  const root = $('#review-source-stepper');
  if (!root) return;
  const reviewable = getReviewableSources();
  if (reviewable.length <= 1) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }

  const active = getActiveReviewSource() || reviewable[0] || null;
  if (!active) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }
  const activeId = active?.id ?? null;
  const idx = reviewable.findIndex((src) => src.id === activeId);
  const activeIdx = idx < 0 ? 0 : idx;
  const selectedCount = activeId == null
    ? 0
    : state.items.filter((it) => it.sourceId === activeId && it.enabled).length;
  const totalCount = activeId == null
    ? 0
    : state.items.filter((it) => it.sourceId === activeId).length;
  const activeSourceIdx = activeId == null ? -1 : state.sources.findIndex((s) => s.id === activeId);
  const displayIdx = activeSourceIdx >= 0 ? activeSourceIdx : activeIdx;
  const activeName = active && typeof active === 'object'
    ? displayName(active, displayIdx)
    : `Source ${activeIdx + 1}`;

  root.hidden = false;
  root.innerHTML = `
    <div class="source-stepper__meta">
      <span class="source-stepper__kicker">Reviewing source ${activeIdx + 1} of ${reviewable.length}</span>
      <strong class="source-stepper__name">${escapeText(activeName)}</strong>
      <span class="source-stepper__count">${selectedCount} / ${totalCount} links selected</span>
    </div>
    <div class="source-stepper__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-stepper="prev" ${activeIdx === 0 ? 'disabled' : ''}>Previous source</button>
      <button type="button" class="btn btn--ghost btn--sm" data-stepper="next" ${activeIdx >= reviewable.length - 1 ? 'disabled' : ''}>Next source</button>
    </div>
  `;

  root.querySelector('[data-stepper="prev"]')?.addEventListener('click', () => changeActiveReviewSource(-1));
  root.querySelector('[data-stepper="next"]')?.addEventListener('click', () => changeActiveReviewSource(1));
}

function gotoReview() {
  // Block parse if any source still has unresolved links the user hasn't
  // addressed. They have to either type a domain or click "Skip & drop".
  const blocked = state.sources.filter((s) => s.unresolvedCount > 0);
  if (blocked.length) {
    const first = document.querySelector(`.source-card[data-id="${blocked[0].id}"] .banner__input`);
    if (first) first.focus();
    const hint = blocked.length === 1
      ? 'One source has links with no domain — resolve it first.'
      : `${blocked.length} sources have links with no domain — resolve them first.`;
    const parseHint = $('#parse-hint');
    if (parseHint) {
      parseHint.textContent = hint;
      parseHint.classList.add('is-warn');
      setTimeout(() => { parseHint.classList.remove('is-warn'); parseHint.textContent = ''; }, 4000);
    }
    return;
  }
  flattenSourcesIntoItems({ resetEnabled: true });
  ensureActiveReviewSource();
  renderReview();
  setReviewMode('edit');
  showScreen('step-review');
}

// Apply each source's strategy choice then flatten src.items into state.items.
// Preserves per-item `enabled` toggles across re-flattens unless resetEnabled.
function flattenSourcesIntoItems({ resetEnabled = false } = {}) {
  // Canonical destination key — the same story reached via URL variants
  // (trailing slash, #fragment, www, http/https, param order) collapses to a
  // single card. Falls back to the raw href if the helper isn't available.
  const keyOf = (it) => (typeof canonicalHref === 'function' ? canonicalHref(it.href) : it.href);
  // remember enabled state by destination before we rebuild
  const prevEnabled = new Map();
  if (!resetEnabled) {
    for (const it of state.items || []) prevEnabled.set(keyOf(it), it.enabled);
  }
  for (const src of state.sources) {
    applySourceStrategy(src);
  }
  // Dedup by canonical destination, with a "richest-wins" tie-break so the card
  // that has both title + thumbnail beats a thinner duplicate of the same URL.
  // The user's rule: only ever ONE card per destination. Final, global.
  // Richness score: thumb (2) + non-domain title (1) + video (1).
  const richness = (it) => {
    let s = 0;
    if (it.thumbnail) s += 2;
    if (it.title && it.title !== it.domain) s += 1;
    if (it.video) s += 1;
    return s;
  };
  const byHref = new Map(); // canonicalKey -> { item, srcIdx, itemIdx }
  state.sources.forEach((src, srcIdx) => {
    (src.items || []).forEach((it, itemIdx) => {
      if (it._excludedByPattern) return;
      const key = keyOf(it);
      const existing = byHref.get(key);
      if (!existing || richness(it) > richness(existing.item)) {
        byHref.set(key, { item: it, srcIdx, itemIdx });
      }
    });
  });
  // Rebuild in original source order, dropping non-winners.
  const all = [];
  for (const src of state.sources) {
    for (const it of src.items || []) {
      if (it._excludedByPattern) continue;
      const key = keyOf(it);
      const winner = byHref.get(key);
      if (!winner || winner.item !== it) continue;
      const enabled = resetEnabled ? true : (prevEnabled.has(key) ? prevEnabled.get(key) : true);
      all.push({ ...it, enabled, pageSection: it.pageSection || 'Other' });
    }
  }
  state.items = all;
}

// Reset the ACTIVE review source: undo its per-field strategy overrides (back
// to Linkforge's default title/image/video picks) and re-select every one of
// its links. Other sources are left untouched.
function resetReviewSource() {
  const src = getActiveReviewSource();
  if (!src) return;
  src.strategyByPattern = {};
  seedDefaultStrategies(src);
  flattenSourcesIntoItems({ resetEnabled: false });
  for (const it of state.items) {
    if (it.sourceId === src.id) it.enabled = true;
  }
  renderReview();
  showToast('Source reset to defaults');
}

// Reset EVERY review source: undo all per-field overrides and re-select every
// link across all sources.
function resetReviewAll() {
  for (const src of state.sources) {
    src.strategyByPattern = {};
    seedDefaultStrategies(src);
  }
  flattenSourcesIntoItems({ resetEnabled: true });
  renderReview();
  showToast('All sources reset to defaults');
}

// ---------- candidate-picker support ----------
// Each source stores src.strategy = {title, thumb, video} with the user's
// chosen extractor name. Applying it walks the source's items and updates
// item.title/thumbnail/video from the saved candidate lists. No re-parse needed.
function applySourceStrategy(src) {
  src.strategyByPattern = src.strategyByPattern || {};
  for (const it of src.items || []) {
    const strat = src.strategyByPattern[it.pattern] || {};
    it._excludedByPattern = !!strat.exclude;
    if (it._excludedByPattern) continue;
    if (strat.title) {
      const pick = it.titleCandidates?.find((c) => c.strategy === strat.title);
      // A partial strategy is deliberately allowed by the picker. Items that
      // do not offer it must be empty, matching the option-group warning,
      // rather than silently retaining a stale value from the last strategy.
      it.title = pick ? pick.value : '';
    }
    if (strat.thumb) {
      const pick = it.thumbCandidates?.find((c) => c.strategy === strat.thumb);
      it.thumbnail = pick ? pick.value : null;
    }
    if (strat.video) {
      const pick = it.videoCandidates?.find((c) => c.strategy === strat.video);
      it.video = pick ? (pick.info || { url: pick.value }) : null;
    }
    refreshItemCategory(it);
  }
}

const STRATEGY_VIDEO_HOSTS = [
  'youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'twitch.tv',
  'dailymotion.com', 'wistia.com', 'instagram.com',
];

function refreshItemCategory(item) {
  // Preserve the parser's gallery distinction while still allowing a chosen
  // video strategy to promote the item (and a cleared image to demote it).
  item._strategyBaseCategory ||= item.category;
  let hrefIsVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(item.href || '');
  try {
    const host = new URL(item.href).hostname.replace(/^www\./, '');
    hrefIsVideo = hrefIsVideo
      || STRATEGY_VIDEO_HOSTS.some((candidate) => host === candidate || host.endsWith('.' + candidate));
  } catch {}
  item.category = item.video || hrefIsVideo
    ? 'video'
    : item.thumbnail
      ? (item._strategyBaseCategory === 'gallery' ? 'gallery' : 'article')
      : 'link';
}

// Build the per-source picker option list as a UNION across every item in
// the source. Each strategy key collapses to one option, but we now track
// how many distinct items it matched, plus whether values vary across items
// (so the dropdown label can show "varies" instead of one specific URL,
// which would otherwise make the option look tied to a single href).
function buildPickerOptionsForGroup(items, field) {
  const candKey = field === 'title' ? 'titleCandidates'
    : field === 'thumb' ? 'thumbCandidates'
    : 'videoCandidates';
  const totalItems = (items || []).length;
  const byStrategy = new Map();
  for (const it of items || []) {
    const seenForItem = new Set();
    for (const c of it[candKey] || []) {
      if (!byStrategy.has(c.strategy)) {
        byStrategy.set(c.strategy, {
          strategy: c.strategy,
          label: c.label,
          sample: c.value,
          count: 0,
          values: new Set(),
        });
      }
      const slot = byStrategy.get(c.strategy);
      // count items not raw candidate hits — a single item could contribute
      // the same strategy twice (e.g. two data-* attrs with identical key).
      if (!seenForItem.has(c.strategy)) {
        slot.count++;
        seenForItem.add(c.strategy);
      }
      slot.values.add(c.value);
    }
  }
  // Sort: umbrella `:any` and broader (high-count) options bubble up; ties broken
  // by label so the dropdown is stable. Detailed descriptor options drop below.
  const out = Array.from(byStrategy.values()).map((o) => ({
    strategy: o.strategy,
    label: o.label,
    sample: o.sample,
    count: o.count,
    totalItems,
    varies: o.values.size > 1,
    coverage: o.count / Math.max(1, totalItems),
    isUmbrella: /(?::any\b|:any$)/.test(o.strategy),
  }));
  out.sort((a, b) => {
    // Umbrella first when coverage is comparable, otherwise highest coverage wins
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    if (a.isUmbrella !== b.isUmbrella) return a.isUmbrella ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return out;
}

// Initialize src.strategy from the parser's default winner (first candidate).
// This makes the dropdown show the right value on first render.
function seedDefaultStrategies(src) {
  if (!src) return;
  src.strategyByPattern = src.strategyByPattern || {};
  for (const it of src.items || []) {
    if (!it.pattern) continue;
    if (!src.strategyByPattern[it.pattern]) {
      src.strategyByPattern[it.pattern] = {};
    }
    const strat = src.strategyByPattern[it.pattern];

    if (typeof strat.exclude !== 'boolean') {
      strat.exclude = false;
    }

    if (!strat.title && it.titleCandidates?.length) {
      // pick the strategy whose value equals the current it.title, else first
      const match = it.titleCandidates.find((c) => c.value === it.title);
      strat.title = (match || it.titleCandidates[0]).strategy;
    }
    if (!strat.thumb && it.thumbCandidates?.length) {
      const match = it.thumbCandidates.find((c) => c.value === it.thumbnail);
      strat.thumb = (match || it.thumbCandidates[0]).strategy;
    }
    if (!strat.video) {
      strat.video = '__none__';
    }
  }
}

function renderSourceStrategyPicker() {
  const root = $('#source-strategy');
  if (!root) return;
  const disclosure = $('#extraction-advanced');
  const src = getActiveReviewSource();
  if (!src) {
    root.hidden = true;
    if (disclosure) disclosure.hidden = true;
    root.innerHTML = '';
    return;
  }
  // Always show the picker for every source that has any items — user wants
  // to pick title and image for everything, even when there's no ambiguity.
  // The defaults are the parser's best guess; the dropdown lets the user
  // confirm or override.
  const rows = [];
  seedDefaultStrategies(src);
  const groups = new Map();
  for (const it of src.items || []) {
    const pattern = it.pattern || 'Other';
    if (!groups.has(pattern)) groups.set(pattern, []);
    groups.get(pattern).push(it);
  }

  for (const [pattern, items] of groups.entries()) {
    const titleOpts = buildPickerOptionsForGroup(items, 'title');
    const thumbOpts = buildPickerOptionsForGroup(items, 'thumb');
    const videoOpts = buildPickerOptionsForGroup(items, 'video');
    const showTitle = titleOpts.length >= 1;
    const showThumb = thumbOpts.length >= 1;
    const showVideo = videoOpts.length >= 1;
    if (!showTitle && !showThumb && !showVideo) continue;

    const currentStrategy = src.strategyByPattern[pattern] || {};
    rows.push({ src, pattern, items, titleOpts, thumbOpts, videoOpts, showTitle, showThumb, showVideo, currentStrategy });
  }
  if (rows.length === 0) {
    root.hidden = true;
    if (disclosure) disclosure.hidden = true;
    root.innerHTML = '';
    return;
  }
  const srcIdx = state.sources.findIndex((s) => s.id === src.id);
  if (disclosure) disclosure.hidden = false;
  root.hidden = false;
  root.innerHTML = `
    <div class="strategy-picker__head">
      <h3>${escapeText(displayName(src, srcIdx))}</h3>
      <p class="muted">Override Linkforge’s best guesses for this source.</p>
    </div>
    <div class="strategy-picker__list">
      ${rows.map(({ src, pattern, items, titleOpts, thumbOpts, videoOpts, showTitle, showThumb, showVideo, currentStrategy }) => `
        <div class="strategy-row ${currentStrategy.exclude ? 'strategy-row--excluded' : ''}" data-src-id="${escapeAttr(src.id)}">
          <div class="strategy-row__header">
            <div class="strategy-row__header-left">
              <span class="strategy-row__name">${escapeText(src.name || 'Untitled source')}</span>
              <span class="strategy-row__count muted">${items.length} link${items.length === 1 ? '' : 's'} matching <code class="strategy-row__pattern" title="${escapeAttr(pattern)}">${escapeText(pattern)}</code></span>
            </div>
            <div class="strategy-row__header-right">
              <label class="strategy-row__toggle">
                <input type="checkbox" data-strategy-include data-src-id="${escapeAttr(src.id)}" data-pattern="${escapeAttr(pattern)}" ${currentStrategy.exclude ? '' : 'checked'} />
                <span>Include this tag group</span>
              </label>
            </div>
          </div>
          <div class="strategy-row__workspace" ${currentStrategy.exclude ? 'aria-disabled="true"' : ''}>
            <div class="strategy-row__fields">
              ${showTitle ? renderStrategySelect('title', src, titleOpts, currentStrategy.title, pattern) : ''}
              ${showThumb ? renderStrategySelect('thumb', src, thumbOpts, currentStrategy.thumb, pattern, { allowNone: true }) : ''}
              ${showVideo ? renderStrategySelect('video', src, videoOpts, currentStrategy.video, pattern, { allowNone: true, optional: true }) : ''}
            </div>
            <div class="strategy-row__previews" ${currentStrategy.exclude ? 'style="display:none;"' : ''}>
              ${items.map(it => {
                const hasThumb = !!it.thumbnail;
                const thumbUrl = hasThumb ? it.thumbnail : '';
                return `
                  <div class="strategy-preview-card">
                    <div class="strategy-preview-card__media">
                      ${hasThumb 
                        ? `<img src="${escapeAttr(thumbUrl)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className: 'strategy-preview-card__no-img', textContent: 'Err'}))" />`
                        : `<div class="strategy-preview-card__no-img"><span>No img</span></div>`
                      }
                    </div>
                    <div class="strategy-preview-card__info">
                      <p class="strategy-preview-card__title" title="${escapeAttr(it.title || '')}">${escapeText(it.title || 'Untitled')}</p>
                      <span class="strategy-preview-card__url" title="${escapeAttr(it.href || '')}">${escapeText(it.domain || '')}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  // bind change handlers
  root.querySelectorAll('select[data-strategy-field]').forEach((sel) => {
    sel.addEventListener('change', onStrategyChange);
  });
  root.querySelectorAll('input[data-strategy-include]').forEach((checkbox) => {
    checkbox.addEventListener('change', onStrategyIncludeToggle);
  });
}

function renderStrategySelect(field, src, options, currentStrategyVal, pattern, opts = {}) {
  const { allowNone = false, optional = false } = opts;
  const labelText = field === 'title' ? 'Title' : field === 'thumb' ? 'Image' : 'Video preview';
  const current = currentStrategyVal || (options[0]?.strategy) || '__none__';
  // Group options into two buckets so the dropdown stays scannable when many
  // strategy keys exist across mixed categories of links:
  //   - Universal: option covers every item in the source ("all N"). Picking
  //     it works for every link without leaving any card blank.
  //   - Partial: option covers only a subset of items (one category). Useful
  //     when the source actually contains a single category of href, or when
  //     the user wants the fine-grained descriptor for a specific category.
  // Inside each group, umbrella (`:any`) keys are first, then by coverage.
  const total = (options[0]?.totalItems) || 0;
  const fmtOption = (o) => {
    const totalN = o.totalItems || 0;
    const allMatch = totalN > 0 && o.count === totalN;
    const coverageTag = allMatch ? `all ${totalN}` : `${o.count} of ${totalN}`;
    const preview = o.varies ? 'varies per link' : (truncate(o.sample || '', 48) || '(empty)');
    const optLabel = `${o.label} — ${preview} · ${coverageTag}`;
    return `<option value="${escapeAttr(o.strategy)}" ${o.strategy === current ? 'selected' : ''}>${escapeText(optLabel)}</option>`;
  };
  const universal = options.filter((o) => total > 0 && o.count === total);
  const partial = options.filter((o) => !(total > 0 && o.count === total));
  const universalHtml = universal.length
    ? `<optgroup label="Works for every link">${universal.map(fmtOption).join('')}</optgroup>`
    : '';
  const partialHtml = partial.length
    ? `<optgroup label="Works for a subset (some links will be empty)">${partial.map(fmtOption).join('')}</optgroup>`
    : '';
  const optHtml = universalHtml + partialHtml;
  const noneHtml = allowNone
    ? `<option value="__none__" ${current === '__none__' ? 'selected' : ''}>${optional ? 'No video preview' : `No ${field}`}</option>`
    : '';
  return `
    <label class="strategy-field">
      <span class="strategy-field__label">${labelText}</span>
      <select data-strategy-field="${field}" data-src-id="${escapeAttr(src.id)}" data-pattern="${escapeAttr(pattern)}">
        ${optHtml}
        ${noneHtml}
      </select>
    </label>
  `;
}

function onStrategyChange(e) {
  const sel = e.currentTarget;
  const srcId = sel.dataset.srcId;
  const field = sel.dataset.strategyField;
  const pattern = sel.dataset.pattern;
  const value = sel.value;
  const src = state.sources.find((s) => s.id === srcId);
  if (!src) return;
  src.strategyByPattern = src.strategyByPattern || {};
  if (!src.strategyByPattern[pattern]) src.strategyByPattern[pattern] = {};
  src.strategyByPattern[pattern][field] = value;
  // Re-flatten so the new title/thumb/video shows up in state.items, then
  // re-render the categories panel. Preserve user's enabled toggles.
  flattenSourcesIntoItems({ resetEnabled: false });
  renderReview();
}

function onStrategyIncludeToggle(e) {
  const checkbox = e.currentTarget;
  const srcId = checkbox.dataset.srcId;
  const pattern = checkbox.dataset.pattern;
  const src = state.sources.find((s) => s.id === srcId);
  if (!src) return;
  src.strategyByPattern = src.strategyByPattern || {};
  if (!src.strategyByPattern[pattern]) src.strategyByPattern[pattern] = {};
  src.strategyByPattern[pattern].exclude = !checkbox.checked;
  flattenSourcesIntoItems({ resetEnabled: false });
  renderReview();
}

function truncate(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

let reviewPreviewTimer = null;

function refreshReviewPreview({ immediate = false } = {}) {
  const frame = $('#review-live-preview');
  if (!frame || !state.items.length) return;
  clearTimeout(reviewPreviewTimer);
  const render = () => {
    try {
      frame.srcdoc = buildGeneratedSite();
      const template = window.LINKFORGE_TEMPLATES?.[state.site.template];
      const label = $('#review-preview-template');
      if (label) label.textContent = template?.name || 'Preview';
    } catch (err) {
      console.error(err);
    }
  };
  if (immediate) render();
  else reviewPreviewTimer = setTimeout(render, 180);
}

function setReviewMode(mode) {
  const workbench = $('.review-workbench');
  if (!workbench || (mode !== 'edit' && mode !== 'preview')) return;
  workbench.dataset.reviewView = mode;
  const mobile = matchMedia('(max-width: 767px)').matches;
  const editor = $('.review-editor');
  const preview = $('.review-preview');
  if (editor) editor.hidden = mobile && mode !== 'edit';
  if (preview) preview.hidden = mobile && mode !== 'preview';
  $$('[data-review-mode]').forEach((button) => {
    const active = button.dataset.reviewMode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (mode === 'preview') refreshReviewPreview({ immediate: true });
}

function syncReviewModeForViewport() {
  const mode = $('.review-workbench')?.dataset.reviewView || 'edit';
  setReviewMode(mode);
}

function renderReview() {
  ensureActiveReviewSource();
  updateReviewMeta();
  renderReviewSourceStepper();
  updateReviewPrimaryAction();

  renderSourceStrategyPicker();
  renderTemplatePicker();

  const root = $('#categories');
  root.innerHTML = '';

  const activeSource = getActiveReviewSource();
  const activeItems = getActiveReviewItems();
  const activeSourceName = $('[data-active-source-name]');
  if (activeSourceName) {
    activeSourceName.textContent = activeSource
      ? displayName(activeSource, state.sources.findIndex((s) => s.id === activeSource.id))
      : '';
  }

  if (!activeSource || activeItems.length === 0) {
    root.innerHTML = `
      <div class="empty">
        <h3>No items found.</h3>
        <p>Go back and paste HTML that contains anchor tags, images, or videos.</p>
      </div>
    `;
    return;
  }

  // Group by existing category: article, video, gallery, link.
  const grouped = new Map();
  for (const it of activeItems) {
    const k = it.category || 'link';
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(it);
  }

  const header = document.createElement('section');
  header.className = 'source-finalized';
  header.innerHTML = `
    <h3 class="source-finalized__title">Extracted links and media</h3>
    <span class="source-finalized__source">${escapeText(displayName(activeSource, state.sources.findIndex((s) => s.id === activeSource.id)))}</span>
  `;
  root.appendChild(header);

  CATEGORY_ORDER.forEach((key, idx) => {
    const items = grouped.get(key);
    if (!items || items.length === 0) return;
    // Show all groups open by default so the user can immediately see images/titles
    root.appendChild(renderGroupPanel(key, items, true));
  });
  applyReviewItemFilter();
  updateReviewSelectionSummary();
  refreshReviewPreview();
}

function renderGroupPanel(key, items, openByDefault) {
  const title = CATEGORY_META[key]?.title || key;
  const desc = CATEGORY_META[key]?.desc || '';
  const enabled = items.filter((i) => i.enabled).length;
  const allOn = enabled === items.length;
  const someOn = enabled > 0 && enabled < items.length;

  const panel = document.createElement('section');
  panel.className = 'group-panel';
  if (openByDefault) panel.classList.add('group-panel--open');
  panel.innerHTML = `
    <header class="group-panel__head">
      <label class="group-checkbox" title="Toggle all in this group">
        <input type="checkbox" data-group-toggle ${allOn ? 'checked' : ''} ${someOn ? 'data-indeterminate="true"' : ''} />
        <span class="group-checkbox__box"></span>
      </label>
      <button type="button" class="group-panel__toggle" aria-expanded="${openByDefault ? 'true' : 'false'}">
        <span class="group-panel__title">${escapeText(title)}</span>
        <span class="group-panel__count">${enabled} / ${items.length}</span>
        <svg class="group-panel__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      ${desc ? `<p class="group-panel__desc">${escapeText(desc)}</p>` : ''}
    </header>
    <div class="group-panel__body"></div>
  `;

  const body = panel.querySelector('.group-panel__body');
  items.forEach((it) => body.appendChild(renderItemRow(it)));

  // Fix indeterminate after attaching
  const groupChk = panel.querySelector('[data-group-toggle]');
  if (someOn) {
    requestAnimationFrame(() => {
      groupChk.indeterminate = true;
    });
  }

  // Group checkbox: select / deselect all in this group
  groupChk.addEventListener('change', (e) => {
    e.stopPropagation();
    const turnOn = groupChk.checked;
    items.forEach((it) => (it.enabled = turnOn));
    renderReview();
  });

  // Collapse toggle
  panel.querySelector('.group-panel__toggle').addEventListener('click', () => {
    panel.classList.toggle('group-panel--open');
    const expanded = panel.classList.contains('group-panel--open');
    panel.querySelector('.group-panel__toggle').setAttribute('aria-expanded', expanded);
  });

  return panel;
}

function renderItemRow(item) {
  const row = document.createElement('label');
  row.className = 'item-row';
  if (!item.enabled) row.classList.add('item-row--off');
  row.dataset.id = item.id;
  row.dataset.reviewFilterKind = reviewFilterOf(item);

  const thumbHtml = item.thumbnail
    ? `<div class="item-row__thumb ${item.category === 'video' ? 'item-row__thumb--video' : ''}">
         <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('item-row__thumb--empty'); this.remove();" />
         ${item.category === 'video' ? '<span class="item-row__play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' : ''}
       </div>`
    : `<div class="item-row__thumb item-row__thumb--empty"><span>${escapeText((item.domain || item.title || 'L').charAt(0).toUpperCase())}</span></div>`;

  row.innerHTML = `
    <input type="checkbox" class="item-row__check" ${item.enabled ? 'checked' : ''} />
    <span class="item-row__box"></span>
    ${thumbHtml}
    <div class="item-row__body">
      <p class="item-row__title">${escapeText(item.title)}</p>
      <div class="item-row__meta">
        <span class="item-row__domain">${escapeText(item.domain)}</span>
      </div>
      <span class="item-row__url">${escapeText(item.href)}</span>
    </div>
  `;

  const check = row.querySelector('.item-row__check');
  check.addEventListener('change', () => {
    item.enabled = check.checked;
    row.classList.toggle('item-row--off', !item.enabled);
    // Update parent group + meta counts without re-rendering everything
    updateGroupHeader(row);
    updateReviewMeta();
    updateReviewSelectionSummary();
    refreshReviewPreview();
  });

  return row;
}

function updateGroupHeader(row) {
  const panel = row.closest('.group-panel');
  if (!panel) return;
  const checks = Array.from(panel.querySelectorAll('.item-row__check'));
  const onCount = checks.filter((c) => c.checked).length;
  const groupChk = panel.querySelector('[data-group-toggle]');
  groupChk.checked = onCount === checks.length;
  groupChk.indeterminate = onCount > 0 && onCount < checks.length;
  panel.querySelector('.group-panel__count').textContent = `${onCount} / ${checks.length}`;
}

function updateReviewMeta() {
  const meta = $('[data-review-meta]');
  if (!meta) return;
  const enabledCount = state.items.filter((i) => i.enabled).length;
  const reviewable = getReviewableSources();
  const active = getActiveReviewSource();
  const activeIdx = active ? reviewable.findIndex((s) => s.id === active.id) : -1;
  meta.innerHTML = `
    <span><strong>${enabledCount}</strong> / ${state.items.length} selected</span>
    <span>${reviewable.length} source${reviewable.length === 1 ? '' : 's'} to review</span>
    ${activeIdx >= 0 ? `<span>On source ${activeIdx + 1}</span>` : ''}
  `;
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
  if (item.thumbnail) {
    const videoOverlay = item.category === 'video' ? `
      <div class="item-card__play">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
      </div>` : '';
    return `
      <div class="item-card__media ${item.category === 'video' ? 'item-card__media--video' : ''}">
        <img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('item-card__media--empty'); this.remove();" />
        ${videoOverlay}
      </div>
    `;
  }
  // empty card — show initial of domain
  const mark = (item.domain || item.title || 'L').charAt(0).toUpperCase();
  return `
    <div class="item-card__media item-card__media--empty">
      <span class="item-card__empty-mark">${escapeText(mark)}</span>
    </div>
  `;
}

// bulk actions
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bulk]');
  if (!btn) return;
  const mode = btn.dataset.bulk;
  // Scope Select all / Deselect all to the current view — the active source AND
  // the active category filter — so "Select all" while viewing Images only
  // toggles the images you can see, not hidden links/videos in other tabs.
  const targetItems = getReviewScopedItems();
  for (const it of targetItems) {
    if (mode === 'all') it.enabled = true;
    else if (mode === 'none') it.enabled = false;
    else if (mode === 'with-image') it.enabled = !!it.thumbnail;
  }
  renderReview();
});

// ===================================================
// STEP 3 — GENERATE FINAL SITE
// ===================================================

const TEMPLATE_DEFAULTS = {
  youtube: {
    title: DEFAULT_SITE_TITLE,
    tagline: DEFAULT_SITE_TAGLINE
  },
  wall: {
    title: DEFAULT_SITE_TITLE,
    tagline: DEFAULT_SITE_TAGLINE
  },
  signal: {
    title: DEFAULT_SITE_TITLE,
    tagline: DEFAULT_SITE_TAGLINE
  },
  editorial: {
    title: DEFAULT_SITE_TITLE,
    tagline: DEFAULT_SITE_TAGLINE
  }
};
const DEFAULT_TEMPLATE_TITLES = new Set(Object.values(TEMPLATE_DEFAULTS).map((d) => d.title));
const DEFAULT_TEMPLATE_TAGLINES = new Set(Object.values(TEMPLATE_DEFAULTS).map((d) => d.tagline));

// ---------- TEMPLATE PICKER UI ----------
function countByCategory(items) {
  // Provide both bucket counts (for suggesting templates from the 3-bucket world)
  // and legacy category counts (article/video/gallery/link) for back-compat.
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

  // Build a minimal ctx for template-level validation (just what validators need).
  const validationCtx = { sourceGroups: [{ name: 'all', items: enabled }] };

  // pick default if not already set (and don't default to a template that would reject)
  const templates = Object.entries(window.LINKFORGE_TEMPLATES);
  const isRejected = (tpl) => {
    if (!tpl.validate) return false;
    const v = tpl.validate(validationCtx);
    return v && v.ok === false;
  };
  if (!state.site.template || !window.LINKFORGE_TEMPLATES[state.site.template] || isRejected(window.LINKFORGE_TEMPLATES[state.site.template])) {
    state.site.template = suggested;
  }

  // Featured templates first, then the rest in declaration order.
  const ordered = templates.slice().sort((a, b) => {
    const af = a[1].featured ? 0 : 1;
    const bf = b[1].featured ? 0 : 1;
    return af - bf;
  });

  for (const [key, tpl] of ordered) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'template-card';
    if (tpl.featured) card.classList.add('template-card--featured');
    if (state.site.template === key) card.classList.add('template-card--active');
    card.dataset.template = key;
    card.setAttribute('aria-pressed', state.site.template === key ? 'true' : 'false');

    let disabledReason = null;
    if (tpl.validate) {
      const v = tpl.validate(validationCtx);
      if (v && v.ok === false) disabledReason = v.reason;
    }
    if (disabledReason) {
      card.classList.add('template-card--disabled');
      card.setAttribute('aria-disabled', 'true');
      card.title = disabledReason;
    }

    card.innerHTML = `
      <div class="template-card__meta">
        ${tpl.featured ? `<span class="template-card__badge">Featured</span>` : ''}
        ${key === suggested ? '<span class="template-card__suggested">Suggested</span>' : ''}
      </div>
      <div class="template-card__preview">${tpl.preview()}</div>
      <div class="template-card__body">
        <div class="template-card__name">${escapeText(tpl.name)}</div>
        <div class="template-card__desc">${escapeText(tpl.desc)}</div>
        ${tpl.fit ? `<div class="template-card__fit">${escapeText(tpl.fit)}</div>` : ''}
        ${disabledReason ? `<div class="template-card__reason">${escapeText(disabledReason)}</div>` : ''}
      </div>
    `;
    card.addEventListener('click', () => {
      if (disabledReason) { showToast(disabledReason); return; }

      const currentTitle = $('#site-title').value.trim();
      const currentTagline = $('#site-tagline').value.trim();

      const isTitleDefault = !currentTitle || DEFAULT_TEMPLATE_TITLES.has(currentTitle);

      const isTaglineDefault = !currentTagline || DEFAULT_TEMPLATE_TAGLINES.has(currentTagline);

      state.site.template = key;

      if (isTitleDefault) {
        const newTitle = TEMPLATE_DEFAULTS[key]?.title || DEFAULT_SITE_TITLE;
        $('#site-title').value = newTitle;
        state.site.title = newTitle;
      }
      if (isTaglineDefault) {
        const newTagline = TEMPLATE_DEFAULTS[key]?.tagline || DEFAULT_SITE_TAGLINE;
        $('#site-tagline').value = newTagline;
        state.site.tagline = newTagline;
      }

      $$('.template-card').forEach((c) => {
        const active = c.dataset.template === key;
        c.classList.toggle('template-card--active', active);
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      refreshReviewPreview({ immediate: true });
    });
    grid.appendChild(card);
  }

  // Initialize template carousel controls
  const viewport = $('.template-carousel__viewport');
  const prevBtn = $('.template-carousel__btn--prev');
  const nextBtn = $('.template-carousel__btn--next');
  const dotsContainer = $('#template-carousel-dots');
  const cards = Array.from(grid.children);

  if (viewport && dotsContainer) {
    dotsContainer.innerHTML = '';
    
    // Create dot indicators
    cards.forEach((card, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'template-carousel__dot' + (card.classList.contains('template-card--active') ? ' template-carousel__dot--active' : '');
      dot.setAttribute('aria-label', `Go to template ${index + 1}`);
      dot.addEventListener('click', () => {
        const cardWidth = card.offsetWidth + 16; // width + gap
        viewport.scrollTo({
          left: index * cardWidth,
          behavior: 'smooth'
        });
      });
      dotsContainer.appendChild(dot);
    });

    const updateControls = () => {
      const scrollLeft = viewport.scrollLeft;
      const cardWidth = cards[0]?.offsetWidth + 16 || 296;
      const activeIndex = Math.round(scrollLeft / cardWidth);

      // Update dot active state
      Array.from(dotsContainer.children).forEach((dot, index) => {
        dot.classList.toggle('template-carousel__dot--active', index === activeIndex);
      });

      // Update arrow buttons disabled state
      if (prevBtn) prevBtn.disabled = scrollLeft <= 4;
      if (nextBtn) {
        const maxScroll = viewport.scrollWidth - viewport.clientWidth;
        nextBtn.disabled = scrollLeft >= maxScroll - 4;
      }
    };

    // Scroll handlers for arrow buttons
    if (prevBtn) {
      prevBtn.onclick = () => {
        const cardWidth = cards[0]?.offsetWidth + 16 || 296;
        viewport.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        const cardWidth = cards[0]?.offsetWidth + 16 || 296;
        viewport.scrollBy({ left: cardWidth, behavior: 'smooth' });
      };
    }

    viewport.addEventListener('scroll', updateControls);
    // Initialize state
    setTimeout(updateControls, 100);
  }
}

// ---------- BUILD GENERATED SITE ----------
function buildGeneratedSite() {
  state.site.title = $('#site-title').value.trim() || DEFAULT_SITE_TITLE;
  state.site.tagline = $('#site-tagline').value.trim() || DEFAULT_SITE_TAGLINE;

  // The final site uses the same three buckets shown on the review page:
  //   withImage  -> rendered as image-card grid (articles section)
  //   withVideo  -> rendered as video card grid (videos section)
  //   plain      -> rendered as text-only link list (links section)
  // We also keep `gallery` (standalone images) as a separate bucket so
  // thumbnail-first templates can treat image-only links as preview cards.
  const enabled = state.items.filter((i) => i.enabled);
  const withImage = enabled.filter((i) => bucketOf(i) === 'with-image');
  const videos = enabled.filter((i) => bucketOf(i) === 'with-video');
  const links = enabled.filter((i) => bucketOf(i) === 'plain');

  // For template compatibility, split withImage into
  //   articles (have an outbound href, i.e. not pure standalone images)
  //   gallery  (standalone images where href === thumbnail)
  const articles = withImage.filter((i) => i.category !== 'gallery');
  const gallery = withImage.filter((i) => i.category === 'gallery');

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Group enabled items by source name, preserving the order sources were added.
  // Each source's display name (typed value, or auto "Source N") is the canonical
  // group label. Items keep an `id` ref to their source so we can re-resolve the
  // name at render time even if the name was edited after paste.
  const bySource = [];
  const sourceIndex = new Map(); // sourceId -> bySource index
  const idToName = new Map();    // sourceId -> display name
  state.sources.forEach((src, idx) => {
    const name = displayName(src, idx);
    idToName.set(src.id, name);
    sourceIndex.set(src.id, bySource.length);
    bySource.push({ name, items: [] });
  });
  // Build a name->bySource fallback for items whose sourceId we can't map.
  const nameIndex = new Map();
  state.sources.forEach((src, idx) => {
    const name = displayName(src, idx);
    if (!nameIndex.has(name)) nameIndex.set(name, sourceIndex.get(src.id));
  });
  for (const it of enabled) {
    // Prefer sourceId binding (survives name edits). Fall back to sourceName lookup,
    // then to a free-standing "Unsourced" bucket as a last resort.
    let bucketIdx = it.sourceId ? sourceIndex.get(it.sourceId) : undefined;
    if (bucketIdx === undefined && it.sourceName) bucketIdx = nameIndex.get(it.sourceName);
    if (bucketIdx === undefined) {
      const key = it.sourceName || 'Unsourced';
      if (!nameIndex.has(key)) {
        nameIndex.set(key, bySource.length);
        bySource.push({ name: key, items: [] });
      }
      bucketIdx = nameIndex.get(key);
    }
    // Overwrite item.sourceName with the current canonical name (so cards/kickers
    // reflect the latest typed value).
    if (it.sourceId && idToName.has(it.sourceId)) it.sourceName = idToName.get(it.sourceId);
    bySource[bucketIdx].items.push(it);
  }
  // Drop empty source groups
  const sourceGroups = bySource.filter((g) => g.items.length > 0);

  const ctx = {
    title: state.site.title,
    tagline: state.site.tagline,
    articles, videos, gallery, links,
    all: enabled,
    sourceGroups,
    today,
  };

  const tpl = window.LINKFORGE_TEMPLATES[state.site.template] || window.LINKFORGE_TEMPLATES.youtube || window.LINKFORGE_TEMPLATES.editorial;
  if (tpl.validate) {
    const check = tpl.validate(ctx);
    if (check && check.ok === false) {
      const err = new Error(check.reason || 'This template cannot render the current selection.');
      err.friendly = true;
      throw err;
    }
  }
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
  let html;
  try {
    html = buildGeneratedSite();
  } catch (err) {
    if (err && err.friendly) {
      showToast(err.message);
      return;
    }
    console.error(err);
    showToast('Something went wrong generating the site.');
    return;
  }
  const iframe = $('#preview-frame');
  iframe.srcdoc = html;
  iframe._html = html;

  const label = $('#btn-download-label');
  if (label) label.textContent = 'Download HTML';

  showScreen('step-output');
}

function siteSlug() {
  return (state.site.title || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
}

function downloadHtml() {
  const html = $('#preview-frame')._html || buildGeneratedSite();

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${siteSlug()}.html`;
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
  const reviewFilter = e.target.closest('[data-review-filter]');
  if (reviewFilter) {
    reviewState.filter = reviewFilter.dataset.reviewFilter;
    applyReviewItemFilter();
    updateReviewSelectionSummary();
    return;
  }
  const reviewMode = e.target.closest('[data-review-mode]');
  if (reviewMode) {
    setReviewMode(reviewMode.dataset.reviewMode);
    return;
  }
  const previewWidth = e.target.closest('[data-preview-width]');
  if (previewWidth) {
    const canvas = $('.review-preview__canvas');
    if (canvas) canvas.dataset.previewSize = previewWidth.dataset.previewWidth;
    $$('[data-preview-width]').forEach((button) => {
      const active = button === previewWidth;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    return;
  }
  if (e.target.closest('[data-add-source]')) {
    addSource();
    return;
  }
  if (e.target.closest('[data-reset-all-sources]')) {
    resetAllSources();
    return;
  }
  if (e.target.closest('[data-reset-review-source]')) {
    resetReviewSource();
    return;
  }
  if (e.target.closest('[data-reset-review-all]')) {
    resetReviewAll();
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
$('#btn-generate').addEventListener('click', handleReviewPrimaryAction);
$('#btn-download').addEventListener('click', downloadHtml);
['site-title', 'site-tagline'].forEach((id) => {
  $(`#${id}`)?.addEventListener('input', () => {
    if (id === 'site-title') {
      const heading = $('#review-collection-heading');
      if (heading) heading.textContent = $(`#${id}`).value.trim() || DEFAULT_SITE_TITLE;
    }
    refreshReviewPreview();
  });
});
$('#review-collection-heading')?.addEventListener('input', (event) => {
  const value = event.currentTarget.textContent.replace(/\s+/g, ' ').trim().slice(0, 80);
  $('#site-title').value = value;
  refreshReviewPreview();
});
$('#review-collection-heading')?.addEventListener('blur', (event) => {
  if (event.currentTarget.textContent.trim()) return;
  event.currentTarget.textContent = DEFAULT_SITE_TITLE;
  $('#site-title').value = DEFAULT_SITE_TITLE;
  refreshReviewPreview({ immediate: true });
});
window.addEventListener('resize', syncReviewModeForViewport);

// Publish-to-Vercel was removed: hosting user-generated pages on a shared
// Vercel account is an abuse vector (anyone could fill the project quota or
// publish illegal content under our deployment). Users now download the HTML
// and host it wherever they like.

// file upload
// If the first source is empty, fill it with the first uploaded file instead
// of appending a new card. (Otherwise users see Source 1 sit empty while their
// upload lands in Source 2.)
$('#file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const html = await file.text();
    // Derive the source name from the HTML's own domain (via runParse below),
    // exactly like paste and "add file to source" — not from the file name —
    // so a source is named the same way no matter how its HTML arrived.
    const firstEmpty = state.sources.find((s) => !s.html.trim());
    if (firstEmpty) {
      firstEmpty.name = '';
      firstEmpty.customName = false;
      firstEmpty.fragments = [{ id: uid(), name: file.name, html, kind: 'manual' }];
      syncSourceHtml(firstEmpty);
      // items + banner state get populated by renderSources → runParse below
    } else {
      addSource({ html });
    }
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
  const files = Array.from(e.dataTransfer?.files || []);
  if (!files.length) return;
  e.preventDefault();
  const src = state.sources.find((s) => s.id === card.dataset.id);
  if (src) {
    await appendFilesToSource(src, files);
    // items + banner state get populated by renderSources → runParse below
    renderSources();
  }
});

// ===================================================
// SAMPLE DATA
// ===================================================

function loadSample() {
  state.sources = [];

  // Mixed-media sample with lazy-loaded thumbnails: every image keeps a
  // generic logo in `src` and the real item image in `data-src`.
  addSource({
    name: 'Weekend finds — sample',
    html: `<!doctype html><html>
      <head>
        <meta property="og:url" content="https://collection.example/" />
        <meta property="og:image" content="https://collection.example/logo.png" />
      </head>
      <body>
        <section id="places" aria-label="Places">
          <h2>Places</h2>
          <a href="https://unsplash.com/photos/moraine-lake">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=900" alt="Mountain lake" />
            <h3>Moraine Lake, Banff National Park</h3>
          </a>
          <a href="https://unsplash.com/photos/forest-cabin">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=900" alt="Cabin in a forest" />
            <h3>Cabin hideaways in the Pacific Northwest</h3>
          </a>
          <a href="https://unsplash.com/photos/ocean-surf">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=900" alt="Surfer on a wave" />
            <h3>Surf session highlights</h3>
          </a>
        </section>

        <section id="design" aria-label="Design">
          <h2>Design</h2>
          <a href="https://www.behance.net/gallery/color-and-shape">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=900" alt="Colorful abstract forms" />
            <h3>Color &amp; shape inspiration</h3>
          </a>
          <a href="https://store.example.com/minimal-chair">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=900" alt="Minimal wooden chair" />
            <h3>Minimal chair collection</h3>
          </a>
          <a href="https://design.example.com/material-library">
            Material library for small spaces
          </a>
        </section>

        <section id="sound-and-motion" aria-label="Sound and motion">
          <h2>Sound &amp; motion</h2>
          <a href="https://vimeo.com/76979871">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900" alt="Motion design screen" />
            <h3>Motion design reel</h3>
          </a>
          <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
            <h3>Studio session — live performance</h3>
          </a>
          <a href="https://www.youtube.com/watch?v=9bZkp7q19f0">
            <h3>Animation breakdown: light and form</h3>
          </a>
        </section>

        <section id="objects" aria-label="Objects">
          <h2>Objects</h2>
          <a href="https://shop.example.com/headphones">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900" alt="Black headphones" />
            <h3>Noise-cancelling headphones</h3>
          </a>
          <a href="https://www.rei.com/product/trail-runner">
            <img src="https://collection.example/logo.png" data-src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900" alt="Trail running shoe" />
            <h3>Trail runner GTX</h3>
          </a>
          <a href="https://music.example.com/chillwave-essentials">Chillwave essentials playlist</a>
        </section>
      </body>
    </html>`,
  });

  showToast('Sample loaded — review your collection');
}

// ===================================================
// INIT
// ===================================================

addSource();
