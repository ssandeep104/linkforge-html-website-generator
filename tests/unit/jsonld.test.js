// Pins extractJsonLd's dedup/selection heuristics: the richness score
// (headline:2, image:2, description:1) used to pick a winner when the same
// URL appears in multiple JSON-LD blocks, and image-array selection by
// largest declared width*height when an entry's `image` is a list of
// ImageObjects.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('picks the richer of two JSON-LD entries for the same URL', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@type":"NewsArticle","url":"https://example.com/rich","headline":"Rich Headline","image":"https://example.com/rich.jpg","description":"desc"}</script>
    <script type="application/ld+json">{"@type":"NewsArticle","url":"https://example.com/rich","headline":"Thin Headline Only"}</script>
  </head><body></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Rich Headline');
  assert.equal(items[0].thumbnail, 'https://example.com/rich.jpg');
});

test('picks the largest-area image when JSON-LD image is an array of ImageObjects', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@type":"NewsArticle","url":"https://example.com/img-area","headline":"Area Test","image":[{"@type":"ImageObject","url":"https://example.com/small.jpg","width":100,"height":100},{"@type":"ImageObject","url":"https://example.com/big.jpg","width":1200,"height":800}]}</script>
  </head><body></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://example.com/big.jpg');
});
