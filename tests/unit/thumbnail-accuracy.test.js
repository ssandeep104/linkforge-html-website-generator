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

test('does not mistake a real multi-word filename containing "blank"/"transparent" for a placeholder', () => {
  // Found by a second independent review pass: narrowing the earlier
  // keyword-SUBSTRING list still left "blank"/"transparent" matching inside
  // real filenames like "blank-space-taylor-swift-cover.jpg" — the "-"
  // delimiter the regex used as a word boundary is the same delimiter real
  // multi-word slugs use. Fixed by switching to exact-basename matching
  // instead of narrowing the keyword list further (see
  // looksLikeLazyLoadPlaceholder / KNOWN_PLACEHOLDER_BASENAMES).
  const html = `<html><body>
    <a href="https://example.com/album/1989-taylors-version">
      <img src="https://cdn.example.com/covers/blank-space-taylor-swift-cover.jpg" data-original="https://cdn.example.com/hover/alt-crop.jpg" alt="Blank Space cover art">
    </a>
    <a href="https://example.com/shop/tumbler-cup">
      <img src="https://cdn.example.com/products/transparent-tumbler-cup.jpg" data-original="https://cdn.example.com/hover/alt-crop2.jpg" alt="Transparent tumbler cup">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 2);
  assert.equal(items[0].thumbnail, 'https://cdn.example.com/covers/blank-space-taylor-swift-cover.jpg');
  assert.equal(items[1].thumbnail, 'https://cdn.example.com/products/transparent-tumbler-cup.jpg');
});

test('still catches a genuine placeholder whose filename IS exactly a known placeholder name', () => {
  const html = `<html><body>
    <a href="https://example.com/detail/photo-999">
      <img src="https://cdn.example.com/img/blank.gif" data-src="https://cdn.example.com/full/999.jpg" alt="Real photo behind a blank.gif placeholder">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example.com/full/999.jpg');
});

test('prefers data-src when src is exactly a site logo', () => {
  const html = `<html><body>
    <a href="https://publisher.example/story">
      <img src="https://publisher.example/logo.png"
           data-src="https://cdn.publisher.example/stories/hero.jpg"
           alt="Story hero">
    </a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.publisher.example/stories/hero.jpg');
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

test('an author avatar inside the card anchor does not win over the card artwork', () => {
  // Card anchors routinely open with furniture — a byline portrait, a channel
  // badge, a play-button sprite — before the artwork. Taking the anchor's
  // FIRST <img> meant the avatar became the card's thumbnail on every item in
  // the feed.
  const html = `<html><body><article class="card">
    <a href="https://news.example/transit-plan">
      <img class="author-avatar" src="https://cdn.example/avatars/jane.jpg" width="32" height="32" alt="Jane Doe">
      <img class="card-image" src="https://cdn.example/photos/transit-hero.jpg" width="800" height="450" alt="Hero">
      <h3>Council approves new transit plan</h3>
    </a></article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example/photos/transit-hero.jpg');
});

test('a play-button sprite inside the anchor does not win over the poster frame', () => {
  const html = `<html><body><article class="card">
    <a href="https://news.example/rescue">
      <img class="play-icon" src="https://cdn.example/ui/play-button.png" width="44" height="44" alt="Play">
      <img src="https://cdn.example/posters/rescue.jpg" alt="Rescue crews at the scene">
      <h3>Rescue crews reach stranded hikers</h3>
    </a></article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example/posters/rescue.jpg');
});

test('a site logo loose in the card block is not promoted to card artwork', () => {
  // findFigureSiblingThumb's last-resort tier matches ANY <img> in the block,
  // with nothing in the markup saying the image plays a thumbnail role — the
  // tier most likely to hand back the site logo. One logo repeated across
  // every card is worse output than cards with no image (which templates
  // route to their "More links" tail), so this tier takes a content-looking
  // image or nothing.
  const html = `<html><body><article class="card">
    <a href="https://news.example/story-four"><h3>Story four</h3></a>
    <img src="https://cdn.example/site-logo.png" alt="Site logo" width="120" height="30">
  </article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, null);
});

test('a placeholder <video poster> loses to the real artwork in the same card', () => {
  // Players ship poster="…/blank.gif" as a first-paint stand-in. Promoting it
  // straight to item.thumbnail (Tier 1 beats Tier 2 by design) turned every
  // such card into a blank thumbnail even though real art sat beside it.
  const html = `<html><body><article class="card">
    <a href="https://vid.example/watch/9">
      <video poster="https://cdn.example/img/blank.gif"><source src="https://cdn.example/v/9.mp4" type="video/mp4"></video>
      <img class="thumb" src="https://cdn.example/posters/9-real.jpg" alt="poster">
      <h3>Real video title</h3>
    </a></article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example/posters/9-real.jpg');
});

test('a placeholder poster is still used when the card offers nothing else', () => {
  const html = `<html><body><article class="card">
    <a href="https://vid.example/watch/10">
      <video poster="https://cdn.example/img/blank.gif"><source src="https://cdn.example/v/10.mp4" type="video/mp4"></video>
      <h3>Only a placeholder poster</h3>
    </a></article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example/img/blank.gif');
});

test('an <img> carrying only a srcset still produces a thumbnail', () => {
  // Responsive markup with no `src` at all is common on lazy-load grids.
  // pickImgSrc consulted src and the data-* attributes but never srcset, so
  // these items came out with no thumbnail whatsoever.
  const html = `<html><body>
    <a href="https://news.example/story-six" class="card">
      <img srcset="https://cdn.example/s6-400.jpg 400w, https://cdn.example/s6-1200.jpg 1200w" alt="Six">
      <h3>Story six</h3></a></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example/s6-1200.jpg');
});

test('<picture><source> wins over the blank <img> that <picture> uses as its fallback slot', () => {
  // The classic <picture> shape is <source srcset="real"><img src="data:…blank">.
  // The <img> exists to satisfy the element contract, not to be displayed —
  // but it was checked first, so the base64 pixel became the thumbnail.
  const html = `<html><body><a href="https://news.example/story-one" class="card">
    <picture>
      <source type="image/webp" srcset="https://cdn.example/real-800.webp 800w, https://cdn.example/real-1600.webp 1600w">
      <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7" alt="">
    </picture>
    <h3>Story one</h3></a></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].thumbnail, 'https://cdn.example/real-1600.webp');
});
