// Card-centric pipeline: cards are found as repeating structures (cards.js),
// each card resolves to one destination, and each set's fields are judged as
// a group. These pin the structural rules, not any one publisher's markup.
import '../helpers/dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceWithMeta } from '../../parser.js';

const BASE = '<base href="https://site.example/">';
const parse = (body) => parseSourceWithMeta(`<html><head>${BASE}</head><body>${body}</body></html>`, 'T');
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

const videoCard = (i) => `
  <div class="vcard">
    <a class="vcard__thumb" href="/watch/${i}"><img src="https://cdn.example/v${i}.jpg" alt="thumb ${i}"></a>
    <h3 class="vcard__title"><a href="/watch/${i}">Video number ${i}</a></h3>
    <a class="vcard__author" href="/channel/c${i}"><img class="avatar" src="https://cdn.example/a${i}.png" width="24" height="24">Channel ${i}</a>
    <a class="vcard__tag" href="/tag/t${i % 3}">Tag ${i % 3}</a>
    <a class="vcard__reviews" href="/watch/${i}/reviews">12 reviews</a>
  </div>`;

// ---------- detection ----------

test('a grid of 24 matching containers is one card set, one card per container', () => {
  const { items, cardSets } = parse(`<main><div class="grid">${range(24).map(videoCard).join('')}</div></main>`);
  assert.equal(cardSets.length, 1);
  assert.equal(cardSets[0].kind, 'repeating');
  assert.equal(cardSets[0].signature, '<div class="vcard">');
  assert.equal(cardSets[0].count, 24);
  assert.equal(items.length, 24, 'author, tag and review links are card detail, not cards');
  assert.deepEqual(items.slice(0, 2).map((i) => i.href), ['https://site.example/watch/1', 'https://site.example/watch/2']);
  assert.equal(items[0].title, 'Video number 1');
  assert.equal(items[0].thumbnail, 'https://cdn.example/v1.jpg');
});

test('secondary links of a card are kept as link alternates', () => {
  const { items } = parse(`<div class="grid">${range(4).map(videoCard).join('')}</div>`);
  const links = items[0].linkCandidates.map((c) => c.value);
  assert.equal(links[0], 'https://site.example/watch/1');
  assert.ok(links.includes('https://site.example/watch/1/reviews'));
});

test('cards laid out in rows: the card is the set, the row is a wrapper', () => {
  const row = (r) => `<div class="row">${range(4).map((c) => videoCard(r * 10 + c)).join('')}</div>`;
  const { items, cardSets } = parse(`<div class="grid">${range(5).map(row).join('')}</div>`);
  assert.equal(cardSets.length, 1);
  assert.equal(cardSets[0].signature, '<div class="vcard">');
  assert.equal(items.length, 20);
});

test('slides inside a product card do not become cards', () => {
  const product = (i) => `
    <li class="product">
      <div class="slides">${range(3).map((s) => `<div class="slide"><a href="/p/${i}"><img src="https://cdn.example/p${i}-${s}.jpg"></a></div>`).join('')}</div>
      <h3><a href="/p/${i}">Product ${i}</a></h3>
    </li>`;
  const { items, cardSets } = parse(`<ul class="products">${range(6).map(product).join('')}</ul>`);
  assert.equal(cardSets.length, 1);
  assert.equal(cardSets[0].signature, '<li class="product">');
  assert.equal(items.length, 6);
  assert.equal(items[2].title, 'Product 3');
});

test('a related-links list inside each story stays part of the story card', () => {
  const story = (i) => `
    <article class="story">
      <a href="/s/${i}"><img src="https://cdn.example/s${i}.jpg"></a>
      <h2><a href="/s/${i}">Story ${i} headline</a></h2>
      <ul class="related"><li><a href="/s/${i}/a">Related A${i}</a></li><li><a href="/s/${i}/b">Related B${i}</a></li></ul>
    </article>`;
  const { items, cardSets } = parse(`<section>${range(5).map(story).join('')}</section>`);
  assert.equal(cardSets.length, 1);
  assert.equal(items.length, 5);
  assert.deepEqual(items.map((i) => i.title), range(5).map((i) => `Story ${i} headline`));
});

