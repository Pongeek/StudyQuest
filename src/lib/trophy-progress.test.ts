import { describe, it, expect } from "vitest";
import {
  computeClosestTrophies,
  type CountableTotals,
} from "./trophy-progress";
import { type AchievementRow } from "./achievement-rules";

/** A fully-zeroed totals bag; override only what a test cares about. */
function totals(overrides: Partial<CountableTotals> = {}): CountableTotals {
  return {
    quiz_sessions_completed: 0,
    boss_fights_completed: 0,
    exam_sessions_completed: 0,
    review_days: 0,
    master_topics: 0,
    streak_days: 0,
    courses_uploaded: 0,
    ...overrides,
  };
}

function row(
  id: string,
  condition_type: string,
  condition_value: number
): AchievementRow {
  return { id, condition_type, condition_value };
}

describe("computeClosestTrophies", () => {
  it("returns progress for a started, unearned countable trophy", () => {
    const rows = [row("boss10", "boss_fights_completed", 10)];
    const result = computeClosestTrophies(
      rows,
      new Set<string>(),
      totals({ boss_fights_completed: 8 })
    );

    expect(result).toEqual([
      { id: "boss10", current: 8, target: 10, pct: 80 },
    ]);
  });

  it("excludes already-earned trophies", () => {
    const rows = [row("boss10", "boss_fights_completed", 10)];
    const result = computeClosestTrophies(
      rows,
      new Set<string>(["boss10"]),
      totals({ boss_fights_completed: 8 })
    );

    expect(result).toEqual([]);
  });

  it("excludes non-countable conditions (one-shots, combo, luck)", () => {
    const rows = [
      row("perfect", "perfect_quiz", 1),
      row("fast", "fast_quiz", 1),
      row("course", "course_completed", 1),
      row("perfectDay", "perfect_day", 3),
      row("combo", "combo_session", 5),
      row("lucky", "random", 1),
    ];
    const result = computeClosestTrophies(rows, new Set<string>(), totals());

    expect(result).toEqual([]);
  });

  it("excludes trophies with zero progress (not yet started)", () => {
    const rows = [row("boss50", "boss_fights_completed", 50)];
    const result = computeClosestTrophies(
      rows,
      new Set<string>(),
      totals({ boss_fights_completed: 0 })
    );

    expect(result).toEqual([]);
  });

  it("excludes trophies already at or over target (about to be awarded)", () => {
    const rows = [
      row("boss10", "boss_fights_completed", 10),
      row("review5", "review_days", 5),
    ];
    const result = computeClosestTrophies(
      rows,
      new Set<string>(),
      totals({ boss_fights_completed: 10, review_days: 7 })
    );

    expect(result).toEqual([]);
  });

  it("ranks by percent complete, closest first", () => {
    const rows = [
      row("far", "quiz_sessions_completed", 100), // 30/100 = 30%
      row("near", "boss_fights_completed", 10), //   8/10  = 80%
      row("mid", "review_days", 10), //               5/10  = 50%
    ];
    const result = computeClosestTrophies(
      rows,
      new Set<string>(),
      totals({
        quiz_sessions_completed: 30,
        boss_fights_completed: 8,
        review_days: 5,
      })
    );

    expect(result.map((t) => t.id)).toEqual(["near", "mid", "far"]);
  });

  it("caps to the top 3 by default and honors an explicit limit", () => {
    const rows = [
      row("a", "quiz_sessions_completed", 100), // 90%
      row("b", "boss_fights_completed", 10), //    80%
      row("c", "review_days", 10), //              70%
      row("d", "exam_sessions_completed", 10), //  60%
    ];
    const t = totals({
      quiz_sessions_completed: 90,
      boss_fights_completed: 8,
      review_days: 7,
      exam_sessions_completed: 6,
    });

    expect(
      computeClosestTrophies(rows, new Set<string>(), t).map((x) => x.id)
    ).toEqual(["a", "b", "c"]);

    expect(
      computeClosestTrophies(rows, new Set<string>(), t, 2).map((x) => x.id)
    ).toEqual(["a", "b"]);
  });

  it("breaks pct ties by fewer remaining, then by id", () => {
    // Same 50% pct; 'few' has 5 remaining, 'many' has 50 — 'few' is closer.
    const rows = [
      row("many", "quiz_sessions_completed", 100), // 50/100, 50 remaining
      row("few", "boss_fights_completed", 10), //     5/10,   5 remaining
    ];
    const byRemaining = computeClosestTrophies(
      rows,
      new Set<string>(),
      totals({ quiz_sessions_completed: 50, boss_fights_completed: 5 })
    );
    expect(byRemaining.map((t) => t.id)).toEqual(["few", "many"]);

    // Same pct AND same remaining → stable, deterministic by id ascending.
    const tie = [
      row("zeta", "boss_fights_completed", 10), // 5/10, 5 remaining
      row("alpha", "review_days", 10), //          5/10, 5 remaining
    ];
    const byId = computeClosestTrophies(
      tie,
      new Set<string>(),
      totals({ boss_fights_completed: 5, review_days: 5 })
    );
    expect(byId.map((t) => t.id)).toEqual(["alpha", "zeta"]);
  });

  it("floors the percent for non-round ratios", () => {
    const rows = [row("third", "master_topics", 3)];
    const result = computeClosestTrophies(
      rows,
      new Set<string>(),
      totals({ master_topics: 1 })
    );

    expect(result).toEqual([{ id: "third", current: 1, target: 3, pct: 33 }]);
  });
});
