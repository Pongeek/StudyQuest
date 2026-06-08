/**
 * Pure "Truesight" calibration aggregation — how well a learner's self-reported
 * Confidence matches their measured correctness. See CONTEXT.md → Calibration.
 *
 * v1 reads quiz answers only (the only surface with a confidence column today),
 * but the input is a generic `{ confidence, score, topicId, topicTitle }[]` so
 * Phase 2 surfaces (Review / Boss / Exam) are purely additive — they contribute
 * more rows of the same shape with no rework here.
 *
 * Pure and deterministic. No DB, no AI. The Profile section component fetches
 * the rows, maps them to this shape, and renders the returned view model.
 *
 * Slice #32 scope: per-tier accuracy + cold-start gating. Signal chips
 * (Overconfident stumbles / Lucky guesses) and the verdict land in #33; the
 * blind-spot topic drill-down lands in #34 — they extend this view model.
 */

import { type Confidence } from "./spaced-repetition";

/** The three rated confidence levels (NULL = unrated, excluded everywhere). */
export type ConfidenceTier = "guessed" | "unsure" | "confident";

/**
 * One canonical definition of "correct", reusing the Grimoire's `< 0.5` fail
 * line so calibration agrees with the Grimoire and mastery everywhere.
 */
export const CORRECT_THRESHOLD = 0.5;

/** Rated answers needed before the section leaves cold-start. */
export const MIN_RATED = 20;

/** Rated answers needed in a single tier before its bar shows a percentage. */
export const MIN_PER_TIER = 5;

/** A single answer's calibration inputs. `confidence === null` means unrated. */
export interface CalibrationAnswer {
  confidence: Confidence;
  /** AI/MCQ score in 0..1; correct when `>= CORRECT_THRESHOLD`. */
  score: number;
  topicId: string;
  topicTitle: string;
}

/** Per-tier accuracy result, one per ConfidenceTier. */
export interface TierResult {
  confidence: ConfidenceTier;
  total: number;
  correct: number;
  /** Floored 0–100; 0 when `total === 0`. Ignore when `lowData`. */
  accuracyPct: number;
  /** True when `total < MIN_PER_TIER` — show "low data", not a percentage. */
  lowData: boolean;
}

export interface CalibrationView {
  /** Count of rated (non-NULL confidence) answers. */
  totalRated: number;
  state: "cold-start" | "ready";
  /** Always three entries, in [guessed, unsure, confident] order. */
  tiers: TierResult[];
}

/** Tier display/iteration order — guessed → unsure → confident. */
const TIER_ORDER: ConfidenceTier[] = ["guessed", "unsure", "confident"];

export function computeCalibration(
  answers: CalibrationAnswer[]
): CalibrationView {
  const totals: Record<ConfidenceTier, { total: number; correct: number }> = {
    guessed: { total: 0, correct: 0 },
    unsure: { total: 0, correct: 0 },
    confident: { total: 0, correct: 0 },
  };

  for (const a of answers) {
    if (a.confidence === null) continue; // unrated — excluded
    const bucket = totals[a.confidence];
    bucket.total += 1;
    if (a.score >= CORRECT_THRESHOLD) bucket.correct += 1;
  }

  const tiers: TierResult[] = TIER_ORDER.map((confidence) => {
    const { total, correct } = totals[confidence];
    return {
      confidence,
      total,
      correct,
      accuracyPct: total > 0 ? Math.floor((correct / total) * 100) : 0,
      lowData: total < MIN_PER_TIER,
    };
  });

  const totalRated = tiers.reduce((s, t) => s + t.total, 0);

  return {
    totalRated,
    state: totalRated >= MIN_RATED ? "ready" : "cold-start",
    tiers,
  };
}
