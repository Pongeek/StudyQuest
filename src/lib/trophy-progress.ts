/**
 * Pure "Closest Trophies" computation — the forward-looking ladder on the
 * profile Overview. Given the achievement catalogue, the user's earned set, and
 * the learner's current countable totals, it returns the nearest *unearned*,
 * *started-but-unfinished* countable Achievements ranked by progress.
 *
 * Pure and deterministic. The countable-condition vocabulary lives in
 * `achievement-rules.ts` (COUNTABLE_CONDITIONS) — this module consumes it so
 * there is one source of truth for which Conditions are progressable.
 *
 * See CONTEXT.md → Closest Trophies for the domain definition.
 */

import { COUNTABLE_CONDITIONS, type AchievementRow } from "./achievement-rules";

/**
 * The learner's current value for each countable Condition. Keys are exactly
 * the members of COUNTABLE_CONDITIONS, so a row's `condition_type` indexes
 * straight into this bag.
 */
export interface CountableTotals {
  quiz_sessions_completed: number;
  boss_fights_completed: number;
  exam_sessions_completed: number;
  review_days: number;
  master_topics: number;
  streak_days: number;
  courses_uploaded: number;
}

/** One rung of the ladder: how far along an unearned countable trophy is. */
export interface TrophyProgress {
  id: string;
  /** Current value, clamped to `target`. */
  current: number;
  /** The Condition's target (`condition_value`). */
  target: number;
  /** Floored percent complete, 0–100. */
  pct: number;
}

export function computeClosestTrophies(
  rows: AchievementRow[],
  earnedIds: Set<string>,
  totals: CountableTotals,
  limit = 3
): TrophyProgress[] {
  const progress: TrophyProgress[] = [];

  for (const r of rows) {
    if (earnedIds.has(r.id)) continue;
    if (!COUNTABLE_CONDITIONS.has(r.condition_type)) continue;

    const target = r.condition_value;
    const current = Math.min(totals[r.condition_type as keyof CountableTotals], target);

    // Only trophies that are *in flight* belong on the chase ladder: started
    // (D2: current > 0) but not yet complete (D1: current < target — a finished-
    // but-unearned trophy is a transient state that pops on the next session).
    if (current <= 0 || current >= target) continue;

    const pct = Math.floor((current / target) * 100);

    progress.push({ id: r.id, current, target, pct });
  }

  // Closest first: highest pct, then fewest absolute remaining, then id for a
  // fully deterministic order (D3).
  progress.sort(
    (a, b) =>
      b.pct - a.pct ||
      (a.target - a.current) - (b.target - b.current) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  return progress.slice(0, limit);
}
