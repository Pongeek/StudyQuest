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

## Current State (Checkpoint — 2026-05-24)

The MVP plus three content layers (Scroll / Grimoire / Feynman), the exam-prep loop, the image-answer pipeline, the per-episode upload pattern, full course/episode delete, the **Course Map redesign**, **weekly Study Report**, **per-topic Mastery Panel**, **Loremaster coach voice**, **grouped achievements + 6 new ones**, **first-run onboarding** (Welcome Modal + Empty Dashboard Hero), **episode-processing feedback** (Processing & Failed banners with classified errors + transition toasts), **grader/scroll/debrief failure UX** (classified errors + answer-draft persistence), **question regeneration** (soft-replace via Claude), **Smart Next Best Action widget** (cycling dashboard priority pill), **paired urgency row** (Exam Countdown cycle + NBA in one 2-col row), and **6-tier level progression** (Novice/Apprentice/Adept/Expert/Master/Sage chrome with within-tier drift + RANK UP overlay + Sage gradient border + dual-color breathing) are all shipped. The app is in active polish + new-feature mode. Read this section AND the next ("What shipped in May 2026") before touching anything.

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

### Recently resolved (audited 2026-05-23 — don't re-add to TODO)

- ✅ **Combo bonus → server XP** — `calculateSessionXp` and `calculateBossFightXp` both award a tiered combo bonus (+5%/+10%/+15% at 3+/4+/5+). Quiz and Boss complete routes pass `maxCombo` through.
- ✅ **`longest_streak` updates** — all three complete routes (quiz / boss / review) compute `Math.max(dbUser.longest_streak || 0, newStreak)` and persist it.
- ✅ **Quiz navigator parity** — `QuizEngine` has `scrollNavBy`, `ChevronLeft`/`ChevronRight` buttons, and a `Leave Quiz` button + confirm banner. `BossFightEngine` uses a `TrialDots` non-scrolling navigator (boss sessions are short enough that horizontal scroll isn't needed) plus a `Leave Fight` button — adequate parity by intent.
- ✅ **Dashboard hero "elegant + retro pixelated"** — shipped as part of the dashboard hero rework. See `project_dashboard_design_tokens` memory for the Tier A vs Tier B+ vocabulary.
- ✅ **Course Map visual redesign** — pixel-bordered episode chrome, boss-arena tile with ambient halo + scanlines + "BOSS DORMANT" copy, fixed-position chapter breadcrumb (NOT sticky in flow — avoids layout-shift wobble), 404 fix on `/dashboard/courses`. See "Course Map redesign" subsection below.

---

## What shipped in May 2026

Each subsection here is a contained feature with its own files + migration. If you're picking up work and one of these is being touched, read the matching subsection first.

### Per-episode upload pipeline (replaces "upload the whole textbook")

The old flow uploaded one giant PDF as the course. That broke for 300+ page textbooks (Claude context, page-numbering, slow extraction). The new flow:

1. User creates an **empty course** via `EmptyCourseForm` (`mode: "empty"` on `POST /api/courses`) — just a name, subject, output language.
2. User uploads **one PDF per episode/chapter** via `EpisodeUploadForm` (max 3 PDFs per episode, ≤100 pages each works best). `POST /api/courses/[id]/episodes` accepts multipart, stores PDFs in `course-files` bucket, creates an `episodes` row with `status='processing'`, fires `processEpisodeAsync()` background work.
3. `EpisodeProcessingPoller` (client) re-`router.refresh()`es every 4s while any episode is processing (5-min safety cap), so the UI flips to "ready" without a manual reload.
4. `extractEpisodeStructure()` in `src/lib/ai/extract-episode.ts` calls Claude with native document content blocks, schema-enforced via tool use (`save_episode_structure`), inserts topics, wires prerequisites, sets `status='ready'`.

Critical extraction rules baked into the prompt (don't relax these without thinking):
- **Topic titles MUST start with the section number** (e.g. `1.1 Finite Automata`, `1.3 ביטויים רגולריים`). The course map relies on this for ordering hints.
- **Page ranges use 1-based PDF physical page indices**, NOT textbook printed page numbers. The Sipser bug — Claude reading "Page 63" from a footer and storing 63 in a 52-page PDF — was fixed by passing `primaryFilePageCount` into the prompt, including a worked example, and post-processing clamp.

Files:
- `src/components/course/EmptyCourseForm.tsx`, `src/components/course/EpisodeUploadForm.tsx`, `src/components/course/EpisodeProcessingPoller.tsx`
- `src/app/dashboard/courses/new/page.tsx` (tabbed: "Empty course" recommended vs "From single PDF" legacy)
- `src/app/api/courses/route.ts` (`mode: "empty"` fast path)
- `src/app/api/courses/[id]/episodes/route.ts` (multipart POST + background processing)
- `src/lib/ai/extract-episode.ts` (tool use, streaming, page-range rules)

### Exam date countdown + study plan

The user sets an exam date per course on the course detail page. A dashboard widget then renders a countdown + auto-generated daily study plan.

- `supabase/migrations/013_exam_dates.sql` adds `exam_date DATE` + `exam_label TEXT` on `courses`.
- `PATCH /api/courses/[id]/exam-date` — validates `YYYY-MM-DD` + 64-char label cap.
- `src/lib/study-plan.ts` — pure functions, `generateStudyPlan()` returns `{ daysUntilExam, urgency, actions[] }` where `urgency ∈ 'calm' | 'steady' | 'crunch' | 'final-push' | 'exam-day' | 'past'`. Picks topics with lowest mastery (< `MASTERY_TARGET = 3`), clamped 1–4 per day.
- `src/components/course/ExamDateButton.tsx` — the picker in the course header. **Use `"en-US"` locale explicitly** when formatting the displayed date — defaulting to `undefined` caused a hydration mismatch (server defaulted to en-GB).
- `src/components/dashboard/ExamCountdownCard.tsx` — the dashboard widget; uses BookOpen / Sparkles / Swords icons per action type.

### Image answer uploads (Claude vision)

Students can attach a hand-drawn diagram (automata, derivations, set-builder, proofs) to any **open-answer** question. Claude vision grades the image alongside the typed text. Lives across all four engines.

- `supabase/migrations/015_answer_images.sql` — adds `image_url TEXT` to `quiz_answers`, `exam_answers`, `review_answers`, `boss_fight_answers`.
- `src/lib/answer-image.ts` — 5MB max, jpeg/png/webp only. `uploadAnswerImage()` stores under `answers/<userId>/<sessionId>/<questionId>-<ts>.<ext>` in `course-files` bucket. Returns `{ storagePath, mediaType, buffer }`. `buildClaudeImageBlock()` builds the vision content block.
- `src/components/quiz/AnswerImagePicker.tsx` — the shared picker (drop / select / preview / remove). RTL-aware. Used by `QuizEngine`, `ExamEngine`, `BossFightEngine`, `ReviewEngine`.
- Graders updated: `src/lib/ai/grade-answer.ts` and `src/lib/ai/grade-exam-answer.ts` both accept optional `studentImage: { mediaType, base64 } | null`. When present, the image block is prepended to `userContent` and the prompt acknowledges "grade based on BOTH the typed text AND the image together."
- All four answer routes (`/api/quiz/answers`, `/api/exams/[id]/answer`, `/api/review/[sessionId]/answer`, `/api/boss-fight/[sessionId]/answer`) now negotiate `application/json` **or** `multipart/form-data` based on `Content-Type` header. Image-bearing submissions go multipart. MCQ stays JSON.

### Scroll of Wisdom (daily insight)

First dashboard visit of the day unfurls a full-screen scroll with one AI-generated insight from a random ready-course topic. One tap dismisses.

- `supabase/migrations/008_daily_scrolls.sql` — `daily_scrolls(user_id, scroll_date UNIQUE)`.
- `src/lib/ai/generate-scroll.ts` — single-turn Claude call, ~256 tokens, returns plain text (2–3 sentences, counterintuitive / surprising).
- `src/app/api/scroll/today/route.ts` — GET (fetch-or-generate today's scroll), POST (dismiss).
- `src/components/scroll/ScrollOfWisdom.tsx` — client overlay. **localStorage gate** key `sq:scroll-YYYY-MM-DD` so it only fires once per day per browser. Animation pattern mirrors `LevelUpOverlay` (spring, damping 16, stiffness 180, transform-origin top). Mounted in `src/app/dashboard/layout.tsx`.
- Z-index: scroll `z-[130]`, level-up `z-[150]`, achievement `z-[160]` — preserve this stacking order.

### Mistake Grimoire (failed-question collection)

Every question the user has failed 2+ times across quiz sessions becomes a "demon" in the gothic-styled grimoire. "Slay All Demons" creates a targeted review session.

- `supabase/migrations/009_grimoire.sql` — adds `review_sessions.source TEXT DEFAULT 'review'` and `review_sessions.pinned_question_ids JSONB`.
- `GET /api/grimoire` — groups quiz_answers in JS (not SQL — avoids gnarly Supabase joins) to count failures per question_id, joins question details, marks "settled" if latest score ≥ 0.8.
- `POST /api/grimoire/session` — picks up to 10 unsettled demons, creates `review_sessions` row with `source='grimoire'` and `pinned_question_ids: [...]`.
- `src/app/dashboard/grimoire/page.tsx`, `src/app/dashboard/grimoire/session/[sessionId]/page.tsx`
- `src/components/dashboard/GrimoireWidget.tsx` — dashboard card with `glow-purple` when count > 0.

### Feynman Mode (teach-back chat)

When the user fails a quiz below 60%, `SessionDebrief` offers "Teach It Back 🎓". They open a chat with Claude playing a curious peer who NEVER gives answers — only asks "why?", "what if?", "give me an example?". After 3+ exchanges, user can request evaluation.

- `supabase/migrations/010_feynman_sessions.sql` — `feynman_sessions(messages JSONB, status TEXT CHECK IN ('active','passed','abandoned'), evaluation_score NUMERIC(4,3), xp_earned INTEGER)`. Includes the "the_professor" achievement (pass 5 Feynman sessions).
- `src/lib/ai/feynman-tutor.ts` — TWO Claude functions. `getFeynmanReply()` is **multi-turn** (alternating user/assistant messages); `evaluateFeynmanSession()` is single-turn JSON. **First and only multi-turn Claude code in this codebase** — handle the `messages` array carefully (no system role inside, system goes in `system` param).
- API: `POST /api/feynman/sessions` (create + opening message), `POST /api/feynman/sessions/[sessionId]/message` (turn), `POST /api/feynman/sessions/[sessionId]/evaluate` (score + XP). XP: pass = 60 XP, fail = 15 XP consolation. Topic must have `mastery_level` updated by upstream review logic, not here.
- `src/components/feynman/FeynmanSession.tsx` — chat UI client component. Bot avatar 🎓, user messages right-aligned indigo-900. Typing indicator (3-dot bounce). "Am I ready? →" button surfaces only when `turnCount >= 3`.

### Course / Episode delete (just landed — 2026-05-20)

Bifurcated risk levels because a course represents weeks of progress, an episode only one chapter.

- **Course delete** — `DELETE /api/courses/[id]` (ownership check via combined WHERE on `user_id` + `id`; FK CASCADE handles all children). UI is `src/components/course/DeleteCourseDialog.tsx` — GitHub-style **type-to-confirm**: user must type the course name (case-insensitive, trimmed). Stats panel quantifies episodes / topics / completed sessions. Lives in a quiet "Danger zone" at the bottom of the course hero card.
- **Episode delete** — `DELETE /api/episodes/[id]` (ownership via `courses!inner(user_id)` join, recomputes `course.episode_count` + `course.topic_count` after cascade). UI is `src/components/course/DeleteEpisodeButton.tsx` — small trash icon in each episode header inside `CourseMap`. Light confirm (no type-to-confirm).
- **CourseMap header split**: HTML disallows `<button>` inside `<button>`, so the episode header was split into a left clickable region (collapse toggle) + a right region containing `DeleteEpisodeButton` + chevron. The trash button uses `stopPropagation()` so opening the dialog doesn't toggle collapse.
- **Storage caveat**: PDF files in the `course-files` bucket are NOT removed by cascade (FK CASCADE only covers DB rows). Logged as a known TODO above.

### Course Map redesign + Study Report + Topic Mastery Panel (2026-05-23)

Three back-to-back commits on `course-redesign` → fast-forward-merged to `main` (rollback anchor: tag `pre-course-redesign` → `aa1dfe0`).

**Course Map redesign (commit `eaa09ef`)**
- Episode cards swap `rpg-card` for `pixel-border` + 4 status-colored pixel-nail corners. Border + nails flip indigo → emerald together when an episode hits 100%.
- Boss tile gets `py-5` height, a `.boss-arena-glow` ambient pulse behind it (red while pending via `--pending` variant, amber after victory via `--defeated`), a `pixel-scanlines` overlay, and the locked copy now reads "**BOSS DORMANT** — Master every topic above to summon the boss" instead of the flat "Complete all topics to unlock".
- New `src/components/course/EpisodeBreadcrumb.tsx` — IntersectionObserver picks the topmost intersecting `#episode-card-{id}` and renders a chapter chip (`CH NN — Title · M/T · P%`) under the dashboard nav while you scroll inside an episode. **Critical pattern**: rendered with `position: fixed` (NOT `position: sticky` in flow) — the sticky version caused a layout-shift feedback loop that visibly wobbled the page on scroll. Outer wrapper handles positioning; `.episode-breadcrumb` is just chrome.
- 404 fix: `/dashboard/courses` doesn't exist as an index — courses live at `/dashboard`. Two broken links repointed (`/dashboard/review/page.tsx` empty-state "Browse Courses" CTA + `TodaysMission.tsx` fallback `nextQuestHref`).
- Tried topic-to-topic connector lines (status-colored, with a one-shot localStorage-gated wipe animation on first mastery crossing) but pulled them — read poorly at small sizes and the mastery-ring tier already telegraphs progress. The connector CSS utilities (`.connector-*`, `@keyframes connector-wipe`) are NOT in globals.css anymore. Don't add them back without a fresh design pass.

**Weekly Study Report (commit `c1e4195`)**
- `src/components/course/CourseStudyReport.tsx` is a server component that sits above the Exam Prep tile on the course detail page.
- Aggregates last-7-days activity scoped to *this course* in parallel: `quiz_sessions` filtered by topic_id, `boss_fight_sessions` filtered by episode_id, `review_sessions` filtered in JS (topic_ids is JSONB, no `.in()`).
- 4 stat tiles: Attempted / Accuracy / Topics / Days to Exam. Accuracy and exam-days tiles are color-coded by threshold (red/amber/emerald). Widget chrome itself flips amber when the exam is within 14 days.
- "Needs Attention" section lists the bottom 3 topics by mastery, only when any are below Adept tier.
- Renders null when there's no recent activity AND no exam date is set — keeps a brand-new course page clean.

**Per-Topic Mastery Panel (commit `e961c95`)**
- `src/components/course/TopicMasteryPanel.tsx` replaces the hardcoded last-3 "Recent Sessions" block on the topic detail page (`/dashboard/courses/[id]/topics/[topicId]`).
- 4 activity tiles: Questions / Accuracy / Minutes / Sessions. Minutes computed from `completed_at - started_at` with a **per-session cap of 1 hour** so an AFK browser tab doesn't inflate the total.
- Inline-SVG **score trajectory sparkline** — last 10 completed sessions, oldest → newest, with a dashed 50% baseline and a trend chip (RISING / DIPPING / STEADY) that only renders once 3+ sessions exist. Stroke color flips by latest score (red/amber/emerald). No charting library — pure SVG `<polyline>` + `<path>`.
- **Stumbles heatmap** — top 8 questions failed 2+ times in this topic. Native `<details>` elements provide collapse without any client JS. Failure threshold: `ai_score < 0.5`.
- **Quest Log** — up to 10 most-recent sessions: date · score · correct/total · duration · XP. Each row links through to its review page.
- Dropped the page's standalone last-3 `quiz_sessions` query — the panel already fetches a wider window, one less round-trip.

### Hebrew RTL + output-language signal

- `supabase/migrations/012_course_output_language.sql` — `courses.output_language TEXT` override so the user can pin a course to a specific AI output language even if the source PDF mixes scripts.
- Course detail page direction check (`src/app/dashboard/courses/[id]/page.tsx`) now uses **three signals in priority order**: `course.output_language === "he"` → RTL chars in `course.title` → RTL chars in `course.theme_name`. The first two alone were insufficient because an English course title can have all-Hebrew content.
- `MarkdownContent` keeps code blocks force-LTR; prose inherits parent `dir`. Textareas across all engines use `dir="auto"` so user input gets auto-detected.

### Loremaster coach persona + Grimoire LaTeX fix + Profile grouping + nav centering (2026-05-23 continued)

After the Course Map / Study Report / Topic Mastery work landed earlier the same day, four follow-on commits shipped to `main` (commits `ac31f2c`, `4ec2f70`, `374a188`, merged via `ba144b7`). Each is small and self-contained.

**Loremaster coach persona (commit `60f4616`)**
- Single shared persona at `src/lib/ai/coach-persona.ts` exports `COACH_PERSONA_SYSTEM` (~250 token system prompt) and a `withCoachPersona(taskPrompt)` helper.
- Wired as the `system:` parameter on every Claude call that "speaks AT the user as a guide": `grade-answer.ts`, `grade-exam-answer.ts` (both calls — per-answer grade + end-of-exam debrief), `generate-scroll.ts`, `session-debrief.ts`.
- **Intentionally exempt**: `feynman-tutor.ts` (Socratic peer by design — persona would break the teach-back), all `extract-*.ts` and `generate-questions*.ts` (purely mechanical, no voice needed).
- Voice rules locked in the persona: vocabulary mappings (`trial`/`stumble`/`ascend`), tone calibration per context (full marks vs partial vs wrong vs daily wisdom vs debrief), hard rules (stay in voice but never derail the task — JSON/tool-use schemas always respected). Hebrew works naturally — persona tells the model to match the student's language.
- Cost: ~250 tokens prepended per call. Roughly $0.05-0.20/day at Max's volume.
- Probe-tested on 4 surfaces (English Scroll, Hebrew Scroll, partial-credit grader, mixed-score debrief) before shipping — voice landed consistently, accuracy/structure unchanged.

**Grimoire demon-list LaTeX fix (commit `ac31f2c`)**
- `DemonCard` in `src/app/dashboard/grimoire/page.tsx` was rendering `{demon.content}` as plain text — so questions with `$M$`, `\Sigma`, `\delta` showed dollar signs and backslashes verbatim. The Slay-All-Demons session view was unaffected because it uses `ReviewEngine` (already routes through MarkdownContent/MarkdownInline).
- Swapped to `MarkdownInline` (inline-safe — remaps block elements to span so it nests inside `<p>` without invalid HTML, while still running remark-math + rehype-katex). Added `dir="auto"` on the wrapping `<p>` for Hebrew right-alignment.
- **Pattern to remember**: any list / preview surface that renders AI-generated question text needs `MarkdownInline` (inline) or `MarkdownContent` (block). Don't render `{question.content}` as plain text — assume LaTeX.

**Profile achievement grouping + 6 tier-2 unlocks (commit `4ec2f70`)**
- Profile page was rendering all 24 achievements as a flat trophy/chest grid; the locked half made the page very long.
- New taxonomy file `src/lib/achievement-categories.ts` is the single source of truth: `AchievementCategory` union, `CATEGORY_ORDER`, `CATEGORY_META` (label + lucide iconName + accent color), `SLUG_TO_CATEGORY` map, and a `groupByCategory()` helper. Adding/re-categorizing an achievement = one constant edit. Unknown slugs fall through to `quests`.
- Profile locked section now renders 7 collapsible `<details>` blocks (Mastery / Streaks / Combat / Quests / Wisdom / Magic / Teaching), each with its own accent color (amber / orange / red / indigo / cyan / purple / emerald). Earned grid stays always-visible — that's the celebration.
- **Migration 016** (`016_more_achievements.sql`) adds 6 tier-2 achievements that all reuse existing `condition_type` values, so the server-side achievement checker awards them automatically with zero code change: `sage` (master_topics:15), `iron_legend` (streak_days:60), `iron_discipline` (review_days:60), `centenarian` (quiz_sessions_completed:100), `apex_predator` (boss_fights_completed:15), `twilight_reader` (scrolls_dismissed:30).
- **Trophy/Chest cards bumped from `line-clamp-1` → `line-clamp-2`** in the same commit — longer descriptions like "Proved your understanding by teaching a concept 5 times and passing" were being clipped mid-sentence. Two lines fits every description in the codebase without breaking grid alignment.

**DashboardNav centering (commit `374a188`)**
- Dashboard / Profile nav links were nested inside the left flex group next to the logo, so `justify-between` left them clustered on the left side of the bar.
- Pulled the nav out as a direct sibling of the logo and HUD-chip groups, positioned `absolute left-1/2 -translate-x-1/2` against the now-`relative` bar so the links sit at the true visual midpoint regardless of how the right-side chip cluster grows.
- Mobile unchanged — `hidden md:flex` keeps the absolute nav off small screens; existing mobile menu handles those.

### First-run onboarding + episode-processing feedback + failed-episode surface (2026-05-24)

Three shipments today, all in service of "intuitive + fun + smart + no bugs."

**First-run onboarding** (migration 017 + 2 components + dashboard page wiring)
- New users have always landed on a single dead "The map is blank…" card with no context. Two new layers fix this:
  - `src/components/dashboard/WelcomeModal.tsx` — client component, mounted only when `users.onboarding_completed_at IS NULL`. 3-slide pixel-arcade carousel (Welcome → How it works → Begin your quest). Keyboard nav (`→` / `Enter` advance, `←` back, `Esc` skip). Dot pagination clickable. Final slide swaps to amber "ENTER THE REALM" — the celebration moment. `useReducedMotion` guard. Closes by POSTing `/api/users/complete-onboarding` (non-fatal if it fails — closes locally anyway).
  - `src/components/dashboard/EmptyDashboardHero.tsx` — server component, persistent whenever `courses.length === 0`. Replaces the ENTIRE dashboard widget stack (DashboardHeroCard / TodaysMission / ExamCountdownCard / GrimoireWidget / QuestBoard / Your Realm) with one indigo pixel-bordered hero: headline + 3-up step grid (`01 UPLOAD` → `02 AI EXTRACTS` → `03 QUEST ON`) + amber upload CTA + one-line PDF tip.
- **Critical wiring** in `dashboard/page.tsx`: when `courses.length === 0`, the function early-returns to `<EmptyDashboardHero/>` *only* (no point rendering widgets at zero data). When > 0, regular dashboard. WelcomeModal is a separate concern from the empty hero — a returning user who deleted all their courses still sees the empty hero but never the modal again.
- The dead "The map is blank…" branch inside "Your Realm" was removed since it's unreachable (page now early-returns).

**Episode-processing feedback** (new banner + enhanced poller)
- Root cause being fixed: when an episode is uploaded, it appears in CourseMap with `status: "processing"` but `topics: []` — so the card renders empty with no spinner, looking broken. When extraction finishes, no celebration.
- `src/components/course/ProcessingEpisodesBanner.tsx` — amber pixel-bordered banner above CourseMap, one row per in-flight episode with a **live elapsed-time counter** that ticks every second starting at the actual elapsed time from `created_at` (so a mid-process refresh shows the real wait). Subtle color shift past 120s — "this is normal-ish, not panic-worthy." `aria-live="polite" aria-busy="true"`. Renders null when nothing's in flight.
- `src/components/course/EpisodeProcessingPoller.tsx` — was just a `router.refresh()` ticker. Now takes the full episode list (id + title + status), tracks previous statuses in `useRef<Map>`, and on each render diffs current vs previous. Transitions `processing → ready` fire `toast.success("X is ready — your topics await.", { icon: "⚔" })`; `processing → error` fire a sharp error toast pointing the user to the FailedEpisodesBanner. First render is the silent baseline (no toast on initial load).
- `dashboard/courses/[id]/page.tsx`: processing episodes are filtered OUT of CourseMap entirely (they own the banner above instead) — solves the broken-empty-card visual.

**Failed-episode surface** (migration 018 + classifier + banner)
- 413 (Anthropic "request too large") was hitting users on big PDFs. The catch handler was correctly setting `status: "error"` but the UI rendered the failed episode identically to a ready one with 0 topics + a phantom boss tile.
- `src/lib/episode-error.ts` — `classifyEpisodeError(err)` returns `{ code, userMessage }`. Codes: `PDF_TOO_LARGE` (413), `RATE_LIMITED` (429), `AUTH_ERROR` (401), `NO_TEXT` (scanned PDF), `ZERO_QUESTIONS` (AI found no topics), `TIMEOUT` (Vercel function), `UNKNOWN` (fallback). Each `userMessage` is one short actionable sentence — no "Sorry" or "Please" (Loremaster doesn't grovel). New error modes get a new block here; don't sprinkle classifiers around.
- `api/courses/[id]/episodes/route.ts` catch handler now calls the classifier and writes `userMessage` to `episodes.error_message` alongside `status: "error"`. User's original title is preserved so re-upload is easier.
- `src/components/course/FailedEpisodesBanner.tsx` — red pixel-bordered banner above CourseMap. Per-episode row shows title + the classified message + a delete button (uses existing `DeleteEpisodeButton variant="label"`). Persistent until the user deletes. Renders null when none failed.
- Course page filters error episodes OUT of CourseMap too — same reason as processing. CourseMap now only ever renders `status === "ready"` episodes.

**Three patterns to remember for next time:**
1. **Empty arrays from background jobs render as broken cards.** Whenever a model owns child rows that get filled in asynchronously, the parent UI needs a "we're working on it" view + a "we failed, here's why" view, not just hopeful rendering of the empty list.
2. **Diff-based toasts beat polling alarms.** `EpisodeProcessingPoller` pattern (track prev statuses, diff on render, fire toast on transition) is the right shape for any "background job finished" notification. Reuse it.
3. **Persist user-facing error messages in the DB.** Don't try to recompute them on each render from a status enum — by the time the user sees it, the original error object is gone. Catch handler → classifier → column.

### Grader/scroll/debrief failure UX + question regeneration + Smart NBA + paired urgency row + level tier progression (2026-05-24 continued)

A long second half of 2026-05-24 — five separate features merged on top of the morning's onboarding/processing work. Each has its own branch + commit lineage, deliberately tight.

**Grader/scroll/debrief failure UX (commit `2f8afe3`)**
- `src/lib/ai-error.ts` — `classifyAiError(err)` returns `{ code, userMessage, retryable }`. Codes: `RATE_LIMITED` (429), `OVERLOADED` (529), `BUDGET_CAP`, `AUTH_ERROR` (401), `TIMEOUT` (504), `NETWORK` (fetch threw), `UNKNOWN`. Loremaster voice. Companion helper `readClassifiedErrorFromResponse(res)` for client engines.
- `src/lib/answer-draft.ts` — localStorage helpers: `saveDraft/loadDraft/clearDraft/clearSessionDrafts`. Key namespace `sq:answer-draft:<sessionId>:<questionId>`. SSR-safe `typeof window` guard. Auto-prunes entries > 30 days on every save so the bucket stays bounded.
- Four answer routes (`/api/quiz/answers`, `/api/exams/[id]/answer`, `/api/review/[sessionId]/answer`, `/api/boss-fight/[sessionId]/answer`) wrap grading in try/catch and return `{ error: ClassifiedAiError }` with HTTP 502 on upstream failure.
- Four client engines (Quiz/Exam/Boss/Review) debounce-save drafts on open-answer keystroke (~600ms), restore on mount with "Restored your saved answer." toast, clear on successful grade, clear all session drafts on completion. Failed submits surface the classified `userMessage` with the draft intact.
- Scroll path already nullable; debrief route returns `debrief: null` on failure and the SessionDebrief component already guards `{debrief && (…)}` — no work needed there.
- **Verified end-to-end via Playwright** on the live dashboard: NETWORK throw, server 502 with classified body, draft survives hard refresh, real Claude retry clears draft.

**Question regeneration (commits `7320216` + `0721c42`) — migration 019**
- Soft-replace pattern: when the user regenerates an ambiguous/hallucinated question, the old row stays in the DB (preserves historical `quiz_answers` integrity) and gets `replaced_by_id` + `replaced_at` stamped. The new row inherits the old row's `created_at` so the new question slots into the same chronological position when the page reloads. Migration 019 adds the two columns + a partial index on `(topic_id, created_at) WHERE replaced_at IS NULL`.
- `src/lib/ai/regenerate-question.ts` — single-question Claude tool-use generator. Same prompt vocabulary as `generate-questions.ts` (LaTeX rules, language rule, Loremaster persona). Prompt acknowledges "previous question rejected — produce a meaningfully different question on the same concept." `max_tokens: 8192` + streaming (`client.messages.stream() + finalMessage()`) — the initial 2048 cap truncated Hebrew + LaTeX outputs (commit `0721c42` fixed this — Hebrew is multi-byte, every `\Sigma` is several tokens). Always log `stop_reason` + `output_tokens` for debugging.
- `POST /api/questions/[questionId]/regenerate` — ownership chain check via topic → episode → course → user. Inserts new row with `created_at = old.created_at`. Marks old replaced. `classifyAiError()` on upstream failure → returns 502 with classified body.
- `src/components/quiz/RegenerateQuestionButton.tsx` — shared client button, two variants (`inline` for in-quiz, `label` for Stumbles). Two-step confirm pattern (first tap = "Tap again to confirm" for 4s, second tap = fire). Classified error toast via the helper from the failure-UX commit.
- `src/components/course/StumbleRegenerateButton.tsx` — thin server-component wrapper that `router.refresh()`es on success so the stumble disappears from the heatmap.
- All reader paths now filter `.is("replaced_at", null).order("created_at", { ascending: true })`: quiz session page, review/start, topic questions GET, grimoire, TopicMasteryPanel stumbles inline-join.
- Mid-session UX: QuizEngine + ReviewEngine hold questions in **local state** (init from prop) so the regenerate handler can swap a question in place without remounting the engine. The Map of per-question state has the old key deleted + new key added with fresh state. Localstorage draft for old id cleared.
- Out of scope for v1: boss-fight questions (different `boss_fight_questions` table) + exam questions (extracted from real PDFs, not AI).

**Smart Next Best Action widget + paired urgency row + MCQ bidi fix (commits `30b18b4`, `75bee3e`, `7e7df45`, `c0f2194`)**
- `src/lib/next-best-action.ts` — pure decision function `pickNextBestActions(input): NextBestAction[]`. Walks a priority list (S exam crunch ≤7d / S streak save after 6pm / A boss ready / A review storm ≥5 / A demon pile ≥5 / A review due 1-4 / B today's quest) and returns ALL qualifying actions sorted highest-priority first. Zero new DB queries — reuses the dashboard's already-fetched `studyPlans` + `reviewQueue` + `grimoireCount` + `recommendations` + `streak` + `lastStudyDate`.
- `src/components/dashboard/NextBestActionCard.tsx` — client widget (state for cycle index). Tier-colored chrome (red S, amber A, indigo B), Lucide icon, headline + context + amber pixel CTA + "Show next →" link that walks the priority list ("Back to first" when at end). Hides cleanly when actions is empty.
- Locked behaviors from this round: cycle does not dismiss — picks the next item in the priority list (Max's pick). Streak-save trigger fires only after 18:00 local. Exam-crunch threshold = 7 days (was 3 in initial draft).
- **MCQ option bidi fix (commit `75bee3e`)** — discovered while reviewing the cycle widget. When an MCQ option's body started with a Latin acronym (e.g. "C. NFA יכול…"), the Unicode bidirectional algorithm grouped the "C. " prefix and the "NFA" acronym into one LTR run and rendered them with no separator: "C.NFA יכול…". Fix: convert the button to `flex items-center gap-3 rtl:flex-row-reverse` with the letter prefix in its own styled `w-7 h-7 rounded-lg` tile (matched the pattern ExamEngine + BossFightEngine were already using). Touched QuizEngine + ReviewEngine; the other two were already correct.
- **Paired Exam Countdown + NBA in 2-col row (commit `7e7df45`)** — both surfaces answer "what's pressing right now?" from different angles (countdown = timeline context, NBA = single best move). Paired in `grid md:grid-cols-2 gap-4 items-stretch` so they read as one band above the rest of the widgets. ExamCountdownCard gained a `compact` prop that hides the "Today's plan" action list when paired (would duplicate NBA's CTA).
- **Exam Countdown cycle + height-matched paired row (commit `c0f2194`)** — multi-exam future-proofed: ExamCountdownCard became a `"use client"` component taking `plans: StudyPlan[]` and cycling through them with the SAME "Show next →" vocabulary as NBA. With one exam set the cycle button hides. Both cards stretch to matched height via `flex flex-col h-full` + `items-stretch` on the grid + `mt-auto` on each card's CTA / cycle row, so footers align even when content lengths differ.

**Level tier progression (commits `9fbb24d`, `a5ec500`, `a512e6d`, `e0d0940`, `bb141d4`)**
- 6 distinct tier looks tied to `LEVEL_TIERS` from `lib/xp.ts` (Novice 1-4 / Apprentice 5-9 / Adept 10-19 / Expert 20-34 / Master 35-49 / Sage 50+). Each tier shifts FOUR axes: accent color, frame chrome decoration, glow style, and numeral color.
- `src/lib/level-tier.ts` — pure helper. `getLevelTierVisuals(level)` returns `{ tier, tierTitle, tierMin, tierMax, subTierProgress, saturationOffset, glowAlpha, decoration, glow, tierClass }`. Open-ended tier (Sage) uses `OPEN_TIER_VIRTUAL_SPAN = 50` levels for the drift calculation so `subTierProgress` is meaningful. `isTierUp(prev, new)` detects rank crossings. `getTierNavChipColors(tier)` returns chip palette tokens for the small nav HUD chip so it tracks the same identity as the hero frame.
- **Within-tier drift** is two channels — HSL saturation rises by up to +25% across the tier range, outer glow alpha rises 0.55 → 0.85. Both deterministic linear ramps from `subTierProgress = (level - tier.min) / (tier.max - tier.min)`. Set inline by `TierLevelFrame` as `--tier-saturation` + `--tier-glow-alpha` CSS custom properties.
- `src/components/gamification/TierLevelFrame.tsx` — drop-in tier-aware replacement for bare `.hud-level-frame` markup. Layers the right decoration spans (sparks/laurels/crown/flames/rune ring) based on the tier's `decoration` kind, applies the glow class (`tier-glow-pulse/halo/breathe/breathe-strong/ring`), Sage swaps numeral to `.text-gradient-epic`. Used by `DashboardHeroCard`, `ProfileHeroCard`, `LandingHeroVisual`, `LevelUpOverlay`.
- `src/components/effects/LevelUpOverlay.tsx` — rank-up variant. `isTierUp(prev, new)` → swap "LEVEL UP!" → "RANK UP!", render the NEW tier's `TierLevelFrame` (the new chrome IS the reveal), flash a radial burst tinted to the new tier accent (~600ms), show the new tier title in 2xl pixel font. Regular level-ups inside the same tier keep the existing smaller animation.
- DashboardNav HUD chip now uses `getTierNavChipColors(tier)` so the always-visible level reminder tracks the hero frame's tier identity (previously pinned to indigo).
- **`src/components/dashboard/TierPreviewGrid.tsx` — dev-only preview grid, query-param gated** at `/dashboard?tierPreview=1`. Renders all 6 tiers at 16 representative sub-levels with drift math printed under each. Keep it — fast inspection surface for tier changes.
- Storybook stories at `src/components/gamification/TierLevelFrame.stories.tsx` (6 per-tier stories + FullProgression + ApprenticeDrift). Storybook itself is installed via `@storybook/addon-mcp` but Max didn't love it as the inspection surface — the dashboard preview grid is preferred.
- **CSS adoption from Stitch v2** (commits `e0d0940` + `bb141d4`) — Google Stitch generated a "Rank Progression" mockup whose bolder color-first interpretation we adopted. Expert went from yellow → ORANGE (vivid against dark, reads as "earned amber with heat"). Sage gained a PINK bridge color: gradient is amber → pink → violet (not amber → violet). Sage's frame border uses `border-image: linear-gradient(to bottom right, #f59e0b, #ec4899, #8b5cf6) 1` so the gradient flows around the perimeter itself (requires `border-color: transparent` to anchor). Sage's halo is a custom dual-color `tier-glow-sage` keyframe breathing pink + amber together. Master + Sage scanlines now drift vertically (`tier-scanlines-scroll` 4s linear, `background-position 0 → 6px` matches the 3px line spacing so the loop reads continuous).
- **CRITICAL DEBUGGING NOTE** — during the Stitch adaptation we hit a "tier CSS not served" issue. Clearing `.next/cache` was NOT enough — Turbopack stores compiled output in other `.next` subfolders. **Full fix: `rm -rf .next` then restart `npm run dev`.** Then hard-refresh the browser (Ctrl+Shift+R) so it re-fetches the stylesheet. Add this to the "don't backslide" list.
- Rollback tag `pre-stitch-adaptation` at commit `a512e6d` is still on origin (kept around in case the bolder palette ever regresses).

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

### Active work + queue (end of 2026-05-24)

The user is actively studying their real Automata / Computational Models course on this app (primary use case, not a demo). Stated focus: "functionality of this application first to make it intuitive, fun, smart and without any bugs and security problems."

**The entire Tier-1 menu shipped 2026-05-24:** ✅ first-run onboarding, ✅ episode-processing feedback, ✅ failed-episode error surfacing, ✅ grader/scroll/debrief failure UX (classified errors + answer-draft persistence), ✅ question regeneration (soft-replace via Claude), ✅ Smart Next Best Action widget, plus a bonus ✅ 6-tier level progression with Stitch v2 polish (gradient Sage border + dual-color breathing + Master scanlines scroll). Total commits on `main` for 2026-05-24: ~14.

**Refreshed menu — Tier 2 (now the top priority):**
- **Client-side pre-upload size cap** — extension of the 413 fix. If user uploads a >20 MB PDF, warn before submission instead of after a 30-second wait + a server-side classification. The classifier in `episode-error.ts` is now the right server-side safety net for anything that slips past.
- **Adaptive difficulty** — question generator picks difficulty based on current mastery. AI accepts the param already; just wire it.
- **Streak freeze tokens** — earn 1 per 7-day streak, auto-burn on missed day. Forgiveness mechanic.

**Tier 3 — bigger lifts:**
- **Daily review push/email** — habit loop. Needs email infra + cron job.
- **Edit/reorder episodes** — last QoL item from the original course-area queue. PATCH `/api/episodes/[id]` for title, plus a reorder endpoint.
- **Mobile responsive audit** — walk through key surfaces on small screens.
- **Boss-fight per-episode illustration** — deferred (cost concern). Path forward documented in Known TODOs.

Deliberately deferred: voice/TTS, cross-course topic linking, friend leaderboard (Max is solo-studying).

**Workflow notes from 2026-05-24 (don't backslide):**
- Confirm scope before refactoring large files (`ExamEngine.tsx`, `CourseMap.tsx`, `BossFightEngine.tsx`, `ReviewEngine.tsx`). User prefers tight, focused commits over megacommits.
- **Feature branch + rollback tag is the standard pattern for any multi-file design pass.** Used today for `grader-failure-ux`, `question-regeneration`, `smart-next-action`, `level-tier-progression`, `stitch-v2-sage-polish`. Each branch was pushed → fast-forward merged to main → branch deleted. Rollback tag `pre-stitch-adaptation` (at `a512e6d`) is still on origin in case the bolder palette ever regresses.
- **Magic MCP (21st.dev) returned generic SaaS Badge variants for "rank tier badge" / "level up reveal" — not useful for RPG vocabulary.** Don't waste tokens retrying those queries. The Builder tool *might* generate something different but we never tested (Max's token budget hit first). The existing pixel-arcade utilities in `globals.css` are more specialized than anything 21st.dev surfaces.
- **Google Stitch (`projects/6876213292851896179` titled "StudyQuest — RPG Dashboard Hero")** has the "Arcane Scholar" design system already configured and produced a useful Rank Progression mockup whose color palette we adopted (Expert orange, Sage pink-bridge gradient, dual-color breathing, scanlines scroll). When polling for a generated screen, `list_screens` returns empty for a while even after generation succeeds — be patient and re-poll, don't conclude generation failed too early.
- **Storybook is installed with `@storybook/addon-mcp`** and has stories for LevelBadge, QuestBoard, QuestCard, StreakCounter, XPBar, TierLevelFrame. Max didn't love it as the inspection surface — for visual previews prefer `/dashboard?tierPreview=1` (dev grid on the live dashboard chrome).
