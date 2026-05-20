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

## Current State (Checkpoint — 2026-05-20)

The MVP plus three major content layers (Scroll / Grimoire / Feynman), the exam-prep loop, the image-answer pipeline, the per-episode upload pattern, and full course/episode delete are all shipped. The app is in active polish + new-feature mode. Read this section AND the next ("What shipped in May 2026") before touching anything.

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

- **Combo bonus → server XP:** currently the combo multiplier is client-side cosmetic only. The Combo Breaker achievement fires, but XP doesn't scale with combo length. Wire into `calculate.ts` or per-answer route.
- **`longest_streak` not updated:** audit flagged that `users.longest_streak` never advances when `current_streak` exceeds it. Fix in the streak update path.
- **Quiz + Boss navigator parity:** the chevron-arrow auto-scroll navigator and `Leave Exam` button are only in `ExamEngine`. Mirror to `QuizEngine` and `BossFightEngine` for long sessions.
- **Orphan PDFs in storage:** when a course/episode is deleted, FK CASCADE removes DB rows but the actual files in the `course-files` Supabase Storage bucket are NOT removed. Harmless (few MB of quota) but eventually worth a sweeper.
- **User strategic queue (not yet picked):** onboarding flow polish, daily quests generator, course-map visual redesign, smart dashboard widget. The user has also asked about making the **dashboard hero feel "elegant + a bit retro pixelated"** — design-direction task, not started.

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

### Hebrew RTL + output-language signal

- `supabase/migrations/012_course_output_language.sql` — `courses.output_language TEXT` override so the user can pin a course to a specific AI output language even if the source PDF mixes scripts.
- Course detail page direction check (`src/app/dashboard/courses/[id]/page.tsx`) now uses **three signals in priority order**: `course.output_language === "he"` → RTL chars in `course.title` → RTL chars in `course.theme_name`. The first two alone were insufficient because an English course title can have all-Hebrew content.
- `MarkdownContent` keeps code blocks force-LTR; prose inherits parent `dir`. Textareas across all engines use `dir="auto"` so user input gets auto-detected.

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
- `src/components/course/EpisodeUploadForm.tsx`, `EpisodeProcessingPoller.tsx`, `EmptyCourseForm.tsx`, `ExamDateButton.tsx` — per-episode pipeline + countdown UI.
- `src/components/scroll/ScrollOfWisdom.tsx`, `src/components/feynman/FeynmanSession.tsx`, `src/components/dashboard/GrimoireWidget.tsx` + `ExamCountdownCard.tsx` — May-2026 content layers.
- `src/lib/ai/extract-episode.ts`, `extract-exam-questions.ts`, `grade-answer.ts`, `grade-exam-answer.ts`, `generate-scroll.ts`, `feynman-tutor.ts` — all Claude code paths. Tool use + streaming + vision blocks.
- `src/lib/answer-image.ts` — image upload helper + Claude vision block builder.
- `src/lib/study-plan.ts` — pure functions for the exam countdown / daily plan.
- `src/lib/spaced-repetition.ts` — SM-2 constants and `computeNextReview`.
- `src/lib/sound.ts` + `src/lib/useSound.ts` — sound engine + React glue.
- `src/components/effects/ComboHUD.tsx`, `LevelUpOverlay.tsx`, `AchievementUnlockOverlay.tsx`, `XPBurst.tsx` — celebration layer.
- `src/components/dashboard/StreakWarningBanner.tsx`, `SoundToggle.tsx` — Tier-1 dopamine bits.
- `src/app/dashboard/courses/[id]/exam/page.tsx` — exam prep landing per course; "Untimed Practice" + "Timed Exam" buttons.
- `src/app/dashboard/courses/[id]/page.tsx` — course detail; mounts ExamDateButton + EpisodeUploadForm + EpisodeProcessingPoller + CourseMap + DeleteCourseDialog (danger zone).

### Next likely user asks

The user is iterating on feel/polish + actively studying their real Automata / Computational Models course on this app (it's their primary use case, not a demo). Expect requests around:

- **Dashboard hero "elegant + a bit retro pixelated" redesign** — explicitly mentioned; user wants the level/user-info area to look better. Subtle pixelation (a little, not maximalist), elegant rather than chaotic. Use the existing `.font-pixel`, `.pixel-xp-bar`, `.hud-level-frame`, `.stat-label` utilities — don't invent new ones unless `globals.css` truly lacks the primitive.
- Polish on the May-2026 layers (Scroll/Grimoire/Feynman) as the user starts using them daily.
- Exam-engine parity work (mirror navigator + Leave button to Quiz/Boss engines).
- Onboarding / first-run polish.
- Quality-of-life on the per-episode flow: edit episode title, reorder episodes, etc.

Confirm scope before refactoring large files (`ExamEngine.tsx`, `CourseMap.tsx`, `BossFightEngine.tsx`, `ReviewEngine.tsx` are all long). The user prefers tight, focused PRs over megacommits — match that cadence.
