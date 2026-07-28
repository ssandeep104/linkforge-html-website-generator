#!/usr/bin/env node
/**
 * Odyssey IMAX 70mm seat monitor — Cinemark Dallas XD and IMAX (TheaterId=207).
 *
 * Scans the next N days for purchasable showtimes of CinemarkMovieId 104867
 * (the IMAX 70MM print — NOT 108919, which is the digital version), then reads
 * each showtime's seat map looking for an open regular seat in row C or later.
 *
 * Notes that cost real debugging time, kept here on purpose:
 *  - Fetch with Playwright's `context.request`, never `page.goto()`. Full browser
 *    navigation gets net::ERR_CONNECTION_RESET in this sandboxed/proxied setup.
 *  - Pass the proxy explicitly; Playwright's auto-detection has silently used a
 *    stale value here before.
 *  - The raw HTTP response uses camelCase attributes (seatType, showtimeId) which
 *    differs from the rendered DOM you'd see in devtools, so parse case-insensitively.
 *  - An *available* accessible seat renders as class "wheelchairAvailable", not
 *    "seatAvailable", so qualification is gated on the available/seatType
 *    attributes rather than the class name.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const { chromium } = loadPlaywright();

const THEATER_ID = 207;
const THEATER_NAME = 'Cinemark Dallas XD and IMAX';
const MOVIE_ID = 104867; // The Odyssey — IMAX 70MM. 108919 is digital; do not use.
const MOVIE_LABEL = 'The Odyssey IMAX 70MM';
const ORIGIN = 'https://www.cinemark.com';

const DAYS = parseInt(process.env.DAYS || '30', 10);
const MIN_ROW_IDX = parseInt(process.env.MIN_ROW_IDX || '2', 10); // 0-based: A=0, B=1, C=2
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '4', 10);
const VERBOSE = /^(1|true|yes)$/i.test(process.env.VERBOSE || '');
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, 'results');

const vlog = (...a) => { if (VERBOSE) console.log(...a); };

function datesToScan(n) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(iso);
  }
  return out;
}

/** Pull an HTML attribute case-insensitively from a single tag string. */
function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/**
 * Extract purchasable showtimes for MOVIE_ID from a GetShowtimes fragment.
 * Sold-out slots render as <p class="off soldOut"> rather than an anchor, so
 * selecting anchors inherently keeps only the purchasable ones.
 */
function parseShowtimes(html, dateStr) {
  const re = /<a\b[^>]*class="[^"]*showtime-link[^"]*"[^>]*>/gi;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const href = attr(tag, 'href');
    if (!href) continue;
    const url = decode(href);
    const params = new URLSearchParams(url.split('?')[1] || '');
    if (params.get('CinemarkMovieId') !== String(MOVIE_ID)) continue;
    const showtimeId = params.get('ShowtimeId');
    if (!showtimeId || seen.has(showtimeId)) continue;
    seen.add(showtimeId);
    out.push({
      date: dateStr,
      showtimeId,
      showtime: params.get('Showtime'),
      format: attr(tag, 'data-print-type-name'),
      url: url.startsWith('http') ? url : ORIGIN + url,
    });
  }
  return out;
}

/** Parse every seat button out of a seat-map page. */
function parseSeats(html) {
  const re = /<button\b[^>]*seatBlock[^>]*>/gi;
  const seats = [];
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const info = attr(tag, 'info');
    if (!info) continue;
    const [rowLetter, seatNum, physRow, col] = info.split(',');
    seats.push({
      rowLetter,
      seatNum,
      physicalRowIdx: parseInt(physRow, 10),
      colIdx: parseInt(col, 10),
      seatType: (attr(tag, 'seatType') || '').toLowerCase(),
      available: /^true$/i.test(attr(tag, 'available') || ''),
    });
  }
  return seats;
}

/** A qualifying seat: open, a regular seat, and in row C or later. */
function qualifies(seat) {
  return seat.available
    && seat.seatType === 'seat'
    && Number.isInteger(seat.physicalRowIdx)
    && seat.physicalRowIdx >= MIN_ROW_IDX;
}

