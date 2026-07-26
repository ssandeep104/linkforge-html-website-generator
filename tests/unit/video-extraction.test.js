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

test('an iframe host that merely CONTAINS a vendor name is not treated as video', () => {
  // The old test matched /youtube|vimeo|…/ against the whole iframe src, so an
  // ad frame carrying `utm_source=youtube` in its query string was accepted as
  // a video — which also flipped the item's category to "video". Vendor
  // matching now runs on the resolved hostname.
  const html = `<html><body><div class="card">
    <a href="https://shop.example/product/1"><img src="https://cdn.example/p1.jpg" alt="Product"></a>
    <iframe src="https://ads.example.com/frame?utm_source=youtube"></iframe>
  </div></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].video, null);
  assert.equal(items[0].category, 'article');
});

test('a progressive MP4 source beats an HLS manifest listed before it', () => {
  // <source> order is a player-preference list, not a quality ranking: sites
  // put the adaptive manifest first because their JS player prefers it. A
  // browser <video> can't play .m3u8 outside Safari, so taking the first
  // source produced previews that silently fail to load.
  const html = `<html><body><div class="card">
    <a href="https://news.example/video-1"><h3>Flood waters rise</h3></a>
    <video poster="https://cdn.example/posters/flood.jpg">
      <source src="https://cdn.example/hls/flood.m3u8" type="application/x-mpegURL">
      <source src="https://cdn.example/mp4/flood.mp4" type="video/mp4">
    </video></div></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].video?.src, 'https://cdn.example/mp4/flood.mp4');
});

test('reads a lazy-loaded player\'s data-poster and <source data-src>', () => {
  const html = `<html><body><div class="card">
    <a href="https://vid.example/w/1"><h3>Lazy player</h3></a>
    <video data-poster="https://cdn.example/posters/1.jpg">
      <source data-src="https://cdn.example/v/1.mp4" type="video/mp4">
    </video></div></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].video?.src, 'https://cdn.example/v/1.mp4');
  assert.equal(items[0].thumbnail, 'https://cdn.example/posters/1.jpg');
});

test('a youtube-nocookie embed resolves to the canonical watch URL and its poster', () => {
  // youtube-nocookie.com is the privacy-mode embed domain. It was in none of
  // the host lists, so an embed-only card (no anchor) yielded no item at all,
  // and the YouTube ID — and therefore the i.ytimg poster — was never derived.
  const html = `<html><body><figure class="card">
    <iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>
    <figcaption>How the song became a meme</figcaption>
  </figure></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].href, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(items[0].thumbnail, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(items[0].title, 'How the song became a meme');
});

test('the anchor\'s own <video> is offered as a video candidate', () => {
  // collectVideoCandidates keys candidates on info.url, but the anchor rule
  // returned the internal { src, poster } shape — so the picker silently lost
  // every anchor-owned video and could only ever offer container/data-attr
  // alternatives.
  const html = `<html><body>
    <a href="https://vid.example/watch/2"><video src="https://cdn.example/v/2.mp4" poster="https://cdn.example/posters/2.jpg"></video><h3>Clip two</h3></a>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  const anchorVideo = items[0].videoCandidates.find((c) => c.strategy === 'anchor-video');
  assert.equal(anchorVideo?.value, 'https://cdn.example/v/2.mp4');
  assert.equal(anchorVideo?.info?.poster, 'https://cdn.example/posters/2.jpg');
});
