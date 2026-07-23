# Task: continue eliminating duplicate/competing CSS rules in style.css

## Status

Batch 1 (8 selectors: `.screen`, `.topbar`, `.logo`, `.logo svg`,
`.topbar__right`, `.step-pill`, `.step-pill__dot`, `.icon-btn`) is merged
into `main` as of commit `49096d2`. Batches 2 and 3 (16 more selectors) are
also merged. Progress so far is logged in `CSS_DEDUP_PROGRESS.md` at the
repo root — **update that file, don't create a new one**, so there's one
running log instead of scattered progress notes.

**85 duplicated selector strings remain** as of this file's current state
on `main` (see the regenerated inventory at the bottom — re-run the
detection script yourself before starting, this list will already be
slightly stale). As before, many of these are legitimate `@media`
responsive breakpoints, not bugs — see the safety rule from the original
brief, repeated below, plus a new rule below that specifically.

## Read this before you touch anything: what went wrong in batch 1

Batch 1 shipped with a real, site-breaking bug, caught in review before it
reached production. It's worth understanding exactly what happened,
because the same mistake is easy to repeat on the remaining 85 selectors.

`.screen { display: none; ... }` and `.screen--active { display: block;
... }` are a pair: every screen element has both classes, `.screen` hides
it by default, `.screen--active` shows the current one. For that to work,
`.screen--active`'s `display: block` must win the cascade — which, before
any of this cleanup started, it did, because it happened to sit later in
the file than the rule that set `.screen`'s `display: none`.

