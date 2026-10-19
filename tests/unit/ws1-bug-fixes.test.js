// Workstream 1 regression tests — issues #9, #4 (residual) and #2.
//
// #9: NBC's vertical-video feed cards have no anchor/img/video/iframe at
//     all (role="button" + data-contentid, background-image thumb,
//     [data-testid="card-title"]) and parsed to ZERO items.
// #4: Bloomberg's <button data-video-url> cards resolved href/headline/
//     poster but carried video: null, so they could not be counted or
//     presented as videos.
// #2: generated output had no data-theme scoping at all, so its theme
//     toggle could not restyle cards/body. These tests build every
//     template, run the export's scripts in jsdom, click the real toggle,
//     and check that the palette variables driving body/cards actually
//     flip — the same real-click-path style as source-filter.test.js.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { parseSourceWithMeta } from '../../parser.js';
import { TEMPLATE_KEYS, buildHtml, context, items } from '../helpers/templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');

// ---------- issue #9: NBC vertical-video feed ----------

test('#9: NBC vertvideo fixture extracts 3 video items with title, thumbnail and target', () => {
  const { items: parsed, unresolvedCount } = parseSourceWithMeta(fixture('nbc-vertvideo-feed.html'), 'Repro');
  assert.equal(parsed.length, 3, `expected 3 items, got ${parsed.length}`);
  assert.equal(unresolvedCount, 0);
  assert.deepEqual(parsed.map((i) => i.title), [
    'Rare baby hippo makes appearance at Berlin Zoo',
    'Are the UFC fights at the White House unprecedented?',
    'Russian authorities investigate two car bombings in Moscow',
  ]);
  assert.deepEqual(parsed.map((i) => i.href), [
    'https://www.nbcnews.com/now/video/mmvo264919109909',
    'https://www.nbcnews.com/now/video/mmvo264814149890',
    'https://www.nbcnews.com/now/video/mmvo264912965718',
  ]);
  for (const item of parsed) {
    assert.match(item.thumbnail, /^https:\/\/media-cldnry\.s-nbcnews\.com\//, 'thumbnail comes from the background-image');
    assert.equal(item.category, 'video');
    assert.equal(item.video?.src, item.href, 'card is a video whose target is its watch URL');
    assert.equal(item.video?.poster, item.thumbnail);
    assert.equal(item.domain, 'nbcnews.com');
  }
});

// ---------- issue #4 residual: Bloomberg data-video-url ----------

test('#4: Bloomberg data-video-url cards carry video semantics', () => {
  const { items: parsed } = parseSourceWithMeta(fixture('bloomberg-video.html'), 'Repro');
  assert.equal(parsed.length, 3, `expected exactly the 3 cards (no duplicate standalone images), got ${parsed.length}`);
  for (const item of parsed) {
    assert.ok(item.video, `expected video semantics for ${item.title}`);
    assert.equal(item.video.src, item.href);
    assert.equal(item.video.poster, item.thumbnail);
    assert.equal(item.category, 'video');
    const cand = item.videoCandidates.find((c) => c.strategy === 'data-attr-video-url');
    assert.ok(cand, 'data-video-url surfaces as a video candidate');
    assert.equal(cand.value, item.href);
  }
});

// ---------- issue #2: generated-output theme toggle ----------

// Palette variable that paints each template's page background, and the
// values it must take in the native vs. toggled theme.
const PALETTES = {
  youtube: { var: '--creator-bg', native: 'dark', dark: '#0b1014', light: '#f6f4ef' },
  wall: { var: '--paper', native: 'light', dark: '#161512', light: '#f7f6f2' },
  flux: { var: '--flux-bg', native: 'dark', dark: '#080c0e', light: '#f4f6f6' },
  shelf: { var: '--shelf-bg', native: 'light', dark: '#101619', light: '#f7f8f8' },
};

const TWO_SOURCES = () => [
  { name: 'Src A', items: [...items('a', 3), ...items('alinks', 2, { thumbnail: false })] },
  { name: 'Src B', items: items('b', 2) },
];

for (const key of TEMPLATE_KEYS) {
  test(`#2: ${key}: theme toggle flips data-theme and the palette that paints body/cards`, () => {
    const pal = PALETTES[key];
    assert.ok(pal, `no palette expectation recorded for template ${key}`);
    const dom = new JSDOM(buildHtml(key, context(TWO_SOURCES())), { runScripts: 'dangerously' });
    const { document } = dom.window;
    const root = document.documentElement;
    const btn = document.querySelector('[data-lf-theme-toggle]');
    assert.ok(btn, 'generated page renders a theme toggle');
    const palette = () => dom.window.getComputedStyle(root).getPropertyValue(pal.var).trim();
    const other = pal.native === 'dark' ? 'light' : 'dark';

    assert.equal(root.getAttribute('data-theme'), pal.native, 'page opens on the template native theme');
    assert.equal(palette(), pal[pal.native]);

    btn.dispatchEvent(new dom.window.Event('click'));
    assert.equal(root.getAttribute('data-theme'), other, 'click flips data-theme');
    assert.equal(palette(), pal[other], 'click actually re-skins the page (body/card palette variable changed)');
    assert.equal(btn.getAttribute('aria-pressed'), other === 'dark' ? 'true' : 'false');

    btn.dispatchEvent(new dom.window.Event('click'));
    assert.equal(root.getAttribute('data-theme'), pal.native, 'second click flips back');
    assert.equal(palette(), pal[pal.native]);
  });

  test(`#2: ${key}: generated CSS carries a scoped opposite-theme block`, () => {
    const html = buildHtml(key, context(TWO_SOURCES()));
    const pal = PALETTES[key];
    const other = pal.native === 'dark' ? 'light' : 'dark';
    assert.match(html, new RegExp(`:root\\[data-theme="${other}"\\]`), 'opposite theme is scoped on data-theme, not prefers-color-scheme alone');
    assert.ok(html.includes('data-lf-theme-toggle'), 'toggle markup ships in the export');
  });
}
