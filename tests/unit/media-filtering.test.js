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
