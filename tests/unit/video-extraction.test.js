// Pins video-source detection: Reddit's shreddit-post custom element as a
// sibling-video container, and the hardcoded iframe-src vendor allowlist
// (youtube/vimeo/tiktok/wistia/dailymotion/twitch/instagram) that decides
// whether an <iframe> is trusted as video vs. ignored as arbitrary embedded
// content (ads, widgets).
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('finds a <video> inside a <shreddit-post> wrapper as the item\'s video', () => {
  const html = `<html><body>
    <shreddit-post>
      <a href="https://reddit.com/r/videos/comments/abc/some_post/"><h3>A cool video post</h3></a>
      <video src="https://v.redd.it/abc/video.mp4" poster="https://v.redd.it/abc/thumb.jpg"></video>
    </shreddit-post>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].video?.src, 'https://v.redd.it/abc/video.mp4');
  assert.equal(items[0].thumbnail, 'https://v.redd.it/abc/thumb.jpg');
  assert.equal(items[0].category, 'video');
});

test('trusts an <iframe> from an allowlisted video vendor (YouTube)', () => {
  const html = `<html><body>
    <a href="https://example.com/embedded-clip"><iframe src="https://www.youtube.com/embed/abc123"></iframe></a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].video?.src, 'https://www.youtube.com/embed/abc123');
  assert.equal(items[0].category, 'video');
});

test('does not trust an <iframe> from a non-allowlisted host as video', () => {
  const html = `<html><body>
    <a href="https://example.com/embedded-clip2"><iframe src="https://random-ad-network.example.com/embed/abc"></iframe><img src="https://example.com/cover2.jpg"></a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].video, null);
  assert.equal(items[0].thumbnail, 'https://example.com/cover2.jpg');
});