test('two different card structures on one page are two sets', () => {
  const article = (i) => `<li class="teaser"><a href="/news/${i}"><img src="https://cdn.example/n${i}.jpg"><h4>News ${i}</h4></a></li>`;
  const { items, cardSets } = parse(`
    <nav><ul>${range(5).map((i) => `<li><a href="/nav/${i}">Nav ${i}</a></li>`).join('')}</ul></nav>
    <section class="videos">${range(8).map(videoCard).join('')}</section>
    <ul class="news">${range(6).map(article).join('')}</ul>`);
  assert.deepEqual(cardSets.map((s) => [s.signature, s.count]), [['<div class="vcard">', 8], ['<li class="teaser">', 6]]);
  assert.equal(items.length, 14, 'navigation is not a card set');
  assert.deepEqual([...new Set(items.map((i) => i.setId))], ['set-1', 'set-2']);
});

test('big page regions that each hold a card grid are not cards', () => {
  const { cardSets, items } = parse(`
    <div><h2>Trending</h2><div class="a-grid">${range(6).map(videoCard).join('')}</div></div>
    <div><h2>Latest</h2><ul>${range(6).map((i) => `<li class="t"><a href="/l/${i}"><img src="https://cdn.example/l${i}.jpg"><h4>Latest ${i}</h4></a></li>`).join('')}</ul></div>
    <div><h2>More</h2><ul>${range(6).map((i) => `<li class="m"><a href="/m/${i}"><img src="https://cdn.example/m${i}.jpg"><h4>More ${i}</h4></a></li>`).join('')}</ul></div>`);
  assert.equal(items.length, 18);
  assert.deepEqual(cardSets.map((s) => s.count), [6, 6, 6]);
});

test('links outside any repeating structure still come through, grouped as loose', () => {
  const { items, cardSets } = parse(`<p>Read <a href="/guides/team">our team page</a> for more.</p>`);
  assert.equal(items.length, 1);
  assert.equal(cardSets[0].kind, 'loose');
  assert.equal(items[0].setId, cardSets[0].id);
});

test('a card without a link of its own is still a card of its set', () => {
  const fig = (i) => `<figure class="shot"><img src="https://cdn.example/g${i}.jpg" alt="Shot ${i}"><figcaption>Caption ${i}</figcaption></figure>`;
  const { items, cardSets } = parse(`<div class="gallery">${range(5).map(fig).join('')}</div>`);
  assert.equal(cardSets.length, 1);
  assert.equal(cardSets[0].kind, 'repeating');
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.setId === 'set-1'));
});

// ---------- field consensus ----------

test('a title that repeats on every card is a label: the set falls back to the real one', () => {
  const card = (i) => `<div class="c"><a href="/x/${i}" aria-label="Watch now"><img src="https://cdn.example/x${i}.jpg" alt="Episode ${i}: the long road"></a></div>`;
  const { items, cardSets } = parse(`<div>${range(5).map(card).join('')}</div>`);
  assert.deepEqual(items.map((i) => i.title), range(5).map((i) => `Episode ${i}: the long road`));
  assert.equal(cardSets[0].fields.title.corrected, 0, 'junk labels never win, so nothing to correct');
});

test('a non-junk label repeated on every card is corrected by set consensus', () => {
  const card = (i) => `<div class="c"><h3>Season two</h3><a href="/x/${i}"><img src="https://cdn.example/x${i}.jpg" alt="Episode ${i}: the long road"></a></div>`;
  const { items, cardSets } = parse(`<div>${range(5).map(card).join('')}</div>`);
  assert.deepEqual(items.map((i) => i.title), range(5).map((i) => `Episode ${i}: the long road`));
  assert.equal(cardSets[0].fields.title.corrected, 5);
});

