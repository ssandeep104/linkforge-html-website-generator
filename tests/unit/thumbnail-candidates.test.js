// Pins thumbnail-candidate collection for lazy-load attribute conventions
// (WordPress/Jetpack's data-large-file, the Flickity carousel library's
// data-flickity-lazyload) and parseSrcset's comma-aware tokenizer, which
// must not split CDN transform URLs (Cloudinary's `f_auto,q_auto,w_400/...`)
// on their internal commas. These assert against thumbCandidates rather
// than the winning .thumbnail, because a plain <img src> (when present)
// outranks these as the default winner — the point here is that the
// candidate is still extracted correctly and offered in the picker.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('WordPress/Jetpack: extracts data-large-file as a thumbnail candidate', () => {
  const html = `<html><body>
    <article class="card"><a href="https://example.com/wp-post"><img data-large-file="https://example.com/full.jpg" src="https://example.com/tiny-placeholder.jpg"><h2>A WordPress Post</h2></a></article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  const candidate = items[0].thumbCandidates.find((c) => c.strategy === 'img-data-large-file');
  assert.equal(candidate?.value, 'https://example.com/full.jpg');
});

test('Flickity: extracts data-flickity-lazyload as the thumbnail when no <img src> exists', () => {
  const html = `<html><body>
    <article class="card"><a href="https://example.com/flickity-post"><img data-flickity-lazyload="https://example.com/flickity-full.jpg"><h2>A Carousel Post</h2></a></article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  const candidate = items[0].thumbCandidates.find((c) => c.strategy === 'img-data-flickity-lazyload');
  assert.equal(candidate?.value, 'https://example.com/flickity-full.jpg');
});

test('parseSrcset does not split Cloudinary transform URLs on their internal commas', () => {
  const html = `<html><body>
    <a href="https://example.com/cloudinary-post"><img srcset="https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/sample.jpg 400w, https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/sample.jpg 800w" src="https://example.com/fallback.jpg"><h2>Cloudinary Post</h2></a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  const values = items[0].thumbCandidates.map((c) => c.value);
  assert.ok(values.includes('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/sample.jpg'));
  assert.ok(values.includes('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/sample.jpg'));
});
