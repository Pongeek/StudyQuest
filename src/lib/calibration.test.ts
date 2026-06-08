import { describe, it, expect } from "vitest";
import {
  computeCalibration,
  CORRECT_THRESHOLD,
  MIN_RATED,
  MIN_PER_TIER,
  type CalibrationAnswer,
  type ConfidenceTier,
} from "./calibration";
import { type Confidence } from "./spaced-repetition";

/** Build one answer row; defaults make a rated, correct, single-topic answer. */
function ans(
  confidence: Confidence,
  score: number,
  topicId = "t1",
  topicTitle = "Topic 1"
): CalibrationAnswer {
  return { confidence, score, topicId, topicTitle };
}

/** N copies of the same answer — handy for crossing the gating thresholds. */
function repeat(n: number, a: CalibrationAnswer): CalibrationAnswer[] {
  return Array.from({ length: n }, () => ({ ...a }));
}

const TIER_ORDER: ConfidenceTier[] = ["guessed", "unsure", "confident"];

function tier(answers: CalibrationAnswer[], which: ConfidenceTier) {
  return computeCalibration(answers).tiers.find((t) => t.confidence === which)!;
}

describe("computeCalibration", () => {
  it("returns all three tiers in a stable order, even with no data", () => {
    const view = computeCalibration([]);
    expect(view.tiers.map((t) => t.confidence)).toEqual(TIER_ORDER);
  });

  it("treats empty input as cold-start with zeroed tiers", () => {
    const view = computeCalibration([]);
    expect(view.totalRated).toBe(0);
    expect(view.state).toBe("cold-start");
    for (const t of view.tiers) {
      expect(t).toMatchObject({ total: 0, correct: 0, accuracyPct: 0, lowData: true });
    }
  });

  it("excludes NULL-confidence (unrated) answers from totals and tiers", () => {
    const view = computeCalibration([
      ans(null, 1),
      ans(null, 0),
      ans("confident", 1),
    ]);
    expect(view.totalRated).toBe(1);
    expect(view.tiers.find((t) => t.confidence === "confident")!.total).toBe(1);
  });

  it("counts an answer as correct when score >= CORRECT_THRESHOLD", () => {
    // CORRECT_THRESHOLD is the Grimoire's canonical 0.5 line.
    expect(CORRECT_THRESHOLD).toBe(0.5);
    const t = tier(
      [
        ans("confident", CORRECT_THRESHOLD), // exactly at the line → correct
        ans("confident", CORRECT_THRESHOLD - 0.01), // just under → wrong
      ],
      "confident"
    );
    expect(t.total).toBe(2);
    expect(t.correct).toBe(1);
  });

  it("computes per-tier accuracy and floors the percent", () => {
    // 2 of 3 correct → 66.66.. → floored 66
    const t = tier(
      [ans("unsure", 1), ans("unsure", 0.9), ans("unsure", 0.2)],
      "unsure"
    );
    expect(t.total).toBe(3);
    expect(t.correct).toBe(2);
    expect(t.accuracyPct).toBe(66);
  });

  it("partitions answers into the right tier", () => {
    const view = computeCalibration([
      ans("guessed", 1),
      ans("guessed", 0),
      ans("unsure", 1),
      ans("confident", 1),
      ans("confident", 1),
      ans("confident", 0),
    ]);
    expect(view.tiers.find((t) => t.confidence === "guessed")).toMatchObject({
      total: 2,
      correct: 1,
    });
    expect(view.tiers.find((t) => t.confidence === "unsure")).toMatchObject({
      total: 1,
      correct: 1,
    });
    expect(view.tiers.find((t) => t.confidence === "confident")).toMatchObject({
      total: 3,
      correct: 2,
    });
  });

  it("flags a tier with fewer than MIN_PER_TIER rated answers as lowData", () => {
    const below = tier(repeat(MIN_PER_TIER - 1, ans("guessed", 1)), "guessed");
    expect(below.lowData).toBe(true);
  });

  it("does not flag a tier at or above MIN_PER_TIER as lowData", () => {
    const at = tier(repeat(MIN_PER_TIER, ans("guessed", 1)), "guessed");
    expect(at.lowData).toBe(false);
  });

  it("stays cold-start below MIN_RATED rated answers", () => {
    const view = computeCalibration(repeat(MIN_RATED - 1, ans("confident", 1)));
    expect(view.totalRated).toBe(MIN_RATED - 1);
    expect(view.state).toBe("cold-start");
  });

  it("flips to ready at exactly MIN_RATED rated answers", () => {
    const view = computeCalibration(repeat(MIN_RATED, ans("confident", 1)));
    expect(view.totalRated).toBe(MIN_RATED);
    expect(view.state).toBe("ready");
  });

  it("counts only rated answers toward the cold-start threshold", () => {
    // MIN_RATED rated + a pile of unrated → still ready, totalRated == MIN_RATED.
    const view = computeCalibration([
      ...repeat(MIN_RATED, ans("confident", 1)),
      ...repeat(50, ans(null, 1)),
    ]);
    expect(view.totalRated).toBe(MIN_RATED);
    expect(view.state).toBe("ready");
  });
});
