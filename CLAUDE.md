# StudyQuest — Agent Guide

StudyQuest is a gamified study platform. It should feel like a clean **study RPG**, never a boring education dashboard. Every screen should make the user feel like they are progressing through an academic RPG journey.

> **Read `AGENTS.md` first.** This is Next.js 16 — APIs and conventions differ from older versions. Consult `node_modules/next/dist/docs/` before writing routes, middleware, or caching code.

---

## Stack

- **Next.js 16** (App Router, React Server Components by default)
- **React 19**, **TypeScript**
- **Tailwind v4** (CSS-first config in `src/app/globals.css`)
- **shadcn/ui** — style `base-nova`, base color `neutral`, icons from `lucide-react`
- **Radix UI** primitives (avatar, dialog, dropdown, progress, separator, slot, tabs, toast)
- **Framer Motion** for animation, **sonner** for toasts, **next-themes** for dark mode
- **Clerk** for auth, **Supabase** (`@supabase/ssr`) for data
- **Anthropic SDK** + `unpdf` / `react-pdf` for the PDF → quiz pipeline
- Request interception lives in `src/proxy.ts` (Next 16's renamed `middleware.ts`)

## Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

---

## Skill & tool routing (when to reach for what)

I auto-receive the full skill/plugin/MCP list each session. This table is the StudyQuest-specific map so the *right* one fires deterministically. Process skills win over implementation skills (decide HOW before WHAT). User instructions always override.

| When I'm about to… | Use |
| --- | --- |
| Start any non-trivial feature / behavior change | `superpowers:brainstorming` → then the brainstorm→spec→plan→subagent flow (see memory). Skip the visual-companion offer for backend-shaped work. |
| Write a multi-step plan | `superpowers:writing-plans`; dispatch independent work via `superpowers:subagent-driven-development` / `dispatching-parallel-agents` |
| Implement a feature or bugfix | `superpowers:test-driven-development` where tests exist; otherwise verify per `superpowers:verification-before-completion` before claiming done |
| Hit a real bug / unexpected behavior | `superpowers:systematic-debugging` (or the `diagnose` skill for hard/perf bugs) — reproduce before fixing |
| Look up Next 16 / React 19 / Supabase / shadcn / AI SDK API details | `context7` MCP (`resolve-library-id` → `query-docs`) or the matching `vercel:*` / `supabase:*` knowledge skill — **don't answer Next 16 from memory** |
| Touch Anthropic SDK / model ids / prompts / tokens | `claude-api` skill (read before editing the file) |
| Write/inspect a migration, RLS, or query | `supabase:supabase-postgres-best-practices` + `supabase` MCP to verify the live DB against the migration list |
| Build/polish RPG UI | `frontend-design` or `ui-ux-pro-max`; reuse `globals.css` utilities first (see Design tokens) |
| Verify a change actually works in the app | `verify` / `run` skill, or `playwright` MCP to drive a real browser |
| Finish a sprint / before merge | `code-review` (bundled review caught real bugs the in-flight reviews missed — run AFTER the sprint, not during), then `simplify` |
| Open a PR / manage issues | `github` MCP or `commit-commands:*` |
| Deploy / env vars / Vercel platform | `vercel:*` skills + `vercel` MCP |

If unsure whether a skill applies, invoke it — a wrong guess is cheap, a skipped skill is not.

---

## Project layout

```
src/
  app/                  # App Router routes (RSC by default)
    api/                # Route handlers
    dashboard/          # Authed app shell
    sign-in/, sign-up/  # Clerk
    globals.css         # Tailwind v4 theme + RPG utilities (read this!)
    layout.tsx, page.tsx
  components/
    ui/                 # shadcn primitives — do NOT put game UI here
    gamification/       # XPBar, LevelBadge, StreakCounter, etc.
    quiz/, exam/        # Question + result flows
    course/             # Course map, TopicNode, MasteryBadge
    dashboard/          # Authed dashboard surfaces
    landing/            # Public landing page
    effects/            # Particles, confetti, motion overlays
  lib/
    ai/                 # Anthropic + prompt logic
    pdf/                # PDF parsing
    supabase/           # Server/browser clients
    xp.ts               # XP curve + level math (single source of truth)
    utils.ts            # cn() and friends
  proxy.ts              # Next 16 request interception (not middleware.ts)
```

**Rules:**
- `components/ui/` is reserved for shadcn primitives. Game-flavored components (anything RPG-themed) go in a feature folder: `gamification/`, `quiz/`, `course/`, etc.
- Anything that touches XP, levels, or streaks goes through `lib/xp.ts`. Do not inline the math.
- Default to Server Components. Add `"use client"` only when you need state, refs, or browser APIs.

---

## Design tokens

The theme lives in `src/app/globals.css`. Use it — don't invent values.

**Semantic colors** (shadcn, oklch, light + dark in `:root` / `.dark`):
`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar*`, `chart-1..5`.

**RPG accent palette** (use these consistently for gameplay meaning):

| Color  | Hex prefix     | Meaning                                   |
| ------ | -------------- | ----------------------------------------- |
| Indigo | `#6366f1`      | Primary / quests / active topic           |
| Amber  | `#f59e0b`      | XP, level-ups, legendary tier             |
| Green  | `#22c55e`      | Correct answers, complete, mastered       |
| Purple | `#a855f7`      | Epic rewards, rare achievements           |
| Red    | `#ef4444`      | Destructive, wrong answer                 |
| Orange | `#f97316`      | Streak fire                               |

**Radius scale:** `--radius` = `0.625rem`, with `sm/md/lg/xl/2xl/3xl/4xl` derived. Prefer `rounded-xl` or `rounded-2xl` for cards.

**Fonts:** `--font-sans` (default + headings), `--font-mono` for code.

## Use the existing utility layer

Before writing custom CSS or new motion, check `globals.css` for an existing utility. Notable classes:

- **Cards:** `.rpg-card`, `.rpg-card-gold`, `.rpg-card-interactive`, `.glass-card`, `.tilt-card`, `.shimmer-border`, `.sparkle-hover`
- **Alive pass (Jun 2026):** `.card-alive` (status-tinted gradient fill driven by `--alive-rgb` "R G B" triplet; pairs with an aria-hidden `.hud-hero-texture` overlay span — used by CourseMap episode cards + the whole dashboard widget stack), `.widget-breathe` (3s glow/border pulse via `--w-rgb` — applied to ONE widget per page, the Next Best Action card; motion = meaning), `.boss-throne-bg` + `.boss-sigil-glow` (boss tile inner wash + skull halo via `--throne-rgb`/`--throne-a`), `.boss-arena-glow` (`--pending` red / `--defeated` amber blurred halo behind the boss tile)
- **Glow:** `.glow-indigo`, `.glow-amber`, `.glow-green`, `.glow-purple`, `.glow-red`, `.text-glow-*`, `.animate-glow-pulse`, `.animate-glow-breathe`
- **Gameplay feedback:** `.animate-bounce-in`, `.animate-shake` (wrong answer), `.animate-confetti-pop`, `.animate-score-burst`, `.quest-complete`, `.animate-fire-glow` (streak), `.animate-level-pulse`
- **Progress:** `.xp-shimmer` (smooth secondary bar — course cards, BossFight, landing mockups), `.pixel-xp-bar` + `.pixel-xp-bar-fill` (segmented hero bar — dashboard/profile/landing heroes), `.animate-xp-fill`, `.progress-bar-striped`, `.mastery-ring` (set `--progress: 0–100`)
- **Hero HUD** (canonical hero identity — used in dashboard, profile, and landing heroes):
  - `.hud-level-frame` (86×86 square pixel level box) with `.hud-level-label` ("LVL" micro-label) + `.hud-level-number` (Press Start 2P amber numeral)
  - `.rank-chip` (decorative `◆ TITLE ◆` pill in pixel font)
  - `.stat-label` (9px Press Start 2P uppercase label — for stat-tile labels and pixel-font micro-text)
  - `.hud-hero-texture` (subtle indigo dot-matrix overlay; absolutely positioned inside the hero card)
- **Identity (other):** `.game-badge` (hexagonal shield — kept for LevelUpOverlay, BossFightEngine, LandingProductMockups; **do not use in hero identity — use `.hud-level-frame` there**), `.tooltip-glow`, `.text-gradient-gold`, `.text-gradient-epic`, `.animate-gradient-text`
- **Profile sections:** `.achievement-ring-*` (animated progress ring), `.trophy-card` (earned achievement), `.chest-card` (locked achievement), `.tier-row` + `.topic-node` (mastered topic groups), `.quest-log-rail` + `.quest-row` + `.quest-stamp` + `.score-runic` (recent quests log)
- **Pixel chrome (nav + arcade moments):** `.font-pixel`, `.pixel-scanlines`, `.pixel-grid`, `.pixel-border`, `.pixel-chip`, `.pixel-ring`, `.pixel-xp-fill`, `.pixel-focus`, `.pixel-vignette`
- **Layout:** `.bg-grid`, `.node-connector`, `.node-connector-complete`, `.scrollbar-hide`

If you need something new, add it to `globals.css` under the right section header — don't scatter one-off animations across components.

---

## Motion rules

- **Durations:** micro `150ms`, standard `250–350ms`, celebration `400–800ms`. Never animate for more than 1s except for `quest-complete` / level-up flourishes.
- **Easing:** prefer the existing `cubic-bezier(0.4, 0, 0.2, 1)` for UI; `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring-y reward moments.
- **Framer Motion** for stateful component animation (mount/unmount, gestures); CSS keyframes in `globals.css` for ambient loops (glow, shimmer, float).
- **Always** respect `prefers-reduced-motion`. Wrap looping/large-motion utilities behind a `motion-safe:` variant.
- Correct answer → `animate-score-burst` + green glow + XP bar `animate-xp-fill` + optional `sonner` toast.
- Wrong answer → `animate-shake` + red glow, no harsh sounds, no scolding copy.
- Level-up → `animate-level-pulse` on the badge + amber confetti via `effects/`. This moment should feel *special*; budget extra polish here.

---

## Component conventions

Reusable game vocabulary (place in `components/gamification/` unless noted):

- `XPBar` — animated fill, shimmer, supports current/next thresholds from `lib/xp.ts`. Uses the smooth `.xp-shimmer` bar — for **secondary** progress (course cards, in-flow indicators). For hero/identity XP, use the segmented `.pixel-xp-bar` pattern instead (see Hero HUD utilities).
- `LevelBadge` — hexagonal `.game-badge`, amber for current level, gold gradient for milestones. **Scope:** overlays and combat surfaces (`LevelUpOverlay`, `BossFightEngine`, `LandingProductMockups`). For hero identity (dashboard / profile / landing hero card), use the `.hud-level-frame` pixel HUD instead.
- `StreakCounter` — fire glow when streak ≥ 3.
- `AchievementCard` — `.rpg-card-gold` for legendary, `.rpg-card-interactive` otherwise.
- `QuestButton` — primary CTA styling, optional `.animate-pulse-ring` for the recommended next action.
- `TopicNode` (`components/course/`) — supports `locked` / `available` / `in-progress` / `mastered` states; mastered uses `.node-connector-complete`.
- `CourseCard` — `.glass-card` with mastery ring.
- `QuizResultCard` (`components/quiz/`) — burst entrance, XP delta, rank/streak summary.
- `MasteryBadge` — uses `.mastery-ring` with `--progress`.

**Props:** prefer discriminated unions for state (`'locked' | 'available' | ...`) over many booleans.

---

## UI rules

- Every main page has a clear visual hierarchy and one obvious next action.
- Progress (XP, streak, mastery) should always be visible on authed surfaces.
- Important actions look like quest actions — labeled like "Start Quest", "Begin Trial", not generic "Submit".
- Empty states guide the user with a quest suggestion, never a dead end.
- Loading states use shimmer / skeletons styled with the RPG palette, not plain grey blocks.
- Quiz feedback is rewarding: motion + color + XP delta on every answer.
- Mobile-first. Layouts must stay clean and tap-targets ≥ 44px on small screens.

## Accessibility floor

- WCAG AA contrast on all text, including text-on-glow. Test the dark theme — many glows fail AA over dark backgrounds.
- Visible focus rings (`--ring`) — never remove them for "cleanliness".
- All gameplay state changes have a non-color cue (icon, copy, motion).
- Decorative motion sits behind `motion-safe:`; meaningful motion (score-burst, level-pulse) can run unconditionally but must not be the *only* signal.
- Use Radix primitives via shadcn for any interactive overlay (dialog, dropdown, toast) — don't roll your own.

---

## Avoid

- Plain corporate dashboards.
- Random colors outside the palette above.
- Childish cartoon styling (mascots, comic fonts, primary-school stickers).
- Walls of grey — if a screen feels grey, add semantic color or a glow utility.
- Overloaded screens (more than ~2 "hero" elements per view).
- Tiny unreadable text (`text-xs` is the floor, and only for metadata).
- Inconsistent spacing — stick to Tailwind's 4 / 6 / 8 / 12 rhythm.
- Components that look unrelated to each other — reuse the existing card/glow/badge utilities.
- New one-off CSS animations in component files when an equivalent already exists in `globals.css`.

---

## Design goal

Whenever improving the frontend, make the app feel like the user is **leveling up through an academic RPG journey** — clean, motivating, and a little bit magical, without ever crossing into childish or cluttered.

---

## Current state

The MVP plus the full feature set is shipped; the app is in active polish + new-feature mode. **Dated, feature-by-feature history lives in `CHANGELOG-agent.md`** — read it for the forensic detail behind any feature. The sections below are the durable facts (wired-up surfaces, migrations, gotchas, security, key files, queue) — read them before touching anything.

### What's wired up

- **Core loop:** PDF upload → AI course extraction → episodes/topics → quiz (MCQ + open) → AI grading → XP/level/mastery → Course Map → recommendations.
- **Boss fights:** end-of-episode comprehensive quiz; victory screen with rematch + return links.
- **Exam Prep mode:** upload past exam PDFs → AI extracts real questions (MCQ + open) → Timed *and* Untimed practice → results deferred to the end (real-exam feel) → AI debrief with predicted score + critical gaps.
- **Spaced repetition (SM-2):** `lib/spaced-repetition.ts` drives a Review mini-mode. `user_topic_mastery` carries `ease_factor`, `interval_days`, `repetitions`, `next_review_at`, `last_quality`. Review session = up to 5 topics × 2 questions, awards `REVIEW_XP_PER_CORRECT` (6) per correct + `REVIEW_SESSION_BONUS_XP` (25) on completion.
- **Runes (Anki-style flashcards, Jun 2026, migration 026):** AI-forged atomic recall cards (front/back) per topic — a separate layer from Review (purple identity; Review stays cyan). Per-CARD SM-2 via `rune_card_srs`, reusing `computeNextReviewFromQuality` unmodified (Again=1/Hard=3/Good=4/Easy=5); **never touches `user_topic_mastery`**. Forge = cheat-sheet pattern (`RuneDeckPanel` on the topic page, GET/POST `/api/topics/[id]/runes`); Reforge replaces ONLY `source='forged' AND edited_at IS NULL` (manual + edited cards survive); Banish = `suspended_at`. Drill = `/dashboard/runes` (scopes: due | topic | course), Again-requeue until passed (re-rating UPDATEs the rep, `was_due` frozen at first rate). Batch caps: due queue `RUNE_SESSION_CAP`=30, cram `RUNE_CRAM_BATCH`=50. Cram continuation ("Drill the rest" sweeps a whole course): `/start` takes `excludeIds` + returns `totalInScope`; the launcher banks each batch's ids in a seen-set and computes `cramRemaining = total − seen − batch` (threaded launcher→engine→summary). XP is farm-proof: +2 per DUE rep rated ≥Hard (`RUNE_XP_PER_DUE_CARD`), 0 for non-due cram reps, +15 once-daily queue-clear bonus; due-scope completion updates the streak. Surfaces: `RunesDueCard` widget, NBA `runes-due` (A-tier, gem), exam-page Rune Cram, course-page "Drill All Runes" entry. Achievements: `runesmith`, `rune_adept`. SRS seed is FATAL on forge/add (rolled back) so due counts can't contradict across surfaces. **Migration 026 must be applied to the live DB before any rune surface works (forge 500s until then; other surfaces degrade gracefully to "no runes").**
- **Slot-machine achievements:** `lucky_scholar`, `perfect_day`, `combo_breaker`, `review_master`, `consistent_scholar`. Checked server-side after sessions; returned in the API response so client overlays can fire.
- **Dopamine Tier 1:** `XPBurst` provider + `useXPBurst()` hook for floating +XP labels, `StreakWarningBanner` (client-side dismissable via localStorage), tiered XP visuals.
- **Sound system:** `lib/sound.ts` (Web Audio synth, no asset files), `lib/useSound.ts` hook, `SoundToggle` in `DashboardNav`. `localStorage` key `sq:sound-muted`, **DEFAULT_MUTED = true**. 11 effects: `playCorrect`, `playWrong`, `playXp(tier)`, `playCombo(count)`, `playCritical`, `playLevelUp`, `playAchievement`, `playBossHit`, `playBossMiss`, `playBossDefeat`, `playReviewComplete`. Wired into `QuizEngine`, `BossFightEngine`, `ReviewEngine`, `SessionDebrief`, `ReviewSummary`, `LevelUpOverlay`, `AchievementUnlockOverlay`.
- **Particle background:** dashboard, profile, landing all share the same particle layer.
- **Landing page:** "Large" tier — ambient hero, **Cinematic Scroll Quest** (Jun 2026: two scroll-scrubbed sticky chapter stages in `LandingScrollQuest.tsx` — Ch 01 FORGE: PDF disintegrates into shards + course map draws itself; Ch 03 FINAL TRIAL: boss HP drains per scroll-landed hit → VICTORY slam; the interactive quiz demo between them is labeled Ch 02 THE TRIAL and **assembles itself from the same pixel shards** as it scrolls into view; replaced the old `LandingStory` crossfade scrollytelling), product mockups, comparison, particle-burst CTA. Hero: HUD card has cursor-reactive 3D tilt + glare (pointer-fine only), and the fold has a scroll-exit handoff (content drifts up/dims into Ch 01; cue reads CHAPTER 01 AWAITS). Press_Start_2P font drives arcade headlines.
- **Mode-gated exam UX:** *Both* Timed and Untimed defer all per-question feedback. MCQ options only show `default | selected` state — no correct/wrong tint mid-exam. Combos tracked silently via `maxComboRef`, XP awarded at completion. Navigator shows `answered` instead of `correct/wrong`. Neutral cue: *"Answer locked in. Full results at the end of the exam."*
- **Exam navigator:** auto-scrolls to current dot via `scrollIntoView`, has chevron `ChevronLeft`/`ChevronRight` buttons (`scrollNavBy`), and a `Leave Exam` button (`DoorOpen` icon) with confirm.

### Migrations applied (Supabase Dashboard — keep this in sync)

```
001 — initial schema (users, courses, episodes, topics, questions, sessions, achievements)
002 — course_files, exam_questions, exam_sessions, exam_answers
003 — mastery + streak fields
004 — RPC increment_user_xp
005 — exam MCQ support (type, options, correct_answer on exam_questions)
006 — slot-machine achievements (lucky_scholar, perfect_day, combo_breaker)
007 — spaced repetition (SR columns + review_sessions + review_answers + review_master + consistent_scholar)
008 — daily_scrolls (Scroll of Wisdom: per-day insight rows)
009 — grimoire (review_sessions.source + review_sessions.pinned_question_ids)
010 — feynman_sessions (multi-turn teach-back chat + "the_professor" achievement)
011 — new feature achievements (grimoire/feynman-adjacent badges)
012 — courses.output_language (per-course AI output language override)
013 — courses.exam_date + courses.exam_label (countdown + study plan inputs)
014 — episodes.status + course_files.episode_id (per-episode upload pipeline)
015 — image_url on quiz_answers / exam_answers / review_answers / boss_fight_answers
016 — six tier-2 achievement extensions (sage, iron_legend, iron_discipline, centenarian, apex_predator, twilight_reader)
017 — users.onboarding_completed_at (first-run Welcome Modal gate, per-user not per-browser)
018 — episodes.error_message (user-facing reason for failed extractions, drives FailedEpisodesBanner)
019 — questions.replaced_by_id + questions.replaced_at (soft-replace for question regeneration, partial index on replaced_at IS NULL)
020 — quiz_answers.confidence + answer_clarifications (Phase 1 pilot — Quiz only; clarifier table is polymorphic for Phase 2)
021 — users.streak_freeze_tokens (forgiveness mechanic: earn 1 per 7-day streak, cap 3, burn lazily on next study after a gap)
022 — topics.cheat_sheet + topics.cheat_sheet_generated_at (AI-generated 1-page summary per topic, cached until regenerated)
023 — review_answers.confidence (Phase 2 — Review; mirrors quiz_answers.confidence CHECK; feeds per-topic confidence-weighted SM-2 per ADR-0001)
024 — answer_clarifications UNIQUE(answer_kind, answer_id) (clarifier upsert dedupe)
025 — users.featured_achievement_id (Featured Trophy: pinned to the profile crest; nullable FK → achievements ON DELETE SET NULL; resolves to most-recently-earned when unset)
026 — runes (rune_cards + rune_card_srs per-card SM-2 + rune_sessions + rune_reps; runesmith/rune_adept achievements)
```

The migration files live in `supabase/migrations/`. Always update this list when you add a migration so the next session can verify the live DB matches.

### Gotchas (don't break)

- **Router refresh timing:** never call `router.refresh()` right after `/complete` returns — server pages will see `completed_at` and redirect/404 before the celebration plays. Refresh on the **navigation button onClick** (Back to Course, Return to Realm, etc.). Applied in `SessionDebrief`, `ExamDebrief`, `ReviewSummary`, `BossFightEngine` victory screen.
- **ComboHUD positioning:** `position: fixed` children inside transformed AnimatePresence wrappers get a new containing block. Render `ComboHUD` at the engine's **top level** outside any motion wrapper.
- **MarkdownContent + RTL:** code blocks are force-LTR; prose follows the parent `dir`. Use `MarkdownContent` for any AI-generated text (questions, feedback, debriefs).
- **Exam grading fast-path:** MCQ answers grade via exact match in `api/exams/[id]/answer/route.ts` — no Claude call.
- **Exam extraction:** `lib/ai/extract-exam-questions.ts` streams via `client.messages.stream() + finalMessage()`, `max_tokens: 32768`, 4-stage defensive JSON parser (direct → strip fences → bracket-slice → repair). Hebrew open-question markers (`הסבר`, `תאר`, `הוכח`, `מדוע`, `כיצד`) force `type: "open"`. Yes/no + explain → OPEN. "When in doubt, prefer OPEN."
- **Exam process route:** `api/exams/process` has `maxDuration: 300`, early NO_TEXT_LAYER detection (text < 800 chars OR < 50 meaningful words), ZERO_QUESTIONS detection, rolls back `course_files` row on failure.
- **`dark` class on `<html>`:** required so shadcn `outline` variant (`bg-background`) resolves to dark. Already in `src/app/layout.tsx`. Don't remove.
- **Arcade headlines:** `Press_Start_2P` font is loaded in root layout — use sparingly for arcade-flavored moments (level-up overlay, boss titles, landing hero accent), never for body copy.
- **Date formatting hydration:** use `"en-US"` explicitly in `toLocaleDateString()` — Node defaults to en-GB, browsers default to en-US, mismatch crashes hydration. Applied in `ExamDateButton` and `ExamCountdownCard`.
- **DOMMatrix is not defined on server:** react-pdf's pdf.js touches DOMMatrix at module-load. PDF viewer is wrapped in `TopicPDFViewerClient.tsx` which uses `dynamic(() => import("./TopicPDFViewer"), { ssr: false })`.
- **framer-motion scroll-scrub subscriptions die silently in dev.** `useScroll({ target }) → useTransform → <motion.div style>` inline-style writes can stop mid-session under React 19 + Turbopack (elements freeze at stale, even internally inconsistent values; zero console errors). Scroll-scrubbed scenes MUST use the CSS-var pattern instead: one scroll listener writes `--p` (0→1) on the sticky stage, every visual is pure CSS `calc()/clamp()` of `var(--p)` (ramps, windows = products of ramps, staircases = sums). See `LandingScrollQuest.tsx`. Bonus gotchas from the same session: `Math.cos/sin` differ in the last ULP between Node SSR and Chromium (round module-scope offsets or hydration fails on inline transform strings), and a framer `y` motion value stomps Tailwind `-translate-y-*` classes on the same element.
- **`rgba(var(--x), a)` is INVALID CSS and fails silently.** Channel-triplet custom properties (`--x: 245 158 11`) MUST use the modern slash syntax: `rgb(var(--x) / 0.5)`. The mixed comma form is invalid **at computed-value time** — the whole declaration computes to none/transparent with no console error and no DevTools strikethrough, so the page can *look* plausible while the rule silently isn't applying (this shipped a "gradient" that was actually transparency, 2026-06-10). When adding var-driven colors, verify with `getComputedStyle(el).backgroundImage` in the browser, not by eyeballing a screenshot.

## Sprint history → `CHANGELOG-agent.md`

The detailed dated changelog — every feature shipped Feb–Jun 2026, per-commit lineages, the
code-review / `/code-review ultra` clusters, and the 2026-06-01 confidence-weighted SM-2 +
lucky-guess clarifier writeups — now lives in `CHANGELOG-agent.md` to keep this file lean.
Read it when you need the forensic detail behind a feature. The durable rules, current-state
summary, migrations list, and key-files index stay here.

### AI infrastructure upgrades

- **Tool use for question generation** — `extract-episode.ts`, `extract-exam-questions.ts`, and topic-question generation all now use Anthropic tool use (`tool_choice: { type: "tool", name: "save_..." }`). This eliminated an entire class of "slightly malformed JSON" parsing failures because Anthropic validates against the tool schema before returning.
- **Streaming for long extractions** — `client.messages.stream() + finalMessage()` with `max_tokens: 32768`. The non-streaming `max_tokens: 8192` was truncating Hebrew+LaTeX outputs and returning empty tool input `{}`. Always log `stop_reason` and `output_tokens` when debugging tool-use truncation.
- **Native PDF reading** — both course/episode extraction and exam-question extraction now feed PDFs to Claude as native document content blocks instead of unpdf-extracted text. Preserves math notation, diagrams, and set-builder syntax that text extraction garbled.
- **6-stage defensive JSON parser** — `direct → strip fences → bracket-slice → smart quotes → escape control chars → repair missing commas`. Tool use is the preferred path now, but the parser is still used as a fallback in legacy non-tool-use call sites.

---

## Security posture (read this before touching auth/env)

- **Sign-ups are restricted** — the user manually allows friend emails in Clerk. Don't enable open sign-up without asking.
- **Anthropic spending cap is set** — the user has a budget cap on their API key. Don't add expensive new prompts (large `max_tokens` on user-triggered routes) without flagging the cost impact.
- **Keys have been rotated** mid-conversation in the past. Treat any key value that ever appeared in chat as compromised. Never echo, paste, or include `.env.local` values in code, commits, or responses.
- **`.env.local` must stay gitignored.** When you change env-var requirements, tell the user to update BOTH Vercel project env vars AND their local `.env.local`.
- **Ownership checks everywhere**: every delete/mutate API route must filter by `user_id = dbUser.id` (resolved from `clerk_id`). The combined-WHERE pattern (`.eq("id", x).eq("user_id", dbUser.id)`) means a cross-tenant attempt returns 0 rows, not a leak.

### Key files to know

- `src/components/exam/ExamEngine.tsx` — large; mode-gated feedback, navigator, leave-confirm, silent combo tracking.
- `src/components/quiz/QuizEngine.tsx` + `BossFightEngine.tsx` + `src/components/review/ReviewEngine.tsx` — sound + router.refresh discipline + image-answer attach lives here.
- `src/components/quiz/SessionDebrief.tsx` — end-of-quiz mount sound + nav-button refresh + Feynman "Teach It Back" CTA when score < 60%.
- `src/components/quiz/AnswerImagePicker.tsx` — shared image picker for diagram answers; RTL-aware.
- `src/components/course/CourseMap.tsx` — episode collapse + topic nodes + boss-fight node + per-episode delete button. Header is split (left collapse / right delete+chevron) due to nested-button HTML rules.
- `src/components/course/DeleteCourseDialog.tsx`, `src/components/course/DeleteEpisodeButton.tsx` — destructive flows. Uses `@base-ui/react/dialog` via the shadcn `dialog.tsx` wrapper (`render={<Element/>}`, NOT Radix `asChild`).
- `src/components/course/EpisodeUploadForm.tsx`, `EpisodeProcessingPoller.tsx`, `EmptyCourseForm.tsx`, `ExamDateButton.tsx` — per-episode pipeline + countdown UI. The poller now diffs episode statuses across refreshes and fires transition toasts (processing → ready/error).
- `src/components/course/ProcessingEpisodesBanner.tsx` — amber pixel banner above CourseMap with live elapsed-time per in-flight episode. Filtered out of CourseMap to avoid the empty-card visual.
- `src/components/course/FailedEpisodesBanner.tsx` — red pixel banner above CourseMap. Reads `episodes.error_message` (written by the classifier in the catch handler) and gives the user one actionable sentence per failed episode + a delete button.
- `src/components/course/EpisodeBreadcrumb.tsx` — sticky chapter chip pinned under the dashboard nav while you scroll inside an episode. Rendered with `position: fixed` (NOT sticky in flow — would wobble).
- `src/components/course/CourseStudyReport.tsx` — server component, per-course weekly study report widget. Parallel queries against quiz/boss/review/mastery, scoped to this course.
- `src/components/course/TopicMasteryPanel.tsx` — server component on the topic detail page. Stat tiles + inline-SVG sparkline + native `<details>` stumbles heatmap + 10-row Quest Log. No charting library.
- `src/components/dashboard/WelcomeModal.tsx` — client component, first-run 3-slide pixel-arcade carousel. Gated by `users.onboarding_completed_at` (server flag, NOT localStorage). Keyboard nav + reduced-motion guard + non-fatal close.
- `src/components/dashboard/EmptyDashboardHero.tsx` — server component shown when `courses.length === 0`. Replaces the regular widget stack entirely; one indigo hero + 3-up step grid + amber upload CTA.
- `src/components/scroll/ScrollOfWisdom.tsx`, `src/components/feynman/FeynmanSession.tsx`, `src/components/dashboard/GrimoireWidget.tsx` + `ExamCountdownCard.tsx` — May-2026 content layers.
- `src/lib/ai/extract-episode.ts`, `extract-exam-questions.ts`, `grade-answer.ts`, `grade-exam-answer.ts`, `generate-scroll.ts`, `session-debrief.ts`, `feynman-tutor.ts` — all Claude code paths. Tool use + streaming + vision blocks.
- `src/lib/ai/coach-persona.ts` — single source of truth for the Loremaster voice. Layered as `system:` on grader/scroll/debrief calls. Feynman + extract/generate are exempt.
- `src/lib/achievement-categories.ts` — slug → category map + `groupByCategory()` helper. Drives the profile page's collapsible locked-achievement sections.
- `src/lib/episode-error.ts` — `classifyEpisodeError()` translates raw 413/429/timeout/etc errors into actionable user copy. Called by the catch handler in the episode upload route to populate `episodes.error_message`.
- `src/lib/ai-error.ts` — `classifyAiError()` for the user-facing grading + scroll + debrief paths. Returns `{ code, userMessage, retryable }`. `readClassifiedErrorFromResponse(res)` helper for client engines. Used by all 4 answer routes and all 4 engines.
- `src/lib/answer-draft.ts` — localStorage helpers for in-flight open-answer text. Survives Claude rate-limit / network drop / page refresh. SSR-safe, auto-prunes > 30 days.
- `src/lib/ai/regenerate-question.ts` — single-question Claude tool-use generator for the "🔄 Regenerate" button. Streams via `client.messages.stream() + finalMessage()` with `max_tokens: 8192` (smaller than full extractor but Hebrew + LaTeX still needs the headroom).
- `src/lib/next-best-action.ts` — pure decision function over the dashboard's already-fetched aggregators. Returns prioritized list, NBA widget renders index 0 with cycle through the rest.
- `src/lib/level-tier.ts` — tier visuals + nav chip palette. Single source of truth for the 6-tier vocabulary (Novice/Apprentice/Adept/Expert/Master/Sage) + within-tier drift math + `isTierUp()` for rank-up celebrations.
- `src/components/quiz/RegenerateQuestionButton.tsx` + `src/components/course/StumbleRegenerateButton.tsx` — shared regen button (inline / label variants) + the server-component wrapper that `router.refresh()`es on success.
- `src/components/dashboard/NextBestActionCard.tsx` — Smart Next Best Action widget. Client component for cycle state.
- `src/components/landing/LandingScrollQuest.tsx` — Cinematic Scroll Quest chapters (Ch 01 FORGE + Ch 03 FINAL TRIAL). CSS-var scroll-scrub architecture (`--p` + calc/clamp — see gotcha); static fallbacks for mobile + reduced motion. `LandingQuizDemo` carries the Ch 02 label + shard-assembly entrance.
- `src/components/landing/scrub.ts` — shared scrub plumbing for ALL landing scroll effects: `r`/`win` calc-string builders, `useStageScrub` (sticky chapters), `useScrubOn` (in-flow sections, takes a module-level compute fn), `useReducedMotionPref`, `makeShards` (deterministic shard grid; one `--d` var drives disintegration AND assembly). New landing scroll work goes through this module, never framer useScroll.
- `src/components/gamification/TierLevelFrame.tsx` — tier-aware HUD level frame. Drop-in for `.hud-level-frame` everywhere (DashboardHeroCard, ProfileHeroCard, LandingHeroVisual, LevelUpOverlay).
- `src/components/dashboard/TierPreviewGrid.tsx` — dev-only grid at `/dashboard?tierPreview=1`. Renders all 6 tiers + drift math.
- `src/lib/answer-image.ts` — image upload helper + Claude vision block builder.
- `src/app/api/users/complete-onboarding/route.ts` — POST stamps `users.onboarding_completed_at`. Idempotent, auth-guarded; called by WelcomeModal on dismiss.
- `src/lib/study-plan.ts` — pure functions for the exam countdown / daily plan.
- `src/lib/spaced-repetition.ts` — SM-2 constants and `computeNextReview`.
- `src/lib/sound.ts` + `src/lib/useSound.ts` — sound engine + React glue.
- `src/components/effects/ComboHUD.tsx`, `LevelUpOverlay.tsx`, `AchievementUnlockOverlay.tsx`, `XPBurst.tsx` — celebration layer.
- `src/components/dashboard/StreakWarningBanner.tsx`, `SoundToggle.tsx` — Tier-1 dopamine bits.
- `src/app/dashboard/courses/[id]/exam/page.tsx` — exam prep landing per course; "Untimed Practice" + "Timed Exam" buttons.
- `src/app/dashboard/courses/[id]/page.tsx` — course detail; mounts ExamDateButton + EpisodeUploadForm + EpisodeProcessingPoller + CourseMap + DeleteCourseDialog (danger zone).
- `src/lib/ai/clarify-answer.ts` — multi-turn Claude wrapper for the "Why was I wrong?" clarifier. Loremaster persona, confidence-aware system prompt branch, `max_tokens: 1024`.
- `src/lib/ai/generate-cheat-sheet.ts` — per-topic Markdown+LaTeX cheat sheet generator. Strict Hebrew+math rules in the prompt (no inline `$...$` in Hebrew lines, all math on its own `$$display$$` line, Unicode for inline symbols, Latin acronyms stand alone).
- `src/lib/adaptive-difficulty.ts` — pure helper biasing the question generator's `difficulty` anchor by `user_topic_mastery.mastery_level`. Used in both regen routes.
- `src/lib/streak.ts` — pure helper `computeStreakUpdate` with freeze-token forgiveness. All-or-nothing burn. `MAX_FREEZE_TOKENS = 3`, `STREAK_MILESTONE_DAYS = 7`.
- `src/lib/freeze-toast.ts` — shared `showFreezeToasts(data)` for the 3 engines' completion handlers.
- `src/lib/upload-validation.ts` — client-side PDF size tiering (`UPLOAD_WARN_MB = 20`, `UPLOAD_BLOCK_MB = 32`). Pre-formats user-facing messages naming the file.
- `src/components/quiz/ConfidenceRow.tsx` + `src/components/quiz/ClarifierThread.tsx` — shared confidence + clarifier UI for the Quiz pilot; live in `quiz/` for Phase 2 reuse by Review / Boss / Exam.
- `src/components/dashboard/TodayStatsStrip.tsx` — server component, today's questions/accuracy/minutes/XP under the hero. Renders null when no activity today.
- `src/components/course/CheatSheetPanel.tsx` — client component for the per-topic cheat sheet. Cold-state generate button + cached viewer with Reforge / Print.
- `src/app/api/clarify/route.ts` — polymorphic clarifier endpoint (pilot only handles `answerKind: "quiz"`). Server-side 6000-token guard applied on BOTH OPEN/resume and CONTINUE branches; `.order().limit(1)` defensive read pattern for React 19 StrictMode dev duplicates; CONTINUE UPDATE error check.
- `src/app/api/topics/[topicId]/cheat-sheet/route.ts` — GET (cached) + POST (generate fresh) cheat sheet routes. Ownership chain via topic → episode → course → user.
- `src/lib/course-subject-icon.ts` — pure helper resolving a course's subject icon slug from `(title, themeName)`. First-match-wins keyword scan, fallback `"Sword"`. Dashboard maps the slug → Lucide component so the helper stays React-free.
- `src/lib/runes-queue.ts` — single source of truth for the per-card "due" definition (`getDueRuneCards`, `countDueRunes` w/ optional topicIds, `loadRuneDeck`, `getCourseTopicIds`, `embedOne`). `src/lib/rune-deck.ts` — client-safe DTO + `isCardDue` + `formatIntervalDays` + char caps. `src/lib/ownership.ts` — shared clerk→dbUser + topic/card ownership-chain checks for the rune routes.
- `src/lib/ai/generate-runes.ts` — tool-use deck generator (8–12 atomic cards, `save_rune_deck`, streams, max_tokens 8192, cheat-sheet Hebrew/LaTeX bidi rules verbatim).
- `src/components/runes/` — `RuneDeckPanel` (forge/browse/manage, topic page), `RuneEditorDialog` (edit/add, conditionally rendered — state seeds on mount), `RuneDrillLauncher`/`RuneDrillEngine` (Again-requeue queue, busyRef + e.repeat guard against double-rate, settle-retry panel, 410 cardGone skip, keyboard Space/1-4), `RuneCardFlip` (CSS 3D flip — no fixed children inside the transform), `RuneSummary` (refresh-on-nav rule). `src/components/dashboard/RunesDueCard.tsx` — purple ReviewQueueCard sibling.
- `src/app/api/runes/*` — start (due/topic/course, cap 30 overdue-first), [sessionId]/rate (per-rep persistence, epoch-millis dueness, FK-gone→410), [sessionId]/complete (due-only XP + queue-clear + streak), cards (manual add), cards/[cardId] (edit/banish). Forge route inserts new cards BEFORE deleting old ones (lossless reforge).

### Active work + open queue

The user is actively studying their real Automata / Computational Models course on this app (primary use case, not a demo). Stated focus: "functionality first — intuitive, fun, smart, without bugs or security problems." Dated sprint history → `CHANGELOG-agent.md`.

**Open queue (bigger lifts):**
- **Phase 2 of confidence + clarifier** — expand to Review / Boss / Exam. SM-2 quality changes + lucky-guess clarifier shipped on the Quiz path; Review still needs (1) a `confidence` column + UI, (2) the same SM-2 modulation in its `/complete`, (3) the polymorphic clarifier endpoint to lift its `answerKind !== "quiz"` gate. (Migration 024 already added `UNIQUE(answer_kind, answer_id)` for the upsert.)
- **Question 👎 feedback button** — orthogonal to Regenerate (Regenerate = action; thumb-down = label). New `answer_feedback` table.
- **Profile page Tier-B+ adoption** — page predates the Tier-B+ vocabulary. ~8 tasks.
- **Daily review push/email** — habit loop. Needs email infra + cron job.
- **Edit/reorder episodes** — `/api/episodes/[id]` only supports DELETE; no `PATCH` for title, no reorder endpoint, no UI affordance.
- **Mobile responsive audit** — walk through key surfaces on small screens.
- **Alive pass for the lower dashboard rows** — Quest Board / Your Realm / Achievements didn't get the 2026-06-11 `.card-alive` depth treatment (deliberately scoped to the widget stack above them). Extend if the contrast between bands reads inconsistent.
- **Orphan PDFs in storage** — course/episode delete cascades DB rows but leaves files in the `course-files` Storage bucket. Harmless quota leak; eventually worth a sweeper.
- **Boss-fight per-episode illustration** — deferred (cost). POC done; path if revisited: migration `episodes.boss_image_url`, server route calling Gemini SDK directly (not MCP), Storage `boss-images/` prefix, skull fallback when null.

Deliberately deferred: voice/TTS, cross-course topic linking, friend leaderboard (Max is solo-studying).

**Durable workflow rules (don't backslide):**
- Confirm scope before refactoring large files (`ExamEngine.tsx`, `CourseMap.tsx`, `BossFightEngine.tsx`, `ReviewEngine.tsx`). Tight, focused commits over megacommits.
- **Feature branch + rollback tag is the standard for any multi-file design pass:** branch → push → fast-forward merge to main → delete branch.
- **Run `/code-review` after a feature sprint, not during** — the bundled review catches real bugs the in-flight happy-path reviews miss.
