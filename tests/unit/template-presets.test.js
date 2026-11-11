// Templates are presets rendered by one engine (templates.js). These pin the
// contract that makes adding a template a data-only change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { TEMPLATES, PRESETS, LAYOUTS, suggestTemplate, fontsHref, buildHtml, context, items } from '../helpers/templates.js';

const COLOR_KEYS = ['bg', 'surface', 'text', 'muted', 'line', 'accent', 'onAccent'];
const groups = () => [{ name: 'Src A', items: [...items('a', 7), ...items('alinks', 2, { thumbnail: false })] }];

test('every preset is complete and uses a registered layout', () => {
  assert.ok(PRESETS.length >= 5);
  assert.equal(new Set(PRESETS.map((p) => p.key)).size, PRESETS.length, 'keys are unique');
  for (const p of PRESETS) {
    for (const field of ['key', 'name', 'desc', 'focus', 'bestFor', 'theme', 'fonts', 'colors', 'layout', 'card']) {
      assert.ok(p[field], `${p.key}: missing ${field}`);
    }
    assert.ok(LAYOUTS[p.layout], `${p.key}: unknown layout ${p.layout}`);
    for (const theme of ['dark', 'light']) {
      for (const k of COLOR_KEYS) assert.match(p.colors[theme][k] || '', /^#[0-9a-f]{6}$/i, `${p.key}.${theme}.${k}`);
    }
    assert.ok(TEMPLATES[p.key], `${p.key} is registered`);
  }
});

test('each page loads only its own fonts and carries its own palette', () => {
  for (const p of PRESETS) {
    const html = buildHtml(p.key, context(groups()));
    assert.ok(html.includes(fontsHref(p.fonts).replace(/&/g, '&amp;')), `${p.key}: font link`);
    assert.ok(html.includes(`--bg: ${p.colors.dark.bg};`) && html.includes(`--bg: ${p.colors.light.bg};`), `${p.key}: both themes`);
    assert.match(html, new RegExp(`<html lang="en" data-theme="${p.theme}">`));
    assert.match(TEMPLATES[p.key].preview(), /^<svg /, `${p.key}: picker preview is generated`);
  }
});

test('adding a template is one preset object and nothing else', () => {
  // Evaluate templates.js with one extra preset appended, the way a
  // contributor would add it, and build a page from it.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(__dirname, '..', '..', 'templates.js'), 'utf8');
  const extra = `{
    key: 'sunset', name: 'Sunset', desc: 'Test preset.', focus: 'Video', bestFor: 'video', theme: 'dark',
    fonts: { display: 'Unbounded', body: 'Inter' },
    colors: {
      dark: { bg: '#1a0f0a', surface: '#2a1810', text: '#fff4ec', muted: '#c9a999', line: '#3a241a', accent: '#ff8a3d', onAccent: '#1a0f0a' },
      light: { bg: '#fff6ef', surface: '#ffffff', text: '#2a1408', muted: '#7a5a4a', line: '#f0dccf', accent: '#c2410c', onAccent: '#ffffff' },
    },
    hero: 'billboard', layout: 'posters', card: { radius: 4, title: 'overlay', hover: 'ring', meta: 'none' },
  },`;
  const patched = source.replace('const PRESETS = [', `const PRESETS = [${extra}`);
  assert.notEqual(patched, source);
  const sandbox = { module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(patched, sandbox);
  const { TEMPLATES: T } = sandbox.module.exports;
  assert.ok(T.sunset, 'the new preset is registered');
  const html = T.sunset.build(context(groups()));
  assert.ok(html.includes('family=Unbounded'));
  assert.ok(html.includes('--bg: #1a0f0a;'));
  assert.ok(html.includes('lf-hero--billboard') && html.includes('data-lf-grid'));
  assert.equal((html.match(/href="https:\/\/a\.example\//g) || []).length, 7, 'every card renders once');
  assert.match(T.sunset.preview(), /#ff8a3d/);
});

test('the suggestion follows each preset\'s bestFor', () => {
  const pick = (counts) => PRESETS.find((p) => p.key === suggestTemplate(counts));
  assert.equal(pick({ total: 10, video: 6 }).bestFor, 'video');
  assert.equal(pick({ total: 10, gallery: 5 }).bestFor, 'gallery');
  assert.equal(pick({ total: 10, link: 7 }).bestFor, 'link');
  assert.ok(pick({ total: 0 }));
});

test('rails chunk long sources and a list keeps preview-less items in the same list', () => {
  const long = [{ name: 'Long', items: items('long', 40) }];
  const rail = PRESETS.find((p) => LAYOUTS[p.layout].kind === 'rail');
  assert.ok((buildHtml(rail.key, context(long)).match(/data-lf-rail /g) || []).length >= 3);
  const list = PRESETS.find((p) => LAYOUTS[p.layout].kind === 'list');
  const html = buildHtml(list.key, context(groups()));
  assert.equal((html.match(/class="lf-row"/g) || []).length, 9);
  assert.ok(!html.includes('class="lf-links__heading"'), 'no separate link tail');
});
