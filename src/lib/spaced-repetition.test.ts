import { describe, it, expect } from "vitest";
import {
  computeConfidenceAdjustedQuality,
  computeNextReviewFromQuality,
} from "./spaced-repetition";

describe("computeConfidenceAdjustedQuality", () => {
  it("returns 0 for an empty answer set", () => {
    expect(computeConfidenceAdjustedQuality([])).toBe(0);
  });

  it("returns the base quality for a single unrated answer (no modulation)", () => {
    // ai_score 0.8 → scoreToQuality(80) = 4; confidence null → unchanged
    expect(
      computeConfidenceAdjustedQuality([{ ai_score: 0.8, confidence: null }]),
    ).toBe(4);
  });

  it("drives confident + wrong to 0 (overconfident stumble)", () => {
    // ai_score 0.4 (wrong), confident → 0 regardless of base
    expect(
      computeConfidenceAdjustedQuality([
        { ai_score: 0.4, confidence: "confident" },
      ]),
    ).toBe(0);
  });

  it("lifts confident + right to 5 (mastery), above its base", () => {
    // ai_score 0.8 → base 4; confident + right → 5
    expect(
      computeConfidenceAdjustedQuality([
        { ai_score: 0.8, confidence: "confident" },
      ]),
    ).toBe(5);
  });

  it("caps guessed + right at min(base, 3) (lucky guess)", () => {
    // ai_score 1.0 → base 5; guessed + right → 3
    expect(
      computeConfidenceAdjustedQuality([
        { ai_score: 1.0, confidence: "guessed" },
      ]),
    ).toBe(3);
  });

  it("leaves guessed + wrong at base (no double-punishment)", () => {
    // ai_score 0.4 → base 1; guessed + wrong → base
    expect(
      computeConfidenceAdjustedQuality([
        { ai_score: 0.4, confidence: "guessed" },
      ]),
    ).toBe(1);
  });

  it("averages per-answer base qualities for an unrated topic (matches Quiz)", () => {
    // ai_score 0.6 → base 2, ai_score 0.9 → base 5; avg(2,5)=3.5 → round 4.
    // Confirms the avg-of-qualities model (NOT quality-of-avg-score, which
    // would give scoreToQuality(75) = 3).
    expect(
      computeConfidenceAdjustedQuality([
        { ai_score: 0.6, confidence: null },
        { ai_score: 0.9, confidence: null },
      ]),
    ).toBe(4);
  });

  it("lets one overconfident stumble reset a small topic to a 1-day interval (ADR-0001)", () => {
    // 2-question topic: confident+wrong (→0) + unsure+correct (base 3).
    // avg(0,3)=1.5 → round 2 → quality < 3 → SM-2 resets the interval.
    const quality = computeConfidenceAdjustedQuality([
      { ai_score: 0.6, confidence: "confident" }, // wrong (<0.7), confident → 0
      { ai_score: 0.75, confidence: "unsure" }, // base 3, unchanged
    ]);
    expect(quality).toBe(2);

    const next = computeNextReviewFromQuality(quality, {
      intervalDays: 6,
      easeFactor: 2.5,
      reviewCount: 2,
    });
    expect(next.intervalDays).toBe(1);
  });
});
