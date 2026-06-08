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

/**
 * Verdict thresholds (chrome-level heuristics, tunable).
 *
 * `OVERCONFIDENT_THRESHOLD` — fraction of *confident* answers that were wrong
 * before we call the learner overconfident (their confidence isn't trustworthy).
 * `UNDERCONFIDENT_THRESHOLD` — fraction of *guessed* answers that were right
 * before we call them underconfident (they know more than they admit; lucky
 * guesses are really soft knowledge). The asymmetry is deliberate: a few wrong
 * "confident" answers is a real blind spot, but guesses landing right is only
 * notable past a coin-flip. Both tiers must clear `MIN_PER_TIER` to count.
 */
export const OVERCONFIDENT_THRESHOLD = 0.3;
export const UNDERCONFIDENT_THRESHOLD = 0.5;

/** A single answer's calibration inputs. `confidence === null` means unrated. */
export interface CalibrationAnswer {
  confidence: Confidence;
  /** AI/MCQ score in 0..1; correct when `>= CORRECT_THRESHOLD`. */
  score: number;
  topicId: string;
  topicTitle: string;
  /** Course the topic belongs to — lets the blind-spot drill-down link out. */
  courseId: string;
}

/** One topic's blind-spot tally — confident-but-wrong answers, with link parts. */
export interface StumbleTopic {
  topicId: string;
  topicTitle: string;
  courseId: string;
  /** Overconfident stumbles on this topic (confident + wrong). */
  count: number;
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

/**
 * The plain verdict, as a key (chrome maps it → copy). `null` during cold-start.
 * - `well-calibrated` — neither signal fires; confidence tracks reality.
 * - `overconfident` — confident answers miss too often (a trustworthy-feeling blind spot).
 * - `underconfident` — guesses land right too often (knows more than they admit).
 * - `mixed` — both signals fire at once.
 */
export type VerdictKey =
  | "well-calibrated"
  | "overconfident"
  | "underconfident"
  | "mixed";

export interface CalibrationView {
  /** Count of rated (non-NULL confidence) answers. */
  totalRated: number;
  state: "cold-start" | "ready";
  /** Always three entries, in [guessed, unsure, confident] order. */
  tiers: TierResult[];
  /**
   * Overconfident stumbles — confident but wrong (the costly blind spots).
   * `byTopic` is ranked descending by count, then a deterministic tie-break
   * (topic title, then id) so ordering is stable across input orderings.
   */
  overconfidentStumbles: { count: number; byTopic: StumbleTopic[] };
  /** Lucky guesses — guessed but right (soft knowledge, not mastery). */
  luckyGuesses: { count: number };
  /** Plain verdict key; `null` during cold-start (chrome hides the line). */
  verdict: VerdictKey | null;
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
  const state = totalRated >= MIN_RATED ? "ready" : "cold-start";

  // Named signals: confident-but-wrong and guessed-but-right.
  const overconfidentStumbles = {
    count: totals.confident.total - totals.confident.correct,
    byTopic: rankStumblesByTopic(answers),
  };
  const luckyGuesses = { count: totals.guessed.correct };

  return {
    totalRated,
    state,
    tiers,
    overconfidentStumbles,
    luckyGuesses,
    verdict: state === "cold-start" ? null : computeVerdict(totals),
  };
}

/**
 * Group the confident-but-wrong answers by topic and rank them descending by
 * stumble count, breaking ties deterministically by topic title then id — so
 * the drill-down order is stable no matter what order the rows arrive in.
 */
function rankStumblesByTopic(answers: CalibrationAnswer[]): StumbleTopic[] {
  const byId = new Map<string, StumbleTopic>();

  for (const a of answers) {
    if (a.confidence !== "confident" || a.score >= CORRECT_THRESHOLD) continue;
    const existing = byId.get(a.topicId);
    if (existing) {
      existing.count += 1;
    } else {
      byId.set(a.topicId, {
        topicId: a.topicId,
        topicTitle: a.topicTitle,
        courseId: a.courseId,
        count: 1,
      });
    }
  }

  return [...byId.values()].sort(
    (x, y) =>
      y.count - x.count ||
      x.topicTitle.localeCompare(y.topicTitle) ||
      x.topicId.localeCompare(y.topicId)
  );
}

/**
 * Map the per-tier totals to a verdict key. A signal only fires when its tier
 * has cleared `MIN_PER_TIER` rated answers — we never judge calibration off a
 * handful of answers, mirroring the bars' `lowData` rule.
 */
function computeVerdict(
  totals: Record<ConfidenceTier, { total: number; correct: number }>
): VerdictKey {
  const { confident, guessed } = totals;

  const overconfident =
    confident.total >= MIN_PER_TIER &&
    (confident.total - confident.correct) / confident.total >=
      OVERCONFIDENT_THRESHOLD;

  const underconfident =
    guessed.total >= MIN_PER_TIER &&
    guessed.correct / guessed.total >= UNDERCONFIDENT_THRESHOLD;

  if (overconfident && underconfident) return "mixed";
  if (overconfident) return "overconfident";
  if (underconfident) return "underconfident";
  return "well-calibrated";
}
