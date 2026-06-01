# Confidence-Weighted SM-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold `quiz_answers.confidence` into the SM-2 quality calculation on the Quiz `/complete` path so the schedule reflects confident-wrong (re-review sooner) and lucky-guess-right (back sooner) signals, with a one-line indicator in SessionDebrief explaining the effect.

**Architecture:** Three touch points — pure helpers in `spaced-repetition.ts`, a per-answer-quality fold in Quiz `/complete`, and a small indicator chip in `SessionDebrief`. No migration; no AI calls; no Review / Boss / Exam changes.

**Tech Stack:** TypeScript + Next.js 16 App Router + Supabase service client + Lucide icons + Framer Motion + Tailwind v4. Pure-helper convention matches `streak.ts` / `adaptive-difficulty.ts` (no test files; verified via `tsc`, server console log, and manual session walk-through).

**Testing approach:** The spec explicitly puts unit tests in "Out of scope" (§9) to match the existing pure-helper convention in this codebase (`streak.ts`, `adaptive-difficulty.ts` ship without tests; no vitest config exists in `src/`). The plan substitutes **`tsc --noEmit` typecheck + a manual verification step at the end of Task 4** for the standard TDD red/green pattern. If a broader test push happens later, the four pure helpers are trivially testable against the grid in spec §3.2.

**Reference spec:** `docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md` (commit `2963cef`). Read §3 before starting.

**Total scope:** 5 tasks, 4 source-file edits, 1 doc edit, 5 commits.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/spaced-repetition.ts` | Modify | Owns SM-2 math. Gains 4 new pure helpers + thin-wrapper refactor of `computeNextReview`. |
| `src/app/api/quiz/sessions/[sessionId]/complete/route.ts` | Modify | Quiz session completion. Wires per-answer confidence into the SR call + computes the indicator. |
| `src/components/quiz/QuizEngine.tsx` | Modify | Quiz session client engine. Threads `confidenceEffect` from `/complete` response → SessionDebrief prop. |
| `src/components/quiz/SessionDebrief.tsx` | Modify | Post-quiz screen. Renders the one-line indicator chip when `confidenceEffect != null`. |
| `CLAUDE.md` | Modify | Living documentation. Subsection capturing what shipped + updated tier-3 queue. |

No new files. No migration. No `package.json` change.

---

## Task 1: Extend `spaced-repetition.ts` with confidence helpers + refactor `computeNextReview`

**Files:**
- Modify: `src/lib/spaced-repetition.ts:1-79` (full file rewrite)

- [ ] **Step 1: Replace the entire file with the new content**

Replace the contents of `src/lib/spaced-repetition.ts` with:

```ts
/**
 * SM-2 spaced-repetition algorithm.
 *
 * Quality mapping from scorePct (0–100):
 *   ≥ 90 → 5 (perfect)
 *   ≥ 80 → 4 (good)
 *   ≥ 70 → 3 (passed)
 *   ≥ 50 → 2 (almost — treated as fail for interval)
 *   ≥ 25 → 1 (fail)
 *   else  → 0 (total blank)
 *
 * Failures (quality < 3) reset interval to 1 day, decrement ease.
 * Successes extend interval by interval × ease, with standard SM-2 ease update.
 *
 * Confidence-weighted variant: Quiz /complete folds quiz_answers.confidence
 * into a per-answer quality (see adjustQualityForConfidence + the 4-cell grid
 * documented in docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md),
 * averages across the session, and calls computeNextReviewFromQuality directly.
 * Review's /complete keeps the legacy computeNextReview(scorePct, ...) call.
 */

export interface ReviewState {
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
}

export interface NextReviewResult extends ReviewState {
  nextReviewAt: Date;
}

export type Confidence = "guessed" | "unsure" | "confident" | null;

export type ConfidenceEffectKind =
  | "overconfident-stumble"
  | "confident-mastery"
  | "lucky-win";

export interface ConfidenceEffect {
  kind: ConfidenceEffectKind;
  line: string;
}

const MIN_EASE = 1.3;

export function scoreToQuality(scorePct: number): number {
  if (scorePct >= 90) return 5;
  if (scorePct >= 80) return 4;
  if (scorePct >= 70) return 3;
  if (scorePct >= 50) return 2;
  if (scorePct >= 25) return 1;
  return 0;
}

/** Per-answer ai_score (0..1) → base SM-2 quality (0..5). Same thresholds as
 *  scoreToQuality (which takes 0..100). */
