# Course Map — "Make it feel alive" + the Boss Moment (visual polish)

**Date:** 2026-06-10
**Type:** Pure visual polish. No new functionality, no data/route/logic changes.
**Surface:** Course detail page → `src/components/course/CourseMap.tsx` + `src/app/globals.css`.
**Brainstorm artifacts:** `.superpowers/brainstorm/955-*/content/coursemap-directions.html`, `coursemap-combo.html` (gitignored).

## Goal

The Course Map reads a little wireframe-y (flat navy cards with thin outlines) and the
episode boss repeats the same flat tile, so the climactic encounter feels underplayed.
Make the map feel like a **living RPG map** and make the **boss moment** land — without
adding length, restructuring, or touching any behavior.

Chosen direction (from the 3 mockups): **calm cards + dramatic boss**.
- Cards stay quiet so the page doesn't get noisy.
- All the drama is reserved for the boss tile.

Explicitly rejected: per-chapter rainbow hues (Direction B cards) and the quest-spine /
connector lines (Direction C) — connectors were tried and pulled before for reading poorly
at small sizes.

## Scope

**In scope**
1. **Calm episode cards** — the outer episode container (`pixel-border` card in CourseMap):
   add a subtle gradient fill, a faint dot-matrix texture overlay, and a **status-tinted
   inner glow** (indigo while in progress → emerald when the episode is 100% mastered).
   The status flip already exists (border/nails/number badge swap indigo→emerald); we
   extend that same flip to the new fill + glow so ALL chrome transitions together.
2. **Dramatic boss tile** — restyle the three existing boss states (no new states):
   - **Dormant (locked):** keep muted + `Lock` + "BOSS DORMANT", but add a *faint*
     sealed red ember (low alpha) so it reads "something dangerous sleeps here." Stays
     clearly inactive.
   - **Awakened (unlocked, not defeated) — THE payoff:** the red active-boss tile becomes
     a "throne" — a red radial glow behind a larger `Skull`, intensified
     `boss-arena-glow--pending`, stronger scanlines. Keeps the `StartBossButton` CTA.
     **Stays red** (danger), per the app's established semantics.
   - **Victory (defeated):** keep amber + `Trophy` + "VICTORY"; small triumphant amber
     throne-glow bump using `boss-arena-glow--defeated`.

**Out of scope** (do not touch this session)
- Topic rows (already tier-colored via `NODE_STYLES` — leave as-is).
- The course **header/hero zone**, Study Report, Exam Prep tiles.
- Any layout/length/hierarchy restructuring.
- The quest spine / connector lines.
- Any data, route, sound, or logic change. Boss unlock/defeat conditions are unchanged —
  we only restyle states the map already computes.

## Color semantics (correction from the mockup — needs Max's sign-off)

The approval mockup showed the *ready* boss igniting **amber**. The real app already uses:
- **red** = the live, dangerous boss fight (unlocked, not yet defeated)
- **amber** = **victory** (defeated) + XP

This matches the locked palette (red = danger, amber = XP/legendary, green = mastery). So in
implementation the "ignite" drama goes on the **red awakened** state, and amber stays for
victory. This is the only deviation from the approved mockup — flagged here for explicit
confirmation before implementation.

## Approach (reuse-first)

Existing utilities to lean on (verified in `globals.css`):
- `.hud-hero-texture` — 18px indigo dot-matrix → the card texture overlay (aria-hidden span).
- `.boss-arena-glow` + `--pending` (red) / `--defeated` (amber) — already animated and
  already `prefers-reduced-motion` guarded (animation off, opacity 0.55). Reused as-is for
  the throne ambient; the awakened state may layer a second, tighter inner ember.
- `.pixel-scanlines`, `.pixel-border` — unchanged, reused.

New CSS (added to `globals.css` under the existing boss/arcade section headers, not scattered
in the component):
- `.episode-card-alive` (or inline style) — status-tinted gradient + inner glow driven by a
  `--alive-rgb` custom property the component sets (`99 102 241` indigo / `34 197 94` emerald).
  Inner glow stays subtle: `box-shadow: inset 0 0 28px rgba(var(--alive-rgb), .12)`.
- `.boss-throne` — a tighter inner radial behind the skull for the awakened red state (and a
  muted variant for dormant). Keyed by a `--throne-rgb` property so red/amber/sealed share one
  rule.
- One ember `@keyframes` for the inner throne breathe, **guarded** by
  `@media (prefers-reduced-motion: reduce)` (animation: none) to match the existing
  `.boss-arena-glow` guard.

## Files

- `src/components/course/CourseMap.tsx` — episode card container className/overlay + boss-tile
  state blocks (dormant / awakened / victory). Add aria-hidden texture + throne overlay spans.
- `src/app/globals.css` — `.episode-card-alive`, `.boss-throne` (+ variants), one ember keyframe
  + reduced-motion guard. Placed under the boss-arena / arcade section.

## Accessibility & correctness floor

- **AA contrast preserved:** body copy stays white; existing red/amber label tones unchanged.
  New glows sit behind opaque tile backgrounds, so they don't reduce text contrast.
- **Non-color cues intact:** `Lock` / `Skull` / `Trophy` icons + pixel labels
  ("BOSS DORMANT" / "BOSS FIGHT" / "VICTORY") already encode state without relying on color.
- **Motion:** every new animation behind `motion-safe` / `prefers-reduced-motion: reduce`.
  Durations stay in the ambient-loop range (2.4–3.4s breathe), matching existing boss pulse.
- **RTL:** changes are background/glow only (direction-agnostic); Hebrew titles unaffected.
- **No new DOM that breaks the existing button-in-button split** in the episode header.

## Verification plan

- `npm run lint` + `npm run build` clean.
- `npm test` still green (no logic touched; styling only — no new unit tests warranted).
- Playwright on the live course page: screenshot the in-progress episode (calm indigo card +
  dormant sealed boss) and confirm against the mockup; confirm 0 new console errors.
- If no fully-mastered episode exists to show the awakened-red + victory states live, verify
  those via the mockup parity + a temporary state toggle, and note it.
- Eyeball `prefers-reduced-motion` (DevTools emulation): glows go static, no breathe.

## Risks

- **Texture/glow over-noise:** keep alphas low (≤0.12 inner glow, ≤0.065 texture dots). If the
  calm card stops reading "calm," dial down first.
- **Awakened boss too loud:** the red throne must feel climactic but not alarming. Tune the
  radial alpha; the `boss-arena-glow--pending` baseline (0.35 center) is the ceiling reference.
- **Color-semantic deviation** (amber→red for "ready") must be confirmed before coding.
