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
