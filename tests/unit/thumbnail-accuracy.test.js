// Real-world gallery/portfolio accuracy checks, found via manual end-to-end
// testing against multimedia-heavy site patterns (photo galleries, lazy-load
// grids). These pin CORRECT behavior, not current behavior — see the
// git history for this file for the bug each one caught.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('prefers a real lazy-loaded image over a base64 placeholder in <img src>', () => {
  // Extremely common gallery/lazy-load convention: <img src="tiny-placeholder"
  // data-src="real-image">, swapped by JS after the placeholder paints. Before
  // any JS runs (i.e. in the raw HTML we're pasted), `src` is a blank pixel
  // and `data-src` holds the actual photo.
  const html = `<html><body>
    <a href="https://stockshelf.example/detail/photo-789" class="asset-tile">
      <img data-src="https://cdn.stockshelf.example/full/789.jpg" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7" alt="Golden retriever puppy">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.stockshelf.example/full/789.jpg');
});

test('falls back to a placeholder-looking src when no real lazy-load attribute exists', () => {
  // If the placeholder is genuinely all we have, still show it rather than
  // nothing — matches the "last resort" philosophy used elsewhere (e.g.
  // resolveBucketTitle's lastResort fallback).
  const html = `<html><body>
    <a href="https://example.com/photo-only-placeholder">
      <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7" alt="No real src available">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7');
});

test('a <figcaption> outranks the image alt text as the default title', () => {
  // Photography-portfolio pattern: <figure><a><img alt="..."></a><figcaption>
  // Real Title</figcaption></figure>. alt text describes the image for
  // accessibility; figcaption is the author's actual chosen caption/title —
  // a stronger signal when both are present and differ.
  const html = `<html><body>
    <figure class="portfolio-item">
      <a href="https://framewright.example/photos/12"><img src="https://cdn.framewright.example/full/pier-dawn.jpg" alt="Foggy pier at dawn"></a>
      <figcaption>Foggy Pier — Dawn Series #4</figcaption>
    </figure>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Foggy Pier — Dawn Series #4');
});
