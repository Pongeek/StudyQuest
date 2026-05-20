/**
 * Study plan generator
 *
 * Given a course with an exam date and a snapshot of the user's progress,
 * computes:
 *   - days until the exam
 *   - an urgency tier (used for color coding + copy)
 *   - today's recommended actions (topics to study, reviews due, bosses to slay)
 *
 * Pure functions only — no DB, no AI. The caller pulls the data, this module
 * decides the daily plan.
 */

export type UrgencyTier = "calm" | "steady" | "crunch" | "final-push" | "exam-day" | "past";

export interface StudyPlanTopic {
  topicId: string;
  topicTitle: string;
  episodeId: string;
  episodeTitle: string;
  /** 0-5 — 0 means untouched, 5 means Master tier */
  masteryLevel: number;
  /** Cosmetic ordering hint from the curriculum */
  orderIndex: number;
}

export interface StudyPlanEpisode {
  episodeId: string;
  episodeTitle: string;
  /** All topics in this episode are at mastery_level >= 1 (boss unlocked) */
  bossUnlocked: boolean;
  /** Has the user already won this boss fight? */
  bossDefeated: boolean;
}

export interface StudyPlanInput {
  courseId: string;
  courseTitle: string;
  examDate: Date;
  examLabel: string | null;
  /** All non-locked topics in the course, regardless of mastery */
  allTopics: StudyPlanTopic[];
  /** All episodes in the course with their boss status */
  episodes: StudyPlanEpisode[];
  /** Topics with a `next_review_at <= today` in user_topic_mastery */
  dueReviewTopicIds: string[];
  /** Today's date — passed in for deterministic testing. */
  today: Date;
}

export type StudyPlanActionKind =
  | "study-topic"
  | "review"
  | "boss-fight";

export interface StudyPlanAction {
  kind: StudyPlanActionKind;
  topicId?: string;
  topicTitle?: string;
  episodeId?: string;
  episodeTitle?: string;
  /** Estimated minutes to complete this action — feeds the daily-time estimate */
  estimatedMinutes: number;
  /** Pre-built URL the dashboard widget links to */
  href: string;
}

export interface StudyPlan {
  courseId: string;
  courseTitle: string;
  examLabel: string | null;
  examDate: Date;
  daysUntilExam: number;
  urgency: UrgencyTier;
  /** Friendly headline for the widget */
  headline: string;
  /** Total topics still below "comfortable" mastery (level < 3) */
  topicsStillToMaster: number;
  /** Ideal pace given days remaining */
  topicsPerDayRecommended: number;
  /** Today's actionable list */
  actions: StudyPlanAction[];
  /** Total estimated minutes for today's actions */
  estimatedTotalMinutes: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MASTERY_TARGET = 3; // "Adept" — comfortable but not perfectionist
const MIN_TOPICS_PER_DAY = 1;
const MAX_TOPICS_PER_DAY = 4;
const MINUTES_PER_TOPIC_STUDY = 20;
const MINUTES_PER_REVIEW = 8;
const MINUTES_PER_BOSS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const aMidnight = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bMidnight = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bMidnight - aMidnight) / msPerDay);
}

function tierForDaysRemaining(days: number): UrgencyTier {
  if (days < 0) return "past";
  if (days === 0) return "exam-day";
  if (days <= 3) return "final-push";
  if (days <= 7) return "crunch";
  if (days <= 14) return "steady";
  return "calm";
}

function headlineForTier(tier: UrgencyTier, days: number, label: string | null): string {
  const exam = label || "your exam";
  switch (tier) {
    case "exam-day":
      return `${exam} is TODAY. You've got this.`;
    case "final-push":
      return `${days} day${days === 1 ? "" : "s"} until ${exam} — final push.`;
    case "crunch":
      return `${days} days until ${exam} — crunch time.`;
    case "steady":
      return `${days} days until ${exam}. Stay consistent.`;
    case "calm":
      return `${days} days until ${exam}. Plenty of time — build the habit.`;
    case "past":
      return `${exam} was ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`;
  }
}

