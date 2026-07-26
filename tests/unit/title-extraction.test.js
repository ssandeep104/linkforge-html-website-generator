// Pins the title-extraction heuristics: TikTok's literal PVideoLabel
// CSS-module class (matched via a 2-level-up parent walk), CNN's
// duration+outlet attribution chip regex in looksLikeBadTitle, the
// container-heading-over-anchor-text priority (BBC/Reuters/Medium's
// image-anchor-steals-alt-text problem), and visibleText's <script>-bleed
// stripping (CNN/MSN inline onerror handlers leaking into textContent).
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

test('TikTok: falls back to sibling p[class*=PVideoLabel] for the caption', () => {
  const html = `<html><body>
    <div class="wrapper1">
      <div class="wrapper2">
        <div><a href="https://www.tiktok.com/@user/video/123"><img src="https://example.com/cover.jpg"></a></div>
        <p class="css-13cdu78-PVideoLabel">Amazing TikTok caption text here #fyp</p>
      </div>
    </div>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Amazing TikTok caption text here #fyp');
});

test('CNN: a "Video <duration> <outlet>" attribution chip loses to a real title from another anchor sharing the same href', () => {
  const html = `<html><body>
    <div><a href="https://cnn.com/videos/some-clip">Video 0:39 CNN</a></div>
    <div><a href="https://cnn.com/videos/some-clip">Soldiers Return Home After Six-Month Deployment</a></div>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Soldiers Return Home After Six-Month Deployment');
});

test('CNN: a multi-outlet attribution chip ("Video 1:13 CNN/Reuters") loses the same way', () => {
  const html = `<html><body>
    <div><a href="https://cnn.com/videos/some-clip2">Video 1:13 CNN/Reuters</a></div>
    <div><a href="https://cnn.com/videos/some-clip2">Referee Gets Hero's Welcome After Visa Denial</a></div>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Referee Gets Hero's Welcome After Visa Denial");
});

test('CNN: with no alternative at all, the attribution chip is still used as a last-resort title', () => {
  const html = `<html><body>
    <article class="card">
      <a href="https://cnn.com/videos/some-clip3">
        <img src="https://cnn.com/thumb.jpg">
        Video 0:39 CNN
      </a>
    </article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Video 0:39 CNN');
});

test('a real heading beats trailing anchor text that looks like a duration chip', () => {
  const html = `<html><body>
    <article class="card">
      <a href="https://cnn.com/videos/x"><img src="https://cnn.com/t.jpg"><h2>Real Headline About A Video</h2>0:39</a>
    </article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Real Headline About A Video');
});

test('strips inline <script> content bleeding into anchor text (CNN/MSN onerror shims)', () => {
  const html = `<html><body>
    <article class="card">
      <a href="https://example.com/story-with-bleed">
        <h2>Real Headline Text</h2>
        <script>document.getElementById('x').setAttribute('src','y'); function foo() { return 1; }</script>
      </a>
    </article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Real Headline Text');
});

test('container heading wins over the anchor\'s own text (BBC/Reuters/Medium image-anchor pattern)', () => {
  const html = `<html><body>
    <article class="card">
      <a href="https://bbc.com/news/story1"><img alt="thumbnail alt text" src="https://bbc.com/t.jpg"></a>
      <h2>The Real BBC Headline</h2>
    </article>
  </body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'The Real BBC Headline');
});

test('a "Read more" CTA anchor loses to the headline sharing its href', () => {
  // Cards commonly emit three anchors for one URL: the thumbnail wrapper, the
  // headline, and a "Read more →" call to action. Whichever the DOM walk
  // reached first won the bucket's title, so feeds came out as a wall of
  // items all titled "Read more".
  const html = `<html><body><article class="card">
    <a href="https://blog.example/post-1" class="thumb"><img src="https://cdn.example/p1.jpg" alt="Post art"></a>
    <a href="https://blog.example/post-1" class="cta">Read more →</a>
    <h3><a href="https://blog.example/post-1">The quiet death of the RSS reader</a></h3>
  </article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'The quiet death of the RSS reader');
});

test('a generic aria-label ("Read more") loses to the anchor\'s own heading', () => {
  // aria-label outranks the anchor's heading in the rule order, which is right
  // when the label names the story — but plenty of templates hard-code the
  // same CTA label on every card.
  const html = `<html><body><article class="card">
    <a href="https://news.example/rates" aria-label="Read more"><h3>Central bank holds rates steady</h3></a>
  </article></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Central bank holds rates steady');
});

test('a date anchor sharing the story href loses to the headline', () => {
  const html = `<html><body><li class="item">
    <a href="https://blog.example/p3" class="date">Sep 3, 2026</a>
    <a href="https://blog.example/p3">A field guide to slow software</a>
  </li></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'A field guide to slow software');
});

test('a junk-looking title is still used when the bucket offers nothing better', () => {
  // Same last-resort contract the duration-chip rules follow: rejecting a
  // candidate must never leave an item with no title at all.
  const html = `<html><body><div class="wrap"><a href="https://blog.example/p4">Read more</a></div></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Read more');
});

test('each card takes its own heading, not the list heading they all share', () => {
  // The per-item wrappers here (<div>, no class) don't match
  // CARD_CONTAINER_SELECTOR, so closest() lands on <section class="post-list">
  // — which does match, via "post" — for every anchor in the list. The rule
  // then took that container's FIRST heading in document order, handing every
  // item in the feed the same "Latest posts" section label as its title.
  // Headings are now ranked by how close they sit to the anchor instead.
  const html = `<html><body><section class="post-list">
    <h2>Latest posts</h2>
    <div><a href="https://blog.example/a" class="thumb"><img src="https://cdn.example/a.jpg" alt="A"></a><h3>How we cut our build time in half</h3></div>
    <div><a href="https://blog.example/b" class="thumb"><img src="https://cdn.example/b.jpg" alt="B"></a><h3>A field guide to slow software</h3></div>
  </section></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'How we cut our build time in half');
  assert.equal(items[1].title, 'A field guide to slow software');
});

test('a standalone gallery image takes its <figcaption> as the title', () => {
  // Gallery photos are frequently alt-less, with the caption in <figcaption>.
  // Titling them "Image" threw away the one name the page actually gave them.
  const html = `<html><body><figure>
    <img src="https://cdn.example/gallery/07.jpg" alt="">
    <figcaption>Dawn over the Cascades, 2026</figcaption>
  </figure></body></html>`;
  const { items } = parseSourceWithMeta(html, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Dawn over the Cascades, 2026');
});
