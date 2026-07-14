# Linkforge Premium Design Blueprint

## 1) Global Design System

**Tokens (CSS custom properties on `:root`, overridable per template family):**
- **Color:** `--bg` (near-black `#0a0a0d` dark / warm-white `#faf9f7` light), `--surface`, `--surface-2` (layered, +4–6% lightness steps), `--ink`, `--ink-muted` (60% opacity), `--ink-faint` (38%), `--accent` (one per family), `--accent-contrast`, `--line` (8–12% ink borders).
- **Typography:** `--font-display` (tight, -2% tracking, weights 650–800), `--font-body`, `--font-mono` (metadata). Scale: 12/14/16/20/28/40/56px, fluid via `clamp()` above 28px. Line-height 1.1 display, 1.55 body.
- **Spacing:** 4px base — 4/8/12/16/24/32/48/64/96. Section rhythm: 96px desktop, 56px mobile.
- **Radius:** `--r-sm:8px`, `--r-md:14px`, `--r-lg:22px`, `--r-full`. One radius tier per component, never mixed within a card.
- **Border:** 1px `--line` default; 1.5px accent on active/selected only.
- **Shadow:** two tiers only — `--shadow-rest` (0 1px 2px + 0 4px 12px, ~6% black) and `--shadow-lift` (0 8px 30px, ~14%). Dark themes use lighter-surface elevation instead of shadow.
- **Motion:** `--ease-out: cubic-bezier(.22,1,.36,1)`, `--dur-fast:150ms`, `--dur-base:240ms`, `--dur-slow:400ms`. Transform/opacity only; never animate layout properties.

**Depth & backgrounds:** three layers max (page → surface → raised). Page backgrounds get one subtle signature: a radial accent glow, fine noise texture, or faint grid — never all three. **Hierarchy:** one dominant element per viewport; size and weight carry hierarchy, color is reserved for action and status. **Responsive:** container queries where supported, else breakpoints at 640/960/1280; fluid type and spacing between them.

**Accessibility defaults:** body text ≥ 4.5:1, large display ≥ 3:1; visible `:focus-visible` ring (2px accent, 2px offset) on every interactive element; `prefers-reduced-motion: reduce` collapses all transitions to opacity ≤ 100ms and disables autoplay/marquee movement; touch targets ≥ 44px.

## 2) Shared Component Language

- **Hero:** full-bleed band; display headline, one-line description, metadata row, single primary CTA. Optional media backdrop at ≤ 35% opacity behind a gradient scrim.
- **Card:** surface + 1px line + `--r-md`; media top (fixed aspect), 16–20px content padding, title (2-line clamp), metadata row bottom. Whole card is the link; inner actions stop propagation.
- **Media block:** aspect-ratio boxes (16:9, 4:5, 1:1 per family), `object-fit: cover`, blurred dominant-color placeholder, lazy-loaded.
- **Nav/header:** sticky, backdrop-blur surface at 85% opacity, hairline bottom border appearing on scroll; brand left, source tabs center/below, count chip right.
- **CTA:** primary = accent fill, pill radius; secondary = 1px outline. One primary per view.
- **Metadata rows:** mono or small-caps 12px `--ink-muted`, dot-separated (`source · type · date`).
- **Chips/tags:** pill, `--surface-2`, 12px; selected = accent fill.
- **Empty states:** centered, icon at 40% opacity, one sentence, one action.

**States:** hover = `--shadow-lift` + `translateY(-2px)` + accent underline/border (`--dur-base`); focus = focus ring, never outline-none; active = `scale(.98)`, `--dur-fast`; disabled = 45% opacity, `pointer-events:none`. Motion: entrance = 12px rise + fade, staggered 40ms across siblings, once only; no looping ambient animation except family signatures, all gated by reduced-motion.

## 3) Template-by-Template Transformation Plan

**Marquee** — *Direction:* cinematic, near-black, one hot accent (coral). *Layout:* oversized hero tile + horizontal scroll rows of video tiles with hover-scrub previews. *Traits:* gradient scrims over media, autoplay loops muted with visible pause control. *Mobile:* rows become edge-peeking swipe carousels; autoplay only for in-view tile. *Avoid:* simultaneous autoplays, text over unscrimmed video, infinite marquee that can't be paused.