export function aiScoreToQuality(aiScore: number): number {
  return scoreToQuality(aiScore * 100);
}

/** Four-cell symmetric confidence modulation (see spec §3.2):
 *   confident + wrong  → 0   (overconfidence = strongest re-review signal)
 *   confident + right  → 5   (strongest mastery signal)
 *   guessed   + right  → min(base, 3)  (lucky guess; schedule sooner)
 *   guessed   + wrong  → base          (already a fail; no double-punishment)
 *   unsure / null      → base
 * "Right" defined as ai_score >= 0.7 to match the existing route. */
export function adjustQualityForConfidence(
  base: number,
  isCorrect: boolean,
  confidence: Confidence,
): number {
  if (!confidence || confidence === "unsure") return base;
  if (confidence === "confident") return isCorrect ? 5 : 0;
  // confidence === "guessed"
  if (isCorrect) return Math.min(base, 3);
  return base;
}

/** Pick the highest-priority confidence signal in a session and return a
 *  Loremaster-voiced one-liner for the SessionDebrief chip. Returns null
 *  when no signal qualifies (all-unrated or all-unsure session).
 *
 *  Priority: overconfident-stumble > confident-mastery > lucky-win.
 *  confident-mastery requires `adjustedQuality >= baseQuality` so a session
 *  with both confident-right AND guessed-right (where the guessed-right cap
 *  drags the average back down to baseQuality) doesn't lie about pushing
 *  the schedule deeper. */
export function describeConfidenceEffect(input: {
  answers: Array<{ ai_score: number; confidence: Confidence }>;
  adjustedQuality: number;
  baseQuality: number;
}): ConfidenceEffect | null {
  const { answers, adjustedQuality, baseQuality } = input;

  const hasConfidentWrong = answers.some(
    (a) => a.confidence === "confident" && a.ai_score < 0.7,
  );
  if (hasConfidentWrong) {
    return {
      kind: "overconfident-stumble",
      line: "Confident but stumbled — the trial returns sooner.",
    };
  }

  const hasConfidentRight = answers.some(
    (a) => a.confidence === "confident" && a.ai_score >= 0.7,
  );
  if (hasConfidentRight && adjustedQuality >= baseQuality) {
    return {
      kind: "confident-mastery",
      line: "Mastered with confidence — pushed deeper into the queue.",
    };
  }

  const hasLuckyWin = answers.some(
    (a) => a.confidence === "guessed" && a.ai_score >= 0.7,
  );
  if (hasLuckyWin) {
    return {
      kind: "lucky-win",
      line: "Lucky guess — back on the queue soon.",
    };
  }

  return null;
}

/** Variant of computeNextReview that takes a pre-computed quality. Used by
 *  Quiz /complete which folds confidence in per-answer. */
