// Workstream 3 — balanced grids (issue #3 and every fixed-column grid).
// planRows() must hold exactly N cards in rows that are each filled edge to
// edge, in source order (no dense-flow reordering), promoting cards only as
// much as the remainder requires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, planRows, SHAPES, items } from '../helpers/templates.js';

// Walk spans into rows; throws if any row overflows or the tail is partial.
function rowsOf(spans, cols) {
  const rows = [];
  let row = [];
  let sum = 0;
  for (const s of spans) {
    row.push(s);
    sum += s;
    assert.ok(sum <= cols, `row overflows ${cols} columns: ${row}`);
    if (sum === cols) { rows.push(row); row = []; sum = 0; }
  }
  assert.equal(row.length, 0, `partial last row: ${row}`);
  return rows;
}

test('issue #3: Editorial 7 items -> 1 hero + 6 in a 3-column grid', () => {
  const rows = rowsOf(planRows(7, SHAPES.heroRows(3)), 3);
  assert.deepEqual(rows, [[3], [1, 1, 1], [1, 1, 1]]);
});

test('issue #3: Editorial 10 items -> 1 hero + 9', () => {
  const rows = rowsOf(planRows(10, SHAPES.heroRows(3)), 3);
  assert.deepEqual(rows, [[3], [1, 1, 1], [1, 1, 1], [1, 1, 1]]);
});

test('issue #3: Editorial 11 items -> 2 heroes + 9, heroes at positions 1 and 5', () => {
  const spans = planRows(11, SHAPES.heroRows(3));
  rowsOf(spans, 3);
  assert.deepEqual(Array.from(spans).map((s, i) => (s === 3 ? i + 1 : null)).filter(Boolean), [1, 5]);
});

test('no promotion when the count already divides evenly', () => {
  assert.ok(planRows(9, SHAPES.heroRows(3)).every((s) => s === 1));
  assert.ok(planRows(12, SHAPES.wideCards(6)).every((s) => s === 1));
});

test('wide-card grids promote the fewest cards needed', () => {
  // 11 in 6 columns: one wide card absorbs the single missing slot.
  assert.equal(planRows(11, SHAPES.wideCards(6)).filter((s) => s === 2).length, 1);
  // 5 in 4 columns: 5 + 3 = 8 slots -> three wide cards would be needed... or
  // one row of 2+1+1 and one row of... the planner finds [2,1,1] + [2,2]?
  // Whatever it picks, every row must be full:
  rowsOf(planRows(5, SHAPES.wideCards(4)), 4);
});

// Every layout the registered templates use, for every realistic count.
const LAYOUTS = {
  'creator lg': [SHAPES.wideCards(6), 6],
  'creator md': [SHAPES.wideCards(4), 4],
  'creator sm / tablet pairs': [SHAPES.wideCards(2), 2],
  'wall lg': [[{ spans: [6, 6], cost: 0.1 }, { spans: [4, 5, 3], cost: 0 }, { spans: [12], cost: 5 }], 12],
  'flux lg': [[{ spans: [6, 6], cost: 0.1 }, { spans: [4, 4, 4], cost: 0 }, { spans: [3, 3, 3, 3], cost: 0.1 }, { spans: [12], cost: 5 }], 12],
  'shelf lg': [[{ spans: [7, 5], cost: 0 }, { spans: [4, 4, 4], cost: 0 }, { spans: [5, 7], cost: 0 }, { spans: [8, 4], cost: 0 }, { spans: [12], cost: 5 }], 12],
  'editorial 3-col': [SHAPES.heroRows(3), 3],
};
for (const [name, [shapes, cols]] of Object.entries(LAYOUTS)) {
  test(`${name}: every count from 1 to 60 fills every row exactly`, () => {
    for (let n = 1; n <= 60; n++) {
      const spans = planRows(n, shapes);
      assert.equal(spans.length, n, `n=${n}`);
      rowsOf(spans, cols);
    }
  });
}

test('generated pages carry per-card spans and never use dense flow', () => {
  const ctx = { title: 'T', tagline: '', today: '', sourceGroups: [{ name: 'a', key: 'a', items: items('a', 7) }] };
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    const built = tpl.build(ctx);
    const html = typeof built === 'string' ? built : built.html;
    assert.doesNotMatch(html, /grid-auto-flow:\s*dense/, `${key} uses dense flow`);
    assert.equal((html.match(/--s-lg:\d+/g) || []).length >= 6, true, `${key} cards carry planned spans`);
  }
});

test('a failed thumbnail never deletes its card', () => {
  const ctx = { title: 'T', tagline: '', today: '', sourceGroups: [{ name: 'a', key: 'a', items: items('a', 3) }] };
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    const built = tpl.build(ctx);
    const html = typeof built === 'string' ? built : built.html;
    assert.doesNotMatch(html, /parentElement\.parentElement\.remove\(\)/, `${key} removes cards on image error`);
  }
});
