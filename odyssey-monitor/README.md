# Odyssey IMAX 70mm seat monitor

Watches **Cinemark Dallas XD and IMAX** (`TheaterId=207`) for an open regular seat
at **The Odyssey in IMAX 70MM**, and notifies on every check.

## Target

| | |
|---|---|
| Theater | Cinemark Dallas XD and IMAX — `TheaterId=207` |
| Movie | `CinemarkMovieId=104867` (**IMAX 70MM**) |
| Qualifying seat | open, `seatType="seat"`, physical row index ≥ 2 (row **C** or later) |
| Window | next 30 days |

> **`104867`, not `108919`.** `108919` is the digital (non-70mm) print of the same
> film at the same theater. Using it silently monitors the wrong screening — the
> scan looks healthy and finds plenty of seats, none of which are 70mm.

Row C+ (rather than E+) is deliberate: 70mm inventory is extremely scarce.

## Usage

```bash
node scan.cjs              # 30-day scan, ~30s, 3-4 lines of output
VERBOSE=1 node scan.cjs    # per-date / per-showtime detail
node test.cjs              # offline parse + qualification checks
```

Env overrides: `DAYS`, `MIN_ROW_IDX`, `CONCURRENCY`, `VERBOSE`, `OUT_DIR`.

Output is intentionally terse — the scheduled job re-reads stdout into context on
every firing, so verbose output is a recurring cost. Full results are written to
`results/results-<timestamp>.json` plus `results/latest.json`.

The last line is machine-readable:

```
RESULT: FOUND row K seat 22 — Sat, Aug 1, 3:15 PM
RESULT: NONE
RESULT: ERROR — <message>
```

## Implementation notes

Each of these cost real debugging time:

- **Use `context.request.get()`, never `page.goto()`.** Full browser navigation gets
  `net::ERR_CONNECTION_RESET` in this sandboxed/proxied environment — a bot-detection
  mismatch on the full Chromium network stack, not a real block. The lightweight
  request client works fine against the identical URL.
- **Pass the proxy explicitly** (`chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })`).
  Playwright's auto-detection has silently used a stale value here.
- **Parse attributes case-insensitively.** The raw HTTP response uses camelCase
  (`seatType`, `showtimeId`), which differs from the rendered DOM in devtools.
- **The movie id is a space-separated class**: `<div class="showtimeMovieBlock 104867 ">`,
  so `showtimeMovieBlock104867` never matches. Showtimes are instead selected by
  `CinemarkMovieId` in each `showtime-link` href, which is more robust anyway.
- **Qualify on attributes, not class names.** An *available accessible* seat renders as
  `class="wheelchairAvailable seatBlock"`, not `seatAvailable`. On the first live run,
  every open seat in the window was wheelchair/companion — class-matching on
  `seatAvailable` plus a row check would have fired three false positives immediately.
- **Row letters skip `I`, and physical row indices have gaps** (`D`→3, `E`→5). Always
  use the physical row index from `info`, never the letter's alphabetical position.

## Verify before notifying

Inventory here has sold out within ~30 seconds of being found. The scan re-fetches the
candidate's seat map immediately before reporting `FOUND`; if the seat is gone, the run
reports a non-match rather than a stale positive. The scheduled job does one more live
re-check before it pushes.

## Scheduling

One consolidated job on the durable trigger platform, every 2 hours (not anchored to
showtime slots). It notifies on **every** firing — an excited push on a find, a
deliberately low-key one otherwise — so that silence unambiguously means the job died.
