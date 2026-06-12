/**
 * Smart Next Best Action
 *
 * Pure decision logic: given the dashboard's already-fetched data, return
 * a prioritized list of actions the student should consider RIGHT NOW.
 *
 * The widget at the top of the dashboard renders `actions[0]` by default,
 * with a "Show next →" link that walks down the list. Cycle behavior is
 * client-side state; this module is purely deterministic.
 *
 * Priority order (first match wins, then we keep walking and add more):
 *   S — must do today
 *     1. Any course with exam ≤7 days → drill weakest topic
 *     2. Streak save: streak ≥3, didn't study today, yesterday was last
 *        study day, local clock ≥6pm
 *   A — high leverage now
 *     3. Boss ready (any episode with all topics ≥1 mastery + boss not defeated)
 *     4. Review queue ≥5 ("review storm")
 *     5. Grimoire unsettled ≥5 ("demons gathering")
 *     6. Review queue 1–4 (normal SR nudge)
 *   B — steady progress
 *     7. Next recommendation from the curriculum-order quest board
 *
 * If nothing matches, returns []. Caller hides the widget.
 */

import type { StudyPlan } from "@/lib/study-plan";

export type ActionTier = "S" | "A" | "B";

export type ActionKind =
  | "exam-crunch"
  | "streak-save"
  | "boss-ready"
  | "review-storm"
  | "demon-pile"
  | "review-due"
  | "runes-due"
  | "next-quest";

export type ActionIcon =
  | "swords"
  | "flame"
  | "crown"
  | "brain"
  | "book"
  | "target"
  | "skull"
  | "gem";

/**
 * Time/date conditions that can only be evaluated on the CLIENT.
 * `pickNextBestActions` runs in the dashboard Server Component, so
 * `new Date()` there is the SERVER's clock (UTC on Vercel) — useless
 * for "is it after 6pm where the user is" decisions. Actions with a
 * `clientGate` are emitted by the server when the user-data
 * preconditions match, and the client component then hides them when
 * the local clock fails the gate.
 */
export type ClientGate = {
  /** Streak-save: needs both "after Nth hour local" AND "lastStudyDate
   *  is local-yesterday." Server can't compute either correctly without
   *  the user's tz, so it bundles both checks for the client. */
  type: "streak-save";
  /** 24-hour local clock threshold (e.g. 18 = 6pm). */
  hour: number;
  /** YYYY-MM-DD string of the user's most recent study day, from the DB
   *  column `users.last_study_date`. Stored without time zone; client
   *  treats it as a calendar date and compares to its own local
   *  yesterday. */
  lastStudyDate: string | null;
};

