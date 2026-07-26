// Pins isLikelyContentMediaElement's vendor-avatar exclusions (YouTube's
// yt3.ggpht.com, Gravatar, GitHub avatars, Twitter/X's /profile_images/
// path convention) and the generic <48px icon-size threshold, which keep
// standalone-image scanning from surfacing author avatars/site icons as
// gallery items.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('filters known avatar/icon CDN patterns from standalone images', () => {
  const html = `<html><body>
    <img src="https://gravatar.com/avatar/abc.jpg" width="80" height="80">
    <img src="https://yt3.ggpht.com/channel/abc.jpg" width="80" height="80">
    <img src="https://avatars.githubusercontent.com/u/123" width="80" height="80">
    <img src="https://pbs.twimg.com/profile_images/abc/pic.jpg" width="80" height="80">
    <img src="https://example.com/real-photo.jpg" alt="A real photo" width="400" height="300">
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1, 'all 4 avatar-CDN images should be filtered, only the real photo survives');
  assert.equal(items[0].href, 'https://example.com/real-photo.jpg');
});

test('filters images under 48px on both dimensions as icons', () => {
  const html = `<html><body>
    <img src="https://example.com/icon.png" width="24" height="24">
    <img src="https://example.com/photo.jpg" alt="photo" width="400" height="300">
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].href, 'https://example.com/photo.jpg');
});

test('filters an image whose WRAPPER names it as furniture (subscriber badge)', () => {
  // The <img> itself is anonymous — no class, no alt — but it sits in
  // <div class="subscriber-badge">. Judging the element alone let the badge
  // through as the only "gallery item" on a whole NBC video feed.
  const html = `<html><body><div class="card">
    <div class="subscriber-badge"><img src="https://cdn.example/asterisk.svg" alt=""></div>
    <img src="https://cdn.example/photos/story.jpg" alt="Story photo">
  </div></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].href, 'https://cdn.example/photos/story.jpg');
});

test('does not read furniture words out of unrelated ancestor classes', () => {
  // Word-delimited matching, so "blogosphere" doesn't read as "logo" and
  // "iconic" doesn't read as "icon" — a substring test would drop both photos.
  const html = `<html><body>
    <div class="blogosphere-roundup"><img src="https://cdn.example/photos/one.jpg" alt="One" width="400" height="300"></div>
    <div class="iconic-covers"><img src="https://cdn.example/photos/two.jpg" alt="Two" width="400" height="300"></div>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 2);
});

test('drops a decorative alt="" image that nothing on the page names', () => {
  // alt="" is the HTML spec's "this image is decorative, ignore it". On its
  // own that isn't enough to discard an image — gallery photos are routinely
  // alt-less with the caption in <figcaption> (covered in
  // title-extraction.test.js) — but decorative AND unnamed is junk.
  const html = `<html><body>
    <div><img src="https://cdn.example/ui/divider-rule.png" alt=""></div>
    <figure><img src="https://cdn.example/gallery/07.jpg" alt=""><figcaption>Dawn over the Cascades</figcaption></figure>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].href, 'https://cdn.example/gallery/07.jpg');
});
