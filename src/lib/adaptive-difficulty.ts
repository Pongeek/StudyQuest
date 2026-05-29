/**
 * Adaptive difficulty — biases the question generator's `difficulty` anchor
 * based on the student's current mastery of the topic. Applied on
 * REGENERATION (single-question via the 🔄 button + bulk via the topic
 * regen route). NOT applied on initial extraction — no user data exists yet
 * at upload time.
 *
 * Rules (kept simple, easy to tune):
 *  - never attempted (`repetitions === 0` or no mastery row) → no change
 *  - mastered (`mastery_level >= 3`)                          → bump +1
 *  - struggling (`mastery_level <= 1` AND attempted)          → drop −1
 *  - in progress (`mastery_level === 2`)                       → no change
 *
 * Distinguishing "never attempted" from "tried once and failed" matters —
 * easing a topic the student has never seen would be confusing.
 *
 * Caller signs the mastery row off as `null` when no row exists.
 */

export type DifficultyAdjustment = "easier" | "harder" | "none";

export interface DifficultyMastery {
  /** From `user_topic_mastery.mastery_level` (0..4 in this project). */
  masteryLevel: number;
  /** From `user_topic_mastery.repetitions`. 0 means never attempted. */
  repetitions: number;
}

export interface DifficultyAdjustmentResult {
  difficulty: number;
  adjustment: DifficultyAdjustment;
}

export function adjustDifficultyForMastery(input: {
  baseDifficulty: number;
  mastery: DifficultyMastery | null;
}): DifficultyAdjustmentResult {
  const { baseDifficulty, mastery } = input;

  // Clamp the base to the canonical 1-5 range so a malformed source row
  // can't produce an out-of-band anchor.
  const base = Math.max(1, Math.min(5, baseDifficulty));

  if (!mastery || mastery.repetitions === 0) {
    return { difficulty: base, adjustment: "none" };
  }

  if (mastery.masteryLevel >= 3) {
    return { difficulty: Math.min(5, base + 1), adjustment: "harder" };
  }
  if (mastery.masteryLevel <= 1) {
    return { difficulty: Math.max(1, base - 1), adjustment: "easier" };
  }
  return { difficulty: base, adjustment: "none" };
}
