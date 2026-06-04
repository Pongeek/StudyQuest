import { describe, it, expect } from "vitest";
import {
  evaluateAchievements,
  type AchievementFacts,
  type AchievementRow,
} from "./achievement-rules";

/** A fully-zeroed quiz-session facts bag; override only what a test cares about. */
function facts(overrides: Partial<AchievementFacts> = {}): AchievementFacts {
  return {
    sessionType: "quiz",
    scorePct: 0,
    maxCombo: 0,
    sessionDurationMs: 999_999,
    newStreak: 0,
    completedEpisodeIds: [],
    quizSessionsCompleted: 0,
    examSessionsCompleted: 0,
    coursesUploaded: 0,
    masterTopicCount: 0,
    bossFightsCompleted: 0,
    reviewDays: 0,
    perfectTodayCount: 0,
    allTopicsCompletedForCompletedEpisodes: false,
    ...overrides,
  };
}

function row(condition_type: string, condition_value = 1): AchievementRow {
  return { id: "a1", condition_type, condition_value };
}

/** Evaluate a single achievement row against a facts bag. */
function evalOne(
  r: AchievementRow,
  f: AchievementFacts,
  rng?: () => number,
): string[] {
  return evaluateAchievements([r], new Set<string>(), f, rng);
}

describe("evaluateAchievements — threshold-count predicates (any-surface)", () => {
  it.each([
    ["quiz_sessions_completed", "quizSessionsCompleted"],
    ["courses_uploaded", "coursesUploaded"],
    ["master_topics", "masterTopicCount"],
    ["exam_sessions_completed", "examSessionsCompleted"],
    ["boss_fights_completed", "bossFightsCompleted"],
    ["review_days", "reviewDays"],
  ] as const)(
    "%s qualifies at the threshold and not below it",
    (conditionType, factKey) => {
      expect(evalOne(row(conditionType, 5), facts({ [factKey]: 5 }))).toEqual(["a1"]);
      expect(evalOne(row(conditionType, 5), facts({ [factKey]: 4 }))).toEqual([]);
    },
  );

  it("streak_days qualifies at/above the threshold streak", () => {
    expect(evalOne(row("streak_days", 7), facts({ newStreak: 7 }))).toEqual(["a1"]);
    expect(evalOne(row("streak_days", 7), facts({ newStreak: 8 }))).toEqual(["a1"]);
    expect(evalOne(row("streak_days", 7), facts({ newStreak: 6 }))).toEqual([]);
  });

  it("perfect_day needs a perfect score AND the daily perfect count", () => {
    expect(
      evalOne(row("perfect_day", 3), facts({ scorePct: 100, perfectTodayCount: 3 })),
    ).toEqual(["a1"]);
    expect(
      evalOne(row("perfect_day", 3), facts({ scorePct: 100, perfectTodayCount: 2 })),
    ).toEqual([]);
    expect(
      evalOne(row("perfect_day", 3), facts({ scorePct: 99, perfectTodayCount: 9 })),
    ).toEqual([]);
  });

  it("combo_session qualifies when maxCombo meets the threshold", () => {
    expect(evalOne(row("combo_session", 5), facts({ maxCombo: 5 }))).toEqual(["a1"]);
    expect(evalOne(row("combo_session", 5), facts({ maxCombo: 4 }))).toEqual([]);
  });
});

describe("evaluateAchievements — quiz-flavored predicates", () => {
  it("perfect_quiz qualifies only at 100%", () => {
    expect(evalOne(row("perfect_quiz"), facts({ scorePct: 100 }))).toEqual(["a1"]);
    expect(evalOne(row("perfect_quiz"), facts({ scorePct: 99 }))).toEqual([]);
  });

  it("fast_quiz qualifies under two minutes", () => {
    expect(evalOne(row("fast_quiz"), facts({ sessionDurationMs: 119_999 }))).toEqual(["a1"]);
    expect(evalOne(row("fast_quiz"), facts({ sessionDurationMs: 120_000 }))).toEqual([]);
  });

  it("course_completed follows the all-topics-complete flag", () => {
    expect(
      evalOne(row("course_completed"), facts({ allTopicsCompletedForCompletedEpisodes: true })),
    ).toEqual(["a1"]);
    expect(
      evalOne(row("course_completed"), facts({ allTopicsCompletedForCompletedEpisodes: false })),
    ).toEqual([]);
  });
});

