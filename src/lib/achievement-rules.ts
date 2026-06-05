/**
 * Pure achievement-rules evaluator — the condition-based core behind
 * `awardSessionAchievements` (the DB shell in `achievements.ts`).
 *
 * No DB, no imports beyond types. Given the achievement catalogue, the user's
 * already-earned set, and a session-moment facts bag, it returns the ids of the
 * achievements that newly qualify. This is the test surface for the whole
 * predicate / scope / null-gating / random-chance logic that used to live
 * inline (and unreachable) inside the four `/complete` routes.
 *
 * See the Achievements section of CONTEXT.md (Achievement / Condition /
 * Award model / Surface scope) and issue #13.
 */

/** Session types that can complete and award achievements. */
export type SessionType = "quiz" | "boss" | "review" | "exam";

/**
 * The facts the evaluator reasons over. Session-moment facts (nullable when the
 * surface doesn't produce them) plus the global aggregate counts the shell
 * reads from the DB.
 */
export interface AchievementFacts {
  sessionType: SessionType;
  /** Session score 0–100. `null` when the surface has no clean correctness % (exam). */
  scorePct: number | null;
  /** Highest combo reached this session. `null` when the surface tracks none (review). */
  maxCombo: number | null;
  /** Wall-clock session duration. `null` when unknown. */
  sessionDurationMs: number | null;
  /** Streak after this session (unchanged current streak for exam). */
  newStreak: number;
  /** Episodes whose final topic was completed this session (drives course_completed). */
  completedEpisodeIds: string[];

  // ── Global aggregate counts the shell supplies ──────────────────────────────
  quizSessionsCompleted: number;
  examSessionsCompleted: number;
  coursesUploaded: number;
  masterTopicCount: number;
  bossFightsCompleted: number;
  reviewDays: number;
  perfectTodayCount: number;
  /** Whether every topic of each `completedEpisodeIds` episode is now complete. */
  allTopicsCompletedForCompletedEpisodes: boolean;
}

/** The fields of an `achievements` row the evaluator needs. */
export interface AchievementRow {
  id: string;
  condition_type: string;
  condition_value: number;
}

/**
 * Conditions whose progress is a clean current-vs-target ratio — the set the
 * profile's "Closest Trophies" ladder can draw a progress bar for. Single
 * source of truth: every type here is a counting case in `qualifies()` below,
 * and `trophy-progress.ts` consumes this set rather than re-listing them.
 *
 * Excluded by design: binary one-shots (`perfect_quiz`, `fast_quiz`,
 * `course_completed`, `perfect_day`), `combo_session` (no stored lifetime
 * best-combo aggregate to measure against), and the luck-based `random` drop
 * (progress toward chance would be a lie). See CONTEXT.md → Closest Trophies.
 */
export const COUNTABLE_CONDITIONS: ReadonlySet<string> = new Set<string>([
  "quiz_sessions_completed",
  "boss_fights_completed",
  "exam_sessions_completed",
  "review_days",
  "master_topics",
  "streak_days",
  "courses_uploaded",
]);

/** Conditions that only mean something on a quiz — never awarded elsewhere. */
const QUIZ_ONLY = new Set<string>(["perfect_quiz", "fast_quiz", "random"]);
/** Conditions earnable by completing a course via a quiz OR a boss fight. */
const QUIZ_OR_BOSS = new Set<string>(["course_completed"]);

/** Lucky-badge perfect-quiz drop chance (matches the legacy inline 5%). */
const RANDOM_DROP_CHANCE = 0.05;
const FAST_QUIZ_MAX_MS = 2 * 60 * 1000;

/** Whether a condition is evaluated at all on the given surface. */
function inScope(conditionType: string, sessionType: SessionType): boolean {
  if (QUIZ_ONLY.has(conditionType)) return sessionType === "quiz";
  if (QUIZ_OR_BOSS.has(conditionType)) {
    return sessionType === "quiz" || sessionType === "boss";
  }
  return true;
}

/**
 * Whether a single in-scope condition is met by the facts. A condition whose
 * required session-moment fact is `null` never qualifies (null-fact gating).
 */
function qualifies(
  row: AchievementRow,
  facts: AchievementFacts,
  rng: () => number,
): boolean {
  const { condition_type: type, condition_value: value } = row;
  const isPerfect = facts.scorePct !== null && facts.scorePct >= 100;

  switch (type) {
    case "quiz_sessions_completed":
      return facts.quizSessionsCompleted >= value;
    case "courses_uploaded":
      return facts.coursesUploaded >= value;
    case "streak_days":
      return facts.newStreak >= value;
    case "master_topics":
      return facts.masterTopicCount >= value;
    case "exam_sessions_completed":
      return facts.examSessionsCompleted >= value;
    case "boss_fights_completed":
      return facts.bossFightsCompleted >= value;
    case "review_days":
      return facts.reviewDays >= value;
    case "course_completed":
      return facts.allTopicsCompletedForCompletedEpisodes;
    case "perfect_quiz":
      return isPerfect;
    case "fast_quiz":
      return facts.sessionDurationMs !== null && facts.sessionDurationMs < FAST_QUIZ_MAX_MS;
    case "combo_session":
      return facts.maxCombo !== null && facts.maxCombo >= value;
    case "perfect_day":
      return isPerfect && facts.perfectTodayCount >= value;
    case "random":
      return isPerfect && rng() < RANDOM_DROP_CHANCE;
    default:
      return false;
  }
}

/**
 * Evaluate every applicable Condition after a session and return the ids of the
 * achievements that newly qualify. Pure and deterministic given `rng`.
 */
export function evaluateAchievements(
  rows: AchievementRow[],
  earnedIds: Set<string>,
  facts: AchievementFacts,
  rng: () => number = Math.random,
): string[] {
  const toAward: string[] = [];
  for (const row of rows) {
    if (earnedIds.has(row.id)) continue;
    if (!inScope(row.condition_type, facts.sessionType)) continue;
    if (qualifies(row, facts, rng)) toAward.push(row.id);
  }
  return toAward;
}