Batch 1 merged two competing `.screen` rules into one, and — following the
instruction "write the merged rule at the position of the last
occurrence" — placed the merged `.screen` (which still carries `display:
none`) at a position that came **after** `.screen--active` in the file.
Same specificity, later wins: `.screen`'s `display: none` started beating
`.screen--active`'s `display: block`, for every screen, always. The app
rendered as a completely blank page. `npm test` still passed (60/60 —
those are parser tests, they never load the page in a browser). The PR's
own progress notes claimed "Visual fidelity: ✓ Verified," which did not
hold up against an actual page load.

**The lesson:** merging and relocating rule A can silently break rule B,
even when you never touch rule B's own text, if A and B compete for the
same CSS property on elements that carry both classes at once. Checking
that your merge is internally correct (right properties, right values) is
necessary but **not sufficient** — you also have to check what else in the
file was depending on A's old position.

## New safety rule: check for companion state classes before relocating

Before you merge and relocate any selector `X`, search the file for any
selector that looks like a state/variant modifier of `X` (commonly named
`X--something`, but also check unrelated classes that are applied to the
same elements — read the HTML in `index.html` if you're not sure what's
paired with what). For every such companion class you find:

1. Does it set any of the same CSS properties as `X`? (`grep` both rules'
   property lists and look for overlap.)
2. If yes: elements that carry both classes depend on a specific one of
   the two winning. Figure out which one is supposed to win (usually the
   one representing "this is the exceptional/active state" should beat
   the one representing "this is the default state" — e.g.
   `--active`/`--off`/`--disabled`/`--empty` variants should generally
   keep winning over their unmodified base class for the properties they
   both touch).
3. After your merge, confirm that relationship still holds by checking
   source order (same rule as before: later same-specificity declaration
   wins) — and if your merge would flip it, either don't relocate the
   merged rule to the "last occurrence" position (leave it at the
   *first* occurrence position instead, or wherever preserves the
   needed order), or move the companion rule too, whichever is the
   smaller, clearer change.

Known companion pairs already in this file that you'll encounter in the
remaining 85 — check these specifically when you get to them:

- `.item-card` / `.item-card--off`
- `.item-row` / `.item-row--off`
- `.item-card__media--empty`, `.item-row__thumb--empty` (empty-state
  variants of media containers)
- `.template-card` / `.template-card--active` / `.template-card--disabled`
- `.template-carousel__dot--active`

This is not an exhaustive list — it's what a `grep -oE
"\.[a-zA-Z0-9_-]+--[a-zA-Z-]+"` turned up as of now. Re-check for others
as you go, especially anything ending in `--active`, `--off`, `--empty`,
`--disabled`, `--selected`, `--current`, `--hidden`.

## New required check: automated render assertion, every batch, not just screenshots

Screenshots are good for catching visual/layout drift, but a fully blank
page is exactly the kind of thing that's easy to glance past in a
screenshot review (and apparently was, last time). Add this **cheap,
automated, pass/fail check** after every batch, in addition to the
screenshot comparison from the original brief — it takes a few seconds
and would have caught the batch-1 bug immediately:

```bash
python3 -m http.server 8123 &
sleep 1
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForTimeout(400);
  const display = await page.evaluate(() => {
    const el = document.querySelector('#step-input');
    return el ? getComputedStyle(el).display : 'MISSING ELEMENT';
  });
  const bodyText = await page.evaluate(() => document.body.innerText.trim().length);
  console.log('step-input computed display:', display, '(must be \"block\")');
  console.log('visible body text length:', bodyText, '(must be > 200 — a blank page has ~0)');
  if (display !== 'block' || bodyText < 200) {
    console.log('FAIL: page did not render correctly');
    process.exit(1);
  }
  console.log('PASS');
  await browser.close();
})();
"
kill %1
```

If this fails, **do not commit** — find which merge caused it (bisect by
reverting your most recent merge and re-running the check) before
continuing.

## Everything else from the original brief still applies

- Regenerate the duplicate-selector list yourself before each session
  (line numbers shift after every edit) — script is below.
- Group occurrences by their enclosing `@media` context first. Only merge
  within a group that has more than one member. Top-level + `@media` is
  never a duplicate. Different `@media` conditions are never duplicates of
  each other.
- For genuine duplicates: last same-context declaration wins per
  property; properties unique to one occurrence are still live and must
  be preserved; merge into one rule.
- Watch for `!important` (6 uses currently in the file — re-check with
  `grep -n "!important" style.css`, an `!important` declaration wins
  regardless of source order).
- Work in small batches (6-8 selectors), verify after each one (brace
  balance + the new render-assertion script above + full screenshot
  comparison + `npm test`), commit only once a batch is clean.
- Do not change any visible output. Do not touch `@media`-scoped rules
  relative to their own group. Do not rename anything. Do not add
  features or tokens. Do not touch any file other than `style.css` (and
  `CSS_DEDUP_PROGRESS.md` for the running log).
- No `git push --force`, no history rewriting.

## Regenerate the duplicate list

```bash
node -e "
const fs = require('fs');
const css = fs.readFileSync('style.css', 'utf8');
const lines = css.split('\n');
const selectorCounts = {};
let lineNo = 0;
for (const line of lines) {
  lineNo++;
  const trimmed = line.trim();
  if (trimmed.endsWith('{') && !trimmed.startsWith('@') && !trimmed.startsWith('/*')) {
    const sel = trimmed.slice(0, -1).trim();
    if (!sel) continue;
    if (!selectorCounts[sel]) selectorCounts[sel] = [];
    selectorCounts[sel].push(lineNo);
  }
}
const dupes = Object.entries(selectorCounts).filter(([sel, lines]) => lines.length > 1);
console.log('Duplicated exact selector strings:', dupes.length);
for (const [sel, lines] of dupes) console.log(lines.join(','), '\t', sel);
"
```

Remember this script's limitation from the original brief: it only
catches exact-string selector matches, and it won't catch a selector's
properties being set via a shared comma-separated rule elsewhere (e.g.
`.foo, .bar, .baz { border-radius: 999px; }` sets `.foo`'s border-radius
too, but won't show up under `.foo` in this scan). When merging a
selector, also `grep -n "\.your-selector," style.css` and `grep -n
",\s*\.your-selector\b" style.css` to check whether it's a member of any
shared multi-selector rule elsewhere — the last PR's `.composer__hint`
merge got this right by inspecting surrounding context by hand, not by
trusting the scanner alone. Do the same.

## Current inventory (regenerate before use — will be stale)

```
::selection, .source-card, .source-card:focus-within, .source-card__head,
.source-card__name, .source-card__name:focus-visible, .source-card__foot,
.source-card__stats, .composer__counts, .btn--primary:hover:not(:disabled),
.btn--primary:disabled, .btn--ghost, .btn--ghost:hover, .btn--sm, .how,
.how__item, .how__num, .footer, .review-head, .page-title,
.review-head__meta, .review-controls, .site-meta, .field, .field select,
.bulk-actions, .source-stepper, .source-stepper__actions,
.template-carousel__track .template-card, .template-carousel__btn,
.template-grid, .template-card, .template-card:hover,
.template-card--active, .template-card__suggested, .template-card__focus,
.template-card__preview, .template-card__body, .template-card__fit,
.category, .category__head, .category__grid, .item-card,
.item-card:hover, .item-card--off, .item-card__media--empty,
.item-card__title, .item-card__toggle, .item-card__toggle:hover,
.item-card__type, .review-foot, .preview-frame-wrap, #preview-frame,
.toast, .item-row, .item-row:hover, .item-row__box,
.item-row__check:checked + .item-row__box,
.item-row__check:checked + .item-row__box::after, .item-row__thumb,
.item-row__thumb--empty, .item-row__meta, .parse-hint, .strategy-picker,
.strategy-picker__head h3, .strategy-row__header, .strategy-row__workspace,
.strategy-field, .strategy-field select, .strategy-field select:focus,
.screen, .topbar, .logo, .logo svg, .topbar__right, .step-pill,
.icon-btn, .eyebrow, .display, .lede, .hero-stat, .hero-stats,
.composer__head, .source-card textarea, .composer__foot
```

Suggested next batch (6-8 selectors, none of them on the companion-class
watch list above, good place to restart the rhythm):
`.btn--ghost`, `.btn--ghost:hover`, `.btn--sm`, `.how`, `.how__item`,
`.how__num`, `.page-title`, `.site-meta`.

Save `.item-card*`, `.item-row*`, `.template-card*` for a batch where you
go slowly and apply the companion-class check above — those are the
highest-risk groups left.

## Deliverable

Same as before: report every selector group merged, every group
deliberately skipped and why, confirmation that both the render-assertion
script and `npm test` pass, before/after line count, and update
`CSS_DEDUP_PROGRESS.md` with the new batch(es) in the same table format
already established there.
