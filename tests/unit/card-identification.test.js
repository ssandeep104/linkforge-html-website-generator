// Workstream 2 — card identification. Every card shape reduces to a click
// target (anchor, data-URL clickable, ID-only clickable) that runs through
// one bucket pipeline; these pin the rules that make that generalize.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceWithMeta } from '../../parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');
const parse = (html, opts) => parseSourceWithMeta(html, 'T', opts).items;

// ---------- non-anchor clickables ----------

test('role=link data-href cards are items, resolved against the page origin', () => {
  const items = parse(fixture('vox-data-href-cards.html'));
  assert.deepEqual(items.map((i) => i.href), [
    'https://www.theverge.com/2026/06/10/foldable-phone-review',
    'https://www.theverge.com/2026/06/10/robot-vacuum-video',
    'https://www.theverge.com/2026/06/10/chip-shortage-explainer',
  ]);
  assert.equal(items[0].title, 'The new foldable finally fixes the crease');
});

test('a control nested inside a card is part of that card, not a card of its own', () => {
  const items = parse(fixture('vox-data-href-cards.html'));
  assert.ok(!items.some((i) => /vx-778899/.test(i.href)), 'the play button must not become an item');
  assert.equal(items.length, 3);
});

test('a clickable that wraps a real <a href> defers to the anchor', () => {
  const html = `<html><body>
    <div role="button" data-href="https://site.example/a"><a href="https://site.example/a-canonical"><h3>Story A</h3></a></div>
  </body></html>`;
  const items = parse(html);
  assert.deepEqual(items.map((i) => i.href), ['https://site.example/a-canonical']);
});

test('aria-hidden clickables are skipped', () => {
  const html = `<html><body>
    <div role="link" aria-hidden="true" data-href="https://site.example/dup"><h3>Duplicate</h3></div>
  </body></html>`;
  assert.equal(parse(html).length, 0);
});

test('an ID-only clickable without a usable title is UI and is not counted unresolved', () => {
  const { items, unresolvedCount } = parseSourceWithMeta('<div role="button" data-contentid="x1"></div>', 'T');
  assert.equal(items.length, 0);
  assert.equal(unresolvedCount, 0);
});

// ---------- background-image thumbnails ----------

test('thumbnails come from inline style on the anchor and from lazy-load data attributes', () => {
  const items = parse(fixture('bg-image-anchor-cards.html'));
  assert.equal(items[0].thumbnail, 'https://img.tiles.example/tile-1.jpg');
  assert.equal(items[1].thumbnail, 'https://img.tiles.example/tile-2.jpg');
});

test('a background-image on furniture (a channel logo) is never the thumbnail', () => {
  const items = parse(fixture('bg-image-anchor-cards.html'));
  assert.equal(items[2].title, 'Late Train');
  assert.equal(items[2].thumbnail, null);
  assert.equal(items[2].category, 'link');
});

test('lazysizes data-bg on a data-href card is its thumbnail', () => {
  const items = parse(fixture('vox-data-href-cards.html'));
  assert.equal(items[0].thumbnail, 'https://cdn.vox-cdn.com/thumbor/abc123/foldable.jpg');
});

// ---------- multi-anchor cards (#5) ----------

test('three anchors spelling one URL three ways merge into one item, byline excluded', () => {
  const items = parse(fixture('three-anchor-variant-urls.html'));
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.title), [
    'Storm season starts early on the coast',
    'City council approves the new bridge',
  ]);
  assert.deepEqual(items.map((i) => i.thumbnail), [
    'https://img.news.example/storm.jpg',
    'https://img.news.example/bridge.jpg',
  ]);
  assert.ok(!items.some((i) => /authors/.test(i.href)));
});

// ---------- video-card signals ----------

for (const name of ['cnn-video-carousel.html', 'guardian-video.html', 'reuters-video.html', 'wsj-video.html']) {
  test(`${name}: duration-chip cards are videos targeting their own page`, () => {
    const items = parse(fixture(name));
    assert.ok(items.length > 0);
    for (const it of items) {
      assert.equal(it.category, 'video');
      assert.equal(it.video?.src, it.href);
    }
  });
}

test('a duration chip on a LIST wrapper does not turn every item into a video', () => {
  const html = `<html><body><ul class="list-card">
    <li><a href="https://site.example/one"><img src="https://img.site.example/1.jpg" alt=""><h3>One</h3></a></li>
    <li><a href="https://site.example/two"><img src="https://img.site.example/2.jpg" alt=""><h3>Two</h3></a></li>
    <span class="playlist-duration">12:40</span>
  </ul></body></html>`;
  const items = parse(html);
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.category === 'article' && i.video === null));
});

test('a duration chip inside the card itself marks it as a video', () => {
  const html = `<html><body><div class="card">
    <a href="https://site.example/clip"><img src="https://img.site.example/c.jpg" alt=""><h3>Clip</h3></a>
    <span class="card__duration">3:05</span>
  </div></body></html>`;
  const [it] = parse(html);
  assert.equal(it.category, 'video');
  assert.equal(it.video.src, 'https://site.example/clip');
});

test('text that merely looks numeric is not a duration', () => {
  const html = `<html><body><div class="card">
    <a href="https://site.example/score"><img src="https://img.site.example/s.jpg" alt=""><h3>Final score</h3></a>
    <span class="duration-label">Duration: about a week</span>
  </div></body></html>`;
  assert.equal(parse(html)[0].category, 'article');
});

test('known video hosts stay videos by URL without a redundant video object', () => {
  const html = `<html><body><div class="card">
    <a href="https://vimeo.com/123456"><img src="https://i.vimeocdn.com/t.jpg" alt=""><h3>Reel</h3></a>
    <span class="duration">1:00</span>
  </div></body></html>`;
  const [it] = parse(html);
  assert.equal(it.category, 'video');
  assert.equal(it.video, null);
});
