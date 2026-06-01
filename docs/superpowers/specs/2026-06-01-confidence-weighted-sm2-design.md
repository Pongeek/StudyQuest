# Confidence-Weighted SM-2 — Design Spec

**Date:** 2026-06-01
**Branch (planned):** `confidence-weighted-sm2`
**Pilot scope:** Quiz `/complete` only (Review / Boss / Exam remain unchanged in this round).

---

## 1. Problem & Goal

StudyQuest already collects per-answer confidence (`quiz_answers.confidence` — `'guessed' | 'unsure' | 'confident' | null`) as part of the Quiz pilot (migration 020, 2026-05-29). That signal currently feeds **one** thing: the "Why was I wrong?" clarifier's tone branch.

The signal is more pedagogically valuable than that — particularly the inversions:

- A **confident wrong** answer is the strongest possible re-review signal (the student doesn't know they don't know; that's the failure mode SM-2 should fight hardest).
- A **guessed right** answer is a fragile-memory signal (the schedule should bring it back sooner, not push it out as if the student had mastered it).

Today the SM-2 update path consumes only the session's `scorePct`. A 100% session counts identically whether the student crushed it confidently or guessed every answer. **Goal:** fold confidence into the SM-2 quality calculation on the Quiz path so the schedule reflects the inversion signals.

**Non-goal:** changing Review / Boss / Exam SR. Boss + Exam don't drive SR anyway; Review's confidence column is deferred to Phase 2.

## 2. Current state (what we're modifying)

### `src/lib/spaced-repetition.ts`

- `scoreToQuality(scorePct: number): number` — pure, maps 0–100 → 0–5 via fixed thresholds (≥90→5, ≥80→4, ≥70→3, ≥50→2, ≥25→1, else 0). 70 is the pass cutoff (quality ≥ 3 = passed).
- `computeNextReview(scorePct, current, now?)` — pure, runs scorePct through `scoreToQuality` then applies SM-2 (interval reset on fail; SM-2 progression `1 / 6 / interval×ease` on success; ease update via the canonical SM-2 formula; ease floor 1.3).

### `src/app/api/quiz/sessions/[sessionId]/complete/route.ts`

- Fetches all `quiz_answers` for the session
- Computes `scorePct = correctCount / totalCount` (correctCount counts `ai_score >= 0.7`)
- Calls `computeNextReview(scorePct, currentMasteryState)` and writes the result to `user_topic_mastery` (interval / ease / count / `next_review_at`)
- Does **not** read `confidence` from the answer rows

### `src/app/api/review/[sessionId]/complete/route.ts`

- Same SR call site, **per topic** (Review can span multiple topics). Stays untouched this round.

### `src/components/quiz/SessionDebrief.tsx`

- Post-quiz screen. Shows XP, score, debrief, masteryEvolution badge, Feynman CTA when score < 60%.
- No confidence-related UI today. We'll add **one** indicator chip.

## 3. Design

### 3.1 Architecture overview

Three touch points; all small.

```
src/lib/spaced-repetition.ts                              +3 pure helpers
src/app/api/quiz/sessions/[id]/complete/route.ts          ~15-line block
src/components/quiz/SessionDebrief.tsx                    ~20-line block
src/app/dashboard/courses/[id]/topics/[topicId]/.../page  pass-through prop
```

No migration. No new tables. No new env vars. No API surface added (existing `/complete` response gains one optional field).

### 3.2 Per-answer modulation grid

The full four-cell symmetric grid (`confidence ∈ {guessed, unsure, confident, null}` × `isCorrect ∈ {true, false}`):

| Confidence  | Wrong (< 0.7) | Right (≥ 0.7) |
|-------------|---------------|---------------|
| `confident` | **force 0**   | **force 5**   |
| `guessed`   | base          | **min(base, 3)** |
| `unsure`    | base          | base          |
| `null`      | base          | base          |

Where `base` is `aiScoreToQuality(ai_score) = scoreToQuality(ai_score * 100)`.

**Why this grid:**

- `confident + wrong → 0`: the strongest re-review signal SM-2 can encode. Students who don't know they don't know need tomorrow's quiz on this topic.
- `confident + right → 5`: the strongest mastery signal. Students who got it right *and* knew they would are the cleanest "push the interval out" case.
- `guessed + right → min(base, 3)`: a "lucky guess" should never be treated as mastery. Capping at 3 means it always counts as "passed but interval doesn't expand much yet" — schedule comes back sooner.
- `guessed + wrong → base`: the answer is already wrong; the base score already drove quality to ≤ 2. Doubling the penalty for "I guessed and was wrong" punishes honest self-reporting. Leave alone.
- `unsure / null → base`: no signal change. Backward compatible with every answer logged before migration 020.

### 3.3 New helpers (`src/lib/spaced-repetition.ts`)

```ts
export type Confidence = "guessed" | "unsure" | "confident" | null;

/** Convert a per-answer ai_score (0..1) to base SM-2 quality (0..5),
 *  using the same thresholds as scoreToQuality (which takes 0..100). */
export function aiScoreToQuality(aiScore: number): number {
  return scoreToQuality(aiScore * 100);
}

/** Confidence-modulated per-answer quality (see grid above).
 *  "Correct" defined as ai_score >= 0.7 to match the existing route. */
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

/** Variant of computeNextReview that takes a pre-computed quality.
 *  Used by Quiz /complete which folds confidence in per-answer.
 *  Review's SR path keeps using computeNextReview(scorePct, ...). */
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
    // SM-2 ease update formula (same as legacy computeNextReview)
    easeFactor = Math.max(
      MIN_EASE,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );
    reviewCount += 1;
  }

  const nextReviewAt = new Date(now.getTime() + intervalDays * 86_400 * 1000);
  return { intervalDays, easeFactor, reviewCount, nextReviewAt };
}
```

The legacy `computeNextReview(scorePct, ...)` body is moved verbatim — only the input changes (quality direct instead of scorePct → quality). `MIN_EASE` is the existing 1.3 constant.

`computeNextReview(scorePct, ...)` is refactored into a thin wrapper:

```ts
export function computeNextReview(scorePct, current, now) {
  return computeNextReviewFromQuality(scoreToQuality(scorePct), current, now);
}
```

So Review's existing call site (`scorePct → quality → SM-2`) is unchanged in behavior.

### 3.4 Quiz `/complete` integration

The route currently receives `answers` via the **request body** (`{ answers, topicId, streakDays, maxCombo }`), not from a `quiz_answers` SELECT. The body's `answers` carry `score` but NEVER `confidence` — confidence is captured by the client AFTER initial answer submission via `PATCH /api/quiz/answers/[answerId]/confidence`, so the DB row is the source of truth for it. So `/complete` needs a fresh SELECT to read the persisted `(ai_score, confidence)` pairs:

```ts
// New query — source of truth for the per-answer SR modulation.
// Reads BOTH ai_score and confidence from the same row so the modulation
// uses one consistent source (the persisted answer state at completion).
const { data: persistedAnswers } = await supabase
  .from("quiz_answers")
  .select("ai_score, confidence")
  .eq("session_id", sessionId);

const sourceAnswers = (persistedAnswers ?? []).map((a) => ({
  ai_score: Number(a.ai_score) || 0,
  confidence: (a.confidence as Confidence) ?? null,
}));

// Per-answer confidence-modulated quality
const perAnswerQualities = sourceAnswers.map((a) => {
  const base = aiScoreToQuality(a.ai_score);
  const isCorrect = a.ai_score >= 0.7;
  return adjustQualityForConfidence(base, isCorrect, a.confidence);
});

// Session-level quality: average, rounded
const adjustedQuality =
  perAnswerQualities.length > 0
    ? Math.round(
        perAnswerQualities.reduce((s, q) => s + q, 0) / perAnswerQualities.length,
      )
    : 0;

const nextSr = computeNextReviewFromQuality(adjustedQuality, currentState);

// (existing user_topic_mastery update — same fields, intervalDays/ease/etc.)
```

**Computing the indicator** (separate from the SR math so the UI signal can change without touching the algorithm):

```ts
// Pre-confidence quality for comparison (was the schedule actually changed?)
const baseQuality = scoreToQuality(scorePct);

const confidenceEffect = describeConfidenceEffect({
  answers: sourceAnswers,
  adjustedQuality,
  baseQuality,
});
```

`describeConfidenceEffect` lives in the same `spaced-repetition.ts` module (pure):

```ts
export type ConfidenceEffectKind =
  | "overconfident-stumble"
  | "confident-mastery"
  | "lucky-win";

export interface ConfidenceEffect {
  kind: ConfidenceEffectKind;
  line: string;
}

export function describeConfidenceEffect(input: {
  answers: { ai_score: number; confidence: Confidence }[];
  adjustedQuality: number;
  baseQuality: number;
}): ConfidenceEffect | null {
  const { answers, adjustedQuality, baseQuality } = input;

  // Priority order: overconfident-stumble > confident-mastery > lucky-win.
  // A session that mixes signals shows the highest-priority one.
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
  if (hasConfidentRight && adjustedQuality > baseQuality) {
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
```

The `adjustedQuality > baseQuality` guard on the `confident-mastery` line keeps the *"pushed deeper into the queue"* copy honest: it only fires when the confidence inputs **strictly** moved the SR quality higher than the score-derived baseline. Two cases the guard catches:

1. **Perfect session with no headroom.** A session where `baseQuality === 5` already (`scorePct ≥ 90`), the confident-right answers can't push quality past 5, so `adjustedQuality === baseQuality === 5` and SM-2 produces an identical schedule. Saying "pushed deeper" would be misleading — nothing moved.
2. **Confident-right + guessed-right in the same session.** Confident-right pushes that answer to quality 5; guessed-right caps the other answer at 3 (where its base might've been 4 or 5). After averaging, `adjustedQuality` can land equal to or below the pre-confidence `baseQuality` — and the chip would lie about the schedule moving deeper.

A strict `>` (not `>=`) is necessary: equality means SM-2 produced the same result, which is the case the chip should not fire on.

**Logging** (in the route, after the SR call):

```ts
console.log(
  `[quiz/complete] SR: base=${baseQuality} confidence-adjusted=${adjustedQuality} ` +
  `(${sourceAnswers.length} answers; effect=${confidenceEffect?.kind ?? "none"}; ` +
  `interval=${nextSr.intervalDays}d)`,
);
```

Mirrors the adaptive-difficulty pattern — verifies the modulation actually fires without needing a dashboard surface.

### 3.5 `/complete` response surface

The route already returns a JSON object. Add one field:

```ts
return NextResponse.json({
  // ... existing fields ...
  confidenceEffect, // ConfidenceEffect | null
});
```

No breaking change — older clients ignore the new field.

### 3.6 SessionDebrief UI

The session page passes `confidenceEffect` through to `<SessionDebrief>` as a new optional prop:

```ts
confidenceEffect?: {
  kind: "overconfident-stumble" | "confident-mastery" | "lucky-win";
  line: string;
} | null;
```

Rendered as a single pixel-bordered chip in the header area, right below the XP / score row:

```
┌──────────────────────────────────────────┐
│  +18 XP        Score: 60%                │
│                                          │
│  [⚡ Confident but stumbled —             │
│      the trial returns sooner.]          │
└──────────────────────────────────────────┘
```

**Visual treatment** (Tier-B+ vocabulary, reusing existing globals.css utilities):

| Kind                    | Border / accent | Icon (Lucide) |
|-------------------------|-----------------|---------------|
| `overconfident-stumble` | red-500 / 10    | `AlertTriangle` |
| `confident-mastery`     | emerald-500 / 10 | `Sparkles` |
| `lucky-win`             | amber-500 / 10  | `Dice5` |

`pixel-border` + 4 pixel-nail corners matching the kind's accent color. No animation beyond the existing card mount.

Hidden when `confidenceEffect == null` — the chip slot collapses cleanly.

### 3.7 Loremaster voice

The three lines need to feel like the Loremaster persona (terse, in-character, no scolding):

- **overconfident-stumble**: *"Confident but stumbled — the trial returns sooner."*
- **confident-mastery**: *"Mastered with confidence — pushed deeper into the queue."*
- **lucky-win**: *"Lucky guess — back on the queue soon."*

These are returned by `describeConfidenceEffect`, not the Loremaster Claude call — they're static strings, no token cost. Localization to Hebrew is out of scope for this pilot (English-only line for now; the rest of the dashboard is already mixed-language; future improvement).

## 4. Data flow

```
QuizEngine                                      (per-question confidence captured today)
    │
    │  POST /api/quiz/answers                    confidence persisted to quiz_answers row
    │  PATCH /api/quiz/answers/[id]/confidence   (idempotent late update)
    ▼
quiz_answers table  ←──  confidence column lives here (migration 020)
    │
    │  (session end)
    ▼
POST /api/quiz/sessions/[id]/complete
    │
    │  SELECT ai_score, confidence FROM quiz_answers WHERE session_id = $1
    │
    ├─→ perAnswerQualities[]   = answers.map(adjustQualityForConfidence)
    ├─→ adjustedQuality         = round(mean(perAnswerQualities))
    ├─→ computeNextReviewFromQuality(adjustedQuality, currentState)
    │        ↓
    │   UPDATE user_topic_mastery
    │     SET review_interval_days, ease_factor, review_count, next_review_at
    │
    ├─→ confidenceEffect = describeConfidenceEffect(answers, adjustedQuality, baseQuality)
    │
    └─→ JSON response includes { confidenceEffect, ... }
            │
            ▼
    /dashboard/courses/[id]/topics/[topicId]/session/[sessionId] page
            │
            ▼
    <SessionDebrief confidenceEffect={...} ... />
            │
            ▼
    One-line chip rendered (or hidden if null)
```

## 5. Edge cases

| Case | Behavior |
|------|----------|
| All answers `confidence === null` (legacy or unrated) | Per-answer quality = base for every answer. `adjustedQuality === baseQuality`. `confidenceEffect === null`. UI shows nothing. Route behaves identically to today. |
| Single-question session | Average over 1 = that answer's modulated quality. No edge. |
| Score boundary `ai_score === 0.7` | `isCorrect = true` (matches existing route's `>= 0.7` cutoff). The grid uses the same threshold so there's no contradiction. |
| Mixed signals (`confident-right` + `confident-wrong` in same session) | Mathematically: per-answer average naturally weights both. UI: shows `overconfident-stumble` (highest priority). |
| Empty `answers` array (defensive — shouldn't happen post-grading) | `perAnswerQualities.length === 0` → `adjustedQuality = 0` → SR resets interval to 1 day. Matches current behavior on a 0% session. |
| `confidence === "guessed"` AND `base === 0/1/2` (failed answer with low quality) | `min(base, 3) = base` — no change. Grid is correct: only `right + guessed` caps; `wrong + guessed` is the no-change cell. |

## 6. Error handling

- The new helpers are pure and total — no exceptions possible. No try/catch needed at the helper layer.
- The `/complete` route already wraps the SR update; the new code sits inside the same scope. A bad `confidence` value (defensive — the column has a `CHECK` constraint, so this shouldn't occur) would fall through the `if` chain and treat the answer as `null`. No throw.
- The SessionDebrief chip is purely render-driven by a typed prop. Bad prop value (TypeScript prevents this; defensive runtime: an unknown `kind` falls through the `switch` to render nothing). No throw.

## 7. Testing

No new test infrastructure. Matches the existing `streak.ts` / `adaptive-difficulty.ts` convention — pure helpers, validated in production via the server-side `console.log` and Max's manual study flow.

If a test suite is added later (Phase-3 hardening), the four helpers (`aiScoreToQuality`, `adjustQualityForConfidence`, `computeNextReviewFromQuality`, `describeConfidenceEffect`) are all pure and trivial to unit-test against the matrix in §3.2.

**Manual verification plan** (Max's pilot session):

1. Take a real Quiz session on a topic. Answer 5 questions: 2 `confident-right`, 1 `confident-wrong`, 1 `guessed-right`, 1 `unsure-wrong`.
2. Submit. Check the server log line — confirm `base`, `adjusted`, `effect`, `interval` are sane.
3. Check `user_topic_mastery.next_review_at` in Supabase — confirm the date moved closer than a confidence-free session of the same `scorePct` would have produced.
4. Check the SessionDebrief — confirm the chip shows the `overconfident-stumble` line.

## 8. Performance

Net cost: O(N) over the session's answers (typically 5–10) with constant-time helpers. Adds zero AI calls, zero new DB queries (just one extra column in the existing answers SELECT). Indistinguishable from baseline.

## 9. Out of scope

Explicitly deferred to later rounds:

- **Review's confidence column** — needs migration 023 (`review_answers.confidence`) + `ConfidenceRow` wired into `ReviewEngine` + same SR modulation in Review `/complete`. Same shape as Quiz; deferred to Phase 2.
- **Boss / Exam confidence** — Boss + Exam don't drive SR. If we add confidence to them later it's for the clarifier signal, not SM-2.
- **Hebrew localization of indicator lines** — the rest of the dashboard already mixes languages; this is a small additional gap. Future i18n pass.
- **Per-question SR records** — moving SR from per-topic to per-question is a major refactor of `user_topic_mastery`. Out of scope; not on the queue.
- **Unit tests for the new helpers** — convention is to ship pure helpers without tests; add when a broader test push happens.
- **Confidence-driven UI on the topic detail page** ("you've been guessing on this topic — review more aggressively") — possible Tier-3 feature but out of this pilot.

## 10. CLAUDE.md updates after shipping

Once merged:

- Add to migrations ledger note: nothing new (migration 020 already shipped).
- Add a subsection to "What shipped" capturing this round's behavior, file pointers, and the four-cell grid as the canonical reference.
- Move "Phase 2 of confidence + clarifier" tier-3 line down — confidence-weighted SM-2 is the first chunk now done.

---

**End of spec.**