export interface NextBestAction {
  tier: ActionTier;
  kind: ActionKind;
  /** Short pixel-chip label. ALL CAPS for the pixel font rendering. */
  label: string;
  /** Big-text headline — the verb of the action. */
  headline: string;
  /** One short sentence on WHY this is the next move. */
  context: string;
  /** Destination URL when the CTA is tapped. */
  href: string;
  /** CTA button text. */
  ctaLabel: string;
  /** Lucide icon name; the component maps to <SwordsIcon /> etc. */
  iconName: ActionIcon;
  /** Optional client-side gate. NextBestActionCard hides actions whose
   *  gate doesn't pass under the user's local clock. */
  clientGate?: ClientGate;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface NextBestActionInput {
  studyPlans: StudyPlan[];
  reviewQueue: Array<{ topicId: string; topicTitle: string }>;
  grimoireCount: number;
  recommendations: Array<{
    topicId: string;
    topicTitle: string;
    courseId: string;
    courseName: string;
    masteryLevel: number;
  }>;
  /** Due rune cards across all courses (per-card SM-2 queue). */
  runesDueCount: number;
  /** From `users.current_streak` */
  streak: number;
  /** Did the user complete any study today? */
  studiedToday: boolean;
  /** Last study date as `YYYY-MM-DD` (or null if never studied). */
  lastStudyDate: string | null;
  /** Server-side `new Date()` — passed in so tests can pin the clock. */
  now: Date;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const STREAK_SAVE_MIN_STREAK = 3;
const STREAK_SAVE_HOUR = 18; // 6pm local
const EXAM_CRUNCH_DAYS = 7;
const REVIEW_STORM_THRESHOLD = 5;
const DEMON_PILE_THRESHOLD = 5;

// ── Decision function ────────────────────────────────────────────────────────

/**
 * Returns the ordered list of qualifying actions, highest priority first.
 *
 * Multiple actions can qualify simultaneously (e.g. exam in 5 days AND
 * 7 reviews due). The widget shows the top one but lets the user cycle.
 */
export function pickNextBestActions(input: NextBestActionInput): NextBestAction[] {
  const {
    studyPlans,
    reviewQueue,
    grimoireCount,
    recommendations,
    runesDueCount,
    streak,
    studiedToday,
    lastStudyDate,
    now,
  } = input;

  const actions: NextBestAction[] = [];

  // ── S1: Exam crunch ≤7 days ──────────────────────────────────────────────
  // Plans are pre-sorted by urgency (soonest first) in the dashboard, so
  // we trust ordering here. Only consider crunch / final-push / exam-day —
  // "steady" (8–14d) is not yet urgent enough for S-tier.
  const crunchPlan = studyPlans.find(
    (p) =>
      p.urgency === "exam-day" ||
      p.urgency === "final-push" ||
      p.urgency === "crunch"
  );
  if (crunchPlan && crunchPlan.daysUntilExam <= EXAM_CRUNCH_DAYS) {
    // The plan's first action is already the best move for today (lowest
    // mastery topic, in curriculum order). Reuse its href/copy.
    const firstAction = crunchPlan.actions[0];
    const days = crunchPlan.daysUntilExam;
    const examName = crunchPlan.examLabel || crunchPlan.courseTitle;
    if (firstAction?.kind === "study-topic" && firstAction.topicTitle) {
      actions.push({
        tier: "S",
        kind: "exam-crunch",
        label: days === 0 ? "EXAM DAY" : "FINAL CRUNCH",
        headline:
          days === 0
            ? `${examName} is TODAY`
            : `Drill ${firstAction.topicTitle}`,
        context:
          days === 0
            ? `Every minute counts. You've got this.`
            : `${days} day${days === 1 ? "" : "s"} to ${examName}. Weakest topic — hit it first.`,
        href: firstAction.href,
        ctaLabel: "START QUEST",
        iconName: "swords",
      });
    } else if (firstAction?.kind === "boss-fight" && firstAction.episodeTitle) {
      // Every topic is at target already — push the boss fight.
      actions.push({
        tier: "S",
        kind: "exam-crunch",
        label: "FINAL CRUNCH",
        headline: `Defeat the ${firstAction.episodeTitle} boss`,
        context: `${days} day${days === 1 ? "" : "s"} to ${examName}. All topics ready — prove it in the arena.`,
        href: firstAction.href,
        ctaLabel: "ENTER ARENA",
        iconName: "skull",
      });
    }
  }

  // ── S2: Streak save ──────────────────────────────────────────────────────
  // Server-side we ONLY check the user-data preconditions (streak ≥ N,
  // didn't study today). The "after 6pm local" check + "lastStudyDate is
  // local-yesterday" check can't be evaluated correctly from the server
  // clock (Vercel runs UTC; a UTC-late-evening server tick is a totally
  // different time-of-day per timezone). Both gates are deferred to the
  // client via `clientGate`. NextBestActionCard hides the action when
  // its gate fails under the user's actual local clock.
  if (streak >= STREAK_SAVE_MIN_STREAK && !studiedToday) {
    const fallbackHref =
      recommendations[0]
        ? `/dashboard/courses/${recommendations[0].courseId}/topics/${recommendations[0].topicId}`
        : reviewQueue.length > 0
        ? `/dashboard/review`
        : studyPlans[0]
        ? `/dashboard/courses/${studyPlans[0].courseId}`
        : `/dashboard`;
    actions.push({
      tier: "S",
      kind: "streak-save",
      label: "STREAK ON THE LINE",
      headline: `Keep your ${streak}-day streak alive`,
      context: `One quiz, about 5 minutes. The day's almost gone.`,
      href: fallbackHref,
      ctaLabel: "PROTECT STREAK",
      iconName: "flame",
      clientGate: {
        type: "streak-save",
        hour: STREAK_SAVE_HOUR,
        lastStudyDate,
      },
    });
  }

  // ── A1: Boss ready ───────────────────────────────────────────────────────
  // First plan with any boss-fight action (means an episode is fully ready
  // and not yet defeated). studyPlans only covers exam-set courses — that's
  // fine, the v1 limitation is acceptable for now.
  for (const plan of studyPlans) {
    const bossAction = plan.actions.find((a) => a.kind === "boss-fight");
    if (bossAction && bossAction.episodeTitle) {
      actions.push({
        tier: "A",
        kind: "boss-ready",
        label: "BOSS DORMANT",
        headline: `Defeat the ${bossAction.episodeTitle} boss`,
        context: `Every topic mastered. The arena waits.`,
        href: bossAction.href,
        ctaLabel: "ENTER ARENA",
        iconName: "skull",
      });
      break; // one boss-ready action per cycle is plenty
    }
  }

  // ── A2: Review storm (≥5 due) ────────────────────────────────────────────
  if (reviewQueue.length >= REVIEW_STORM_THRESHOLD) {
    actions.push({
      tier: "A",
      kind: "review-storm",
      label: "REVIEW STORM",
      headline: `${reviewQueue.length} reviews due`,
      context: `Spaced repetition compounds. Don't let the queue pile up.`,
      href: "/dashboard/review",
      ctaLabel: "BEGIN REVIEW",
      iconName: "brain",
    });
  }

  // ── A3: Demon pile (≥5 unsettled grimoire questions) ─────────────────────
  if (grimoireCount >= DEMON_PILE_THRESHOLD) {
    actions.push({
      tier: "A",
      kind: "demon-pile",
      label: "DEMONS GATHER",
      headline: `${grimoireCount} demons in the Grimoire`,
      context: `Questions you've missed two or more times. Settle the score.`,
      href: "/dashboard/grimoire",
      ctaLabel: "OPEN GRIMOIRE",
      iconName: "skull",
    });
  }

  // ── A4: Review queue 1–4 ─────────────────────────────────────────────────
  // Only emit if we haven't already pushed a review-storm action (avoid
  // two near-identical entries in the cycle list).
  const alreadyHaveReview = actions.some(
    (a) => a.kind === "review-storm" || a.kind === "demon-pile"
  );
  if (
    !alreadyHaveReview &&
    reviewQueue.length > 0 &&
    reviewQueue.length < REVIEW_STORM_THRESHOLD
  ) {
    const minutes = Math.max(5, reviewQueue.length * 2);
    actions.push({
      tier: "A",
      kind: "review-due",
      label: "REVIEW DUE",
      headline: `${reviewQueue.length} topic${reviewQueue.length === 1 ? "" : "s"} ready for review`,
      context: `~${minutes}m. Maintain the spacing — it's why it works.`,
      href: "/dashboard/review",
      ctaLabel: "BEGIN REVIEW",
      iconName: "brain",
    });
  }

  // ── A5: Runes due ────────────────────────────────────────────────────────
  // Per-card SM-2 queue (separate from the topic-level review queue). Sits
  // below review actions — review is AI-graded and heavier; runes are the
  // fast self-graded reps — and above the B-tier curriculum floor.
  if (runesDueCount > 0) {
    const minutes = Math.max(1, Math.round((runesDueCount * 10) / 60));
    actions.push({
      tier: "A",
      kind: "runes-due",
      label: "RUNES DUE",
      headline: `${runesDueCount} rune${runesDueCount === 1 ? "" : "s"} await`,
      context: `~${minutes}m of recall flips. Fast reps, honest ratings.`,
      href: "/dashboard/runes",
      ctaLabel: "DRILL RUNES",
      iconName: "gem",
    });
  }

  // ── B1: Next quest ───────────────────────────────────────────────────────
  // The floor — when nothing's on fire, the next-best action is just to
  // keep moving through the curriculum.
  if (recommendations.length > 0) {
    const r = recommendations[0];
    actions.push({
      tier: "B",
      kind: "next-quest",
      label: "TODAY'S QUEST",
      headline: `Study ${r.topicTitle}`,
      context: `${r.courseName}. Curriculum order — natural next step.`,
      href: `/dashboard/courses/${r.courseId}/topics/${r.topicId}`,
      ctaLabel: "BEGIN QUEST",
      iconName: "target",
    });
  }

  return actions;
}
