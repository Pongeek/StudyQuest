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
 */

export interface ReviewState {
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
}

export interface NextReviewResult extends ReviewState {
  nextReviewAt: Date;
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

export function computeNextReview(
  scorePct: number,
  current: ReviewState,
  now: Date = new Date()
): NextReviewResult {
  const quality = scoreToQuality(scorePct);
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
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    reviewCount += 1;
  }

  const nextReviewAt = new Date(now.getTime() + intervalDays * 86_400 * 1000);
  return { intervalDays, easeFactor, reviewCount, nextReviewAt };
}

/** XP earned per correct review answer. Smaller than a fresh quiz. */
export const REVIEW_XP_PER_CORRECT = 6;
/** Flat bonus XP for completing a full review session. */
export const REVIEW_SESSION_BONUS_XP = 25;
/** Maximum topics pulled into a single review session. */
export const MAX_TOPICS_PER_SESSION = 5;
/** Questions sampled per topic in a review session. */
export const QUESTIONS_PER_TOPIC = 2;
