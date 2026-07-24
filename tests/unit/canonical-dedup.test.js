// Guards the canonical de-duplication that stops the same destination from
// rendering as repeated cards. canonicalHref() is the grouping KEY: two URLs
// share it when they differ only by protocol, a leading www., a trailing
// slash, an in-page #fragment, or query-parameter order. Hashbang / hash-router
// routes and genuinely different params must stay distinct. parseSourceWithMeta
// must collapse anchor variants into ONE item while keeping the link verbatim.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta, canonicalHref } from '../../parser.js';

test('canonicalHref collapses protocol, www, trailing slash, fragment, param order', () => {
  const base = canonicalHref('https://news.example.com/story/x');
  assert.equal(canonicalHref('http://news.example.com/story/x'), base, 'http vs https');
  assert.equal(canonicalHref('https://www.news.example.com/story/x'), base, 'www. prefix');
  assert.equal(canonicalHref('https://news.example.com/story/x/'), base, 'trailing slash');
  assert.equal(canonicalHref('https://news.example.com/story/x#comments'), base, 'in-page fragment');
  assert.equal(
    canonicalHref('https://e.com/p?a=1&b=2'),
    canonicalHref('https://e.com/p?b=2&a=1'),
    'query-parameter order'
  );
});

test('canonicalHref keeps genuinely different destinations distinct', () => {
  assert.notEqual(
    canonicalHref('https://e.com/story/x'),
    canonicalHref('https://e.com/story/y'),
    'different paths'
  );
  assert.notEqual(
    canonicalHref('https://e.com/p?id=1'),
    canonicalHref('https://e.com/p?id=2'),
    'different param values'
  );
  // Hashbang / hash-router routes carry the page identity in the fragment.
  assert.notEqual(
    canonicalHref('https://e.com/app#/route/1'),
    canonicalHref('https://e.com/app#/route/2'),
    'SPA hash routes'
  );
});

test('parseSourceWithMeta merges URL variants of one story into a single item', () => {
  const html = `<base href="https://news.example.com/">
    <article class="card"><a href="/story/x"><img src="https://img.example/a.jpg"></a><h3><a href="/story/x">Story X</a></h3></article>
    <article class="card"><a href="/story/x/"><img src="https://img.example/a.jpg"></a><h3><a href="/story/x/">Story X</a></h3></article>
    <article class="card"><a href="/story/x#comments"><img src="https://img.example/a.jpg"></a><h3><a href="/story/x#comments">Story X</a></h3></article>
    <article class="card"><a href="https://www.news.example.com/story/x"><img src="https://img.example/a.jpg"></a><h3>Story X www</h3></article>
    <article class="card"><a href="/story/y"><img src="https://img.example/b.jpg"></a><h3><a href="/story/y">Story Y</a></h3></article>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 2, 'four variants of /story/x collapse to one; /story/y is separate');
  const hrefs = items.map((i) => i.href).sort();
  // The surviving href is a verbatim, working URL (first occurrence wins) —
  // never the protocol-stripped canonical key.
  for (const h of hrefs) assert.match(h, /^https:\/\//, 'stored href stays a real URL');
  assert.ok(hrefs.some((h) => h.includes('/story/x')), '/story/x survives');
  assert.ok(hrefs.some((h) => h.includes('/story/y')), '/story/y survives');
});

test('parseSourceWithMeta keeps SPA hash routes as separate items', () => {
  const html = `<base href="https://app.example.com/">
    <a href="/app#/route/1"><h3>Route One</h3></a>
    <a href="/app#/route/2"><h3>Route Two</h3></a>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 2, 'distinct hash-router routes must not merge');
});
