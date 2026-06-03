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

## Current State (Checkpoint — 2026-06-01)

The MVP plus the full feature set is shipped: three content layers (Scroll / Grimoire / Feynman), the exam-prep loop, image-answer pipeline, per-episode upload, full course/episode delete, Course Map redesign, weekly Study Report, per-topic Mastery Panel, Loremaster coach voice, grouped achievements, first-run onboarding, episode-processing + failure UX (classified errors + answer-draft persistence), question regeneration (soft-replace), Smart Next Best Action widget, paired urgency row, 6-tier level progression (Novice→Sage), streak freeze tokens, Today's stats strip, per-topic cheat sheets, universal RTL table fix, subject-icon sigils, and the 2026-06-01 confidence layer (Quiz "Why was I wrong?" clarifier, confidence-weighted SM-2, lucky-guess clarifier). Multiple code-review / `/code-review ultra` correctness sweeps have landed on top. The app is in active polish + new-feature mode. **For the dated detail behind any of these, see `CHANGELOG-agent.md`.** Read the rest of this section (wired-up surfaces, migrations, conventions, TODOs) before touching anything.

### What's wired up

- **Core loop:** PDF upload → AI course extraction → episodes/topics → quiz (MCQ + open) → AI grading → XP/level/mastery → Course Map → recommendations.
- **Boss fights:** end-of-episode comprehensive quiz; victory screen with rematch + return links.
- **Exam Prep mode:** upload past exam PDFs → AI extracts real questions (MCQ + open) → Timed *and* Untimed practice → results deferred to the end (real-exam feel) → AI debrief with predicted score + critical gaps.
- **Spaced repetition (SM-2):** `lib/spaced-repetition.ts` drives a Review mini-mode. `user_topic_mastery` carries `ease_factor`, `interval_days`, `repetitions`, `next_review_at`, `last_quality`. Review session = up to 5 topics × 2 questions, awards `REVIEW_XP_PER_CORRECT` (6) per correct + `REVIEW_SESSION_BONUS_XP` (25) on completion.
- **Slot-machine achievements:** `lucky_scholar`, `perfect_day`, `combo_breaker`, `review_master`, `consistent_scholar`. Checked server-side after sessions; returned in the API response so client overlays can fire.
- **Dopamine Tier 1:** `XPBurst` provider + `useXPBurst()` hook for floating +XP labels, `StreakWarningBanner` (client-side dismissable via localStorage), tiered XP visuals.
- **Sound system:** `lib/sound.ts` (Web Audio synth, no asset files), `lib/useSound.ts` hook, `SoundToggle` in `DashboardNav`. `localStorage` key `sq:sound-muted`, **DEFAULT_MUTED = true**. 11 effects: `playCorrect`, `playWrong`, `playXp(tier)`, `playCombo(count)`, `playCritical`, `playLevelUp`, `playAchievement`, `playBossHit`, `playBossMiss`, `playBossDefeat`, `playReviewComplete`. Wired into `QuizEngine`, `BossFightEngine`, `ReviewEngine`, `SessionDebrief`, `ReviewSummary`, `LevelUpOverlay`, `AchievementUnlockOverlay`.
- **Particle background:** dashboard, profile, landing all share the same particle layer.
- **Landing page:** "Large" tier — ambient hero, live quiz demo, product mockups, scroll story, comparison, particle-burst CTA. Hero card sized up to match the 6xl headline. Press_Start_2P font drives arcade headlines.
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
```

The migration files live in `supabase/migrations/`. Always update this list when you add a migration so the next session can verify the live DB matches.

### Conventions established this round (don't break)

- **Router refresh timing:** never call `router.refresh()` right after `/complete` returns — server pages will see `completed_at` and redirect/404 before the celebration plays. Refresh on the **navigation button onClick** (Back to Course, Return to Realm, etc.). Applied in `SessionDebrief`, `ExamDebrief`, `ReviewSummary`, `BossFightEngine` victory screen.
- **ComboHUD positioning:** `position: fixed` children inside transformed AnimatePresence wrappers get a new containing block. Render `ComboHUD` at the engine's **top level** outside any motion wrapper.
- **MarkdownContent + RTL:** code blocks are force-LTR; prose follows the parent `dir`. Use `MarkdownContent` for any AI-generated text (questions, feedback, debriefs).
- **Exam grading fast-path:** MCQ answers grade via exact match in `api/exams/[id]/answer/route.ts` — no Claude call.
- **Exam extraction:** `lib/ai/extract-exam-questions.ts` streams via `client.messages.stream() + finalMessage()`, `max_tokens: 32768`, 4-stage defensive JSON parser (direct → strip fences → bracket-slice → repair). Hebrew open-question markers (`הסבר`, `תאר`, `הוכח`, `מדוע`, `כיצד`) force `type: "open"`. Yes/no + explain → OPEN. "When in doubt, prefer OPEN."
- **Exam process route:** `api/exams/process` has `maxDuration: 300`, early NO_TEXT_LAYER detection (text < 800 chars OR < 50 meaningful words), ZERO_QUESTIONS detection, rolls back `course_files` row on failure.
- **`dark` class on `<html>`:** required so shadcn `outline` variant (`bg-background`) resolves to dark. Already in `src/app/layout.tsx`. Don't remove.
- **Arcade headlines:** `Press_Start_2P` font is loaded in root layout — use sparingly for arcade-flavored moments (level-up overlay, boss titles, landing hero accent), never for body copy.

### Known TODOs / open threads

Audited 2026-05-23 against actual code — kept only items that are *genuinely* still open. Verify before re-adding anything you think is a bug.

- **Orphan PDFs in storage:** when a course/episode is deleted, FK CASCADE removes DB rows but the actual files in the `course-files` Supabase Storage bucket are NOT removed. The `DELETE /api/courses/[id]` docstring explicitly admits this. Harmless (few MB of quota) but eventually worth a sweeper. *Still open.*
- **Edit episode title / reorder episodes:** `/api/episodes/[id]` only supports DELETE. No `PATCH` for title, no reorder endpoint. UI also has no affordance. Lowest-priority of the queue items.
- **Boss-fight ambient illustration (per-episode):** discussed 2026-05-23 with proof-of-concept generated via Nano Banana 2 MCP (Church-Turing Thesis boss image at `generated_imgs/`). User liked the result but deferred building the production pipeline. Path forward if revisited: migration `episodes.boss_image_url`, server route calling Gemini SDK directly (not MCP — MCP is dev-only), Supabase Storage `boss-images/` prefix, auto-trigger after episode processing, skull fallback when null.
- **User strategic queue (not yet picked):** onboarding flow polish, daily quests generator, smart dashboard widget. Profile page also pre-dates the Tier B+ vocabulary and could use a pass.

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

### UI / hydration / RSC discipline (don't backslide)

- **`router.refresh()` timing**: never call it right after `/complete` returns — server pages will see `completed_at` and redirect before the celebration plays. Refresh on the navigation button onClick instead. Applied across `SessionDebrief`, `ExamDebrief`, `ReviewSummary`, `BossFightEngine` victory screen.
- **Date formatting hydration**: use `"en-US"` explicitly in `toLocaleDateString()` — Node defaults to en-GB, browsers default to en-US, mismatch crashes hydration. Applied in `ExamDateButton` and `ExamCountdownCard`.
- **DOMMatrix is not defined on server**: react-pdf's pdf.js touches DOMMatrix at module-load. PDF viewer is wrapped in `TopicPDFViewerClient.tsx` which uses `dynamic(() => import("./TopicPDFViewer"), { ssr: false })`.
- **`ComboHUD` positioning**: `position: fixed` children inside transformed `AnimatePresence` wrappers get a new containing block. Render `ComboHUD` at the engine top level, outside any motion wrapper.

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

### Active work + queue (end of 2026-05-30)

The user is actively studying their real Automata / Computational Models course on this app (primary use case, not a demo). Stated focus: "functionality of this application first to make it intuitive, fun, smart and without any bugs and security problems."

**The entire Tier-1 menu shipped 2026-05-24:** ✅ first-run onboarding, ✅ episode-processing feedback, ✅ failed-episode error surfacing, ✅ grader/scroll/debrief failure UX (classified errors + answer-draft persistence), ✅ question regeneration (soft-replace via Claude), ✅ Smart Next Best Action widget, plus a bonus ✅ 6-tier level progression with Stitch v2 polish (gradient Sage border + dual-color breathing + Master scanlines scroll), and a closing ✅ 12-fix code-review correctness sweep (soft-replace integrity in 5 reader paths + answer routes / image-only open answers / classified error envelope across 4 routes / word-boundary status regex / narrow try/catch on regenerate / timezone-aware streak-save NBA / ExamCountdown compact-mode hook / isTierUp demotion guard / Novice baseline glow). Total commits on `main` for 2026-05-24: ~26.

**Tier-2 menu cleared 2026-05-30:** ✅ Confidence rating + "Why was I wrong?" clarifier (Quiz pilot — Review/Boss/Exam Phase 2), ✅ adaptive difficulty on regeneration (mastery-anchored), ✅ client-side PDF upload size cap (20MB warn / 32MB block), ✅ streak freeze tokens (forgiveness mechanic), ✅ Today's stats strip (under hero), ✅ per-topic cheat sheet generator + ✅ universal RTL table fix (MarkdownContent refactor benefits every Markdown surface). One bug fix: ✅ Stumbles LaTeX rendering. Branch `pedagogy-clarifier-confidence-quiz` shipped to `main` on 2026-05-30 evening — 7 feature commits + 1 docs commit. Followed same evening by a **`/code-review ultra` cluster of 5 single-fix commits** (adaptive-difficulty dead-code column, boss freeze toast missing `newStreak`, clarifier honest-image/UPDATE-check/resume-budget-guard, bulk regen IDOR, Stumbles expanded-view MarkdownContent) and a final ✅ **subject-icon sigils on course tiles** feature. All on `main`. Last commit of the day: `4443679` (subject sigils) at 2026-05-30 23:38 +03:00.

**Tier-3 — bigger lifts:**
- **Phase 2 of confidence + clarifier** — expand to Review / Boss / Exam engines. Add `UNIQUE(answer_kind, answer_id)` on `answer_clarifications` + upsert pattern in the open branch. SM-2 quality changes + lucky-guess clarifier both shipped on the Quiz path 2026-06-01; Review still needs (1) the `confidence` column + UI, (2) the same SM-2 modulation in its `/complete`, (3) the polymorphic clarifier endpoint to lift its `answerKind !== "quiz"` gate so both wrong-answer and lucky-guess flows light up.
- **Question 👎 feedback button** — orthogonal to Regenerate (Regenerate = action; thumb-down = label). New `answer_feedback` table.
- **Profile page Tier-B+ adoption** — page predates the Tier-B+ vocabulary. ~8 tasks.
- **Daily review push/email** — habit loop. Needs email infra + cron job.
- **Edit/reorder episodes** — last QoL item from the original course-area queue.
- **Mobile responsive audit** — walk through key surfaces on small screens.
- **Boss-fight per-episode illustration** — deferred (cost concern).

Deliberately deferred: voice/TTS, cross-course topic linking, friend leaderboard (Max is solo-studying).

**Workflow notes from 2026-05-24 (don't backslide):**
- Confirm scope before refactoring large files (`ExamEngine.tsx`, `CourseMap.tsx`, `BossFightEngine.tsx`, `ReviewEngine.tsx`). User prefers tight, focused commits over megacommits.
- **Feature branch + rollback tag is the standard pattern for any multi-file design pass.** Used today for `grader-failure-ux`, `question-regeneration`, `smart-next-action`, `level-tier-progression`, `stitch-v2-sage-polish`, and `code-review-cluster-1` (12-fix sweep). Each branch was pushed → fast-forward merged to main → branch deleted. Rollback tag `pre-stitch-adaptation` (at `a512e6d`) is still on origin in case the bolder palette ever regresses.
- **Run `/code-review` after a feature sprint, not during.** The bundled extra-high-effort review (5 finder angles × 8 candidates → 1-vote verify → sweep, max 15 findings) caught real bugs that the in-flight implementation reviews missed because they were focused on each feature's happy path. The cluster-1 sweep returned 12 actionable findings on top of the day's 14 feature commits. Worth scheduling as a periodic checkpoint before risky multi-file design passes.
- **Magic MCP (21st.dev) returned generic SaaS Badge variants for "rank tier badge" / "level up reveal" — not useful for RPG vocabulary.** Don't waste tokens retrying those queries. The Builder tool *might* generate something different but we never tested (Max's token budget hit first). The existing pixel-arcade utilities in `globals.css` are more specialized than anything 21st.dev surfaces.
- **Google Stitch (`projects/6876213292851896179` titled "StudyQuest — RPG Dashboard Hero")** has the "Arcane Scholar" design system already configured and produced a useful Rank Progression mockup whose color palette we adopted (Expert orange, Sage pink-bridge gradient, dual-color breathing, scanlines scroll). When polling for a generated screen, `list_screens` returns empty for a while even after generation succeeds — be patient and re-poll, don't conclude generation failed too early.
- **Storybook is installed with `@storybook/addon-mcp`** and has stories for LevelBadge, QuestBoard, QuestCard, StreakCounter, XPBar, TierLevelFrame. Max didn't love it as the inspection surface — for visual previews prefer `/dashboard?tierPreview=1` (dev grid on the live dashboard chrome).