async function getText(ctx, url, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ctx.request.get(url, { timeout: 45000 });
      if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
      return await res.text();
    } catch (err) {
      if (attempt === 3) {
        vlog(`  ! ${label} failed after 3 attempts: ${err.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  return null;
}

/** Run tasks with bounded concurrency, preserving input order in the output. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const fmtWhen = (iso) => {
  if (!iso) return 'unknown time';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

async function main() {
  const startedAt = new Date();
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const summary = {
    scannedAt: startedAt.toISOString(),
    theater: { id: THEATER_ID, name: THEATER_NAME },
    movie: { id: MOVIE_ID, label: MOVIE_LABEL },
    criteria: { minPhysicalRowIdx: MIN_ROW_IDX, seatType: 'seat', days: DAYS },
    daysScanned: 0,
    datesWithShowtimes: [],
    showtimes: [],
    qualifying: [],
    verifiedMatch: null,
    errors: [],
  };

  try {
    const dates = datesToScan(DAYS);

    // 1. Find purchasable 70mm showtimes across the window.
    const perDate = await mapLimit(dates, CONCURRENCY, async (date) => {
      const url = `${ORIGIN}/umbraco/surface/Theater/GetShowtimes?theaterId=${THEATER_ID}&showDate=${date}`;
      const html = await getText(ctx, url, `showtimes ${date}`);
      if (html === null) {
        summary.errors.push({ stage: 'showtimes', date });
        return [];
      }
      const found = parseShowtimes(html, date);
      if (found.length) vlog(`  ${date}: ${found.length} purchasable 70mm showtime(s)`);
      return found;
    });

    summary.daysScanned = dates.length;
    const showtimes = perDate.flat();
    summary.showtimes = showtimes;
    summary.datesWithShowtimes = [...new Set(showtimes.map((s) => s.date))];

    // 2. Read each showtime's seat map.
    const seatResults = await mapLimit(showtimes, CONCURRENCY, async (st) => {
      const html = await getText(ctx, st.url, `seatmap ${st.showtimeId}`);
      if (html === null) {
        summary.errors.push({ stage: 'seatmap', showtimeId: st.showtimeId });
        return { ...st, seats: [], open: [] };
      }
      const seats = parseSeats(html);
      const open = seats.filter(qualifies);
      vlog(`  ${st.date} ${st.showtime}: ${seats.length} seats, ${seats.filter((s) => s.available).length} open, ${open.length} qualifying`);
      return { ...st, totalSeats: seats.length, openAny: seats.filter((s) => s.available).length, open };
    });

    // Keep per-showtime counts so a future run can tell "seat map read, all full"
    // apart from "seat map came back empty" — they otherwise look identical.
    summary.showtimes = seatResults.map((r) => ({
      date: r.date, showtime: r.showtime, showtimeId: r.showtimeId,
      format: r.format, url: r.url,
      totalSeats: r.totalSeats ?? 0,
      openAnyType: r.openAny ?? 0,
      openQualifying: r.open.length,
    }));

    for (const r of seatResults) {
      for (const seat of r.open) {
        summary.qualifying.push({
          date: r.date, showtime: r.showtime, showtimeId: r.showtimeId,
          url: r.url, format: r.format,
          row: seat.rowLetter, seat: seat.seatNum, physicalRowIdx: seat.physicalRowIdx,
        });
      }
    }

    // 3. Re-verify live before declaring a match. This inventory has sold out
    //    within ~30s of being found, so a stale positive is worse than a miss.
    if (summary.qualifying.length) {
      const cand = summary.qualifying[0];
      vlog(`  re-verifying ${cand.row}${cand.seat} on showtime ${cand.showtimeId}...`);
      const html = await getText(ctx, cand.url, `verify ${cand.showtimeId}`);
      if (html) {
        const stillOpen = parseSeats(html).some(
          (s) => qualifies(s) && s.rowLetter === cand.row && s.seatNum === cand.seat
        );
        if (stillOpen) {
          summary.verifiedMatch = cand;
        } else {
          const anyOther = parseSeats(html).filter(qualifies);
          if (anyOther.length) {
            const s = anyOther[0];
            summary.verifiedMatch = {
              ...cand, row: s.rowLetter, seat: s.seatNum, physicalRowIdx: s.physicalRowIdx,
            };
          }
        }
      }
      summary.verificationRan = true;
    }
  } finally {
    await browser.close();
  }

  // 4. Persist the full run.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(OUT_DIR, `results-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(summary, null, 2));

  // 5. Minimal stdout — a scheduled job re-reads this into context every firing.
  const m = summary.verifiedMatch;
  console.log(`Odyssey 70mm @ ${THEATER_NAME} — scanned ${summary.daysScanned} days, ${summary.showtimes.length} purchasable showtime(s), ${summary.qualifying.length} qualifying seat(s).`);
  if (m) {
    console.log(`RESULT: FOUND row ${m.row} seat ${m.seat} — ${fmtWhen(m.showtime)}`);
    console.log(`URL: ${m.url}`);
  } else if (summary.qualifying.length) {
    console.log('RESULT: NONE (candidate found but gone on live re-check — not reporting a stale positive)');
  } else {
    console.log('RESULT: NONE');
  }
  if (summary.errors.length) console.log(`WARN: ${summary.errors.length} fetch error(s); see ${outFile}`);
  console.log(`Saved: ${outFile}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`RESULT: ERROR — ${err.message}`);
    process.exit(1);
  });
}

module.exports = { parseShowtimes, parseSeats, qualifies, attr, MOVIE_ID };
