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

test('does not mistake a real filename containing "logo"/"empty"/"loading" for a lazy-load placeholder', () => {
  // Found by an independent review agent while verifying the initial fix
  // (PR #21): the first version of this check reused looksLikePlaceholder(),
  // whose word list (built for a different job — filtering site-logo
  // og:image fallbacks) includes generic English words that show up in real
  // content filenames. An unrelated data-* attribute (e.g. a hover-compare
  // widget's data-original) must not silently outrank a legitimate src.
  const html = `<html><body>
    <a href="https://example.com/campaign-recap">
      <img src="https://cdn.example.com/photos/acme-logo-unveiling-event.jpg" data-original="https://cdn.example.com/hover/different-crop.jpg" alt="Acme logo unveiling event">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example.com/photos/acme-logo-unveiling-event.jpg');
});

test('does not mistake a hash-like query param starting with a small digit for a tiny-dimension placeholder', () => {
  // "?h=4a2b1c9d" — a cache-busting hash that happens to start with "4" —
  // must not match the tiny width/height heuristic the way an unanchored
  // "next char is not a digit" check would (the hash's next character, "a",
  // is also "not a digit").
  const html = `<html><body>
    <a href="https://example.com/photo-hash-query">
      <img src="https://cdn.example.com/full/photo.jpg?h=4a2b1c9d" data-original="https://cdn.example.com/hover/different.jpg" alt="Real photo with a cache-busting hash">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example.com/full/photo.jpg?h=4a2b1c9d');
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