/**
 * Pick the most-impactful topics to study today. Prefers untouched topics
 * (mastery 0) over partially-touched (1-2). Within each tier, follows the
 * curriculum's order so prerequisites are studied first.
 */
function pickTopicsForToday(
  allTopics: StudyPlanTopic[],
  count: number
): StudyPlanTopic[] {
  // Topics that haven't reached the target mastery yet.
  const needsWork = allTopics.filter((t) => t.masteryLevel < MASTERY_TARGET);
  if (needsWork.length === 0) return [];

  // Sort: lowest mastery first, then by curriculum order.
  const sorted = [...needsWork].sort((a, b) => {
    if (a.masteryLevel !== b.masteryLevel) return a.masteryLevel - b.masteryLevel;
    return a.orderIndex - b.orderIndex;
  });

  return sorted.slice(0, count);
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function generateStudyPlan(input: StudyPlanInput): StudyPlan {
  const {
    courseId,
    courseTitle,
    examDate,
    examLabel,
    allTopics,
    episodes,
    dueReviewTopicIds,
    today,
  } = input;

  const days = daysBetween(today, examDate);
  const urgency = tierForDaysRemaining(days);
  const headline = headlineForTier(urgency, days, examLabel);

  const topicsStillToMaster = allTopics.filter(
    (t) => t.masteryLevel < MASTERY_TARGET
  ).length;

  // Pace: how many topics should I study per day to hit the target?
  // Clamped to MIN..MAX so it stays realistic even with wild date ranges.
  const effectiveDays = Math.max(days, 1);
  const topicsPerDayRecommended = Math.min(
    MAX_TOPICS_PER_DAY,
    Math.max(MIN_TOPICS_PER_DAY, Math.ceil(topicsStillToMaster / effectiveDays))
  );

  // Build today's action list.
  const actions: StudyPlanAction[] = [];

  // 1) Studying — pick today's topics
  const topicsToday = pickTopicsForToday(allTopics, topicsPerDayRecommended);
  for (const t of topicsToday) {
    actions.push({
      kind: "study-topic",
      topicId: t.topicId,
      topicTitle: t.topicTitle,
      episodeId: t.episodeId,
      episodeTitle: t.episodeTitle,
      estimatedMinutes: MINUTES_PER_TOPIC_STUDY,
      href: `/dashboard/courses/${courseId}/topics/${t.topicId}`,
    });
  }

  // 2) Reviews — if any topic in this course is due, add ONE review session.
  //    The review picker on the review page will choose specific topics; we
  //    just signal that a review session is worth doing today.
  const reviewsDueInCourse = dueReviewTopicIds.filter((id) =>
    allTopics.some((t) => t.topicId === id)
  );
  if (reviewsDueInCourse.length > 0) {
    actions.push({
      kind: "review",
      estimatedMinutes: MINUTES_PER_REVIEW,
      href: `/dashboard/review`,
    });
  }

  // 3) Boss fights — if any episode has all topics at level ≥ 1 and the boss
  //    isn't defeated yet, queue ONE boss fight today (the first eligible).
  const eligibleBoss = episodes.find((ep) => ep.bossUnlocked && !ep.bossDefeated);
  if (eligibleBoss) {
    actions.push({
      kind: "boss-fight",
      episodeId: eligibleBoss.episodeId,
      episodeTitle: eligibleBoss.episodeTitle,
      estimatedMinutes: MINUTES_PER_BOSS,
      href: `/dashboard/courses/${courseId}/boss/prep/${eligibleBoss.episodeId}`,
    });
  }

  const estimatedTotalMinutes = actions.reduce(
    (sum, a) => sum + a.estimatedMinutes,
    0
  );

  return {
    courseId,
    courseTitle,
    examLabel,
    examDate,
    daysUntilExam: days,
    urgency,
    headline,
    topicsStillToMaster,
    topicsPerDayRecommended,
    actions,
    estimatedTotalMinutes,
  };
}
