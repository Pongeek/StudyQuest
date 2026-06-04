/**
 * Streak update with freeze-token forgiveness.
 *
 * Called from quiz / boss / review complete routes. Replaces the
 * previous inline streak math (Math.max(longest, current) + 1).
 *
 * Mechanic:
 *  - Same-day study (gap === 0)         → no streak change
 *  - Day-after study  (gap === 1)       → streak += 1
 *  - Gap > 1 AND tokens >= missed_days  → BURN tokens, streak += 1
 *  - Gap > 1 AND tokens <  missed_days  → reset to 1 (tokens preserved)
 *  - First study ever (no last date)    → streak = 1
 *
 * Tokens earned: 1 every 7-day streak milestone, capped at MAX_FREEZE_TOKENS.
 * All-or-nothing burn: we don't partially eat into the token pool if the
 * gap exceeds what's available — fairer to the student.
 */

export const MAX_FREEZE_TOKENS = 3;
export const STREAK_MILESTONE_DAYS = 7;

// ── Streak Titles ──────────────────────────────────────────────────────────
// A streak-derived honorific (distinct from the level-derived Rank). Reflects
// how disciplined the learner is *right now*: it tracks the current streak and
// lapses on reset. See CONTEXT.md glossary.

export type StreakTitle =
  | "Disciplined"
  | "Relentless"
  | "Unbroken"
  | "Ascendant"
  | "Eternal";

export interface StreakTitleTier {
  title: StreakTitle;
  /** Consecutive-day threshold at which this title is earned. */
  days: number;
}

/** Ordered ascending by threshold. Single source of truth for the ladder. */
export const STREAK_TITLE_TIERS: StreakTitleTier[] = [
  { title: "Disciplined", days: 7 },
  { title: "Relentless", days: 14 },
  { title: "Unbroken", days: 30 },
  { title: "Ascendant", days: 60 },
  { title: "Eternal", days: 100 },
];

/**
 * Highest Streak Title reached by a given streak, or null below the first
 * threshold. Drives the hero-card chip.
 */
export function getStreakTitle(streak: number): StreakTitle | null {
  let earned: StreakTitle | null = null;
  for (const tier of STREAK_TITLE_TIERS) {
    if (streak >= tier.days) earned = tier.title;
  }
  return earned;
}

/**
 * The Streak Title newly earned when a streak advances from `prev` to `next`,
 * or null if no threshold was crossed. Returns the highest threshold in the
 * half-open range (prev, next], so a multi-day jump reports the top title
 * reached — it doesn't assume single-day increments.
 *
 * Drives the celebratory toast fired on session completion.
 */
export function getEarnedStreakTitle(
  prev: number,
  next: number,
): StreakTitleTier | null {
  let earned: StreakTitleTier | null = null;
  for (const tier of STREAK_TITLE_TIERS) {
    if (tier.days > prev && tier.days <= next) earned = tier;
  }
  return earned;
}

export type StreakAction =
  | "first-study"
  | "same-day"
  | "continued"
  | "frozen"
  | "reset";

export interface StreakUpdate {
  newStreak: number;
  newFreezeTokens: number;
  action: StreakAction;
  /** Tokens burned this update. 0 unless action === 'frozen'. */
  tokensUsed: number;
  /** True iff this update earned a NEW freeze token (newStreak crossed a 7-day boundary AND was below cap). */
  tokenEarned: boolean;
}

export interface StreakInput {
  /** users.current_streak before this update. */
  currentStreak: number;
  /** users.streak_freeze_tokens before this update. */
  freezeTokens: number;
  /** users.last_study_date (YYYY-MM-DD) or null on a brand-new account. */
  lastStudyDate: string | null;
  /** Today as YYYY-MM-DD. Caller's local date — caller decides timezone. */
  today: string;
}

function daysBetween(aIso: string, bIso: string): number {
  // Treat the YYYY-MM-DD strings as midnight UTC. Both inputs are already
  // calendar dates from the caller, so timezone has been resolved upstream.
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function computeStreakUpdate(input: StreakInput): StreakUpdate {
  const { currentStreak, freezeTokens, lastStudyDate, today } = input;

  // ── First study ever ───────────────────────────────────────────────────
  if (!lastStudyDate) {
    return {
      newStreak: 1,
      newFreezeTokens: freezeTokens,
      action: "first-study",
      tokensUsed: 0,
      tokenEarned: false,
    };
  }

  const gap = daysBetween(lastStudyDate, today);

  // ── Same-day study ────────────────────────────────────────────────────
  // Already studied today; no change. (last_study_date isn't bumped — it's
  // already today.)
  if (gap <= 0) {
    return {
      newStreak: currentStreak,
      newFreezeTokens: freezeTokens,
      action: "same-day",
      tokensUsed: 0,
      tokenEarned: false,
    };
  }

  // ── Day-after study ───────────────────────────────────────────────────
  if (gap === 1) {
    const newStreak = currentStreak + 1;
    const earned =
      newStreak > 0 &&
      newStreak % STREAK_MILESTONE_DAYS === 0 &&
      freezeTokens < MAX_FREEZE_TOKENS;
    return {
      newStreak,
      newFreezeTokens: earned ? freezeTokens + 1 : freezeTokens,
      action: "continued",
      tokensUsed: 0,
      tokenEarned: earned,
    };
  }

  // ── Gap > 1: try to bridge with freeze tokens ─────────────────────────
  const missedDays = gap - 1;

  if (freezeTokens >= missedDays) {
    const tokensRemaining = freezeTokens - missedDays;
    const newStreak = currentStreak + 1;
    const earned =
      newStreak > 0 &&
      newStreak % STREAK_MILESTONE_DAYS === 0 &&
      tokensRemaining < MAX_FREEZE_TOKENS;
    return {
      newStreak,
      newFreezeTokens: earned ? tokensRemaining + 1 : tokensRemaining,
      action: "frozen",
      tokensUsed: missedDays,
      tokenEarned: earned,
    };
  }

  // ── Couldn't bridge — reset. Tokens stay (no partial burn). ───────────
  return {
    newStreak: 1,
    newFreezeTokens: freezeTokens,
    action: "reset",
    tokensUsed: 0,
    tokenEarned: false,
  };
}
