// Pins isChromeAnchor's two filters (parser.js CHROME_PATH_PREFIXES /
// CHROME_CONTAINER_SELECTOR), added for Time.com-style homepages where
// nav/account/tag links pollute the output alongside real story links.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('drops anchors under a chrome path prefix (Time.com /tag/ pattern)', () => {
  const html = `<html><body>
    <article class="card"><a href="https://example.com/movies/some-review"><img src="https://example.com/img.jpg"><h2>Some Movie Review</h2></a></article>
    <a href="https://example.com/tag/movies">Movies</a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].href, 'https://example.com/movies/some-review');
});

test('drops anchors inside a <nav> container regardless of path', () => {
  const html = `<html><body>
    <nav><a href="https://example.com/home">Home</a></nav>
    <article class="card"><a href="https://example.com/story"><img src="https://example.com/a.jpg"><h2>Story Headline</h2></a></article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].href, 'https://example.com/story');
});
