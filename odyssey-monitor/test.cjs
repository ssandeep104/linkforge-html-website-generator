#!/usr/bin/env node
/**
 * Offline checks for the parse/qualify logic — the parts that have actually
 * bitten us: camelCase attributes in the raw response, available accessible
 * seats rendering as "wheelchairAvailable", and the row-C threshold.
 * No network required.
 */
'use strict';

const assert = require('assert');
const { parseShowtimes, parseSeats, qualifies } = require('./scan.cjs');

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`  FAIL ${name}: ${e.message}`); process.exitCode = 1; }
};

const seatBtn = (info, { available, seatType, cls }) =>
  `<button available="${available}" class="${cls} seatBlock" id="x" info="${info}" ` +
  `physicalDistanceBuffer="False" seatType="${seatType}" selected="False" showtimeId="633419" type="button">`;

console.log('showtime parsing');

check('keeps 104867 (70mm) and drops 108919 (digital)', () => {
  const html = `
    <a class="showtime-link" data-print-type-name="Imax 70mm" href="/TicketSeatMap/?TheaterId=207&amp;ShowtimeId=1&amp;CinemarkMovieId=104867&amp;Showtime=2026-07-29T07:45:00">7:45am</a>
    <a class="showtime-link" data-print-type-name="Luxury Lounger XD" href="/TicketSeatMap/?TheaterId=207&amp;ShowtimeId=2&amp;CinemarkMovieId=108919&amp;Showtime=2026-07-29T08:45:00">8:45am</a>`;
  const got = parseShowtimes(html, '2026-07-29');
  assert.strictEqual(got.length, 1, 'expected exactly one showtime');
  assert.strictEqual(got[0].showtimeId, '1');
  assert.ok(got[0].url.includes('CinemarkMovieId=104867'));
});

check('ignores sold-out slots (rendered as <p>, not <a>)', () => {
  const html = `<p class="off soldOut" aria-disabled="true">7:45am</p>`;
  assert.strictEqual(parseShowtimes(html, '2026-07-29').length, 0);
});

console.log('seat parsing + qualification');

check('parses camelCase attributes from the raw response', () => {
  const [s] = parseSeats(seatBtn('H,12,8,4,633419', { available: 'True', seatType: 'seat', cls: 'seatAvailable' }));
  assert.strictEqual(s.rowLetter, 'H');
  assert.strictEqual(s.seatNum, '12');
  assert.strictEqual(s.physicalRowIdx, 8);
  assert.strictEqual(s.seatType, 'seat');
  assert.strictEqual(s.available, true);
});

check('open regular seat in row H qualifies', () => {
  const [s] = parseSeats(seatBtn('H,12,8,4,633419', { available: 'True', seatType: 'seat', cls: 'seatAvailable' }));
  assert.ok(qualifies(s));
});

check('open regular seat in row C (idx 2) qualifies — boundary', () => {
  const [s] = parseSeats(seatBtn('C,5,2,3,633419', { available: 'True', seatType: 'seat', cls: 'seatAvailable' }));
  assert.ok(qualifies(s));
});

check('row B (idx 1) is rejected — boundary', () => {
  const [s] = parseSeats(seatBtn('B,5,1,3,633419', { available: 'True', seatType: 'seat', cls: 'seatAvailable' }));
  assert.ok(!qualifies(s));
});

check('open WHEELCHAIR seat is rejected despite available=True', () => {
  // Real regression: this is what row D looked like live, and the class is
  // "wheelchairAvailable" — not "seatAvailable" — so class-matching would miss it.
  const [s] = parseSeats(seatBtn('D,21,3,6,633419', { available: 'True', seatType: 'wheelchair', cls: 'wheelchairAvailable' }));
  assert.strictEqual(s.seatType, 'wheelchair');
  assert.ok(!qualifies(s), 'wheelchair space must never qualify');
});

check('open COMPANION seat is rejected', () => {
  const [s] = parseSeats(seatBtn('D,20,3,7,633419', { available: 'True', seatType: 'companion', cls: 'companionAvailable' }));
  assert.ok(!qualifies(s));
});

check('unavailable regular seat is rejected', () => {
  const [s] = parseSeats(seatBtn('H,12,8,4,633419', { available: 'False', seatType: 'seat', cls: 'seatUnavailable' }));
  assert.ok(!qualifies(s));
});

check('finds the one good seat in a realistic mixed map', () => {
  const html = [
    seatBtn('A,22,0,6,633419', { available: 'True', seatType: 'seat', cls: 'seatAvailable' }),   // too close
    seatBtn('D,21,3,6,633419', { available: 'True', seatType: 'wheelchair', cls: 'wheelchairAvailable' }),
    seatBtn('D,20,3,7,633419', { available: 'True', seatType: 'companion', cls: 'companionAvailable' }),
    seatBtn('H,12,8,4,633419', { available: 'True', seatType: 'seat', cls: 'seatAvailable' }),   // the winner
    seatBtn('K,1,10,0,633419', { available: 'False', seatType: 'seat', cls: 'seatUnavailable' }),
  ].join('\n');
  const hits = parseSeats(html).filter(qualifies);
  assert.strictEqual(hits.length, 1, `expected 1 hit, got ${hits.length}`);
  assert.strictEqual(hits[0].rowLetter, 'H');
  assert.strictEqual(hits[0].seatNum, '12');
});

console.log(`\n${passed}/10 checks passed`);