test('an image that repeats on every card is a logo: the set uses the per-card picture', () => {
  const card = (i) => `<div class="c"><a href="/x/${i}"><img src="https://cdn.example/brand-mark.jpg"><h3>Card ${i}</h3></a><img class="art" src="https://cdn.example/art${i}.jpg"></div>`;
  const { items, cardSets } = parse(`<div>${range(5).map(card).join('')}</div>`);
  assert.deepEqual(items.map((i) => i.thumbnail), range(5).map((i) => `https://cdn.example/art${i}.jpg`));
  assert.equal(cardSets[0].fields.thumb.corrected, 5);
});

test('two competing headings flag the set title as ambiguous and list both sources', () => {
  const card = (i) => `<article class="post"><a href="/p/${i}"><img src="https://cdn.example/p${i}.jpg"></a><h2>Main headline ${i}</h2><h3 class="deck">A different deck line ${i}</h3></article>`;
  const { items, cardSets } = parse(`<div>${range(6).map(card).join('')}</div>`);
  const title = cardSets[0].fields.title;
  assert.equal(title.ambiguous, true);
  assert.equal(title.ambiguousCount, 6);
  assert.equal(items[0].title, 'Main headline 1');
  assert.equal(items[0].ambiguous.title, true);
  const strategies = title.options.map((o) => o.strategy);
  assert.equal(strategies[0], title.strategy, 'the winning source is listed first');
  assert.ok(strategies.includes('slot:h3.deck'), 'the rival heading is offered by its own slot');
  assert.equal(title.options.find((o) => o.strategy === 'slot:h3.deck').count, 6);
});

test('a heading echoed by link text and alt text is not ambiguous', () => {
  const card = (i) => `<article class="post"><a href="/p/${i}"><img src="https://cdn.example/p${i}.jpg" alt="Clear title ${i}"><h2>Clear title ${i}</h2></a></article>`;
  const { cardSets, items } = parse(`<div>${range(4).map(card).join('')}</div>`);
  assert.equal(cardSets[0].fields.title.ambiguous, false);
  assert.deepEqual(items[0].ambiguous, {});
});

test('two distinct pictures in a card flag the image; srcset sizes of one picture do not', () => {
  const two = (i) => `<div class="c"><a href="/x/${i}"><img src="https://cdn.example/front${i}.jpg"><h3>Card ${i}</h3></a><img src="https://cdn.example/back${i}.jpg"></div>`;
  const one = (i) => `<div class="c"><a href="/x/${i}"><img src="https://cdn.example/a${i}-400.jpg" srcset="https://cdn.example/a${i}-400.jpg 400w, https://cdn.example/a${i}-800.jpg 800w"><h3>Card ${i}</h3></a></div>`;
  assert.equal(parse(`<div>${range(4).map(two).join('')}</div>`).cardSets[0].fields.thumb.ambiguous, true);
  assert.equal(parse(`<div>${range(4).map(one).join('')}</div>`).cardSets[0].fields.thumb.ambiguous, false);
});

test('a hover-preview video is paired with its own card', () => {
  const card = (i) => `<div class="clip"><a href="/clip/${i}"><img src="https://cdn.example/c${i}.jpg"><video muted loop preload="none" src="https://cdn.example/preview${i}.mp4"></video></a><p class="clip__name">Clip ${i}</p></div>`;
  const { items, cardSets } = parse(`<div>${range(5).map(card).join('')}</div>`);
  assert.equal(items.length, 5, 'the card player is not re-emitted as a standalone video');
  assert.deepEqual(items.map((i) => i.video.src), range(5).map((i) => `https://cdn.example/preview${i}.mp4`));
  assert.deepEqual(items.map((i) => i.thumbnail), range(5).map((i) => `https://cdn.example/c${i}.jpg`));
  assert.equal(cardSets[0].fields.video.options.length, 1);
});