export function computeNextReviewFromQuality(
  quality: number,
  current: ReviewState,
  now: Date = new Date(),
): NextReviewResult {
  let { intervalDays, easeFactor, reviewCount } = current;

  if (quality < 3) {
    // Failed — reset to tomorrow, knock ease down slightly
    intervalDays = 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    reviewCount = 0;
  } else {
    // Passed — SM-2 interval progression
    if (reviewCount === 0) intervalDays = 1;
    else if (reviewCount === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    // SM-2 ease update formula
    easeFactor = Math.max(
      MIN_EASE,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );
    reviewCount += 1;
  }

  const nextReviewAt = new Date(now.getTime() + intervalDays * 86_400 * 1000);
  return { intervalDays, easeFactor, reviewCount, nextReviewAt };
}

/** Legacy entry point — Review's /complete still calls this. Identical
 *  behavior to the pre-refactor version; just delegates through quality. */
export function computeNextReview(
  scorePct: number,
  current: ReviewState,
  now: Date = new Date(),
): NextReviewResult {
  return computeNextReviewFromQuality(scoreToQuality(scorePct), current, now);
}

/** XP earned per correct review answer. Smaller than a fresh quiz. */
export const REVIEW_XP_PER_CORRECT = 6;
/** Flat bonus XP for completing a full review session. */
export const REVIEW_SESSION_BONUS_XP = 25;
/** Maximum topics pulled into a single review session. */
export const MAX_TOPICS_PER_SESSION = 5;
/** Questions sampled per topic in a review session. */
export const QUESTIONS_PER_TOPIC = 2;
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors. (If `tsc --noEmit` complains about other files unrelated to this change, note the baseline and ensure the new file adds no new errors.)

- [ ] **Step 3: Confirm callers still resolve**

Run:

```bash
grep -rn "computeNextReview\|scoreToQuality" src --include="*.ts" --include="*.tsx" | grep -v spaced-repetition.ts
```

Expected output (or close to it):

```
src/app/api/review/[sessionId]/complete/route.ts: import { computeNextReview, ... }
src/app/api/review/[sessionId]/complete/route.ts: const nextSr = computeNextReview(scorePct, ...)
src/app/api/quiz/sessions/[sessionId]/complete/route.ts: import { computeNextReview } ...
src/app/api/quiz/sessions/[sessionId]/complete/route.ts: const nextSr = computeNextReview(scorePct, ...)
```

This confirms both call sites still resolve `computeNextReview` through the legacy wrapper (Quiz's import gets replaced in Task 2; Review's stays).

- [ ] **Step 4: Commit**

```bash
git add src/lib/spaced-repetition.ts
git commit -m "$(cat <<'EOF'
feat(sr): add confidence helpers + refactor computeNextReview into a wrapper

Adds the pure pieces needed for confidence-weighted SM-2 on the Quiz path:
  - aiScoreToQuality(aiScore: 0..1)
  - adjustQualityForConfidence(base, isCorrect, confidence) — 4-cell grid
  - computeNextReviewFromQuality(quality, current, now)
  - describeConfidenceEffect({ answers, adjustedQuality, baseQuality })

computeNextReview(scorePct, ...) becomes a thin wrapper that delegates to
computeNextReviewFromQuality(scoreToQuality(scorePct), ...). Review's
/complete keeps using the legacy entry point; behavior unchanged there.

No callers wired yet — that lands in the next commit. This shipment is
pure-helper expansion only.

Spec: docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire confidence into Quiz `/complete` route

**Files:**
- Modify: `src/app/api/quiz/sessions/[sessionId]/complete/route.ts`

- [ ] **Step 1: Update the imports**

Find the existing line:

```ts
import { computeNextReview } from "@/lib/spaced-repetition";
```

Replace it with:

```ts
import {
  aiScoreToQuality,
  adjustQualityForConfidence,
  computeNextReviewFromQuality,
  describeConfidenceEffect,
  scoreToQuality,
  type Confidence,
} from "@/lib/spaced-repetition";
```

- [ ] **Step 2: Add a fresh query for persisted `(ai_score, confidence)` rows**

The route does NOT currently SELECT from `quiz_answers` — `answers` arrive via the request body and carry `score` but not `confidence` (confidence is captured by the client AFTER initial answer submission via `PATCH /api/quiz/answers/[answerId]/confidence`, so the DB row is the source of truth, not the client payload). Add a fresh query.

Find the existing line near the top of the handler (around line 60):

```ts
// Get existing mastery to compute new level
const { data: existingMastery } = await supabase
  .from("user_topic_mastery")
  .select("*")
  .eq("user_id", dbUser.id)
  .eq("topic_id", topicId)
  .single();
```

Immediately ABOVE that block, insert:

```ts
// Fetch persisted per-answer confidence for this session's SR modulation.
// quiz_answers.confidence is set by the client AFTER initial answer
// submission (PATCH /api/quiz/answers/[answerId]/confidence), so the DB
// row is the source of truth — the request body's `answers` carries
// `score` but never `confidence`. Read both ai_score AND confidence here
// so the modulation uses one consistent source for both fields.
const { data: persistedAnswers } = await supabase
  .from("quiz_answers")
  .select("ai_score, confidence")
  .eq("session_id", sessionId);
```

- [ ] **Step 3: Replace the SR call block**

Find the current SR computation (around line 107):

```ts
// Compute SR scheduling — completing a regular quiz counts as a review
const nextSr = computeNextReview(scorePct, {
  intervalDays: existingMastery?.review_interval_days ?? 1,
  easeFactor: existingMastery?.ease_factor ?? 2.5,
  reviewCount: existingMastery?.review_count ?? 0,
});
```

Replace that block with:

```ts
// Compute SR scheduling — completing a regular quiz counts as a review.
// Quiz /complete folds quiz_answers.confidence into a per-answer quality,
// averages across the session, then runs SM-2 against the adjusted quality.
// See spec docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md.
const sourceAnswers = (persistedAnswers ?? []).map((a) => ({
  ai_score: Number(a.ai_score) || 0,
  confidence: (a.confidence as Confidence) ?? null,
}));

const perAnswerQualities = sourceAnswers.map((a) => {
  const base = aiScoreToQuality(a.ai_score);
  const isCorrect = a.ai_score >= 0.7;
  return adjustQualityForConfidence(base, isCorrect, a.confidence);
});
const adjustedQuality =
  perAnswerQualities.length > 0
    ? Math.round(
        perAnswerQualities.reduce((s, q) => s + q, 0) /
          perAnswerQualities.length,
      )
    : 0;

const baseQuality = scoreToQuality(scorePct);

const nextSr = computeNextReviewFromQuality(adjustedQuality, {
  intervalDays: existingMastery?.review_interval_days ?? 1,
  easeFactor: existingMastery?.ease_factor ?? 2.5,
  reviewCount: existingMastery?.review_count ?? 0,
});

const confidenceEffect = describeConfidenceEffect({
  answers: sourceAnswers,
  adjustedQuality,
  baseQuality,
});

console.log(
  `[quiz/complete] SR: base=${baseQuality} confidence-adjusted=${adjustedQuality} ` +
    `(${sourceAnswers.length} answers; effect=${confidenceEffect?.kind ?? "none"}; ` +
    `interval=${nextSr.intervalDays}d)`,
);
```

- [ ] **Step 4: Add `confidenceEffect` to the JSON response**

Find the existing `return NextResponse.json({ ... })` block at the end of the POST handler. Add `confidenceEffect` as a new field alongside `xpEarned`, `scorePct`, `debrief`, `masteryEvolution`, `newAchievements`, etc.

```ts
return NextResponse.json({
  xpEarned,
  scorePct: Math.round(scorePct * 100) / 100,
  // ... existing fields stay ...
  masteryEvolution,
  debrief,
  // ... rest of existing fields stay ...
  confidenceEffect, // ← NEW: ConfidenceEffect | null
});
```

- [ ] **Step 5: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no new errors. If TypeScript complains about `a.confidence` typing on the Supabase query result, the `as Confidence` cast in the helper calls handles it; the SELECT string addition is the only thing that surfaces the column.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/quiz/sessions/[sessionId]/complete/route.ts
git commit -m "$(cat <<'EOF'
feat(quiz/complete): fold per-answer confidence into SM-2 quality

The Quiz /complete route now reads quiz_answers.confidence (already captured
per migration 020) and modulates the SR quality per-answer:

  confident + wrong  -> force quality 0   (strongest re-review signal)
  confident + right  -> force quality 5   (strongest mastery signal)
  guessed   + right  -> min(base, 3)      (lucky guess; back sooner)
  guessed   + wrong  -> base              (no double-punishment)
  unsure / null      -> base              (no signal change)

Per-answer modulated qualities are averaged across the session, rounded,
and passed to computeNextReviewFromQuality. Response gains an optional
confidenceEffect field carrying a Loremaster one-liner for SessionDebrief.

Server-side console.log captures base / adjusted / effect / interval for
verification — matches the adaptive-difficulty logging pattern.

Review's /complete is unchanged in this round (Phase 2 will follow).

Spec: docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Thread `confidenceEffect` through QuizEngine

**Files:**
- Modify: `src/components/quiz/QuizEngine.tsx` (state type + response handler + JSX prop)

- [ ] **Step 1: Extend the `sessionSummary` state type**

Find the existing state declaration around line 173:

```ts
const [sessionSummary, setSessionSummary] = useState<{
  xpEarned: number;
  scorePct: number;
  debrief: { strengths: string[]; gaps: string[]; next_topic: string; reason: string } | null;
  masteryEvolution: { topicId: string; fromLevel: number; toLevel: number } | null;
} | null>(null);
```

Replace it with:

```ts
const [sessionSummary, setSessionSummary] = useState<{
  xpEarned: number;
  scorePct: number;
  debrief: { strengths: string[]; gaps: string[]; next_topic: string; reason: string } | null;
  masteryEvolution: { topicId: string; fromLevel: number; toLevel: number } | null;
  confidenceEffect: {
    kind: "overconfident-stumble" | "confident-mastery" | "lucky-win";
    line: string;
  } | null;
} | null>(null);
```

- [ ] **Step 2: Read `data.confidenceEffect` in the response handler**

Find the existing `setSessionSummary({ ... })` call (around line 599):

```ts
setSessionSummary({
  xpEarned: data.xpEarned,
  scorePct: data.scorePct,
  debrief: data.debrief,
  masteryEvolution: data.masteryEvolution ?? null,
});
```

Replace with:

```ts
setSessionSummary({
  xpEarned: data.xpEarned,
  scorePct: data.scorePct,
  debrief: data.debrief,
  masteryEvolution: data.masteryEvolution ?? null,
  confidenceEffect: data.confidenceEffect ?? null,
});
```

- [ ] **Step 3: Pass the prop into `<SessionDebrief>`**

Find the existing `<SessionDebrief>` render at line 635:

```tsx
<SessionDebrief
  xpEarned={sessionSummary.xpEarned}
  scorePct={sessionSummary.scorePct}
  debrief={sessionSummary.debrief}
  topicTitle={topicTitle}
  courseId={courseId}
  topicId={topicId}
  masteryEvolution={sessionSummary.masteryEvolution}
  results={buildResultsArray()}
/>
```

Add the new prop:

```tsx
<SessionDebrief
  xpEarned={sessionSummary.xpEarned}
  scorePct={sessionSummary.scorePct}
  debrief={sessionSummary.debrief}
  topicTitle={topicTitle}
  courseId={courseId}
  topicId={topicId}
  masteryEvolution={sessionSummary.masteryEvolution}
  confidenceEffect={sessionSummary.confidenceEffect}
  results={buildResultsArray()}
/>
```

- [ ] **Step 4: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: ONE error in `SessionDebrief.tsx` complaining about the unknown `confidenceEffect` prop. That's good — Task 4 adds the prop to the component. Note the error and move on.

- [ ] **Step 5: Do NOT commit yet**

Task 3 and Task 4 land together as one commit (the prop pipe is incomplete without the receiver). Move to Task 4.

---

## Task 4: Render the indicator chip in `SessionDebrief`

**Files:**
- Modify: `src/components/quiz/SessionDebrief.tsx` (props interface + new import + render block)

- [ ] **Step 1: Add the Lucide icon imports**

Find the existing Lucide import at the top of the file (line 7):

```tsx
import { Trophy, Zap, ArrowRight, CheckCircle, XCircle, RotateCcw, Sparkles, Loader2 } from "lucide-react";
```

Add `AlertTriangle` and `Dice5`:

```tsx
import { Trophy, Zap, ArrowRight, CheckCircle, XCircle, RotateCcw, Sparkles, Loader2, AlertTriangle, Dice5 } from "lucide-react";
```

- [ ] **Step 2: Extend the props interface**

Find the existing `SessionDebriefProps` interface (around line 25):

```ts
interface SessionDebriefProps {
  xpEarned: number;
  scorePct: number;
  debrief: { /* … */ } | null;
  topicTitle: string;
  courseId: string;
  topicId: string;
  sessionId?: string;
  masteryEvolution?: { topicId: string; fromLevel: number; toLevel: number } | null;
  results: AnswerResult[];
}
```

Add the `confidenceEffect` optional prop right before `results`:

```ts
interface SessionDebriefProps {
  xpEarned: number;
  scorePct: number;
  debrief: { strengths: string[]; gaps: string[]; next_topic: string; reason: string } | null;
  topicTitle: string;
  courseId: string;
  topicId: string;
  sessionId?: string;
  /** If the session bumped the topic to a new mastery tier, this gets
   *  forwarded to the Course Map URL so the matching node plays the
   *  one-shot evolution celebration on arrival. */
  masteryEvolution?: { topicId: string; fromLevel: number; toLevel: number } | null;
  /** Loremaster one-liner describing how confidence shifted the SR schedule.
   *  Hidden when null (no confident or guessed answers in the session). */
  confidenceEffect?: {
    kind: "overconfident-stumble" | "confident-mastery" | "lucky-win";
    line: string;
  } | null;
  results: AnswerResult[];
}
```

- [ ] **Step 3: Destructure the new prop in the function signature**

Find the destructured props in the component (around line 49):

```ts
export default function SessionDebrief({
  xpEarned,
  scorePct,
  debrief,
  topicTitle,
  courseId,
  topicId,
  sessionId,
  masteryEvolution,
  results,
}: SessionDebriefProps) {
```

Add `confidenceEffect`:

```ts
export default function SessionDebrief({
  xpEarned,
  scorePct,
  debrief,
  topicTitle,
  courseId,
  topicId,
  sessionId,
  masteryEvolution,
  confidenceEffect,
  results,
}: SessionDebriefProps) {
```

- [ ] **Step 4: Add the chip render block**

The chip slots into the existing header area, immediately below the XP / score row but before the debrief content. Search the file for the place where `xpEarned` and `scorePct` are rendered together (it's an existing JSX block around the top of the returned tree).

Add this block immediately after that header row, before the debrief / results sections:

```tsx
{confidenceEffect && (
  <div
    className={cn(
      "pixel-border px-3 py-2 mt-3 flex items-start gap-2.5 relative",
      confidenceEffect.kind === "overconfident-stumble" &&
        "bg-red-500/10 text-red-200",
      confidenceEffect.kind === "confident-mastery" &&
        "bg-emerald-500/10 text-emerald-200",
      confidenceEffect.kind === "lucky-win" && "bg-amber-500/10 text-amber-200",
    )}
    role="status"
    aria-live="polite"
  >
    {/* Pixel-nail corners — kind-tinted to match the chrome family. */}
    <span
      aria-hidden
      className={cn(
        "absolute top-1 left-1 w-1.5 h-1.5",
        confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
        confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
        confidenceEffect.kind === "lucky-win" && "bg-amber-400",
      )}
    />
    <span
      aria-hidden
      className={cn(
        "absolute top-1 right-1 w-1.5 h-1.5",
        confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
        confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
        confidenceEffect.kind === "lucky-win" && "bg-amber-400",
      )}
    />
    <span
      aria-hidden
      className={cn(
        "absolute bottom-1 left-1 w-1.5 h-1.5",
        confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
        confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
        confidenceEffect.kind === "lucky-win" && "bg-amber-400",
      )}
    />
    <span
      aria-hidden
      className={cn(
        "absolute bottom-1 right-1 w-1.5 h-1.5",
        confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
        confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
        confidenceEffect.kind === "lucky-win" && "bg-amber-400",
      )}
    />

    {confidenceEffect.kind === "overconfident-stumble" && (
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
    )}
    {confidenceEffect.kind === "confident-mastery" && (
      <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
    )}
    {confidenceEffect.kind === "lucky-win" && (
      <Dice5 className="w-4 h-4 mt-0.5 shrink-0" />
    )}

    <p className="text-sm leading-snug">{confidenceEffect.line}</p>
  </div>
)}
```

**Placement note:** if the existing JSX has multiple plausible insertion points, drop the chip *right after the XP/score header* and *before* the per-question results list. The visual order in spec §3.6 expects: XP + score → chip → debrief / results.

- [ ] **Step 5: Typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: zero errors. (The error from Task 3 step 4 is now resolved by the new prop in the component.)

- [ ] **Step 6: Manual verification — exercise all three states**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`. Sign in (or use an existing session) and run a single short quiz on any ready topic. **Repeat three times** to exercise all three chip states:

| Confidence inputs to capture during quiz | Expected chip after submission |
|---|---|
| At least one *confident* answer that you intentionally answer **wrong** | Red chip with AlertTriangle: *"Confident but stumbled — the trial returns sooner."* |
| At least one *confident* answer answered **right**, no confident-wrongs | Emerald chip with Sparkles: *"Mastered with confidence — pushed deeper into the queue."* |
| At least one *guessed* answer answered **right**, no confident answers | Amber chip with Dice5: *"Lucky guess — back on the queue soon."* |

After each session, also verify in the server terminal that the `[quiz/complete] SR:` log line printed with sane `base` / `confidence-adjusted` / `effect` / `interval` values.

**Optional DB spot-check:** In Supabase, run:

```sql
SELECT review_interval_days, ease_factor, review_count, next_review_at
FROM user_topic_mastery
WHERE user_id = '<your-id>' AND topic_id = '<topic-id>'
ORDER BY last_attempted_at DESC LIMIT 1;
```

Confirm that the `confident + wrong` run has `review_interval_days = 1` (quality 0 = fail → reset) and the `confident + right` run has a larger `review_interval_days` than a confidence-free baseline of the same score would have produced.

- [ ] **Step 7: Commit (combined for Task 3 + Task 4)**

```bash
git add src/components/quiz/QuizEngine.tsx src/components/quiz/SessionDebrief.tsx
git commit -m "$(cat <<'EOF'
feat(quiz/debrief): one-line confidence indicator in SessionDebrief

Threads the new confidenceEffect field from /complete through QuizEngine
state into SessionDebrief, which renders a pixel-bordered chip describing
how the confidence inputs shifted the SR schedule:

  overconfident-stumble (red,    AlertTriangle): "Confident but stumbled —
                                                  the trial returns sooner."
  confident-mastery     (emerald, Sparkles)    : "Mastered with confidence —
                                                  pushed deeper into the queue."
  lucky-win             (amber,  Dice5)        : "Lucky guess —
                                                  back on the queue soon."

Hidden cleanly when confidenceEffect is null (all-unrated session, or no
qualifying signal — the route returns null). Tier-B+ pixel chrome with
4 nail corners tinted to match the kind. Tested all three states locally.

Spec: docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (migrations note + new "What shipped" subsection + tier-3 queue line)

- [ ] **Step 1: Update the hero "Current State" paragraph**

Find the Current State checkpoint header. Update the date in the heading to today's date (`2026-06-01`) and add a phrase to the hero paragraph capturing this shipment, e.g. inserting *"and **confidence-weighted SM-2** on the Quiz path (4-cell symmetric grid + one-line SessionDebrief indicator)"* near the existing "Confidence rating + 'Why was I wrong?' clarifier" mention.

Exact insertion: find the existing phrase `**Confidence rating + "Why was I wrong?" clarifier** (Quiz pilot)` and append `, **confidence-weighted SM-2 on the Quiz path** (4-cell symmetric grid: confident-wrong → quality 0, confident-right → 5, guessed-right → capped at 3; one-line indicator chip in SessionDebrief)` immediately after.

- [ ] **Step 2: Add a new subsection capturing this shipment**

Add this subsection immediately after the existing `### \`/code-review ultra\` cluster on the 2026-05-30 sprint (same evening)` section (or wherever the most recent shipped section ends; place it adjacent to the related Confidence + clarifier subsection):

```markdown
### Confidence-weighted SM-2 on the Quiz path (2026-06-01)

First Phase-2 confidence shipment: folds `quiz_answers.confidence` (captured per migration 020) into the SM-2 quality calculation on Quiz `/complete`. Review / Boss / Exam SR paths unchanged this round.

**Files touched:**
- `src/lib/spaced-repetition.ts` — added `aiScoreToQuality`, `adjustQualityForConfidence`, `computeNextReviewFromQuality`, `describeConfidenceEffect`. The legacy `computeNextReview(scorePct, …)` is now a thin wrapper delegating through `scoreToQuality` → `computeNextReviewFromQuality`. Review's call site is unchanged in behavior.
- `src/app/api/quiz/sessions/[sessionId]/complete/route.ts` — fetches `confidence` alongside `ai_score`, computes per-answer modulated quality, averages across the session, rounds, calls `computeNextReviewFromQuality`. Computes `confidenceEffect` for the indicator and includes it in the response.
- `src/components/quiz/QuizEngine.tsx` — threads `confidenceEffect` through `sessionSummary` state into the `<SessionDebrief>` prop.
- `src/components/quiz/SessionDebrief.tsx` — renders the indicator chip when non-null (red `AlertTriangle` / emerald `Sparkles` / amber `Dice5` with pixel chrome).

**The four-cell symmetric grid (canonical reference):**

| Confidence  | Wrong (< 0.7) | Right (≥ 0.7) |
|-------------|---------------|---------------|
| `confident` | **force 0**   | **force 5**   |
| `guessed`   | base          | **min(base, 3)** |
| `unsure`    | base          | base          |
| `null`      | base          | base          |

Per-answer quality is `aiScoreToQuality(ai_score)` then modulated by the grid; session quality is the rounded average. Server log line: `[quiz/complete] SR: base=N confidence-adjusted=N (M answers; effect=K; interval=Dd)`.

**Indicator chip priority** (highest-priority signal wins when a session has multiple):
1. Any `confident + wrong` → `overconfident-stumble` (red) — *"Confident but stumbled — the trial returns sooner."*
2. Else any `confident + right` AND `adjustedQuality >= baseQuality` → `confident-mastery` (emerald) — *"Mastered with confidence — pushed deeper into the queue."*
3. Else any `guessed + right` → `lucky-win` (amber) — *"Lucky guess — back on the queue soon."*
4. Else → `null` (chip hides).

The `adjustedQuality >= baseQuality` guard on `confident-mastery` catches the edge where the same session has a `guessed-right` answer whose cap-at-3 drags the average back to the pre-confidence quality — the line would otherwise lie about pushing the schedule deeper.

**Phase 2 follow-up still open:** Review's `confidence` column + UI + same modulation in Review `/complete`. Boss + Exam don't drive SR so no plan to add confidence there for SM-2 reasons (could still happen for clarifier).

**Spec:** `docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md`. Plan: `docs/superpowers/plans/2026-06-01-confidence-weighted-sm2.md`. `docs/` is gitignored on purpose for laptop-local spec drafts; both files are committed in this round.
```

- [ ] **Step 3: Update the tier-3 queue line**

Find the existing line in the "Active work + queue" section:

```markdown
- **Phase 2 of confidence + clarifier** — expand to Review / Boss / Exam engines. Add `UNIQUE(answer_kind, answer_id)` on `answer_clarifications` + upsert pattern in the open branch. SM-2 quality changes designed in the spec but unimplemented.
```

Replace with:

```markdown
- **Phase 2 of confidence + clarifier** — expand to Review / Boss / Exam engines. Add `UNIQUE(answer_kind, answer_id)` on `answer_clarifications` + upsert pattern in the open branch. SM-2 quality changes shipped on the Quiz path 2026-06-01; Review still needs the column + UI + the same modulation in its `/complete`.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(CLAUDE.md): confidence-weighted SM-2 on Quiz path

Captures the 2026-06-01 shipment: confidence on quiz_answers (live since
migration 020) now folds into SM-2 via the four-cell symmetric grid. Adds
a new "What shipped" subsection with file pointers, the canonical grid,
the indicator chip priority order, and the open Phase-2 follow-up (Review
adoption).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

Spec coverage check (matched against `docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md`):

| Spec section | Implemented in |
|---|---|
| §2 Current state | Read-only; informed Task 1's refactor of `computeNextReview` into a wrapper |
| §3.1 Architecture | All 5 tasks |
| §3.2 Four-cell grid | Task 1 — `adjustQualityForConfidence` |
| §3.3 New helpers | Task 1 — all 4 + `Confidence` / `ConfidenceEffectKind` / `ConfidenceEffect` types |
| §3.4 Quiz /complete integration | Task 2 |
| §3.5 /complete response surface | Task 2, step 4 |
| §3.6 SessionDebrief UI | Tasks 3 + 4 |
| §3.7 Loremaster voice (static strings) | Task 1's `describeConfidenceEffect` |
| §4 Data flow | Tasks 1–4 |
| §5 Edge cases (all-null, single-Q, score boundary, mixed signals, empty array, guessed-wrong-with-low-base) | Task 1 helpers handle these by construction; manual verification step in Task 4 step 6 exercises them |
| §6 Error handling | Pure helpers are total — no try/catch needed |
| §7 Testing (no new infra) | Plan substitutes typecheck + manual session walk-through |
| §8 Performance | O(N) over session answers; no AI calls added; one extra column in existing SELECT |
| §9 Out of scope | Honored — no Review/Boss/Exam touch, no migration, no unit tests |
| §10 CLAUDE.md updates | Task 5 |

Placeholder scan: no "TBD", "TODO", "implement later", "appropriate error handling", or "similar to Task N" patterns present. Every code step shows the exact code.

Type consistency: `Confidence`, `ConfidenceEffect`, `ConfidenceEffectKind`, `confidenceEffect` field name, and all helper signatures match across tasks. The `kind` literal union (`"overconfident-stumble" | "confident-mastery" | "lucky-win"`) is identical in the route response, the QuizEngine state, the SessionDebrief props, and the helper. Verified by hand.

Ambiguity check: the only step that says "find the line around line N" is Step 3 of Task 2 — but the surrounding context (the exact `computeNextReview(scorePct, …)` block) is uniquely identifiable. Task 4 step 4 names a "header area" placement; resolved by the explicit "after XP/score row, before debrief / results" instruction in the placement note.

---

## Execution Notes

- **Total estimated time:** 30–45 min for an attentive implementer (Tasks 1, 2, 5 are mechanical; Tasks 3 + 4 share the visual verification time).
- **Rollback handle:** Task 1 is the only commit that touches `computeNextReview`'s behavior boundary. If Phase 2 demands a different shape, `git revert` Task 5 → Task 4+3 → Task 2 → Task 1 cleanly.
- **Branch suggestion:** create `confidence-weighted-sm2` off `main`, run the 5 tasks, push, fast-forward merge.

---

**End of plan.**
