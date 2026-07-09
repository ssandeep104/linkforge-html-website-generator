# Linkforge Redesign — Task Prompts

This file breaks the full UX redesign into self-contained prompts. Each prompt
is sized to be one focused session of work (roughly one PR each). They are
ordered so later prompts can build on earlier ones; where there's a hard
dependency it's called out under **Depends on**.

Repo entry points to remember:
- `index.html` — three screens: `#step-input`, `#step-review`, `#step-output`
- `style.css` — single global stylesheet (~3.4k lines)
- `app.js` — all client-side behavior (~4k lines)
- `templates.js` — the 6 layout renderers used by the generated output
- `server.js` — trivial static Express server (`npm run dev` → http://localhost:3000)
- No build step. No framework. Vanilla HTML/CSS/JS.

Local verification for every prompt: `npm run dev`, walk the flow
Input → click **Try a sample** → **Parse & continue** → **Generate site**.

---

## Prompt 1 — Fix the sticky action bar overlap on the Review screen

**Scope:** Bug fix only, no visual redesign.

**Problem:** On `#step-review`, the sticky footer bar containing **Back** and
**Generate site** is positioned such that it visually overlaps the layout
picker cards in the middle of the page (see
`.copilot/session-state/.../files/02-review-fresh.png`). The bar's background
is transparent/translucent enough that content bleeds through, and the bar
sits *over* the cards rather than reserving space below them.

**What to do:**
1. Find the sticky bar in `index.html` inside `#step-review` (the wrapper that
   holds the `Back` and `Generate site` buttons).
2. In `style.css`, either:
   - Give the bar a fully opaque background (matching the page) with a proper
     `backdrop-filter: blur(20px)` and a top border/shadow, **and**
   - Add matching `padding-bottom` to the review screen's scroll container so
     content can scroll clear of the bar.
3. Verify at 1440×900 and 375×812 that no content is ever hidden by the bar
   while scrolling.

**Do not** restructure the review layout — a fuller redesign lands in Prompt 6.

**Done when:** Walking the sample flow to review, no card, dropdown, or link
row is ever obscured by the sticky bar at any scroll position or viewport
width from 360px up.

---

## Prompt 2 — Establish the global design token layer

**Scope:** Foundation work. Touches variables only, minimal visual change on
its own. Every later prompt consumes these tokens.

**What to do:**
1. In `style.css`, locate the existing `:root` custom-property block. Extend
   it (or replace it) with a coherent token set:
   - **Type scale** (tabular where numeric):
     `--fs-display: 56px`, `--fs-h1: 40px`, `--fs-h2: 28px`, `--fs-h3: 20px`,
     `--fs-body: 15px`, `--fs-small: 13px`, `--fs-mono: 12px`.
     Matching `--lh-*` line-heights.
   - **Spacing scale** on a 4px base: `--s-1` through `--s-16`.
   - **Radius scale:** `--r-sm 8`, `--r-md 14`, `--r-lg 20`, `--r-pill 999`.
   - **Elevation:** replace ad-hoc shadows with `--elev-0/1/2/3` (0 = flat,
     3 = modal). Keep them subtle — max 20% opacity, low-blur soft shadows.
   - **Color:** keep the existing orange; formalize
     `--accent`, `--accent-strong`, `--accent-soft`, `--fg`, `--fg-muted`,
     `--fg-subtle`, `--surface`, `--surface-raised`, `--surface-sunken`,
     `--border`, `--border-strong`. Define **light** and **dark** sets.
2. Add a `[data-theme="dark"]` selector on `<html>` that swaps the color
   tokens; wire the existing moon/sun toggle button in the topbar to toggle
   `data-theme` and persist to `localStorage` (`linkforge:theme`).
3. Do a **mechanical migration only** of the most obvious offenders: replace
   hard-coded `#…` colors and `px` font-sizes in the topbar, buttons, and
   the shared card class with the new tokens. Leave the rest for later
   prompts.
4. Add a small `docs/design-tokens.md` cheat sheet documenting each token
   and when to use it.

**Do not** redesign any screen. This prompt should render nearly identically
in light mode; the payoff is that later prompts can just use tokens.

**Done when:** Toggling the theme button flips the whole app between a
readable light theme and a real dark theme (near-black background, orange
brightened for contrast). Existing screens still function.

---

## Prompt 3 — Redesign the Output / Ship screen

**Depends on:** Prompt 2 (tokens + dark mode).

**Scope:** The `#step-output` screen only. This is the highest-ROI screen —
it's currently the weakest and it's the payoff moment of the whole app.

**What to do:**
1. **Hero success card** at the top of the screen, replacing today's
   inline generated site:
   - Big check glyph, `Your site is ready`, filename (e.g.
     `streamstack.html`), file size in KB, item + source counts.
   - Primary action **Download HTML** (orange), secondary **Open preview**
     (opens the generated HTML in a new tab via a blob URL), tertiary text
     row: `Copy inline HTML · Copy embed link · Start new`.
   - Use tokens from Prompt 2.
2. **Framed preview** below the hero:
   - Wrap the generated site in a browser-chrome mock: rounded top bar with
     three window dots, a fake URL pill showing the filename, subtle shadow,
     max-width ~1040px, centered. This visually separates the preview from
     the app chrome.
   - The generated HTML should render inside an `<iframe srcdoc>` so its
     styles are scoped and can't leak into the app.
3. **Publish anywhere** card in a right rail (stack below the frame on
   ≤900px):
   - One-line instructions with copy-to-clipboard buttons for GitHub Pages,
     Netlify Drop, Vercel, and "any static host / S3."
   - Reinforce the "no backend, no lock-in" line here.
4. **Fix broken image placeholders** inside the generated output: when an
   `<img>` has no `src` or fails to load, replace it with an SVG placeholder
   pattern showing the domain's initials on a soft-tinted background that
   matches the chosen template's palette. Implement in `templates.js` or a
   shared helper.
5. Remove the floating `12 / 1 source queued in creator-grid mode` card and
   the awkward `PREVIEW COVERAGE 67%` widget — fold their info into the hero
   success card if useful, otherwise drop.

**Done when:** After clicking **Generate site**, the user lands on a screen
that feels like a delivered artifact: clear success moment, obvious download,
neatly framed preview, and clear next steps for publishing.

---

## Prompt 4 — Redesign the Input screen as a workspace

**Depends on:** Prompt 2 (tokens).

**Scope:** The `#step-input` screen. Restructure from "landing page" to
"paste-first workspace."

**What to do:**
1. **Compress the hero.** Replace the huge multi-line headline with a single
   line: `Paste HTML → forge a watchlist or gallery.` Move the long
   description into a small "About" popover triggered from a `?` button, or
   into the footer.
2. **Kill the right rail** as it exists (Workflow blurb, three stat tiles,
   Output blurb). It's brag copy and duplicates the header stepper.
3. **Editor shell.** Turn today's "Sources" card + tip banner + source card
   into one unified surface that looks like a code editor:
   - Top: filename tab strip (`Source 1`, `+ Add source`) — tabs, not
     stacked cards, for multi-source.
   - Middle: the paste textarea, filling most of the fold. Monospace font,
     subtle inner shadow, `⌘V to paste` hint when empty.
   - Bottom: meta strip with live counts (`0 items · 0 with image · 0 videos`)
     and the tip line (compressed to one line, truncatable).
4. **Live inspector panel** on the right (≥1100px) or below the editor
   (narrower):
   - Updates on paste with detected title, hero image, JSON-LD found?, and a
     scroll of the first 5 detected links with thumbs.
   - This is the "wow" — the tool visibly responds to input.
5. **Primary CTA** in the bottom-right of the editor shell, sticky:
   `Parse 12 links →` (count baked in, disabled at 0). Kill the separate
   `0 sources · 0 items detected` bar.
6. **Remove the three §01/§02/§03 footer cards.** They repeat the header
   step pill.
7. Background: swap the peach wash for a neutral surface with a subtle dot
   grid (`background-image` of radial-gradient dots at 24px spacing, very
   low contrast). Save the peach for the Review screen.

**Done when:** On first load at 1440×900 the paste editor is the dominant
element in the fold, the user can paste and immediately see detected content
in an inspector panel, and the primary CTA reflects live parse readiness.

---

## Prompt 5 — Rebuild the layout picker as compact previews

**Depends on:** Prompt 2.

**Scope:** The layout-picker section of the Review screen. Extracted from
Prompt 6 because it's a self-contained, meaty piece of work.

**What to do:**
1. Replace the seven large (~340×340) abstract block-graphic cards with a
   **compact horizontal strip** of small tiles (roughly 180×140).
2. Each tile renders a **real miniature of the template's actual output** —
   not abstract blocks. Reuse the renderers in `templates.js` on a fixed
   sample dataset (add it to `templates.js` as `SAMPLE_PREVIEW_DATA`) and
   scale the result down with `transform: scale(0.18)` inside a clipped
   frame. This makes template choice honest.
3. Selected state: a strong 2px accent ring + label bar underneath with the
   template name. Suggested template gets a single subtle glow, not a badge.
4. On hover/focus, show a small popover with the template's one-line
   description and "best for" text — this pulls the current wall of
   descriptions off the main surface.
5. Keep keyboard navigation: arrow keys move selection, Enter confirms.

**Done when:** The layout picker fits in ~200px of vertical space, previews
resemble the actual output, and switching templates is a one-click,
low-friction choice.

---

## Prompt 6 — Restructure the Review screen into a split view

**Depends on:** Prompt 1 (sticky bar), Prompt 2 (tokens), Prompt 5 (picker).

**Scope:** The `#step-review` screen. Excludes the layout-picker piece
(Prompt 5) and the sticky-bar bug (Prompt 1).

**What to do:**
1. **Two-column split** (35% / 65%) on ≥1100px, stacked on narrower:
   - **Left (sticky):** site meta (title + tagline as one compact card),
     source switcher as a **vertical list** with progress checks (source 1 ✓,
     source 2 →), then the layout-picker strip from Prompt 5, then an
     **Advanced source rules** disclosure (closed by default) that contains
     today's Title/Image selector dropdowns.
   - **Right (scrolling):** a live rendered preview of the selected template
     at the top (~360px tall), then the selectable link list grouped by
     `with image / with video / plain`. Each row: thumb + title + domain +
     checkbox. A toolbar directly above the list holds `Select all`,
     `Select none`, `Only with image`.
2. **Delete duplicate source counters.** Keep exactly one source-progress
   indicator — the vertical list in the left rail. Remove the top-right
   `12 / 12 selected · N sources to review · On source 1` box and the
   footer `Reviewing source 1 of 2 · Previous / Next` row.
3. **Sticky footer bar** (already fixed for overlap in Prompt 1) gets its
   real content now: `Back` on the left, source progress dots in the middle,
   `Generate site →` on the right. Use `backdrop-filter: blur(20px)` and a
   proper token-driven surface color.
4. **Peach wash stays here** — this is the editorial curation screen and is
   the right place for the warm palette.

**Done when:** Reviewing a multi-source paste feels like a workshop: you
choose a template on the left, curate links on the right, and never lose
context or scroll past a floating action bar to see your work.

---

## Prompt 7 — Motion & micro-interaction pass

**Depends on:** Prompts 3, 4, 6.

**Scope:** Add restrained motion across all three screens. Nothing gratuitous.

**What to do:**
1. **Input:** subtle pulse on the detected-item counter when new links are
   parsed. Cursor-tracking radial glow on the empty paste textarea to invite
   the click.
2. **Review:** crossfade between template previews when the user switches
   layouts (~150ms). Row-level fade when a link is toggled off.
3. **Output:** on entering the screen, a one-shot success animation on the
   hero card (check mark draws in, filename types out over ~600ms, download
   button lifts).
4. **Global:** step-transition between screens is a soft crossfade + 8px
   upward shift; respect `prefers-reduced-motion: reduce` for all of the
   above (no motion, just state change).
5. Buttons: subtle scale-down on `:active` (0.98), soft shadow rise on
   `:hover`.

Keep every animation under 400ms. Use CSS transitions where possible; only
reach for JS/Web Animations API for the success sequence.

**Done when:** The app feels alive — visible response to user actions —
without any animation ever blocking or delaying interaction. Reduced-motion
users get zero motion but the same states.

---

## Prompt 8 — Typography and color-usage cleanup pass

**Depends on:** Prompts 2, 3, 4, 6.

**Scope:** A cleanup sweep, not a redesign. Enforces the type scale and
color rules everywhere.

**What to do:**
1. **Typography audit:** grep the codebase for any `font-size:` declaration
   in `style.css` that isn't already using a `--fs-*` token, and convert it.
   Same for line-heights.
2. **Color audit:** grep for hex colors, `rgb(`, and `hsl(` in `style.css`
   and replace with tokens. Any leftover hardcoded color is a bug — either
   promote it to a token or delete it.
3. **Accent budget:** the orange (`--accent`) may appear on **at most one
   primary action per screen** plus tokenized micro-uses (focus rings,
   selected-tab underline, hero highlight). Anywhere it's currently used as
   a border, badge background, or decorative dot outside those rules,
   downgrade to a neutral or the soft-accent tint.
4. **Tabular numerals** everywhere numbers align in columns (source
   counters, link counts, file size).
5. Verify contrast: every text/background pairing meets WCAG AA (4.5:1 for
   body, 3:1 for large text) in both themes.

**Done when:** No hardcoded colors or px font-sizes remain in `style.css`,
every screen has exactly one dominant orange action, and both themes pass
AA contrast.

---

## Prompt 9 — Cross-viewport & QA pass

**Depends on:** Prompts 1–8.

**Scope:** Manual QA sweep, plus small fixes surfaced along the way.

**What to do:**
1. Walk the full flow at these widths: **360, 414, 768, 1024, 1280, 1440,
   1920**. In each: paste the sample, walk to review, generate, download.
2. In both **light** and **dark** themes.
3. Log every regression as a checkbox in a fresh
   `docs/redesign-qa.md`. Fix the ones that are ≤30 min each in this same
   prompt; file the rest as follow-ups at the bottom of `redesign-qa.md`.
4. Verify: no horizontal scroll at any width; no overlapping sticky
   surfaces; no untranslated raw HTML (`<h3>`, `<img src>`) leaking into
   the default UI; every focus ring visible; every button reachable by tab.
5. Update the top of `README.md` with a short "Design & UX" section that
   links to `docs/design-tokens.md` and this file.

**Done when:** The QA doc has an all-green checklist for the tested widths
in both themes.

---

## Suggested execution order

1. **Prompt 1** — sticky bar (unblocks Prompt 6, quick win).
2. **Prompt 2** — tokens + dark mode (foundation for everything visual).
3. **Prompt 3** — Output screen (biggest UX ROI, sets the quality bar).
4. **Prompt 4** — Input workspace.
5. **Prompt 5** — layout picker mini-previews.
6. **Prompt 6** — Review split view.
7. **Prompt 7** — motion pass.
8. **Prompt 8** — type/color cleanup.
9. **Prompt 9** — cross-viewport QA.

Prompts 3–5 can be parallelized after Prompt 2. Prompts 7 and 8 can be
parallelized after Prompt 6. Prompt 9 must be last.
