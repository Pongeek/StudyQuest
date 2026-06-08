import { describe, it, expect } from "vitest";
import {
  computeCalibration,
  CORRECT_THRESHOLD,
  MIN_RATED,
  MIN_PER_TIER,
  OVERCONFIDENT_THRESHOLD,
  UNDERCONFIDENT_THRESHOLD,
  type CalibrationAnswer,
  type ConfidenceTier,
} from "./calibration";
import { type Confidence } from "./spaced-repetition";

/** Build one answer row; defaults make a rated, correct, single-topic answer. */
function ans(
  confidence: Confidence,
  score: number,
  topicId = "t1",
  topicTitle = "Topic 1",
  courseId = "c1"
): CalibrationAnswer {
  return { confidence, score, topicId, topicTitle, courseId };
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

describe("computeCalibration — signal counts", () => {
  it("counts Overconfident stumbles (confident + wrong)", () => {
    const view = computeCalibration([
      ans("confident", 0), // stumble
      ans("confident", 0.2), // stumble
      ans("confident", 1), // confident + right — not a stumble
      ans("unsure", 0), // unsure + wrong — not a stumble
      ans("guessed", 0), // guessed + wrong — not a stumble
    ]);
    expect(view.overconfidentStumbles.count).toBe(2);
  });

  it("counts Lucky guesses (guessed + right)", () => {
    const view = computeCalibration([
      ans("guessed", 1), // lucky guess
      ans("guessed", 0.5), // exactly at the line → right → lucky guess
      ans("guessed", 0), // guessed + wrong — not lucky
      ans("confident", 1), // confident + right — not a guess
      ans("unsure", 1), // unsure + right — not a guess
    ]);
    expect(view.luckyGuesses.count).toBe(2);
  });

  it("reports zero signal counts for empty input", () => {
    const view = computeCalibration([]);
    expect(view.overconfidentStumbles.count).toBe(0);
    expect(view.luckyGuesses.count).toBe(0);
  });
});

describe("computeCalibration — overconfident stumbles byTopic", () => {
  it("groups stumbles by topic, carrying course id and title for linking", () => {
    const { byTopic } = computeCalibration([
      ans("confident", 0, "tA", "Alpha", "cA"), // stumble
      ans("confident", 0.2, "tA", "Alpha", "cA"), // stumble
      ans("confident", 1, "tA", "Alpha", "cA"), // confident + right — excluded
    ]).overconfidentStumbles;

    expect(byTopic).toEqual([
      { topicId: "tA", topicTitle: "Alpha", courseId: "cA", count: 2 },
    ]);
  });

  it("excludes non-stumbles (right answers, and unsure/guessed wrongs) from byTopic", () => {
    const { byTopic } = computeCalibration([
      ans("confident", 1, "tA", "Alpha"), // confident + right
      ans("unsure", 0, "tA", "Alpha"), // unsure + wrong
      ans("guessed", 0, "tA", "Alpha"), // guessed + wrong
    ]).overconfidentStumbles;

    expect(byTopic).toEqual([]);
  });

  it("ranks topics descending by stumble count", () => {
    const { byTopic } = computeCalibration([
      ...repeat(1, ans("confident", 0, "tA", "Alpha")),
      ...repeat(3, ans("confident", 0, "tB", "Beta")),
      ...repeat(2, ans("confident", 0, "tC", "Gamma")),
    ]).overconfidentStumbles;

    expect(byTopic.map((t) => t.topicId)).toEqual(["tB", "tC", "tA"]);
    expect(byTopic.map((t) => t.count)).toEqual([3, 2, 1]);
  });

  it("breaks count ties deterministically and stably regardless of input order", () => {
    // Beta and Alpha both have 2 stumbles; Gamma has 3. Feed them shuffled.
    const answers = [
      ans("confident", 0, "tB", "Beta"),
      ans("confident", 0, "tC", "Gamma"),
      ans("confident", 0, "tA", "Alpha"),
      ans("confident", 0, "tB", "Beta"),
      ans("confident", 0, "tA", "Alpha"),
      ans("confident", 0, "tC", "Gamma"),
      ans("confident", 0, "tC", "Gamma"),
    ];
    const first = computeCalibration(answers).overconfidentStumbles.byTopic;
    const reversed = computeCalibration([...answers].reverse())
      .overconfidentStumbles.byTopic;

    // Gamma(3) first; the Alpha/Beta tie resolves the same way both runs.
    expect(first.map((t) => t.topicTitle)).toEqual(["Gamma", "Alpha", "Beta"]);
    expect(reversed).toEqual(first);
  });

  it("returns an empty byTopic when there are no stumbles", () => {
    const view = computeCalibration([
      ...repeat(10, ans("confident", 1)),
      ...repeat(10, ans("guessed", 0)),
    ]);
    expect(view.overconfidentStumbles.count).toBe(0);
    expect(view.overconfidentStumbles.byTopic).toEqual([]);
  });
});

describe("computeCalibration — verdict", () => {
  it("returns a null verdict during cold-start", () => {
    expect(computeCalibration([]).verdict).toBeNull();
    expect(
      computeCalibration(repeat(MIN_RATED - 1, ans("confident", 1))).verdict
    ).toBeNull();
  });

  it("is well-calibrated when confident is mostly right and guesses mostly wrong", () => {
    // confident: 10/10 right (wrong-rate 0); guessed: 0/10 right.
    const view = computeCalibration([
      ...repeat(10, ans("confident", 1)),
      ...repeat(10, ans("guessed", 0)),
    ]);
    expect(view.state).toBe("ready");
    expect(view.verdict).toBe("well-calibrated");
  });

  it("is overconfident when the confident tier misses past the threshold", () => {
    // confident: 4/10 wrong → wrong-rate 0.4 >= OVERCONFIDENT_THRESHOLD; guesses wrong.
    expect(OVERCONFIDENT_THRESHOLD).toBeLessThanOrEqual(0.4);
    const view = computeCalibration([
      ...repeat(6, ans("confident", 1)),
      ...repeat(4, ans("confident", 0)),
      ...repeat(10, ans("guessed", 0)),
    ]);
    expect(view.verdict).toBe("overconfident");
  });

  it("is underconfident when guesses land right past the threshold", () => {
    // confident: all right; guessed: 6/10 right → correct-rate 0.6 >= UNDERCONFIDENT_THRESHOLD.
    expect(UNDERCONFIDENT_THRESHOLD).toBeLessThanOrEqual(0.6);
    const view = computeCalibration([
      ...repeat(10, ans("confident", 1)),
      ...repeat(6, ans("guessed", 1)),
      ...repeat(4, ans("guessed", 0)),
    ]);
    expect(view.verdict).toBe("underconfident");
  });

  it("is mixed when both confident misses and lucky guesses cross their thresholds", () => {
    const view = computeCalibration([
      ...repeat(6, ans("confident", 1)),
      ...repeat(4, ans("confident", 0)), // overconfident signal
      ...repeat(6, ans("guessed", 1)),
      ...repeat(4, ans("guessed", 0)), // underconfident signal
    ]);
    expect(view.verdict).toBe("mixed");
  });

  it("ignores a tier below the per-tier floor when deciding the verdict", () => {
    // 20 rated all in 'unsure'; confident & guessed are lowData → no signal → well-calibrated.
    const view = computeCalibration([
      ...repeat(10, ans("unsure", 1)),
      ...repeat(10, ans("unsure", 0)),
    ]);
    expect(view.state).toBe("ready");
    expect(view.tiers.find((t) => t.confidence === "confident")!.lowData).toBe(
      true
    );
    expect(view.verdict).toBe("well-calibrated");
  });
});
