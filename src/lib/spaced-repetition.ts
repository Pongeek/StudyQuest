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
 * Confidence-weighted variant: both Quiz and Review /complete fold per-answer
 * confidence into a quality (see adjustQualityForConfidence + the 4-cell grid
 * documented in docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md),
 * average via computeConfidenceAdjustedQuality, and call
 * computeNextReviewFromQuality directly. Quiz folds across the whole session
 * (single topic); Review folds per-topic, undampened (see ADR-0001). The
 * legacy score-only computeNextReview(scorePct, ...) wrapper is retained for
 * callers that have no per-answer confidence to fold.
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

/** Fold a set of graded + self-rated answers into a single SM-2 quality
 *  (0..5). For each answer: base = aiScoreToQuality(ai_score), corrected by
 *  adjustQualityForConfidence, then the per-answer qualities are averaged and
 *  rounded. Used per-topic by Review /complete and session-wide for the
 *  confidence chip. Mirrors the fold Quiz /complete applies. */
export function computeConfidenceAdjustedQuality(
  answers: Array<{ ai_score: number; confidence: Confidence }>,
): number {
  if (answers.length === 0) return 0;
  const perAnswer = answers.map((a) => {
    const base = aiScoreToQuality(a.ai_score);
    const isCorrect = a.ai_score >= 0.7;
    return adjustQualityForConfidence(base, isCorrect, a.confidence);
  });
  return Math.round(perAnswer.reduce((s, q) => s + q, 0) / perAnswer.length);
}

/** Pick the highest-priority confidence signal in a session and return a
 *  Loremaster-voiced one-liner for the SessionDebrief chip. Returns null
 *  when no signal qualifies (all-unrated or all-unsure session).
 *
 *  Priority: overconfident-stumble > confident-mastery > lucky-win.
 *  confident-mastery requires `adjustedQuality > baseQuality` (strict) so
 *  the chip only fires when confidence STRICTLY moved the SR quality up.
 *  Equality means SM-2 produces the same schedule — saying "pushed deeper"
 *  in that case would lie. Catches both the perfect-session-no-headroom
 *  case and the confident-right + guessed-right offset case. */
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
    if (reviewCount === 0) {
      intervalDays = 1;
    } else if (reviewCount === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
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

/** Score-only convenience wrapper — schedules from a 0..100 percentage with
 *  no confidence fold. Retained for callers without per-answer confidence;
 *  Quiz and Review both fold confidence and call computeNextReviewFromQuality
 *  directly. Delegates through quality, so behavior matches the score-only
 *  path exactly. */
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

// ── Runes (Anki-style per-card drilling) ─────────────────────────────────────
// Rune ratings ARE SM-2 qualities — they feed computeNextReviewFromQuality
// directly: Again=1 (reset), Hard=3, Good=4, Easy=5.

/** Self-grade ratings on a rune card flip. */
export type RuneRating = 1 | 3 | 4 | 5;
/** XP per DUE card rated Hard/Good/Easy. Non-due (free-drill) reps earn 0 —
 *  dueness is time-gated by SM-2, which makes rune XP farm-proof. */
export const RUNE_XP_PER_DUE_CARD = 2;
/** Once-per-day bonus for clearing the entire due queue. */
export const RUNE_QUEUE_CLEAR_BONUS_XP = 15;
/** Max cards pulled into a single drill session (most-overdue-first). */
export const RUNE_SESSION_CAP = 30;
