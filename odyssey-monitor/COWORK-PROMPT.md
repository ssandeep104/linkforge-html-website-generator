# Cowork prompt — Odyssey IMAX 70mm monitor (row E+)

Paste the block below into a new Cowork session. It is self-contained: it names the
fast path (clone this repo, the scraper already exists) and includes the full spec so
Cowork can rebuild from scratch if its environment can't reach the repo.

Difference from the original run: the row threshold is **E onwards** instead of C onwards.

---

```
Set up a recurring seat-availability monitor for "The Odyssey" in IMAX 70mm at
Cinemark Dallas, with a push notification on every check.

TARGET
- Theater: Cinemark Dallas XD and IMAX, TheaterId=207 (cinemark.com)
- Movie: "The Odyssey IMAX 70MM", CinemarkMovieId=104867
  NOT 108919 — that is the digital (non-70mm) print of the same film at the same
  theater. It has ~10x more showtimes and plenty of open seats, so getting this
  wrong looks like a perfectly healthy scan of entirely the wrong screening.
- Qualifying seat: an OPEN REGULAR seat (not wheelchair, not companion) in
  row E or later.
- Window: next 30 days.

ROW THRESHOLD — READ CAREFULLY
Row E is physical row index 5, NOT 4. This auditorium's rows are:
  A:0  B:1  C:2  D:3  E:5  F:6  G:7  H:8  J:9  K:10
Index 4 does not exist (walkway gap) and the letters skip I. So use
physicalRowIdx >= 5, or equivalently exclude row letters A/B/C/D. Never derive the
index from the letter's alphabetical position.

FAST PATH
The scraper already exists and is tested:
  repo:   ssandeep104/linkforge-html-website-generator
  branch: claude/odyssey-imax-seat-monitor-tl7eok
  path:   odyssey-monitor/scan.cjs
Clone it and run:
  MIN_ROW_IDX=5 node odyssey-monitor/scan.cjs
It prints a 3-4 line summary ending in a machine-readable line:
  RESULT: FOUND row <R> seat <N> — <when>   |   RESULT: NONE   |   RESULT: ERROR — <msg>
Run `node odyssey-monitor/test.cjs` first (offline, no network) to confirm the parsing
logic still passes before trusting a scan. Read odyssey-monitor/README.md for detail.

IF YOU MUST REBUILD IT
- Showtimes: https://www.cinemark.com/umbraco/surface/Theater/GetShowtimes?theaterId=207&showDate=YYYY-MM-DD
  Server-rendered HTML, not JSON. Fetch once per date.
- Use Playwright's context.request.get(), NOT page.goto(). Full browser navigation
  gets net::ERR_CONNECTION_RESET in sandboxed/proxied environments — a bot-detection
  mismatch on the Chromium network stack, not a real block. The lightweight request
  client works fine on the identical URL.
- Pass the proxy explicitly if requests fail while curl succeeds:
  chromium.launch({ proxy: { server: process.env.HTTPS_PROXY } })
  Playwright's auto-detection has silently used a stale value here.
- The movie id is a SPACE-SEPARATED CLASS: <div class="showtimeMovieBlock 104867 ">,
  so searching for "showtimeMovieBlock104867" never matches. Simpler and more robust:
  select <a class="showtime-link"> anchors whose href contains CinemarkMovieId=104867.
  Sold-out slots render as <p class="off soldOut">, not anchors, so anchor-selection
  inherently keeps only purchasable showtimes.
- Seat map: fetch each showtime's /TicketSeatMap/?... href directly and parse
  <button ... available="True|False" info="Row,SeatNum,PhysicalRowIdx,ColIdx,ShowtimeId"
  seatType="seat|wheelchair|companion" class="...seatBlock">.
- Parse attributes CASE-INSENSITIVELY. The raw HTTP response uses camelCase
  (seatType, showtimeId), which differs from the rendered DOM in devtools.
- Qualify on the available/seatType ATTRIBUTES, never the class name. An *available
  accessible* seat renders as class "wheelchairAvailable", not "seatAvailable". On a
  real run, all 93 open seats across the whole 30-day window were wheelchair or
  companion — class-matching plus a row check would have fired false positives
  immediately.
- Sanity check: if a seat map parses to 0 seats, that is an expired/invalid showtime
  or a parse failure, NOT "sold out". A healthy map is ~231 seats. Track this —
  "all seats full" and "parsed nothing" otherwise look identical.

VERIFY BEFORE NOTIFYING (critical)
This inventory has sold out within ~30 seconds of being found. Before sending any
"found it" notification, re-fetch that specific seat map and confirm the seat is still
open. If it's gone, treat the firing as a non-match. Never send a stale positive.

NOTIFY ON EVERY FIRING — no exceptions
- Found (row E+, verified live): excited push, e.g.
  "🎉🎬 SEAT FOUND! Row H, Aug 4 3:15pm, Cinemark Dallas — BUY NOW: <url>"
  plus a full chat reply with date / time / row / seat / link.
- Nothing found (the common case): a deliberately low-key push anyway, e.g.
  "😔 Still no Odyssey IMAX seats. Job alive, watching." No chat reply needed.
- Errors: say so in the push, e.g. "⚠️ Odyssey monitor hit an error, still alive."
Silence must unambiguously mean "the job died" — it must never be confusable with
"nothing available yet". Keep routine output minimal; a scheduled job re-reads its own
output into context every firing, so verbose logging is a recurring cost.

SCHEDULING
One single consolidated job (not one per showtime), every 2 hours flat, not anchored to
showtime slots. Use durable/persistent scheduling if available; if only session-scoped
scheduling exists, say so plainly rather than implying set-and-forget reliability.

FIRST, CHECK PRECONDITIONS AND TELL ME WHAT YOU FIND
1. Can you reach cinemark.com? If fetches fail with "Host not in allowlist" that is a
   network-policy issue to raise with me, not a bug to route around.
2. Is Playwright available? If not, say so — curl/fetch also works against both
   endpoints; they are plain HTTP GETs with no auth.
3. What scheduling is actually available, and is it durable or session-scoped?
Report what's live and what its real limitations are. Do a full scan once and show me
the result before scheduling anything.
```
