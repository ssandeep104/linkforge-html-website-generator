// Every generated template carries a source filter bar — "All sources" plus one
// chip per source — and clicking a chip actually hides the other sources.
//
// The bug these pin: the CSS that hides unselected content lived in a constant
// no template referenced, so exports shipped tab markup and a click handler
// with nothing to hide the inactive content. The buttons toggled classes and
// the page never changed. Two of the four templates had no bar at all, and
// none of them offered an "all" view.
//
// jsdom runs the export's inline <script> here, so these tests exercise the
// real click path rather than asserting on markup alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { TEMPLATE_KEYS, buildHtml, context, items } from '../helpers/templates.js';

const THREE_SOURCES = () => [
  { name: 'The Verge', items: [...items('verge', 4), ...items('vergelinks', 3, { thumbnail: false })] },
  { name: 'YouTube Picks', items: [...items('yt', 3), ...items('ytlinks', 2, { thumbnail: false })] },
  { name: 'Design Blogs', items: [...items('design', 2), ...items('designlinks', 5, { thumbnail: false })] },
];

function render(key, sourceGroups) {
  const dom = new JSDOM(buildHtml(key, context(sourceGroups)), { runScripts: 'dangerously' });
  const { document } = dom.window;
  const chips = [...document.querySelectorAll('.tab-btn')];
  // `hidden` is the filter's mechanism; anything inside a hidden block counts
  // as hidden too, so walk ancestors rather than trusting the link's own flag.
  const isHidden = (el) => {
    for (let node = el; node; node = node.parentElement) if (node.hidden) return true;
    return false;
  };
  const visibleHrefs = () => [...document.querySelectorAll('a[href^="https://"]')]
    .filter((a) => !isHidden(a))
    .map((a) => a.getAttribute('href'));
  return { dom, document, chips, visibleHrefs };
}

for (const key of TEMPLATE_KEYS) {
  test(`${key}: renders an "All sources" chip plus one per source`, () => {
    const { chips } = render(key, THREE_SOURCES());
    const labels = chips.map((c) => c.querySelector('.tab-btn__title').textContent.trim());
    assert.deepEqual(labels, ['All sources', 'The Verge', 'YouTube Picks', 'Design Blogs']);
    assert.equal(chips[0].getAttribute('aria-pressed'), 'true', 'the page opens on "All sources"');
  });

  test(`${key}: clicking a source chip hides every other source's items`, () => {
    const { chips, visibleHrefs } = render(key, THREE_SOURCES());
    const all = visibleHrefs();
    assert.equal(all.length, 19, 'all four-plus-three, three-plus-two and two-plus-five items show under "All"');

    chips[2].dispatchEvent(new chips[2].ownerDocument.defaultView.Event('click'));
    const filtered = visibleHrefs();
    assert.ok(filtered.length > 0, 'the selected source still renders');
    assert.ok(filtered.every((href) => /\/\/yt/.test(href)), `only YouTube Picks items remain, got ${filtered.join(', ')}`);
    assert.equal(filtered.length, 5, 'both the 3 cards and the 2 link-tail entries of that source stay');
    assert.equal(chips[2].getAttribute('aria-pressed'), 'true');
    assert.equal(chips[0].getAttribute('aria-pressed'), 'false');
  });

  test(`${key}: "All sources" restores every item`, () => {
    const { chips, visibleHrefs } = render(key, THREE_SOURCES());
    const before = visibleHrefs();
    const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.Event('click'));
    click(chips[1]);
    assert.notEqual(visibleHrefs().length, before.length);
    click(chips[0]);
    assert.deepEqual(visibleHrefs(), before);
  });

  test(`${key}: filtering never leaves a section heading with nothing under it`, () => {
    // One source has only cards, the other only link-tail entries — so each
    // filtered view empties out a whole region of the page.
    const { chips, document, visibleHrefs } = render(key, [
      { name: 'Cards Only', items: items('cards', 4) },
      { name: 'Links Only', items: items('links', 5, { thumbnail: false }) },
    ]);
    const isHidden = (el) => {
      for (let node = el; node; node = node.parentElement) if (node.hidden) return true;
      return false;
    };
    for (const index of [1, 2]) {
      chips[index].dispatchEvent(new document.defaultView.Event('click'));
      // A link-tail heading may legitimately show (the links-only source's own
      // links sit under it) — what must never happen is the heading surviving
      // with no links left beneath it.
      const orphanHeadings = [...document.querySelectorAll('h2, h3')]
        .filter((h) => !isHidden(h))
        .filter((h) => /more links|further reading/i.test(h.textContent.trim()))
        .filter((h) => {
          // Anchor on the filterable region, not the nearest wrapper: some
          // templates put the heading in its own header <div> that contains
          // no links by construction.
          const region = h.closest('[data-source-scope]') || h.closest('section');
          const links = region ? [...region.querySelectorAll('a[href^="https://"]')] : [];
          return !links.some((a) => !isHidden(a));
        })
        .map((h) => h.textContent.trim());
      assert.deepEqual(orphanHeadings, [], `chip ${index} left a "More links" heading with nothing under it`);
      assert.ok(visibleHrefs().length > 0, `chip ${index} hid everything`);
    }
  });

  test(`${key}: a single-source export renders no filter bar`, () => {
    const { chips, visibleHrefs } = render(key, [
      { name: 'Only Source', items: [...items('solo', 3), ...items('sololinks', 2, { thumbnail: false })] },
    ]);
    assert.equal(chips.length, 0, 'filtering one source to itself is not a choice worth showing');
    assert.equal(visibleHrefs().length, 5, 'every item still renders');
  });
}