describe("evaluateAchievements — surface scope", () => {
  it("perfect_quiz is quiz-only (not awarded on a boss fight)", () => {
    expect(evalOne(row("perfect_quiz"), facts({ sessionType: "boss", scorePct: 100 }))).toEqual([]);
    expect(evalOne(row("perfect_quiz"), facts({ sessionType: "quiz", scorePct: 100 }))).toEqual(["a1"]);
  });

  it("fast_quiz and random are quiz-only", () => {
    expect(evalOne(row("fast_quiz"), facts({ sessionType: "boss", sessionDurationMs: 1000 }))).toEqual([]);
    expect(
      evalOne(row("random"), facts({ sessionType: "boss", scorePct: 100 }), () => 0.01),
    ).toEqual([]);
  });

  it("course_completed is quiz-or-boss but not review/exam", () => {
    const f = { allTopicsCompletedForCompletedEpisodes: true };
    expect(evalOne(row("course_completed"), facts({ ...f, sessionType: "boss" }))).toEqual(["a1"]);
    expect(evalOne(row("course_completed"), facts({ ...f, sessionType: "review" }))).toEqual([]);
    expect(evalOne(row("course_completed"), facts({ ...f, sessionType: "exam" }))).toEqual([]);
  });

  it("cross-surface conditions fire on any surface", () => {
    expect(evalOne(row("streak_days", 7), facts({ sessionType: "boss", newStreak: 7 }))).toEqual(["a1"]);
    expect(evalOne(row("combo_session", 5), facts({ sessionType: "exam", maxCombo: 5 }))).toEqual(["a1"]);
    expect(evalOne(row("review_days", 3), facts({ sessionType: "review", reviewDays: 3 }))).toEqual(["a1"]);
  });
});

describe("evaluateAchievements — null-fact gating", () => {
  it("does not award when the required fact is null", () => {
    expect(evalOne(row("combo_session", 1), facts({ maxCombo: null }))).toEqual([]);
    expect(evalOne(row("perfect_quiz"), facts({ scorePct: null }))).toEqual([]);
    expect(evalOne(row("perfect_day", 1), facts({ scorePct: null, perfectTodayCount: 9 }))).toEqual([]);
    expect(evalOne(row("fast_quiz"), facts({ sessionDurationMs: null }))).toEqual([]);
    expect(evalOne(row("random"), facts({ scorePct: null }), () => 0.01)).toEqual([]);
  });
});

describe("evaluateAchievements — random (injectable rng)", () => {
  it("awards on a perfect quiz when rng is below the 5% gate", () => {
    expect(evalOne(row("random"), facts({ scorePct: 100 }), () => 0.01)).toEqual(["a1"]);
  });

  it("does not award when rng is above the gate", () => {
    expect(evalOne(row("random"), facts({ scorePct: 100 }), () => 0.99)).toEqual([]);
  });

  it("does not award without a perfect score even when rng passes", () => {
    expect(evalOne(row("random"), facts({ scorePct: 99 }), () => 0.01)).toEqual([]);
  });
});

describe("evaluateAchievements — earned-skip and multi-row", () => {
  it("skips achievements the user already earned", () => {
    const earned = new Set<string>(["a1"]);
    expect(
      evaluateAchievements([row("streak_days", 7)], earned, facts({ newStreak: 30 })),
    ).toEqual([]);
  });

  it("returns every qualifying row id and omits the rest", () => {
    const rows: AchievementRow[] = [
      { id: "streak", condition_type: "streak_days", condition_value: 7 },
      { id: "combo", condition_type: "combo_session", condition_value: 5 },
      { id: "perfect", condition_type: "perfect_quiz", condition_value: 1 },
      { id: "masters", condition_type: "master_topics", condition_value: 99 },
    ];
    const result = evaluateAchievements(
      rows,
      new Set<string>(),
      facts({ newStreak: 7, maxCombo: 5, scorePct: 100, masterTopicCount: 1 }),
    );
    expect(result).toEqual(["streak", "combo", "perfect"]);
  });
});