**Stream** — *Direction:* creator-platform energy; dark surface, electric accent. *Layout:* tabbed sources → responsive card grid, 16:9 thumbs, duration badge. *Traits:* channel avatar row, "new" pulse dot on fresh items. *Mobile:* 1-col with large thumbs; tabs scroll horizontally with fade edges. *Avoid:* cramming 4+ columns, thumbnail letterboxing.

**Board** — *Direction:* data-dense, calm precision; mono metadata, cool accent. *Layout:* compact list-cards in 2-col masonry, strong metadata hierarchy. *Traits:* status chips, timestamp column, hairline dividers. *Mobile:* single column, metadata collapses to one row. *Avoid:* decorative imagery dominating data, mixed alignment.

**Console** — *Direction:* terminal-luxe; true black, phosphor-green or amber accent, mono display type. *Layout:* full-width rows, keyboard-style focus traversal, sectioned by source. *Traits:* prompt-style headings (`>`), subtle scanline texture, count readouts. *Mobile:* rows stay full-width; texture removed. *Avoid:* blinking cursors everywhere, low-contrast green-on-black body text.

**Editorial** — *Direction:* magazine calm; warm light theme, serif display. *Layout:* leading story (large image + deck) then 2-col article list with thumbnail-right rows. *Traits:* drop-cap-free but generous whitespace, pull-quote styling for descriptions, thin rules. *Mobile:* single column, images 4:5 above text. *Avoid:* dark-mode-by-default, card-chrome overload — let rules and whitespace divide.

**Index** — *Direction:* Swiss/archival; near-white, ink-black, single red accent. *Layout:* alphabetical/sectioned table-like list, oversized section letters, hover reveals thumbnail popover (desktop only). *Traits:* numbered rows, right-aligned metadata, hard grid. *Mobile:* rows become tappable full-width cells, no popovers. *Avoid:* adding cards/shadows — this family is flat by identity.

**Reel** — *Direction:* immersive vertical media; black, white type, gradient scrims. *Layout:* snap-scrolling 9:16 panels (desktop: centered column with side metadata rail). *Traits:* progress dots, per-panel CTA, swipe affordance hint once. *Mobile:* full-viewport snap panels. *Avoid:* hijacked scroll without escape, autoplay with sound, hidden exit.

## 4) Implementation Rules

**Must remain unchanged:** `TEMPLATES` registry keys and `build/validate/normalize` contracts; all rendered data fields (titles, URLs, descriptions, source grouping, counts); link `href` semantics and ordering; source-tab behavior and slugs; golden-test DOM data (selectors/attributes that tests assert); generated-file structure (single-file HTML output, no new runtime dependencies).

**Safe to refactor:** all CSS (move to shared token layer + per-family override block); class names not asserted by tests; wrapper/`div` structure inside cards; SVG previews in `previewSvg`; shared shell markup (header/footer) provided landmarks stay (`header/nav/main/footer`); adding `aria-*`, `loading="lazy"`, `aspect-ratio`.

**Priority order:** 1) token layer + shared shell, 2) shared components (card, tabs, hero, metadata), 3) Marquee + Stream (flagship families), 4) Editorial + Board, 5) Console + Index + Reel, 6) motion pass + reduced-motion audit, 7) SVG preview refresh to match new identities.

## 5) Acceptance Criteria

1. Every template consumes only tokens — zero hard-coded colors/shadows outside the token layer.
2. Each family is identifiable in a 1-second glance test (distinct accent, type, layout signature).
3. All text meets WCAG AA contrast (automated axe/Lighthouse a11y score ≥ 95).
4. Every interactive element shows a visible `:focus-visible` ring and is keyboard-reachable in DOM order.
5. `prefers-reduced-motion` disables all autoplay, loops, and entrance animation.
6. No horizontal page overflow at 320, 768, 1440, and 1920px widths.
7. Touch targets ≥ 44×44px on mobile; tabs and carousels swipeable.
8. Hover, active, and disabled states present on every card, tab, chip, and CTA.
9. All media uses `aspect-ratio` + lazy loading; zero layout shift (CLS ≈ 0) on load.
10. Animations use transform/opacity only; no transition exceeds 400ms.
11. Golden tests pass unmodified: identical link count, order, `href`s, and text content per fixture.
12. Generated output remains a self-contained single HTML file with no new external requests.
