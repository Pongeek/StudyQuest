# Dashboard — "Urgency Breathes" alive pass (visual polish)

**Date:** 2026-06-11
**Type:** Pure visual polish. No new functionality, no data/route/logic changes.
**Surface:** `/dashboard` widget stack — `src/components/dashboard/*` + `src/app/globals.css` (+ one rename touch in `CourseMap.tsx`).
**Brainstorm artifacts:** `.superpowers/brainstorm/955-*/content/dashboard-directions.html` (gitignored). Max picked **Direction B: Urgency Breathes** (depth everywhere + motion only where it means something + living hero HUD).

## Goal

The dashboard widgets read flat — `rpg-card` is a near-flat white-tint (`rgba(255,255,255,0.018)`)
and the pixel-border widgets sit on plain `bg-slate-900/95`. Extend the Course-Map "alive"
treatment (status-tinted gradient + dot-matrix texture) across the widget stack for cohesion,
and add **one** breathing surface: the Next Best Action card, tinted by its tier. Motion stays
a signal, not decoration.

Explicitly rejected (from the 3-way mockup): C "Everything Hums" (texture drift + all widgets
breathing on offset timers) — restless on a page used between study sessions. A "Quiet Depth"
(no motion at all) — loses the living-HUD ask.

## Findings that shaped scope

- **The hero is already alive.** `DashboardHeroCard` has the dot-matrix texture, tier-glow
  level frame (`TierLevelFrame`), shimmering rank chip, animated counters, AND the XP bar
  already carries a 2.8s shimmer sweep (`.pixel-xp-bar-fill::before`). Mockup B's "hero XP
  sheen" exists in production. → Hero gets **no changes**; the living-HUD ask is satisfied.
- **`.episode-card-alive` (shipped this morning) is already generic** — fully driven by
  `--alive-rgb`. → Rename to `.card-alive` and reuse, instead of duplicating.

## Scope

**1. Rename `.episode-card-alive` → `.card-alive`** (globals.css + the one usage in
`CourseMap.tsx`). Same rule, generic name, comment updated. Add a
`.rpg-card.card-alive:hover` re-assertion so `rpg-card`'s flat hover background doesn't
wipe the gradient when the two classes combine.

**2. Depth on the widget stack** — each widget gets `card-alive` + its semantic
`--alive-rgb` + an aria-hidden `hud-hero-texture` overlay span (`pointer-events-none`,
rounded to match the card):

| Widget | Accent (`--alive-rgb`) |
|---|---|
| `TodayStatsStrip` | indigo `99 102 241` |
| `ExamCountdownCard` | urgency-colored (new `urgencyAliveRgb()` helper beside the existing `urgencyChipClass/Accent/Nail` helpers) |
| `NextBestActionCard` | tier-colored (add `tierRgb` to `TIER_PALETTE`: S `239 68 68` / A `245 158 11` / B `99 102 241`) |
| `ReviewQueueCard` | cyan `34 211 238` / urgent orange `249 115 22` (replaces the current flat `bg-*-500/5` tints) |
| `TodaysMission` | amber `245 158 11` / indigo `99 102 241` (replaces `bg-slate-900/95`) |
| `GrimoireWidget` | purple `168 85 247` / muted slate `100 116 139` when no demons (replaces `bg-slate-900/95`) |

**3. The one breathing widget** — new `.widget-breathe` utility (globals.css, boss/arcade
section): slow 3s box-shadow + border-tone pulse driven by `--w-rgb`. Applied **only** to
the `NextBestActionCard` root, `--w-rgb` = displayed action's tier color. NBA is by
construction the single most-pressing action (its decision logic already ranks S/A/B), so
"the most urgent thing breathes" falls out of existing logic with zero new computation.
When NBA renders null (no actions), nothing on the page breathes — correct.

**Out of scope:** hero card (already alive), QuestBoard / Your Realm / Achievements rows
(assess after this band lands), EmptyDashboardHero (zero-course state), color-palette
changes (Max explicitly skipped "more color energy"), any data/logic change.

## Accessibility & correctness floor

- New breathe animation joins the reduced-motion guard pattern:
  `@media (prefers-reduced-motion: reduce) { .widget-breathe { animation: none } }`.
- Glows/gradients sit behind opaque-enough fills at ≤0.10 alpha; text contrast unchanged.
- Texture spans are `aria-hidden` + `pointer-events-none`; widget content already renders
  at `z-[1]`/`z-10`.
- No DOM-structure changes that affect focus order or semantics.

## Verification

- `npx tsc --noEmit` clean; eslint on touched files (pre-existing issues excluded).
- Playwright: dashboard screenshot, 0 new console errors; NBA card visibly breathing;
  reduced-motion emulation freezes it.
- Course Map regression glance (the rename touches `CourseMap.tsx`).

## Risks

- `rpg-card:hover` specificity wiping the gradient — handled by the
  `.rpg-card.card-alive:hover` re-assertion.
- Over-noise from six tinted widgets — alphas match the Course-Map values (0.10/0.05)
  that Max already approved; if the stack reads busy, dial `--alive-rgb` alphas down first.
- NBA breathe needs to read as "gentle invite," not alarm — 3s period, shadow alpha ≤0.5.
